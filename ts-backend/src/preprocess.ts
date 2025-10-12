// ts-backend/src/preprocess.ts
import type { RawBlock } from "./types.js";

export type Chunk = {
  id: string;
  text: string;
  metadata: {
    source: string;
    section?: string;
    page_start: number;
    page_end: number;
    type: "text" | "table" | "figure" | "equation";
    caption_html?: string;
  };
};

const MAX_TOKENS = parseInt(process.env.MAX_CHUNK_SIZE || "1000", 10);
const OVERLAP = parseInt(process.env.CHUNK_OVERLAP || "200", 10);
const estimateTokens = (s: string) => Math.ceil(s.length / 4);

export function semanticChunking(blocks: RawBlock[], source: string): Chunk[] {
  const chunks: Chunk[] = [];

  // 1) Keep atomic blocks
  for (const b of blocks) {
    if (["table", "figure", "equation"].includes(b.type)) {
      chunks.push({
        id: `${source}-${b.type}-${chunks.length}`,
        text: b.text,
        metadata: {
          source,
          section: b.section,
          page_start: b.page_number,
          page_end: b.page_number,
          type: b.type as any,
          caption_html: b.caption_html
        }
      });
    }
  }

  // 2) Group paragraphs by section
  const paras = blocks.filter((b) => b.type === "paragraph");
  const groups = groupParagraphsBySection(paras);

  for (const g of groups) {
    const { section, pages, text } = g;
    const tokens = text.split(/\s+/);
    let start = 0;

    while (start < tokens.length) {
      let end = start;
      let cur = "";
      while (end < tokens.length && estimateTokens(cur + " " + tokens[end]) <= MAX_TOKENS) {
        cur += (cur ? " " : "") + tokens[end];
        end++;
      }
      chunks.push({
        id: `${source}-text-${chunks.length}`,
        text: cur,
        metadata: {
          source,
          section,
          page_start: pages[0],
          page_end: pages[pages.length - 1],
          type: "text"
        }
      });
      // overlap by words (approx)
      start = Math.max(end - Math.floor(OVERLAP / 1), end);
    }
  }

  return chunks;
}

function groupParagraphsBySection(paras: RawBlock[]) {
  type Group = { section?: string; pages: number[]; text: string };
  const groups: Group[] = [];
  let cur: Group | null = null;

  for (const p of paras) {
    if (!cur || cur.section !== p.section) {
      if (cur) groups.push(cur);
      cur = { section: p.section, pages: [p.page_number], text: p.text };
    } else {
      cur.pages.push(p.page_number);
      cur.text += (cur.text ? "\n\n" : "") + p.text;
    }
  }
  if (cur) groups.push(cur);
  for (const g of groups) {
    g.pages = Array.from(new Set(g.pages)).sort((a, b) => a - b);
  }
  return groups;
}
