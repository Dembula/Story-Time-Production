/** Knowledge sources indexed for RAG retrieval. */
export type KnowledgeSourceType =
  | "catalogue"
  | "scene"
  | "platform_policy"
  | "project_script"
  | "sa_language_glossary";

export type RetrievedKnowledgeChunk = {
  id: string;
  chunkKey: string;
  sourceType: KnowledgeSourceType;
  title: string | null;
  chunkText: string;
  score: number;
  contentId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RetrieveKnowledgeParams = {
  query: string;
  sourceTypes: KnowledgeSourceType[];
  limit?: number;
  minScore?: number;
  contentId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  /** Viewer age gate — filters catalogue/scene chunks for published content minAge. */
  profileAge?: number | null;
};

export type RetrieveKnowledgeResult = {
  chunks: RetrievedKnowledgeChunk[];
  queryEmbeddingUsed: boolean;
  vectorBackend: "pgvector" | "json_cosine" | "none";
};

export type UpsertKnowledgeChunkInput = {
  chunkKey: string;
  sourceType: KnowledgeSourceType;
  sourceId?: string | null;
  contentId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  title?: string | null;
  chunkText: string;
  metadata?: Record<string, unknown> | null;
  embedding?: number[] | null;
};
