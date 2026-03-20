export const migrationStatements = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      locale TEXT DEFAULT 'en',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_message_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      body TEXT NOT NULL,
      language TEXT,
      citations TEXT NOT NULL DEFAULT '[]',
      risk_level TEXT NOT NULL DEFAULT 'low',
      model_provider TEXT,
      model_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages (conversation_id, created_at);
  `,
  `
    CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      expires_at TEXT,
      deleted_at TEXT,
      source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_memory_items_user_active
    ON memory_items (user_id, deleted_at, updated_at);
  `,
  `
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT,
      school TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      chunk_text TEXT NOT NULL,
      last_verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts
    USING fts5(
      chunk_text,
      source_title,
      tags,
      content='knowledge_chunks',
      content_rowid='rowid'
    );
  `,
  `
    CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ai
    AFTER INSERT ON knowledge_chunks
    BEGIN
      INSERT INTO knowledge_fts (rowid, chunk_text, source_title, tags)
      VALUES (new.rowid, new.chunk_text, new.source_title, new.tags);
    END;
  `,
  `
    CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ad
    AFTER DELETE ON knowledge_chunks
    BEGIN
      INSERT INTO knowledge_fts (knowledge_fts, rowid, chunk_text, source_title, tags)
      VALUES ('delete', old.rowid, old.chunk_text, old.source_title, old.tags);
    END;
  `,
  `
    CREATE TRIGGER IF NOT EXISTS knowledge_chunks_au
    AFTER UPDATE ON knowledge_chunks
    BEGIN
      INSERT INTO knowledge_fts (knowledge_fts, rowid, chunk_text, source_title, tags)
      VALUES ('delete', old.rowid, old.chunk_text, old.source_title, old.tags);
      INSERT INTO knowledge_fts (rowid, chunk_text, source_title, tags)
      VALUES (new.rowid, new.chunk_text, new.source_title, new.tags);
    END;
  `,
  `
    CREATE TABLE IF NOT EXISTS safety_events (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      rating INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `
] as const;
