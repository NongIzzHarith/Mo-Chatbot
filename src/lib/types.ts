export type MessageRole = "user" | "assistant" | "system";
export type RiskLevel = "low" | "medium" | "high";
export type SafetyCategory =
  | "self_harm"
  | "abuse"
  | "medical"
  | "legal"
  | "fatwa"
  | "financial"
  | "general_distress";

export interface Citation {
  knowledgeId: string;
  sourceTitle: string;
  sourceType: string;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  excerpt: string;
}

export interface StoredConversation {
  id: string;
  userId: string | null;
  title: string | null;
  status: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  body: string;
  language: string | null;
  citations: Citation[];
  riskLevel: RiskLevel;
  modelProvider: string | null;
  modelName: string | null;
  createdAt: string;
}

export interface MemoryItem {
  id: string;
  userId: string;
  key: string;
  value: string;
  confidence: number;
  expiresAt: string | null;
  deletedAt: string | null;
  sourceMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryCandidate {
  key: "name" | "goal" | "recurring_struggle" | "tone_preference" | "language_preference";
  value: string;
  confidence: number;
}

export interface KnowledgeChunk {
  id: string;
  sourceTitle: string;
  sourceType: string;
  sourceUrl: string | null;
  school: string | null;
  tags: string[];
  chunkText: string;
  lastVerifiedAt: string | null;
  createdAt: string;
}

export interface SafetyAssessment {
  riskLevel: RiskLevel;
  categories: SafetyCategory[];
  disableHumor: boolean;
  requiresImmediateSupport: boolean;
}

export interface StructuredModelReply {
  reply: string;
  next_step?: string;
  citation_ids?: string[];
  memory_candidates?: MemoryCandidate[];
  requires_scholar_referral?: boolean;
}
