// ts-backend/src/types.ts
export type IngestedChunk = {
    id: string;
    text: string;
    metadata: Record<string, any>;
  };
  
  export type QueryResult = {
    answer: string;
    contexts: Array<{
      text: string;
      metadata?: Record<string, any>;
      score?: number;
    }>;
  };
  
  export type RawBlock = {
    type: "heading" | "paragraph" | "table" | "figure" | "equation" | string;
    page_number: number;
    section?: string;
    text: string;
    caption_html?: string;
  };
  