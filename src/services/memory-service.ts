import type { MemoryCandidate, MemoryItem } from "../lib/types.js";

type MemoryKey = MemoryCandidate["key"];

const allowedKeys = new Set<string>([
  "name",
  "goal",
  "recurring_struggle",
  "tone_preference",
  "language_preference"
]);

function cleanValue(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function isSensitive(value: string): boolean {
  return /\b(suicid|self-harm|rape|assault|crime|illegal|porn|explicit|sex)\b/i.test(value);
}

export function deriveLocalMemoryCandidates(input: { text: string; locale: string }): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  const text = input.text;

  const nameMatch = text.match(/\b(?:my name is|i am|i'm)\s+([A-Za-z][A-Za-z'\-]{1,30})\b/i);
  if (nameMatch) {
    candidates.push({ key: "name", value: cleanValue(nameMatch[1]), confidence: 0.75 });
  }

  const goalMatch = text.match(/\b(?:i want to|my goal is to|i'm trying to)\s+([^.!?]{6,140})/i);
  if (goalMatch) {
    candidates.push({ key: "goal", value: cleanValue(goalMatch[1]), confidence: 0.72 });
  }

  const struggleMatch = text.match(/\b(?:i struggle with|i've been struggling with|my biggest struggle is)\s+([^.!?]{6,140})/i);
  if (struggleMatch) {
    candidates.push({ key: "recurring_struggle", value: cleanValue(struggleMatch[1]), confidence: 0.7 });
  }

  if (/\b(be direct|don't sugarcoat|just be honest|straight answer)\b/i.test(text)) {
    candidates.push({ key: "tone_preference", value: "direct_but_kind", confidence: 0.8 });
  }

  candidates.push({ key: "language_preference", value: input.locale || "en", confidence: 0.6 });

  return filterMemoryCandidates(candidates);
}

export function filterMemoryCandidates(candidates: Array<{ key: string; value: string; confidence: number }>): MemoryCandidate[] {
  const seen = new Set<string>();

  return (candidates as MemoryCandidate[]).filter((candidate) => {
    if (!allowedKeys.has(candidate.key)) {
      return false;
    }

    const value = cleanValue(candidate.value);
    if (!value || isSensitive(value)) {
      return false;
    }

    const identity = `${candidate.key}:${value.toLowerCase()}`;
    if (seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    candidate.value = value;
    candidate.confidence = Math.min(0.95, Math.max(0.4, candidate.confidence));
    return true;
  });
}

export function buildMemorySummary(memoryItems: MemoryItem[]): string {
  if (memoryItems.length === 0) {
    return "No long-term memory stored yet.";
  }

  return memoryItems.map((item) => `- ${item.key}: ${item.value}`).join("\n");
}
