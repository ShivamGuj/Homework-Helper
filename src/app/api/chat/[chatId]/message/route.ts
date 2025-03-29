export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';

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

    const body = await request.json();
    if (!body || !body.content || !body.role) {
      return NextResponse.json({ message: 'Message content and role are required' }, { status: 400 });
    }

    await connectDB();

    // Find the existing chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Add the message to the chat with proper metadata
    chat.messages.push({
      role: body.role,
      content: body.content,
      isResource: body.isResource || false, // Flag to identify resource messages
      timestamp: new Date()
    });
    
    // If this is a resource message, mark it in the chat document
    if (body.isResource) {
      chat.hasResources = true;
    }
    
    await chat.save();

    return NextResponse.json({ 
      message: 'Message added successfully',
      chat: chat 
    });
  } catch (error) {
    console.error('Error adding message to chat:', error);
    return NextResponse.json(
      { message: 'Failed to add message', details: (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
