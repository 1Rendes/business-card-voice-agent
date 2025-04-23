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
    input: input,
    model: 'text-embedding-3-small',
  });
  return response;
}

export const retrieverTool = {
  retrieveInformationFromDocuments: {
    description:
      "retrieve different information in database for additional context. If you perform this function, say 'Let me check the information' before in conversation's language.",
    parameters: z.object({
      query: z.string().describe('user query to search in database'),
    }),
    execute: async ({ query: userQuery }: { query: string }) => {
      console.log('query: ', userQuery);
      const embeddenQuery = await createEmbeddings(userQuery);

      const queryVectors = embeddenQuery.data[0].embedding;
      try {
        const result = await index.query({ topK: 3, vector: queryVectors, includeMetadata: true });
        console.log('result: ', result.matches[0].metadata);
        const response = result.matches[0].metadata;
        if (response) return response.text as string;
      } catch (error) {
        console.log('error: ', error);
      }
    },
  },
};
