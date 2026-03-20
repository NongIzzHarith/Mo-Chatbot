import { randomUUID } from "node:crypto";

import { db } from "../db/database.js";

export class FeedbackRepository {
  save(input: { conversationId: string; messageId?: string; rating: number; note?: string }): void {
    db.prepare(
      `
        INSERT INTO feedback (id, conversation_id, message_id, rating, note)
        VALUES (?, ?, ?, ?, ?)
      `
    ).run(randomUUID(), input.conversationId, input.messageId ?? null, input.rating, input.note ?? null);
  }
}
