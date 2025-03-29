import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Initialize Gemini API with proper error handling
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

interface ResourceResult {
  topic: string;
  links: {
    title: string;
    url: string;
    snippet?: string;
  }[];
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    let content = '';
    try {
      const body = await request.json();
      content = body.content || '';
    } catch (error) {
      console.error('Error parsing request body:', error);
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: 'No content provided' },
        { status: 400 }
      );
    }

    console.log('Processing resource request for content:', content.substring(0, 100) + '...');

    // Create a Gemini model instance - using the same model as the hint system
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Update the prompt to ask for more direct, focused resources
    const prompt = `I'm trying to understand the following homework problem or topic better:

"${content}"

Please provide 3-4 educational resources that would help me learn the fundamental concepts needed to understand this topic. For each resource:

1. Group resources by clear, specific subject topics (like "Trigonometric Equations", "Linear Algebra", etc.)
2. Provide actual working URLs to reliable educational websites
3. Keep it simple and direct - just resource names and links

Format your response as a JSON array following this structure exactly:
[
  {
    "topic": "Specific Subject Topic Name (be very specific)",
    "links": [
      {
        "title": "Resource Name (short and descriptive)",
        "url": "https://specific-working-url.com/specific-page"
      }
    ]
  }
]

Ensure all URLs are working and point directly to educational content relevant to the topic.`;

    // Generate response from Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Raw Gemini response:', text.substring(0, 500) + '...');
    
    // Parse the JSON response with better error handling
    let resources: ResourceResult[] = [];
    try {
      // Find JSON in the response (in case there's text before or after)
      // Use a regular expression compatible with older ECMAScript versions
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      
      if (jsonMatch) {
        resources = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
      
      console.log('Parsed resources:', resources);
      
      // Validate the structure
      if (!Array.isArray(resources) || resources.length === 0) {
        throw new Error('Invalid resources structure');
      }
      
      // Ensure each resource has the required fields
      resources = resources.filter(resource => 
        resource && 
        typeof resource === 'object' && 
        typeof resource.topic === 'string' && 
        Array.isArray(resource.links) &&
        resource.links.every(link => 
          typeof link === 'object' && 
          typeof link.title === 'string' && 
          typeof link.url === 'string' &&
          link.url.startsWith('http')
        )
      );
      
      if (resources.length === 0) {
        throw new Error('No valid resources after filtering');
      }
    } catch (e) {
      console.error('Error parsing Gemini response:', e, text);
      
      // Fallback resources if parsing fails - now more educational and diverse
      resources = [{
        topic: "General Learning Resources",
        links: [
          {
            title: "Khan Academy",
            url: "https://www.khanacademy.org/",
            snippet: "Free personalized learning resources for all subjects including math, science, and more."
          },
          {
            title: "MIT OpenCourseWare",
            url: "https://ocw.mit.edu/",
            snippet: "Free access to MIT course materials across a wide range of subjects."
          },
          {
            title: "Brilliant.org",
            url: "https://brilliant.org/",
            snippet: "Interactive courses on math, science, and computer science with problem-solving focus."
          },
          {
            title: "Paul's Online Math Notes",
            url: "https://tutorial.math.lamar.edu/",
            snippet: "Free and comprehensive math notes and tutorials from algebra to calculus."
          }
        ]
      }];
    }

    return NextResponse.json({ resources });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
