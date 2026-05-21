import { llm } from '@livekit/agents';
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';
import openai from 'openai';
import { z } from 'zod';

dotenv.config();

const openAI = new openai();
const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = client.index('business-card');

async function createEmbeddings(input: string | string[]) {
  const response = await openAI.embeddings.create({
    input,
    model: 'text-embedding-3-small',
  });
  return response;
}

export const retrieverTool = llm.tool({
  description:
    "Retrieve information about Volodymyr's projects and experience. If you perform this function, say 'Let me check the information' before in conversation's language.",
  parameters: z.object({
    query: z.string().describe('user query to search in database'),
  }),
  execute: async ({ query: userQuery }) => {
    console.log('query: ', userQuery);
    const embeddedQuery = await createEmbeddings(userQuery);
    const queryVectors = embeddedQuery.data[0].embedding;
    try {
      const result = await index.query({ topK: 5, vector: queryVectors, includeMetadata: true });
      const textContent = result.matches
        .map((m) => m.metadata)
        .filter((m): m is NonNullable<typeof m> => m != null)
        .map((m) => m.text || '')
        .filter(Boolean)
        .join('\n\n');
      console.log('textContent: ', textContent);
      return textContent || 'No relevant information found.';
    } catch (error) {
      console.log('error: ', error);
      return 'Error retrieving information.';
    }
  },
});
