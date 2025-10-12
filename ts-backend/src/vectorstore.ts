// ts-backend/src/vectorstore.ts
import { ChromaClient, type Collection } from "chromadb";
import { embedOne, embedTexts } from "./embeddings.js";
import type { IngestedChunk } from "./types.js";

const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";
const DEFAULT_COLLECTION = process.env.COLLECTION_NAME || "papers";

const client = new ChromaClient({ path: CHROMA_URL });

export async function getOrCreateCollection(
  name: string = DEFAULT_COLLECTION
): Promise<Collection> {
  try {
    return await client.getCollection({ name, embeddingFunction: undefined as any });
  } catch {
    return await client.createCollection({ name });
  }
}

export async function addChunks(
  chunks: IngestedChunk[],
  collectionName: string = DEFAULT_COLLECTION
) {
  const collection = await getOrCreateCollection(collectionName);
  const ids = chunks.map((c) => c.id);
  const docs = chunks.map((c) => c.text);
  const metas = chunks.map((c) => c.metadata || {});
  const vectors = await embedTexts(docs);
  await collection.add({ ids, documents: docs, metadatas: metas, embeddings: vectors });
}

export async function similaritySearch(
  question: string,
  topK: number
): Promise<{ text: string; metadata: Record<string, any>; distance?: number }[]> {
  const collection = await getOrCreateCollection(DEFAULT_COLLECTION);
  const qvec = await embedOne(question);
  const result = await collection.query({
    queryEmbeddings: [qvec],
    nResults: topK
  });

  const docs = result.documents?.[0] || [];
  const metas = result.metadatas?.[0] || [];
  const dists = result.distances?.[0] || [];

  return docs.map((text: string | null, i: number) => ({
    text: text || "",
    metadata: metas[i] || {},
    distance: dists[i]
  }));
}
