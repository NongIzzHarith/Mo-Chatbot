import { randomUUID } from "node:crypto";

import { db } from "../db/database.js";
import type { Citation, MessageRole, RiskLevel, StoredConversation, StoredMessage } from "../lib/types.js";

type ConversationRow = {
  id: string;
  user_id: string | null;
  title: string | null;
  status: string;
  created_at: string;
  last_message_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  body: string;
  language: string | null;
  citations: string;
  risk_level: RiskLevel;
  model_provider: string | null;
  model_name: string | null;
  created_at: string;
};

function mapConversation(row: ConversationRow): StoredConversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at
  };
}

function mapMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    body: row.body,
    language: row.language,
    citations: JSON.parse(row.citations) as Citation[],
    riskLevel: row.risk_level,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    createdAt: row.created_at
  };
}

export class ConversationRepository {
  upsertUser(input: { userId?: string; displayName?: string; locale?: string }): string | null {
    if (!input.userId) {
      return null;
    }

    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(input.userId) as { id: string } | undefined;

    if (existing) {
      db.prepare(
        `
          UPDATE users
          SET display_name = COALESCE(?, display_name),
              locale = COALESCE(?, locale)
          WHERE id = ?
        `
      ).run(input.displayName ?? null, input.locale ?? null, input.userId);

      return input.userId;
    }

    db.prepare(
      `
        INSERT INTO users (id, display_name, locale)
        VALUES (?, ?, ?)
      `
    ).run(input.userId, input.displayName ?? null, input.locale ?? "en");

    return input.userId;
  }

  ensureConversation(input: {
    conversationId?: string;
    userId?: string | null;
    title?: string | null;
  }): StoredConversation {
    if (input.conversationId) {
      const row = db
        .prepare(
          `
            SELECT id, user_id, title, status, created_at, last_message_at
            FROM conversations
            WHERE id = ?
          `
        )
        .get(input.conversationId) as ConversationRow | undefined;

      if (row) {
        if (input.userId && row.user_id !== input.userId) {
          db.prepare("UPDATE conversations SET user_id = ? WHERE id = ?").run(input.userId, input.conversationId);
          row.user_id = input.userId;
        }

        return mapConversation(row);
      }
    }

    const id = input.conversationId ?? randomUUID();

    db.prepare(
      `
        INSERT INTO conversations (id, user_id, title)
        VALUES (?, ?, ?)
      `
    ).run(id, input.userId ?? null, input.title ?? null);

    const created = db
      .prepare(
        `
          SELECT id, user_id, title, status, created_at, last_message_at
          FROM conversations
          WHERE id = ?
        `
      )
      .get(id) as ConversationRow;

    return mapConversation(created);
  }

  setConversationTitleIfEmpty(conversationId: string, title: string): void {
    const normalizedTitle = title.trim().slice(0, 80);
    if (!normalizedTitle) {
      return;
    }

    db.prepare(
      `
        UPDATE conversations
        SET title = CASE
          WHEN title IS NULL OR title = '' THEN ?
          ELSE title
        END
        WHERE id = ?
      `
    ).run(normalizedTitle, conversationId);
  }

  saveMessage(input: {
    conversationId: string;
    role: MessageRole;
    body: string;
    language?: string | null;
    citations?: Citation[];
    riskLevel?: RiskLevel;
    modelProvider?: string | null;
    modelName?: string | null;
  }): StoredMessage {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    db.prepare(
      `
        INSERT INTO messages (
          id,
          conversation_id,
          role,
          body,
          language,
          citations,
          risk_level,
          model_provider,
          model_name,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      input.conversationId,
      input.role,
      input.body,
      input.language ?? null,
      JSON.stringify(input.citations ?? []),
      input.riskLevel ?? "low",
      input.modelProvider ?? null,
      input.modelName ?? null,
      timestamp
    );

    db.prepare("UPDATE conversations SET last_message_at = ? WHERE id = ?").run(timestamp, input.conversationId);

    const row = db
      .prepare(
        `
          SELECT id, conversation_id, role, body, language, citations, risk_level, model_provider, model_name, created_at
          FROM messages
          WHERE id = ?
        `
      )
      .get(id) as MessageRow;

    return mapMessage(row);
  }

  getConversation(conversationId: string): StoredConversation | null {
    const row = db
      .prepare(
        `
          SELECT id, user_id, title, status, created_at, last_message_at
          FROM conversations
          WHERE id = ?
        `
      )
      .get(conversationId) as ConversationRow | undefined;

    return row ? mapConversation(row) : null;
  }

  getMessages(conversationId: string, limit = 50): StoredMessage[] {
    const rows = db
      .prepare(
        `
          SELECT id, conversation_id, role, body, language, citations, risk_level, model_provider, model_name, created_at
          FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(conversationId, limit) as MessageRow[];

    return rows.reverse().map(mapMessage);
  }

  listConversationsForUser(userId: string, limit = 50): StoredConversation[] {
    const rows = db
      .prepare(
        `
          SELECT id, user_id, title, status, created_at, last_message_at
          FROM conversations
          WHERE user_id = ?
          ORDER BY last_message_at DESC
          LIMIT ?
        `
      )
      .all(userId, limit) as ConversationRow[];

    return rows.map(mapConversation);
  }

  saveSafetyEvents(input: {
    conversationId: string;
    messageId: string;
    categories: string[];
    severity: RiskLevel;
    actionTaken: string;
  }): void {
    if (input.categories.length === 0) {
      return;
    }

    const insert = db.prepare(
      `
        INSERT INTO safety_events (id, conversation_id, message_id, category, severity, action_taken)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    );

    const transaction = db.transaction(() => {
      for (const category of input.categories) {
        insert.run(randomUUID(), input.conversationId, input.messageId, category, input.severity, input.actionTaken);
      }
    });

    transaction();
  }

  forgetConversation(conversationId: string, deleteMemory: boolean): { deleted: boolean } {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return { deleted: false };
    }

    const transaction = db.transaction(() => {
      if (deleteMemory && conversation.userId) {
        const timestamp = new Date().toISOString();

        db.prepare(
          `
            UPDATE memory_items
            SET deleted_at = ?, updated_at = ?
            WHERE user_id = ?
              AND deleted_at IS NULL
              AND source_message_id IN (
                SELECT id FROM messages WHERE conversation_id = ?
              )
          `
        ).run(timestamp, timestamp, conversation.userId, conversationId);
      }

      db.prepare("DELETE FROM feedback WHERE conversation_id = ?").run(conversationId);
      db.prepare("DELETE FROM safety_events WHERE conversation_id = ?").run(conversationId);
      db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversationId);
      db.prepare(
        `
          UPDATE conversations
          SET status = 'forgotten', last_message_at = ?
          WHERE id = ?
        `
      ).run(new Date().toISOString(), conversationId);
    });

    transaction();
    return { deleted: true };
  }
}
