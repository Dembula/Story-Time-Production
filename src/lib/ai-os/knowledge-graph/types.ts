/** Knowledge graph entity types. */
export type KnowledgeEntityType =
  | "content"
  | "scene"
  | "actor"
  | "genre"
  | "theme"
  | "creator"
  | "character"
  | "cast_role"
  | "festival"
  | "rights"
  | "project";

export type KnowledgeRelation =
  | "created_by"
  | "has_genre"
  | "has_theme"
  | "has_scene"
  | "features_actor"
  | "similar_to"
  | "same_creator"
  | "has_character"
  | "played_by"
  | "linked_project"
  | "submitted_to"
  | "has_rights"
  | "cast_in";

export type KnowledgeEdgeRecord = {
  id: string;
  fromType: KnowledgeEntityType;
  fromId: string;
  toType: KnowledgeEntityType;
  toId: string;
  relation: KnowledgeRelation | string;
  label: string | null;
  weight: number;
  contentId: string | null;
  metadata?: Record<string, unknown> | null;
};

export type GraphContext = {
  contentId: string;
  title: string;
  edges: KnowledgeEdgeRecord[];
  actors: string[];
  genres: string[];
  themes: string[];
  festivals: string[];
  rights: string[];
  cast: Array<{ name: string; importance: string | null }>;
  relatedContent: Array<{ contentId: string; title: string; score: number }>;
};
