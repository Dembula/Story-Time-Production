import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatStoryTimeMemoryPrompt } from "./format-prompt";
import { loadGlobalMemory } from "./providers/load-global";
import type { StoryTimeMemoryLayers } from "./types";

function minimalLayers(overrides?: Partial<StoryTimeMemoryLayers>): StoryTimeMemoryLayers {
  return {
    conversation: {
      conversationId: "conv-1",
      sessionTool: "budget",
      sessionTask: "budget",
      recentTurns: [{ role: "user", content: "Build my budget" }],
      recentUserIntents: ["Build my budget"],
      at: "2026-06-18T12:00:00.000Z",
    },
    user: {
      acceptedActions: { generate_smart_budget: 3 },
      declinedActions: {},
      preferredSuggestions: ["generate_smart_budget"],
      actionSuccessRates: { generate_smart_budget: 1 },
      recentActions: ["generate_smart_budget:ok"],
      topTopics: [{ topic: "budget", count: 5 }],
      playbookRules: [{ when: "user asks budget", then: "run smart budget", confidence: 0.9 }],
    },
    project: {
      projectId: "proj-1",
      graph: null,
    },
    studio: {
      projectCount: 1,
      projects: [
        {
          id: "proj-1",
          title: "NGIKHONA",
          status: "ACTIVE",
          phase: "PRE_PRODUCTION",
          sceneCount: 12,
          characterCount: 4,
          openTasks: 2,
          shootDays: 3,
          updatedAt: "2026-06-18T12:00:00.000Z",
        },
      ],
    },
    global: loadGlobalMemory(),
    ...overrides,
  };
}

describe("formatStoryTimeMemoryPrompt", () => {
  it("includes all five memory layer sections", () => {
    const prompt = formatStoryTimeMemoryPrompt(minimalLayers(), []);

    assert.match(prompt, /### 1\. Conversation memory/);
    assert.match(prompt, /### 2\. User memory/);
    assert.match(prompt, /### 3\. Project memory/);
    assert.match(prompt, /### 4\. Studio memory/);
    assert.match(prompt, /### 5\. Global memory/);
  });

  it("lists missing context flags when present", () => {
    const prompt = formatStoryTimeMemoryPrompt(minimalLayers(), ["no_focus_project", "missing_script"]);

    assert.match(prompt, /Missing context flags/);
    assert.match(prompt, /no_focus_project/);
    assert.match(prompt, /missing_script/);
  });

  it("includes platform policies in global memory", () => {
    const prompt = formatStoryTimeMemoryPrompt(minimalLayers(), []);

    assert.match(prompt, /Playback and streaming performance always outrank AI features/);
  });
});

describe("loadGlobalMemory", () => {
  it("returns workflow patterns and policies without I/O", () => {
    const global = loadGlobalMemory();

    assert.ok(global.workflowPatterns.length > 0);
    assert.ok(global.platformPolicies.length >= 4);
  });
});
