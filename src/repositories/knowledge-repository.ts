import { randomUUID } from "node:crypto";

import { db } from "../db/database.js";
import type { KnowledgeChunk } from "../lib/types.js";

type KnowledgeRow = {
  id: string;
  source_title: string;
  source_type: string;
  source_url: string | null;
  school: string | null;
  tags: string;
  chunk_text: string;
  last_verified_at: string | null;
  created_at: string;
};

function mapKnowledge(row: KnowledgeRow): KnowledgeChunk {
  return {
    id: row.id,
    sourceTitle: row.source_title,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    school: row.school,
    tags: JSON.parse(row.tags) as string[],
    chunkText: row.chunk_text,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at
  };
}

function buildFtsQuery(query: string): string | null {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2)
    .slice(0, 8);

  if (tokens.length === 0) {
    return null;
  }

  return tokens.map((token) => `${token}*`).join(" OR ");
}

export class KnowledgeRepository {
  insertChunks(
    documents: Array<{
      sourceTitle: string;
      sourceType: string;
      sourceUrl?: string | null;
      school?: string | null;
      tags?: string[];
      chunkText: string;
      lastVerifiedAt?: string | null;
    }>
  ): number {
    const insert = db.prepare(
      `
        INSERT INTO knowledge_chunks (
          id,
          source_title,
          source_type,
          source_url,
          school,
          tags,
          chunk_text,
          last_verified_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    const transaction = db.transaction(() => {
      for (const document of documents) {
        insert.run(
          randomUUID(),
          document.sourceTitle,
          document.sourceType,
          document.sourceUrl ?? null,
          document.school ?? null,
          JSON.stringify(document.tags ?? []),
          document.chunkText,
          document.lastVerifiedAt ?? null
        );
      }
    });

    transaction();
    return documents.length;
  }

  searchRelevant(query: string, limit = 4): KnowledgeChunk[] {
    const ftsQuery = buildFtsQuery(query);

    if (ftsQuery) {
      const rows = db
        .prepare(
          `
            SELECT
              kc.id,
              kc.source_title,
              kc.source_type,
              kc.source_url,
              kc.school,
              kc.tags,
              kc.chunk_text,
              kc.last_verified_at,
              kc.created_at
            FROM knowledge_fts
            JOIN knowledge_chunks kc ON kc.rowid = knowledge_fts.rowid
            WHERE knowledge_fts MATCH ?
            ORDER BY bm25(knowledge_fts)
            LIMIT ?
          `
        )
        .all(ftsQuery, limit) as KnowledgeRow[];

      if (rows.length > 0) {
        return rows.map(mapKnowledge);
      }
    }

    const wildcard = `%${query.trim().slice(0, 80)}%`;
    const fallbackRows = db
      .prepare(
        `
          SELECT id, source_title, source_type, source_url, school, tags, chunk_text, last_verified_at, created_at
          FROM knowledge_chunks
          WHERE source_title LIKE ?
             OR chunk_text LIKE ?
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(wildcard, wildcard, limit) as KnowledgeRow[];

    return fallbackRows.map(mapKnowledge);
  }
}
