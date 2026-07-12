"use client";

import { getPersistenceContext } from "../../platform/persistence/client";
import type { JsonValue } from "../../platform/persistence/types";
import type { CapstoneBackend, PersistedChatMessage } from "../../lib/capstone-contract";

const CONVERSATION_IDS: Record<CapstoneBackend, string> = {
  student: "capstone:student",
  local: "capstone:local",
};

export async function loadCapstoneConversation() {
  const { database, repositories } = await getPersistenceContext();
  const selected = await repositories.settings.get<JsonValue>("capstone.selected-backend");
  const messages: PersistedChatMessage[] = [];
  for (const backend of ["student", "local"] as const) {
    const conversations = await database.conversations.where("backend").equals(backend).sortBy("updatedAt");
    const conversation = conversations.at(-1);
    if (!conversation) continue;
    const records = await repositories.conversations.messages(conversation.id);
    for (const record of records) {
      if (record.role !== "user" && record.role !== "assistant") continue;
      messages.push({
        id: record.id,
        role: record.role,
        content: record.content,
        status: record.status,
        backend,
        attemptId: typeof record.metadata.attemptId === "string" ? record.metadata.attemptId : undefined,
        parentUserId: typeof record.metadata.parentUserId === "string" ? record.metadata.parentUserId : undefined,
      });
    }
  }
  return {
    selectedBackend: selected === "local" ? "local" as const : "student" as const,
    messages,
  };
}

export async function persistCapstoneConversation(selectedBackend: CapstoneBackend, messages: PersistedChatMessage[]) {
  const { database, repositories } = await getPersistenceContext();
  const persisted = messages.filter((message) => message.status !== "streaming");
  await database.transaction("rw", database.conversations, database.conversationMessages, database.settings, async () => {
    const now = Date.now();
    for (const backend of ["student", "local"] as const) {
      const id = CONVERSATION_IDS[backend];
      const selected = persisted.filter((message) => message.backend === backend);
      await database.conversations.put({
        id,
        backend,
        title: backend === "student" ? "Learner-trained model" : "Local Transformer",
        createdAt: now,
        updatedAt: now,
      });
      await database.conversationMessages.where("conversationId").equals(id).delete();
      if (selected.length) {
        await database.conversationMessages.bulkPut(selected.map((message, sequence) => ({
          id: message.id,
          conversationId: id,
          sequence,
          role: message.role,
          content: message.content,
          status: message.status,
          createdAt: now + sequence,
          metadata: {
            ...(message.attemptId ? { attemptId: message.attemptId } : {}),
            ...(message.parentUserId ? { parentUserId: message.parentUserId } : {}),
          },
        })));
      }
    }
    await repositories.settings.put("capstone.selected-backend", selectedBackend);
  });
}
