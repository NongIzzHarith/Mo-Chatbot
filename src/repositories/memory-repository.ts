import { randomUUID } from "node:crypto";

import { db } from "../db/database.js";
import type { MemoryCandidate, MemoryItem } from "../lib/types.js";

type MemoryRow = {
  id: string;
  user_id: string;
  key: string;
  value: string;
  confidence: number;
  expires_at: string | null;
  deleted_at: string | null;
  source_message_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapMemory(row: MemoryRow): MemoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at,
    sourceMessageId: row.source_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class MemoryRepository {
  getActiveMemory(userId: string, limit = 12): MemoryItem[] {
    const rows = db
      .prepare(
        `
          SELECT id, user_id, key, value, confidence, expires_at, deleted_at, source_message_id, created_at, updated_at
          FROM memory_items
          WHERE user_id = ?
            AND deleted_at IS NULL
            AND (expires_at IS NULL OR expires_at > ?)
          ORDER BY confidence DESC, updated_at DESC
          LIMIT ?
        `
      )
      .all(userId, new Date().toISOString(), limit) as MemoryRow[];

    return rows.map(mapMemory);
  }

  saveCandidates(userId: string, candidates: MemoryCandidate[], sourceMessageId: string): void {
    if (candidates.length === 0) {
      return;
    }

    const findExisting = db.prepare(
      `
        SELECT id
        FROM memory_items
        WHERE user_id = ?
          AND key = ?
          AND value = ?
          AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 1
      `
    );

    const updateExisting = db.prepare(
      `
        UPDATE memory_items
        SET confidence = MAX(confidence, ?),
            source_message_id = ?,
            updated_at = ?
        WHERE id = ?
      `
    );

    const insert = db.prepare(
      `
        INSERT INTO memory_items (
          id,
          user_id,
          key,
          value,
          confidence,
          source_message_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    const transaction = db.transaction(() => {
      for (const candidate of candidates) {
        const timestamp = new Date().toISOString();
        const existing = findExisting.get(userId, candidate.key, candidate.value) as { id: string } | undefined;

        if (existing) {
          updateExisting.run(candidate.confidence, sourceMessageId, timestamp, existing.id);
          continue;
        }

        insert.run(
          randomUUID(),
          userId,
          candidate.key,
          candidate.value,
          candidate.confidence,
          sourceMessageId,
          timestamp,
          timestamp
        );
      }
    });

    transaction();
  }
}
