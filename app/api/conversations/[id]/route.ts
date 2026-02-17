import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const conversation = await Conversation.findOne({
      _id: params.id,
      userId: session.user.dbId,
      isActive: true,
    }).lean();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: conversation._id.toString(),
      title: conversation.title,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error: any) {
    console.error('Conversation detail API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
