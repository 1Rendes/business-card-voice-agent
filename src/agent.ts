import { type JobContext, ServerOptions, cli, defineAgent, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import dotenv from 'dotenv';
import type { PushOperator } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { initMongoConnection } from './db/initMongo.js';
import { retrieverTool } from './tools/retrieverTool.js';
import { systemInstructions } from './context/systemInstructions.js';

dotenv.config();

export const mongoClient = await initMongoConnection();

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const db = mongoClient.db();
    const voiceChatMessages = db.collection('voiceChatMessages');

    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    console.log(
      `starting assistant for ${participant.identity} in room ${ctx.room.name}`,
    );

    const metadata = JSON.parse(participant.info.metadata || '{}');
    const language = (() => {
      switch (metadata.language) {
        case 'ua': return 'Ukrainian';
        case 'en': return 'English';
        case 'de': return 'German';
        default: return 'English';
      }
    })();

    const chatId = uuidv4();
    const threadId = { userId: participant.identity, chatId };

    const addMessagesToDb = async ({ type, content }: { type: string; content: string }) => {
      await voiceChatMessages.updateOne(
        { 'thread_id.userId': threadId.userId, 'thread_id.chatId': threadId.chatId },
        {
          $push: { messages: { type, content } } as PushOperator<Document>,
        },
        { upsert: true },
      );
    };

    const agent = new voice.Agent({
      instructions: `${systemInstructions}. User's language is ${language || 'English'}`,
      tools: { retrieveInformationFromDocuments: retrieverTool },
    });

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        model: 'gpt-realtime-1.5',
      }),
    });

    await session.start({ agent, room: ctx.room });

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, async (ev) => {
      if (ev.isFinal) {
        await addMessagesToDb({ type: 'outgoing', content: ev.transcript });
      }
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, async (ev) => {
      const item = ev.item;
      if ('role' in item && item.role === 'assistant' && 'textContent' in item) {
        const text = item.textContent;
        if (text) {
          await addMessagesToDb({ type: 'incoming', content: text });
        }
      }
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
