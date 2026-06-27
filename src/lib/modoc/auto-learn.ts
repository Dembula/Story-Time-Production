import "server-only";

import { buildAdaptivePlaybookPrompt, derivePlaybookDraftsFromTurn, extractMessageTopics } from "./adaptive-playbook";
import {
  getPlaybookRuleCount,
  getTopPlaybookRules,
  getTopTopicStats,
  incrementTopicStats,
  migrateJsonLearningToDb,
  upsertPlaybookEntries,
} from "./learning-store";
import { getModocLearning, saveModocLearning } from "./learning";
import { learnSaLanguageFromTurn } from "@/lib/ai-os/languages/learn-from-turn";

export async function ingestModocConversationLearning(params: {
  userId: string;
  userMessage: string;
  assistantMessage?: string;
  conversationId?: string;
}): Promise<void> {
  const userMessage = params.userMessage.trim();
  if (!userMessage) return;

  const profile = await getModocLearning(params.userId);
  await migrateJsonLearningToDb(params.userId, profile);

  const topics = extractMessageTopics(userMessage);
  await incrementTopicStats(params.userId, topics);

  const topicCounts = await getTopTopicStats(params.userId, 500);
  const drafts = derivePlaybookDraftsFromTurn({
    userMessage,
    assistantMessage: params.assistantMessage,
    topicCounts,
  });

  if (drafts.length > 0) {
    await upsertPlaybookEntries(params.userId, drafts);
  }

  await saveModocLearning(params.userId, {
    interactionCount: (profile.interactionCount ?? 0) + 1,
    lastLearnedAt: new Date().toISOString(),
  });

  if (params.assistantMessage) {
    await learnSaLanguageFromTurn({
      userId: params.userId,
      userMessage,
      assistantMessage: params.assistantMessage,
    }).catch(() => {});
  }
}

export async function buildPlaybookPromptForUser(userId: string): Promise<string> {
  const profile = await getModocLearning(userId);
  await migrateJsonLearningToDb(userId, profile);

  const [rules, totalRuleCount, topicCounts] = await Promise.all([
    getTopPlaybookRules(userId),
    getPlaybookRuleCount(userId),
    getTopTopicStats(userId),
  ]);

  return buildAdaptivePlaybookPrompt({
    rules,
    interactionCount: profile.interactionCount ?? 0,
    lastLearnedAt: profile.lastLearnedAt,
    topicCounts,
    totalRuleCount,
  });
}
