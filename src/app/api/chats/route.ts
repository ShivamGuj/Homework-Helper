import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';

interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  id?: string | null;
}

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Extract user info from session with proper typing
    const sessionUser = session.user as SessionUser;
    
    // Get userId - try different approaches
    let userId = sessionUser.id;
    
    await connectDB();
    
    // If userId doesn't exist in session, look up user by email
    if (!userId && sessionUser.email) {
      try {
        // Find user by email
        const user = await User.findOne({ email: sessionUser.email });
        if (user) {
          userId = user._id.toString();
          console.log('Found userId by email lookup for chats API:', userId);
        } else {
          return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
      } catch (error) {
        console.error('Error looking up user by email:', error);
        return NextResponse.json(
          { message: 'Failed to find user', details: (error instanceof Error ? error.message : 'Unknown error') },
          { status: 500 }
        );
      }
    }
    
    if (!userId) {
      console.error('Unable to determine userId from session for chats API:', session.user);
      return NextResponse.json({ message: 'User identification failed' }, { status: 400 });
    }

    // Fetch all chats for the user
    const chats = await Chat.find({ userId }).sort({ updatedAt: -1 });
    console.log(`Found ${chats.length} chats for userId:`, userId);
    
    return NextResponse.json({ chats });
  } catch (error) {
    console.error('Chats API error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch chats', details: (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
