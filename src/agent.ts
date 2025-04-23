import { type JobContext, WorkerOptions, cli, defineAgent, llm, multimodal } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import dotenv from 'dotenv';
import type { PushOperator } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { initMongoConnection } from './db/initMongo.js';
import { retrieverTool } from './tools/retrieverTool.js';

dotenv.config();

export const mongoClient = await initMongoConnection();

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const db = mongoClient.db();
    const voiceChatMessages = db.collection('voiceChatMessages');

    await ctx.connect();
    console.log('waiting for participant');
    const participant = await ctx.waitForParticipant();
    console.log(
      `starting assistant example agent for ${participant.identity} to room ${ctx.room.name}`,
    );

    const model = new openai.realtime.RealtimeModel({
      instructions: 'Your are a helpful assistant',
    });
    const fncCtx: llm.FunctionContext = {
      ...retrieverTool,
    };
    const agent = new multimodal.MultimodalAgent({ model, fncCtx });
    const sessionAndChatData = await agent.start(ctx.room, participant).then((session) => {
      const chatId = uuidv4();
      const threadId = { userId: participant.identity, chatId };
      return { threadId, session: session as openai.realtime.RealtimeSession };
    });
    const session = sessionAndChatData.session;
    const threadId = sessionAndChatData.threadId;
    const addMessagesToDb = async ({ type, content }: { type: string; content: string }) => {
      await voiceChatMessages.updateOne(
        { 'thread_id.userId': threadId.userId, 'thread_id.chatId': threadId.chatId },
        {
          $push: {
            messages: {
              type,
              content,
            },
          } as PushOperator<Document>,
        },
        { upsert: true },
      );
    };
    session.addListener('input_speech_transcription_completed', async (data) => {
      addMessagesToDb({ type: 'outgoing', content: data.transcript });
    });
    session.addListener('response_content_done', async (data) => {
      addMessagesToDb({ type: 'incoming', content: data.text });
    });
    session.conversation.item.create(
      llm.ChatMessage.create({
        role: llm.ChatRole.ASSISTANT,
        text: 'How can i assist you today?',
      }),
    );
    session.response.create();
  },
});

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    host: '0.0.0.0',
    initializeProcessTimeout: 50000,
  }),
);
