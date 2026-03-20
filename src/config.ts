import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: parseNumber(process.env.PORT, 3000),
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "./data/app.db"),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  deepseekReasonerModel: process.env.DEEPSEEK_REASONER_MODEL ?? "deepseek-reasoner",
  useReasonerForComplex: parseBoolean(process.env.USE_REASONER_FOR_COMPLEX, false),
  maxHistoryMessages: parseNumber(process.env.MAX_HISTORY_MESSAGES, 12)
};
