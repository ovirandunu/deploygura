import { Configuration, OpenAIApi } from 'openai-edge';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { db } from '@/lib/db';
import { chats, messages as _messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { Message } from 'ai/react';
import { getContext } from '@/lib/context';

export const runtime = 'edge';

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(config);

export async function POST(req: Request) {
  try {
    const { messages, chatId } = await req.json();
    const _chats = await db.select().from(chats).where(eq(chats.id, chatId));
    if (_chats.length != 1) {
      return NextResponse.json({ error: 'chat not found' }, { status: 404 });
    }
    const fileKey = _chats[0].fileKey;
    const lastMessage = messages[messages.length - 1];
    const context = await getContext(lastMessage.content, fileKey);

    const prompt = {
      role: 'system',
      content: `You are an AI assistant that helps users find information in a document.
        Answer based on this context block which contains vectors relevant to the users query:
        START OF DOCUMENT
        ${context}
        END OF DOCUMENT
        The AI takes into account any DOCUMENT provided, ensuring responses are tailored to the specific content and queries of the user.
        Answer with only the relevant information to the user's query.
        If the AI cannot find an answer within the document, it will respond accordingly and guide users on how to find the information they need.
        `,
    };

    console.log(prompt);
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        prompt,
        ...messages.filter((message: Message) => messages.role === 'user'),
      ],
      stream: true,
    });

    const stream = OpenAIStream(response, {
      onStart: async () => {
        //save user message into db
        await db.insert(_messages).values({
          chatId,
          content: lastMessage.content,
          role: 'user'
        });
      },
      onCompletion: async (completion) => {
        //sace ai message into db
        await db.insert(_messages).values({
          chatId,
          content: completion,
          role: 'system'
        });
      },
    });

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error(error);
  }
}
