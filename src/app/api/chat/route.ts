export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User'; // Import User model
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Define a more complete user type
interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  id?: string | null;
}

export async function POST(req: Request) {
  try {
    // Log request details for debugging
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    console.log('Request method:', req.method);

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Extract user info from session with proper typing
    const sessionUser = session.user as SessionUser;
    console.log('Session user:', sessionUser);
    
    // Get userId - try different approaches
    let userId = sessionUser.id;
    
    // If userId doesn't exist in session, look up user by email
    if (!userId && sessionUser.email) {
      await connectDB();
      
      try {
        // Find user by email
        const user = await User.findOne({ email: sessionUser.email });
        if (user) {
          userId = user._id.toString();
          console.log('Found userId by email lookup:', userId);
        } else {
          // Create a new user if not found
          const newUser = await User.create({
            name: sessionUser.name || 'User',
            email: sessionUser.email,
            image: sessionUser.image || '',
          });
          userId = newUser._id.toString();
          console.log('Created new user with ID:', userId);
        }
      } catch (error) {
        console.error('Error looking up user by email:', error);
        return NextResponse.json(
          { message: 'Failed to find or create user', details: (error instanceof Error ? error.message : 'Unknown error') },
          { status: 500 }
        );
      }
    }
    
    if (!userId) {
      console.error('Unable to determine userId from session:', session.user);
      return NextResponse.json({ message: 'User identification failed' }, { status: 400 });
    }

    // Content type handling
    const contentType = req.headers.get('content-type') || '';
    let reqData;
    
    // Handle different content types
    if (contentType.includes('application/json')) {
      try {
        // Handle JSON content
        const clonedReq = req.clone();
        const rawText = await clonedReq.text();
        console.log('Raw JSON request body:', rawText);
        
        if (!rawText || rawText.trim() === '') {
          return NextResponse.json({ message: 'Empty request body' }, { status: 400 });
        }
        
        try {
          reqData = JSON.parse(rawText);
        } catch (parseError) {
          console.error('JSON parsing error details:', parseError);
          return NextResponse.json(
            { 
              message: 'Invalid JSON in request body', 
              details: (parseError instanceof Error ? parseError.message : 'Unknown error'),
              receivedBody: rawText.substring(0, 100)
            },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('Error reading JSON request:', error);
        return NextResponse.json(
          { message: 'Failed to read request body', details: (error instanceof Error ? error.message : 'Unknown error') },
          { status: 400 }
        );
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Handle form data
      try {
        const formData = await req.formData();
        console.log('Form data entries:', Array.from(formData.entries()));
        
        // Check if messages are passed as JSON string in a form field
        const messagesField = formData.get('messages');
        
        if (messagesField) {
          try {
            if (typeof messagesField === 'string') {
              reqData = { messages: JSON.parse(messagesField) };
            } else {
              reqData = { messages: messagesField };
            }
          } catch (parseError) {
            console.error('Error parsing messages from form data:', parseError);
            return NextResponse.json(
              { 
                message: 'Invalid messages format in form data', 
                details: (parseError instanceof Error ? parseError.message : 'Unknown error'),
                receivedValue: String(messagesField).substring(0, 100)
              },
              { status: 400 }
            );
          }
        } else {
          // Try to construct a messages object from individual form fields
          const message = formData.get('message');
          const chatId = formData.get('chatId');
          
          if (message) {
            reqData = { 
              messages: [{ 
                content: message.toString(),
                role: 'user',
                chatId: chatId ? chatId.toString() : undefined
              }] 
            };
          } else {
            return NextResponse.json(
              { message: 'No message found in form data' },
              { status: 400 }
            );
          }
        }
      } catch (error) {
        console.error('Error processing form data:', error);
        return NextResponse.json(
          { message: 'Failed to process form data', details: (error instanceof Error ? error.message : 'Unknown error') },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { message: `Unsupported content type: ${contentType}. Expected application/json or multipart/form-data` },
        { status: 400 }
      );
    }

    const { messages } = reqData || {};
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ 
        message: 'Invalid or missing messages in request',
        receivedData: JSON.stringify(reqData).substring(0, 100)
      }, { status: 400 });
    }

    await connectDB();

    let chat;
    const chatId = messages[0]?.chatId;
    if (chatId) {
      chat = await Chat.findById(chatId);
      if (!chat) {
        return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
      }
    }

    // Create the model with the correct version
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
    });

    // Determine if this is the first or second hint
    const isFirstHint = !chat || chat.hintsUsed === 0;
    
    // Prepare instruction as part of the prompt instead of as system message
    const hintInstruction = isFirstHint 
      ? "You are a homework helper that only provides small hints, not full solutions. Give a brief, subtle hint that points the student in the right direction without revealing too much. Your hint MUST be UNDER 100 CHARACTERS total - be very concise and brief."
      : "You are a homework helper providing a follow-up hint. Since this is the second hint, provide a more detailed explanation that helps the student understand the core concepts needed to solve the problem, but still leave the final solution for them to discover. Your hint MUST be UNDER 200 WORDS.";

    // Prepare the user message with instructions for hint creation
    let userPrompt = messages[messages.length - 1].content;
    
    // Create enhanced prompt that includes our instruction and the user's question
    let enhancedPrompt = `${hintInstruction}\n\nProblem: ${userPrompt}\n\n`;
    
    // Add formatting instructions for mathematical content
    enhancedPrompt += "When your answer includes mathematical expressions or equations, use proper LaTeX formatting with $ for inline math and $$ for display math. Make your response visually clear and well-formatted.\n\n";
    
    if (isFirstHint) {
      enhancedPrompt += "Please give me a very small, subtle hint (under 100 characters) that will guide me in the right direction without revealing too much.";
    } else {
      enhancedPrompt += "This is my second hint request, so please provide more guidance than before (under 200 words), but still let me solve it on my own.";
    }

    // Configure the chat with proper history structure
    // Only include previous messages if they exist
    const chatHistory = messages.slice(0, -1).map((message: any) => ({
      role: message.role === "user" ? "user" : "model",
      parts: [{ text: message.content }],
    }));

    const chatConfig = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.7,
      },
    });

    // Send the enhanced prompt as the user message
    const result = await chatConfig.sendMessage(enhancedPrompt);
    const response = await result.response;
    const aiResponse = response.text();

    // Before returning, check the response for excessive length and trim if necessary
    let processedResponse = aiResponse;
    
    if (isFirstHint && aiResponse.length > 100) {
      // If first hint is too long, truncate to 100 characters and add ellipsis
      processedResponse = aiResponse.substring(0, 97) + "...";
      console.log("First hint was too long, truncated from", aiResponse.length, "to 100 characters");
    }

    // When creating a new chat or updating existing chat, preserve hasResources flag
    if (!chat) {
      try {
        chat = await Chat.create({
          userId: userId,
          messages: [
            { role: 'user', content: messages[messages.length - 1].content },
            { role: 'assistant', content: processedResponse }
          ],
          hintsUsed: 1,
          hasResources: false
        });
        console.log('Created new chat with userId:', userId);
      } catch (error) {
        console.error('Error creating new chat:', error);
        if (error instanceof Error) {
          return NextResponse.json(
            { message: 'Failed to create new chat', details: error.message },
            { status: 500 }
          );
        }
        throw error;
      }
    } else {
      const hasResources = chat.hasResources || false; // Preserve existing hasResources value
      
      chat.messages.push(
        { role: 'user', content: messages[messages.length - 1].content },
        { role: 'assistant', content: processedResponse }
      );
      chat.hintsUsed += 1;
      if (chat.hintsUsed >= 2) {
        chat.isCompleted = true;
      }
      chat.hasResources = hasResources; // Make sure we don't reset the hasResources flag
      await chat.save();
    }

    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { message: 'Failed to process chat request', details: (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
