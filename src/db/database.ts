import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { config } from "../config.js";
import { migrationStatements } from "./schema.js";

const dataDir = path.dirname(config.databasePath);
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(config.databasePath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

for (const statement of migrationStatements) {
  db.exec(statement);
}
