export type {
  KnowledgeSourceType,
  RetrievedKnowledgeChunk,
  RetrieveKnowledgeParams,
  RetrieveKnowledgeResult,
  UpsertKnowledgeChunkInput,
} from "./types";

export { vectorToPgLiteral, estimateTokens, EMBEDDING_DIM } from "./vector-utils";
export { formatRagPromptBlock } from "./format-prompt";
export { upsertKnowledgeChunk } from "./index-chunk";
export {
  indexCatalogueFromEnrichment,
  indexSceneChunk,
  indexScenesForContent,
} from "./index-catalogue";
export { indexProjectScript } from "./index-project-script";
export { retrieveKnowledge } from "./retrieve";
export { buildRagPromptBlock } from "./build-rag-prompt";
export { PLATFORM_POLICY_CHUNKS } from "./platform-policies";
export { isPgvectorAvailable } from "./pgvector";
