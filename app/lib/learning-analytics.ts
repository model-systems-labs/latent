"use client";

import { getPersistenceContext } from "@/app/platform/persistence/client";
import type { JsonValue } from "@/app/platform/persistence/types";

const ANALYTICS_KEY = "learning.analytics.v1";
const MAX_EVENTS = 500;

export type LearningEventName =
  | "lesson_opened"
  | "cell_check_completed"
  | "lesson_checks_completed"
  | "knowledge_check_completed"
  | "module_checkpoint_completed"
  | "project_tests_completed"
  | "project_build_completed"
  | "capstone_started";

export type LearningEvent = {
  id: string;
  name: LearningEventName;
  occurredAt: number;
  lessonId?: string;
  moduleId?: string;
  outcome?: "passed" | "failed" | "cancelled";
  count?: number;
};

type LearningAnalyticsRecord = {
  version: 1;
  policy: "device-local-no-code-no-prompts";
  events: LearningEvent[];
};

const EMPTY: LearningAnalyticsRecord = {
  version: 1,
  policy: "device-local-no-code-no-prompts",
  events: [],
};

let analyticsQueue = Promise.resolve();

function validEvent(value: unknown): value is LearningEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<LearningEvent>;
  return typeof event.id === "string"
    && typeof event.name === "string"
    && typeof event.occurredAt === "number";
}

function sanitize(value: unknown): LearningAnalyticsRecord {
  if (!value || typeof value !== "object") return { ...EMPTY, events: [] };
  const record = value as Partial<LearningAnalyticsRecord>;
  if (record.version !== 1 || !Array.isArray(record.events)) return { ...EMPTY, events: [] };
  return { ...EMPTY, events: record.events.filter(validEvent).slice(-MAX_EVENTS) };
}

export async function loadLearningAnalytics() {
  const { repositories } = await getPersistenceContext();
  return sanitize(await repositories.settings.get<JsonValue>(ANALYTICS_KEY));
}

export function recordLearningEvent(
  name: LearningEventName,
  dimensions: Omit<LearningEvent, "id" | "name" | "occurredAt"> = {},
) {
  // This intentionally accepts only bounded categorical dimensions. Source,
  // prompts, chat content, API keys, and free-form learner answers have no field.
  analyticsQueue = analyticsQueue.then(async () => {
    const { repositories } = await getPersistenceContext();
    const current = sanitize(await repositories.settings.get<JsonValue>(ANALYTICS_KEY));
    const next: LearningAnalyticsRecord = {
      ...current,
      events: [...current.events, {
        id: crypto.randomUUID(),
        name,
        occurredAt: Date.now(),
        ...dimensions,
      }].slice(-MAX_EVENTS),
    };
    await repositories.settings.put(ANALYTICS_KEY, next as unknown as JsonValue);
  }).catch(() => {
    // Learning interactions must continue when storage is blocked or full.
  });
  return analyticsQueue;
}

export async function clearLearningAnalytics() {
  await analyticsQueue;
  const { repositories } = await getPersistenceContext();
  await repositories.settings.put(ANALYTICS_KEY, EMPTY as unknown as JsonValue);
}

export async function learningAnalyticsBlob() {
  const record = await loadLearningAnalytics();
  return new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
}
