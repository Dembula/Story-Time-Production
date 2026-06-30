import "server-only";

import type { UIMessage } from "ai";
import { CREATOR_VA_ROLE } from "@/lib/modoc/creator-va";
import { VIEWER_VA_ROLE } from "@/lib/modoc/viewer-va";
import {
  getLastUserTextFromRawMessages,
  prepareModocModelMessages,
} from "@/lib/modoc/chat-messages";
import type { ModocActionPayload, ModocActionType } from "@/lib/modoc/action-types";
import { normalizeModocActionType } from "@/lib/modoc/action-types";
import { inferFollowUpExecuteAction } from "@/lib/modoc/follow-up-actions";
import { getModocLearning } from "@/lib/modoc/learning";
import { getRecentActionLogs, migrateJsonLearningToDb } from "@/lib/modoc/learning-store";
import { buildExecutedActionPromptBlock, runVaAction } from "@/lib/modoc/run-va-action";
import { buildProductionGraph } from "@/lib/modoc/production-graph";
import { streamModocWithFallback } from "@/lib/modoc/model-router";
import { parseModocIntelFromText } from "@/lib/modoc/response-protocol";
import { buildModocSessionIntel, persistModocSessionIntel } from "@/lib/modoc/learning-loop";
import { ingestModocConversationLearning } from "@/lib/modoc/auto-learn";
import { applySpecialistPrompt } from "../agents/specialists";
import { resolveAbExperimentVariant } from "../evaluation/ab-model";
import { invalidateMemoryCache } from "../memory/cached-assemble";
import { logAiRequest } from "../observability/log-request";
import { planModocOrchestration } from "../planner/intent-router";
import { searchWeb, formatWebSearchForPrompt } from "@/lib/modoc/web-search";
import type { ModocChatOrchestratorInput, ModocChatOrchestratorResult, OrchestrationPlan } from "../types";

function buildResponseModePromptBlock(plan: OrchestrationPlan): string {
  if (plan.responseMode === "conversational") {
    return `
## Response mode for this turn: conversational
Answer naturally in clear prose. Do NOT use OBSERVATION / REASONING / ACTION headers unless you are executing a MODOC_ACTION or MODOC_SUGGEST for Story Time.
`;
  }
  return `
## Response mode for this turn: production protocol
Use OBSERVATION / REASONING / ACTION when answering about Story Time production data or executing platform workflows.
`;
}

export type ResolveModocActionsInput = {
  userId: string;
  sessionRole: string;
  scope?: string;
  path: string;
  rawMessages: UIMessage[];
  pageContext?: Record<string, string | number | boolean | null>;
  executeAction?: { type: string; payload?: ModocActionPayload };
  conversationId?: string;
  systemPrompt: string;
};

export type ResolveModocActionsResult = {
  systemPrompt: string;
  plan: OrchestrationPlan;
};

/**
 * Resolves follow-up / explicit MODOC actions and augments the system prompt.
 * Extracted from the chat route — behavior unchanged.
 */
export async function resolveModocActionsAndPlan(
  input: ResolveModocActionsInput,
): Promise<ResolveModocActionsResult> {
  let systemPrompt = input.systemPrompt;
  const lastUserText = getLastUserTextFromRawMessages(input.rawMessages);

  const plan = planModocOrchestration({
    sessionRole: input.sessionRole,
    scope: input.scope,
    path: input.path,
    pageContext: input.pageContext,
    lastUserText,
  });

  let resolvedExecuteAction = input.executeAction;

  if (
    !resolvedExecuteAction?.type &&
    input.sessionRole === CREATOR_VA_ROLE &&
    input.rawMessages.length > 0
  ) {
    try {
      const learning = await getModocLearning(input.userId);
      await migrateJsonLearningToDb(input.userId, learning);
      const recentActions = await getRecentActionLogs(input.userId, 200);
      const inferred = inferFollowUpExecuteAction(lastUserText, recentActions);
      if (inferred) {
        resolvedExecuteAction = { type: inferred.type, payload: inferred.payload };
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("MODOC follow-up action inference failed:", e);
      }
    }
  }

  if (resolvedExecuteAction?.type && input.sessionRole === CREATOR_VA_ROLE) {
    try {
      const actionType = normalizeModocActionType(resolvedExecuteAction.type);
      if (!actionType) {
        if (process.env.NODE_ENV === "development") {
          console.error("MODOC unknown executeAction:", resolvedExecuteAction.type);
        }
      } else {
        const focusProjectId = (input.pageContext?.projectId as string | undefined) ?? undefined;
        const actionPayload = {
          ...(resolvedExecuteAction.payload ?? {}),
          projectId: resolvedExecuteAction.payload?.projectId ?? focusProjectId ?? undefined,
        };
        const actionResult = await runVaAction({
          userId: input.userId,
          action: actionType,
          payload: actionPayload,
          conversationId: input.conversationId,
        });

        const actionContext = input.executeAction?.type ? "suggestion" : "follow_up";
        systemPrompt += buildExecutedActionPromptBlock(actionType, actionResult, actionContext);
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("MODOC action execution failed:", e);
      }
    }
  }

  systemPrompt += buildResponseModePromptBlock(plan);

  if (plan.needsWebSearch && plan.webSearchQuery?.trim()) {
    try {
      const webResults = await searchWeb(plan.webSearchQuery.trim());
      plan.webSearchUsed = webResults.length > 0;
      systemPrompt += `\n\n${formatWebSearchForPrompt(webResults, plan.webSearchQuery.trim())}`;
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("MODOC web search failed:", e);
      }
      systemPrompt += `\n\n${formatWebSearchForPrompt([], plan.webSearchQuery.trim())}`;
    }
  }

  return { systemPrompt, plan };
}

