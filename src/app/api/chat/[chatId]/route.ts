import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Chat from '@/models/Chat';

export async function DELETE(
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

    // Find and delete the chat
    const deletedChat = await Chat.findByIdAndDelete(chatId);
    
    if (!deletedChat) {
      return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json(
      { message: 'Failed to delete chat', details: (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
