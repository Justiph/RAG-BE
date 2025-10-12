// ts-backend/src/embeddings.ts
import OpenAI from "openai";

const provider = (process.env.EMBEDDING_PROVIDER || "python").toLowerCase();
const extractorUrl = process.env.EXTRACTOR_URL || "http://localhost:7001";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const OPENAI_EMBED = "text-embedding-3-large";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (provider === "python") {
    const res = await fetch(`${extractorUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts })
    });
    if (!res.ok) {
      throw new Error(`Embed service error: ${res.status}`);
    }
    const data = await res.json();
    return data.embeddings as number[][];
  }
  // Fallback: OpenAI embeddings
  const r = await openai.embeddings.create({ model: OPENAI_EMBED, input: texts });
  return r.data.map((d) => d.embedding as number[]);
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
