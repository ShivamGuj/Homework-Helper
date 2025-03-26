import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const chatId = params.chatId;
    if (!chatId) {
      return NextResponse.json({ message: 'Chat ID is required' }, { status: 400 });
    }

    await connectDB();

    // Find the existing chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Check if hints are already used up
    if (chat.hintsUsed >= 2) {
      return NextResponse.json({ 
        message: 'Maximum hints already used for this chat',
        chat 
      }, { status: 400 });
    }

    // Create the model with the correct version
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
    });

    // Get the user's original question
    const userQuestion = chat.messages[0].content;

    // Prepare the follow-up hint instruction with word limit and LaTeX formatting
    const hintInstruction = "You are a homework helper providing a follow-up hint. Since this is the second hint, provide a more detailed explanation that helps the student understand the core concepts needed to solve the problem, but still leave the final solution for them to discover. YOUR HINT MUST BE UNDER 200 WORDS TOTAL.";
    
    // Create enhanced prompt with formatting instructions
    const enhancedPrompt = `${hintInstruction}\n\nOriginal Problem: ${userQuestion}\n\n
    When your answer includes mathematical expressions or equations, use proper LaTeX formatting with $ for inline math and $$ for display math. Make your response visually clear and well-formatted.\n\n
    This is my second hint request, so please provide more guidance than before (under 200 words), but still let me solve it on my own.`;

    // Map previous messages to the format expected by the API
    const chatHistory = chat.messages.map((message: any) => ({
      role: message.role === "user" ? "user" : "model",
      parts: [{ text: message.content }],
    }));

    // Configure the chat
    const chatConfig = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.7,
      },
    });

    // Send the message and get the response
    const result = await chatConfig.sendMessage(enhancedPrompt);
    const response = await result.response;
    const aiResponse = response.text();

    // Check if response is too long and trim if necessary
    let processedResponse = aiResponse;
    
    // Simple word count (approximate)
    const wordCount = aiResponse.split(/\s+/).length;
    
    if (wordCount > 200) {
      console.log("Second hint exceeded word limit:", wordCount, "words. Truncating...");
      // This is a simplistic approach - in a real implementation, you might want to
      // truncate at sentence boundaries or ensure LaTeX formulas aren't broken
      const words = aiResponse.split(/\s+/).slice(0, 200);
      processedResponse = words.join(' ') + "...";
    }

    // Update the chat with the new hint
    chat.messages.push(
      { role: 'user', content: 'I need another hint for this problem.' },
      { role: 'assistant', content: processedResponse }
    );
    chat.hintsUsed += 1;
    
    // If this was the second hint, mark the chat as completed
    if (chat.hintsUsed >= 2) {
      chat.isCompleted = true;
    }
    
    await chat.save();

    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Hint API error:', error);
    return NextResponse.json(
      { message: 'Failed to get another hint', details: (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
