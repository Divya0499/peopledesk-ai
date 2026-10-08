import { Pinecone } from "@pinecone-database/pinecone";

let client: Pinecone | undefined;

// Created on first use rather than at import, so a missing API key fails
// the request that needs Pinecone instead of every route that imports it
function getPinecone() {
  client ??= new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  return client;
}

export function getIndex() {
  return getPinecone().index({
    name: process.env.PINECONE_INDEX!,
  });
}