/**
 * MODOC chat orchestrator — coordinates planning, model routing, streaming, and learning.
 * Milestone 1: wraps existing V1 behavior; specialist agents activate in later milestones.
 */
export async function runModocChatOrchestrator(
  input: ModocChatOrchestratorInput,
): Promise<ModocChatOrchestratorResult> {
  const lastUserTextForLearning = getLastUserTextFromRawMessages(input.rawMessages);

  const { systemPrompt, plan } = await resolveModocActionsAndPlan({
    userId: input.userId,
    sessionRole: input.sessionRole,
    scope: input.scope,
    path: input.path,
    rawMessages: input.rawMessages,
    pageContext: input.pageContext,
    executeAction: input.executeAction as ResolveModocActionsInput["executeAction"],
    conversationId: input.conversationId,
    systemPrompt: input.systemPrompt,
  });

  const messages = await prepareModocModelMessages(input.rawMessages);
  if (messages.length === 0) {
    throw new ModocOrchestratorError("No valid messages to send.", 400);
  }

  const systemWithAgent = applySpecialistPrompt(systemPrompt, plan.primaryAgentId);
  const orchestrationStarted = Date.now();

  const focusProjectId = input.focusProjectId ?? (input.pageContext?.projectId as string | undefined) ?? null;
  const graphForIntel =
    focusProjectId && input.userId
      ? await buildProductionGraph(input.userId, focusProjectId).catch(() => null)
      : null;

  const experimentVariant = resolveAbExperimentVariant(input.userId);

  const { result, modelUsed } = await streamModocWithFallback({
    system: systemWithAgent,
    messages,
    taskKind: plan.taskKind,
    userId: input.userId,
    onFinish: async ({ text, modelUsed: used, experimentVariant: variant }) => {
      logAiRequest({
        userId: input.userId,
        route: "modoc/chat",
        agentId: plan.primaryAgentId,
        modelUsed: used,
        taskKind: plan.taskKind,
        experimentVariant: variant,
        latencyMs: Date.now() - orchestrationStarted,
        metadata: {
          taskKind: plan.taskKind,
          routingReason: plan.routingReason,
          experimentVariant: variant,
          memoryCacheHit: input.memoryCacheHit ?? false,
          intentCategory: plan.intentCategory,
          responseMode: plan.responseMode,
          webSearchUsed: plan.webSearchUsed ?? false,
        },
      });

      if (input.userId && lastUserTextForLearning) {
        const canLearn =
          input.sessionRole === CREATOR_VA_ROLE ||
          (input.sessionRole === VIEWER_VA_ROLE &&
            (input.scope === "browse" || input.path.startsWith("/browse")));

        if (canLearn) {
          try {
            await ingestModocConversationLearning({
              userId: input.userId,
              userMessage: lastUserTextForLearning,
              assistantMessage: text,
              conversationId: input.conversationId,
            });
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.error("MODOC auto-learn failed:", e);
            }
          }
        }

        if (input.sessionRole === CREATOR_VA_ROLE) {
          try {
            const intelBlock = parseModocIntelFromText(text);
            const sessionIntel = await buildModocSessionIntel({
              userId: input.userId,
              userIntent: lastUserTextForLearning,
              graph: graphForIntel,
              intelBlock,
              modelUsed: used,
              conversationId: input.conversationId,
              projectId: focusProjectId,
            });
            await persistModocSessionIntel(input.userId, sessionIntel);
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.error("MODOC session intel failed:", e);
            }
          }
        }

        void invalidateMemoryCache({
          userId: input.userId,
          projectId: focusProjectId,
          conversationId: input.conversationId,
        }).catch(() => {});
      }
    },
  });

  if (process.env.NODE_ENV === "development") {
    console.info(
      `[ai-os] plan=${plan.primaryAgentId} taskKind=${plan.taskKind} model=${modelUsed} variant=${experimentVariant} reason="${plan.routingReason}"`,
    );
  }

  return {
    plan,
    streamResponse: result.toUIMessageStreamResponse(),
  };
}

export class ModocOrchestratorError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ModocOrchestratorError";
  }
}
