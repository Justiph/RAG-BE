// ts-backend/src/llm.ts
import OpenAI from "openai";
import type { QueryResult } from "./types.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-4o-mini";

export async function answerWithContext(
  question: string,
  contexts: { text: string; metadata?: Record<string, any> }[]
): Promise<QueryResult> {
  const contextBlock = contexts
    .map((c, i) => {
      const sec = c.metadata?.section ? ` [Section: ${c.metadata.section}]` : "";
      const pages =
        c.metadata?.page_start && c.metadata?.page_end
          ? ` [Pages: ${c.metadata.page_start}-${c.metadata.page_end}]`
          : "";
      const type = c.metadata?.type ? ` [Type: ${c.metadata.type}]` : "";
      return `[[DOC ${i + 1}]]${sec}${pages}${type}\n${c.text}`;
    })
    .join("\n\n");

  const system = `You are a careful RAG assistant.
Use ONLY the provided context to answer.
Always cite like [DOC i]. If answer is not in context, say "I don't know" briefly.`;

  const user = `Question: ${question}

Context:
${contextBlock}`;

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2
  });

  const answer = completion.choices[0]?.message?.content?.trim() || "";

  return {
    answer,
    contexts: contexts.map((c) => ({ text: c.text, metadata: c.metadata }))
  };
}
