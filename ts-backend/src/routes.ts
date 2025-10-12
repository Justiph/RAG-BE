// ts-backend/src/routes.ts
import { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { semanticChunking } from "./preprocess.js";
import { addChunks, similaritySearch } from "./vectorstore.js";
import { answerWithContext } from "./llm.js";
import type { RawBlock, IngestedChunk } from "./types.js";

const TOP_K = parseInt(process.env.TOP_K || "6", 10);
const extractorUrl = process.env.EXTRACTOR_URL || "http://localhost:7001";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

  app.get("/health", async () => ({ ok: true }));

  app.post("/api/upload", async (req, reply) => {
    const mp = await req.file();
    if (!mp || mp.mimetype !== "application/pdf") {
      return reply.status(400).send({ error: "Please upload a PDF file" });
    }

    const source = mp.filename?.replace(/\.pdf$/i, "") || `pdf-${Date.now()}`;
    const buf = await mp.toBuffer();

    // 1) call extractor
    const form = new FormData();
    // Node 20+ has Blob/FormData globally
    form.append("file", new Blob([new Uint8Array(buf)], { type: "application/pdf" }), mp.filename || "file.pdf");

    const res = await fetch(`${extractorUrl}/extract`, { method: "POST", body: form as any });
    if (!res.ok) {
      return reply.status(500).send({ error: "Extractor failed", code: res.status });
    }
    const data = (await res.json()) as { blocks: RawBlock[] };
    const blocks = data.blocks;

    // 2) semantic chunking + metadata
    const chunks = semanticChunking(blocks, source);
    if (chunks.length === 0) {
      return reply.status(400).send({ error: "No content extracted" });
    }

    // 3) index to Chroma (embed via python /embed)
    const toIndex: IngestedChunk[] = chunks.map((c) => ({
      id: c.id,
      text: c.text,
      metadata: c.metadata
    }));
    await addChunks(toIndex);

    return reply.send({ indexed: chunks.length, source });
  });

  app.post("/api/query", async (req, reply) => {
    const schema = z.object({ question: z.string().min(1) });
    const parse = schema.safeParse(await req.body);
    if (!parse.success) {
      return reply.status(400).send({ error: "Invalid body", details: parse.error.issues });
    }

    const { question } = parse.data;
    const hits = await similaritySearch(question, TOP_K);

    const res = await answerWithContext(
      question,
      hits.map((h) => ({ text: h.text, metadata: h.metadata }))
    );

    return reply.send({
      answer: res.answer,
      citations: hits.map((h, i) => ({
        doc: i + 1,
        metadata: h.metadata,
        distance: h.distance
      }))
    });
  });
}
