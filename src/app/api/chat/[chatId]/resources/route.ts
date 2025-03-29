import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // Return mock resources for testing
    const mockResources = [
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
