import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import NextAuth from 'next-auth';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Define resource types
interface ResourceLink {
  title: string;
  url: string;
  snippet: string;
}

interface Resource {
  topic: string;
  links: ResourceLink[];
}

export async function GET(request: NextRequest) {
  try {
    // Return mock resources for testing
    const mockResources: Resource[] = [
      {
        topic: "Mathematics",
        links: [
          {
            title: "Khan Academy - Math",
            url: "https://www.khanacademy.org/math",
            snippet: "Free world-class education in mathematics."
          },
          {
            title: "Wolfram Alpha",
            url: "https://www.wolframalpha.com",
            snippet: "Computational intelligence for math problems."
          }
        ]
      },
      {
        topic: "Study Resources",
        links: [
          {
            title: "YouTube Educational Videos",
            url: "https://www.youtube.com/results?search_query=educational+math",
            snippet: "Video tutorials explaining various concepts."
          }
        ]
      }
    ];
    
    return NextResponse.json({ resources: mockResources });
  } catch (error) {
    console.error('Error getting resources:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session to authenticate user
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Get request body
    const body = await request.json();
    const { chatId, messages } = body;

    if (!chatId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Find user by email
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find chat by ID and ensure it belongs to the user
    const chat = await Chat.findOne({ _id: chatId, userId: user._id });
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    try {
      // Extract the user's question from the messages
      const userMessages = messages.filter(msg => msg.role === 'user');
      const userQuestion = userMessages.length > 0 ? userMessages[0].content : '';
      
      if (!userQuestion) {
        return NextResponse.json({ error: 'No question found' }, { status: 400 });
      }

      console.log('Generating resources for question:', userQuestion.substring(0, 100) + '...');
      
      // Check if Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.error('GOOGLE_API_KEY is not defined in environment variables');
        
        // Use fallback resources instead of returning an error
        console.log('Using fallback resources due to missing API key');
        
        // Generate more specific fallback resources based on question content
        const resourcesMessage = {
          role: 'assistant',
          content: generateFallbackResources(userQuestion)
        };

        chat.messages.push(resourcesMessage);
        chat.resourcesShown = true;
        await chat.save();

        return NextResponse.json({ 
          success: true,
          chat: chat.toObject(),
          note: 'Used fallback resources due to missing API key'
        });
      }
      
      // Use a try-catch block specifically for the Google API call
      try {
        // Use Google to generate relevant resources
        // Check if we're using the correct model name
        const model = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash",  // Updated to use a more recent model
          generationConfig: {
            temperature: 0.2,  // Lower temperature for more focused results
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
          }
        });
        
        // Create a more specific prompt to generate problem-relevant resources
        const prompt = `
        You are an expert educational resource finder for students.
        
        The student has asked this SPECIFIC homework question: "${userQuestion.substring(0, 500)}"
        
        Your task: Find 5-7 educational resources that will help THIS SPECIFIC STUDENT solve THIS EXACT PROBLEM.
        
        IMPORTANT INSTRUCTIONS:
        1. Analyze the specific topics and concepts in the question
        2. For EACH specific concept, find 1-2 educational resources that teach exactly that concept
        3. Each resource MUST directly address a concept needed to solve this exact problem
        4. DO NOT provide general educational websites - every resource must be concept-specific
        5. For each resource, explain EXACTLY how it helps solve this specific homework problem
        
        Format your response EXACTLY as follows:
        
        ## Educational Resources for Your Problem
        
        ### [Specific Concept #1 from the Question]
        - **[Resource Title with Exact Topic](URL)** - Explanation of how this resource helps solve the specific problem.
        - **[Another Resource for Concept #1](URL)** - Explanation of how it helps.
        
        ### [Specific Concept #2 from the Question]
        - **[Resource Title with Exact Topic](URL)** - Explanation of how this resource helps solve the specific problem.
        
        Think step-by-step:
        1. What exact concepts does the student need to understand?
        2. What specific resources teach those exact concepts?
        3. How does each resource directly help solve this specific problem?
        
        Example: If the question is about quadratic equations, find resources specifically about solving quadratic equations, not general algebra websites.
        `;
        
        console.log('Sending prompt to Google API');
        const result = await model.generateContent(prompt);
        console.log('Received response from Google API');
        
        const response = await result.response;
        const resourcesContent = response.text();
        console.log('Resources content length:', resourcesContent.length);
        
        // Check if the content is valid and contains resources
        if (!resourcesContent || resourcesContent.trim() === '' || !resourcesContent.includes('Educational Resources')) {
          console.warn('Google API returned invalid content, using targeted resources');
          
          // Use a more targeted approach for this specific question
          const questionAnalysis = await analyzeQuestion(model, userQuestion);
          const targetedResources = await generateTargetedResources(model, questionAnalysis);
          
          // Add resources message to the chat with targeted content
          const resourcesMessage = {
            role: 'assistant',
            content: targetedResources
          };
          
          chat.messages.push(resourcesMessage);
          chat.resourcesShown = true;
          await chat.save();
          
          return NextResponse.json({ 
            success: true,
            chat: chat.toObject(),
            note: 'Used targeted resources'
          });
        }
        
        // Add resources message to the chat
        const resourcesMessage = {
          role: 'assistant',
          content: resourcesContent
        };
        
        chat.messages.push(resourcesMessage);
        chat.resourcesShown = true;
        await chat.save();
        
        return NextResponse.json({
          success: true,
          chat: chat.toObject()
        });
      } catch (googleError) {
        console.error('Google API error:', googleError);
        
        // Only use fallback resources as a last resort when the API completely fails
        try {
          // Try one more time with a different approach
          const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
              temperature: 0.3,
              topP: 0.9,
              maxOutputTokens: 2048,
            }
          });
          
          // Simplified prompt as a fallback
          const fallbackPrompt = `
          For this homework question: "${userQuestion.substring(0, 300)}"
          
          List 5 specific educational resources (with URLs) that directly help solve this exact problem.
          Format as markdown with headings for specific concepts and bullet points for resources.
          Each resource must be about a concept needed to solve this specific problem.
          `;
          
          const fallbackResult = await model.generateContent(fallbackPrompt);
          const fallbackResponse = await fallbackResult.response;
          const fallbackContent = fallbackResponse.text();
          
          if (fallbackContent && fallbackContent.trim() !== '') {
            // Format the content properly
            const formattedContent = `## Educational Resources for Your Problem\n\n${fallbackContent}`;
            
            const resourcesMessage = {
              role: 'assistant',
              content: formattedContent
            };
            
            chat.messages.push(resourcesMessage);
            chat.resourcesShown = true;
            await chat.save();
            
            return NextResponse.json({ 
              success: true,
              chat: chat.toObject(),
              note: 'Used fallback approach'
            });
          }
        } catch (fallbackError) {
          console.error('Fallback approach also failed:', fallbackError);
        }
        
        // If all else fails, use generic subject-based resources
        const resourcesMessage = {
          role: 'assistant',
          content: generateFallbackResources(userQuestion)
        };
        
        chat.messages.push(resourcesMessage);
        chat.resourcesShown = true;
        await chat.save();
        
        return NextResponse.json({ 
          success: true,
          chat: chat.toObject(),
          note: 'Used generic fallback resources'
        });
      }
    } catch (error) {
      console.error('Error generating resources:', error);
      return NextResponse.json({ error: 'Error generating resources' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error generating resources:', error);
    return NextResponse.json({ error: 'Error generating resources' }, { status: 500 });
  }
}

// Function to analyze the question and identify key concepts
async function analyzeQuestion(model: any, question: string): Promise<string> {
  try {
    const analysisPrompt = `
    Analyze this SPECIFIC homework question: "${question.substring(0, 300)}"
    
    Identify the EXACT concepts and skills the student needs to solve this problem.
    
    Format your response as a comma-separated list of:
    1. The main subject (e.g., calculus, organic chemistry, European history)
    2. The specific sub-topics (e.g., integration by parts, alkene reactions, French Revolution)
    3. The exact concepts needed to solve this problem
    4. The specific techniques or formulas required
    
    BE EXTREMELY SPECIFIC to this exact problem - no generic topics.
    `;
    
    const analysisResult = await model.generateContent(analysisPrompt);
    const analysisResponse = await analysisResult.response;
    return analysisResponse.text();
  } catch (error) {
    console.error('Error analyzing question:', error);
    return question; // Return the original question if analysis fails
  }
}

// Function to generate targeted resources based on question analysis
async function generateTargetedResources(model: any, questionAnalysis: string): Promise<string> {
  try {
    const resourcesPrompt = `
    Based on this analysis of a homework question: "${questionAnalysis}"
    
    Generate 5-7 HIGHLY SPECIFIC educational resources that directly address these exact concepts.
    
    Each resource must:
    1. Address a specific concept from the analysis
    2. Contain direct, step-by-step instructions for solving problems like this
    3. Be from a reputable, free educational source
    4. Include an explanation of how it specifically helps solve this exact problem
    
    Format your response EXACTLY as follows:
    
    ## Educational Resources for Your Problem
    
    ### [Specific Concept from Analysis]
    - **[Resource Title with Exact Topic](URL)** - Detailed explanation of how this resource helps solve the specific problem.
    
    ### [Another Specific Concept from Analysis]
    - **[Resource Title with Exact Topic](URL)** - Detailed explanation of how this resource helps solve the specific problem.
    
    DO NOT include generic educational websites. Each resource must directly address a concept needed for THIS SPECIFIC problem.
    `;
    
    const resourcesResult = await model.generateContent(resourcesPrompt);
    const resourcesResponse = await resourcesResult.response;
    return resourcesResponse.text();
  } catch (error) {
    console.error('Error generating targeted resources:', error);
    return generateFallbackResources(questionAnalysis); // Use fallback as last resort
  }
}

// Function to generate more targeted fallback resources based on question content
function generateFallbackResources(question: string): string {
  // Convert question to lowercase for easier matching
  const lowerQuestion = question.toLowerCase();
  
  // Check for math-related keywords
  const mathKeywords = ['equation', 'solve', 'calculate', 'math', 'algebra', 'geometry', 'calculus', 
    'trigonometry', 'function', 'graph', 'number', 'polynomial', 'factor', 'derivative', 'integral',
    'arithmetic', 'sequence', 'series', 'probability', 'statistics'];
  
  // Check for science-related keywords
  const scienceKeywords = ['physics', 'chemistry', 'biology', 'science', 'experiment', 'lab', 
    'molecule', 'atom', 'cell', 'force', 'energy', 'reaction', 'organism', 'ecosystem',
    'gravity', 'motion', 'velocity', 'acceleration', 'mass', 'volume'];
  
  // Check for history-related keywords
  const historyKeywords = ['history', 'war', 'revolution', 'century', 'ancient', 'medieval', 
    'civilization', 'empire', 'king', 'queen', 'president', 'government', 'nation', 'country',
    'timeline', 'era', 'period', 'historical'];
  
  // Check for literature-related keywords
  const literatureKeywords = ['literature', 'book', 'novel', 'poem', 'poetry', 'author', 'writer',
    'character', 'plot', 'theme', 'essay', 'analysis', 'shakespeare', 'fiction', 'nonfiction',
    'literary', 'narrative', 'story'];
  
  // Count matches for each category
  const mathCount = mathKeywords.filter(keyword => lowerQuestion.includes(keyword)).length;
  const scienceCount = scienceKeywords.filter(keyword => lowerQuestion.includes(keyword)).length;
  const historyCount = historyKeywords.filter(keyword => lowerQuestion.includes(keyword)).length;
  const literatureCount = literatureKeywords.filter(keyword => lowerQuestion.includes(keyword)).length;
  
  // Determine primary and secondary categories
  const counts = [
    { category: 'Mathematics', count: mathCount },
    { category: 'Science', count: scienceCount },
    { category: 'History', count: historyCount },
    { category: 'Literature', count: literatureCount }
  ];
  
  // Sort by count in descending order
  counts.sort((a, b) => b.count - a.count);
  
  // Generate resources based on the top categories
  let resources = `## Educational Resources for Your Problem\n\n`;
  
  // Add math resources if relevant
  if (counts[0].category === 'Mathematics' || counts[1]?.category === 'Mathematics') {
    resources += `### Mathematics Concepts\n`;
    resources += `- **[Khan Academy - Algebra](https://www.khanacademy.org/math/algebra)** - Comprehensive lessons on solving equations and understanding algebraic concepts.\n`;
    resources += `- **[Paul's Online Math Notes](https://tutorial.math.lamar.edu)** - Detailed explanations of calculus, algebra, and differential equations with examples.\n`;
    resources += `- **[Wolfram Alpha](https://www.wolframalpha.com)** - Step-by-step solutions for various math problems and equations.\n\n`;
  }
  
  // Add science resources if relevant
  if (counts[0].category === 'Science' || counts[1]?.category === 'Science') {
    resources += `### Science Concepts\n`;
    resources += `- **[Khan Academy - Physics](https://www.khanacademy.org/science/physics)** - Detailed explanations of physics concepts with practice problems.\n`;
    resources += `- **[PhET Interactive Simulations](https://phet.colorado.edu)** - Visual simulations to understand scientific concepts interactively.\n`;
    resources += `- **[Crash Course Chemistry](https://www.youtube.com/playlist?list=PL8dPuuaLjXtPHzzYuWy6fYEaX9mQQ8oGr)** - Engaging video explanations of chemistry concepts.\n\n`;
  }
  
  // Add history resources if relevant
  if (counts[0].category === 'History' || counts[1]?.category === 'History') {
    resources += `### Historical Context\n`;
    resources += `- **[Khan Academy - World History](https://www.khanacademy.org/humanities/world-history)** - Comprehensive overview of world history periods and events.\n`;
    resources += `- **[Crash Course History](https://www.youtube.com/playlist?list=PL8dPuuaLjXtMwmepBjTSG593eG7ObzO7s)** - Engaging videos explaining historical events and their significance.\n`;
    resources += `- **[History.com](https://www.history.com/)** - Articles and resources about key historical events and figures.\n\n`;
  }
  
  // Add literature resources if relevant
  if (counts[0].category === 'Literature' || counts[1]?.category === 'Literature') {
    resources += `### Literary Analysis\n`;
    resources += `- **[SparkNotes](https://www.sparknotes.com/)** - Summaries and analyses of major literary works.\n`;
    resources += `- **[Purdue OWL](https://owl.purdue.edu/owl/subject_specific_writing/writing_in_literature/index.html)** - Guides for literary analysis and writing about literature.\n`;
    resources += `- **[LitCharts](https://www.litcharts.com/)** - Detailed analysis of themes, characters, and symbols in literary works.\n\n`;
  }
  
  // Always add general learning resources
  resources += `### General Learning Resources\n`;
  resources += `- **[Coursera](https://www.coursera.org/courses?query=free)** - Free courses from top universities covering various subjects.\n`;
  resources += `- **[Quizlet](https://quizlet.com)** - Create flashcards and practice tests for effective studying.\n`;
  resources += `- **[YouTube EDU](https://www.youtube.com/education)** - Educational videos on virtually any academic topic.\n`;
  
  return resources;
}
