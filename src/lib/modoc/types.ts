/**
 * MODOC — Machine Orchestrating Digital Operations for Creation
 * Types and interfaces for the platform-wide AI assistant.
 */

export interface ModocUserContext {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  /** Current dashboard or area (e.g. admin, creator, project/123) */
  scope?: string;
  /** Optional extra context from the current page (e.g. project name, content title) */
  pageContext?: Record<string, string | number | boolean | null>;
}

export interface ModocPlatformContext {
  /** Summary of the platform for the model */
  platformSummary: string;
  /** Current user context (anonymous if not logged in) */
  user: ModocUserContext | null;
  /** Optional: current route/path for context */
  path?: string;
  /** Optional: additional context from the client (e.g. selected entity, IDs) */
  clientContext?: string;
}

export interface ModocChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ModocChatRequest {
  messages: ModocChatMessage[];
  /** Optional override: pass context from client (e.g. "I'm on the Originals pitch page") */
  clientContext?: string;
  /** Optional: scope hint (e.g. "admin", "creator", "project/abc") */
  scope?: string;
}
