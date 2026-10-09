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

// eval-rag uses its own namespace so it doesn't touch the real docs
export function getIndex() {
  const index = getPinecone().index({
    name: process.env.PINECONE_INDEX!,
  });
  const namespace = process.env.PINECONE_NAMESPACE;

  return namespace ? index.namespace(namespace) : index;
}
