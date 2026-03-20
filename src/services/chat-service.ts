import type { Citation, KnowledgeChunk, MemoryCandidate, StructuredModelReply } from "../lib/types.js";
import { config } from "../config.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { KnowledgeRepository } from "../repositories/knowledge-repository.js";
import { MemoryRepository } from "../repositories/memory-repository.js";
import { DeepSeekProvider } from "./deepseek-provider.js";
import { buildMemorySummary, deriveLocalMemoryCandidates, filterMemoryCandidates } from "./memory-service.js";
import { buildSystemPrompt } from "./prompt-service.js";
import { assessSafety } from "./safety-service.js";

export class ChatService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly memory: MemoryRepository,
    private readonly knowledge: KnowledgeRepository,
    private readonly provider: DeepSeekProvider
  ) {}

  private selectModel(message: string): string {
    if (!config.useReasonerForComplex) {
      return config.deepseekModel;
    }

    const complex =
      message.length > 320 ||
      /\b(quran|hadith|fatwa|madhhab|scholar|inheritance|divorce|finance|mortgage|riba)\b/i.test(message);

    return complex ? config.deepseekReasonerModel : config.deepseekModel;
  }

  private buildProviderMessages(input: {
    systemPrompt: string;
    history: Array<{ role: "user" | "assistant" | "system"; body: string }>;
  }): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const recentHistory = input.history.slice(-config.maxHistoryMessages);

    return [
      { role: "system", content: input.systemPrompt },
      ...recentHistory.map((message) => ({
        role: message.role,
        content: message.body
      }))
    ];
  }

  private mapCitationIdsToSources(citationIds: string[] | undefined, sources: KnowledgeChunk[]): Citation[] {
    if (!citationIds || citationIds.length === 0) {
      return [];
    }

    const sourceMap = new Map<string, KnowledgeChunk>();
    sources.forEach((source, index) => {
      sourceMap.set(`K${index + 1}`, source);
    });

    return citationIds
      .map((id) => {
        const source = sourceMap.get(id);
        if (!source) {
          return null;
        }

        return {
          knowledgeId: source.id,
          sourceTitle: source.sourceTitle,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          lastVerifiedAt: source.lastVerifiedAt,
          excerpt: source.chunkText.slice(0, 240)
        } satisfies Citation;
      })
      .filter((citation): citation is Citation => citation !== null);
  }

  private mergeMemoryCandidates(
    modelCandidates: Array<{ key: string; value: string; confidence: number }> | undefined,
    localCandidates: MemoryCandidate[]
  ): MemoryCandidate[] {
    return filterMemoryCandidates([...(modelCandidates ?? []), ...localCandidates]);
  }

  async sendMessage(input: {
    conversationId?: string;
    userId?: string;
    displayName?: string;
    locale?: string;
    text: string;
  }): Promise<{
    conversationId: string;
    userId: string | null;
    assistantMessageId: string;
    reply: string;
    citations: Citation[];
    riskLevel: "low" | "medium" | "high";
    nextStep: string | null;
    requiresScholarReferral: boolean;
  }> {
    const locale = input.locale ?? "en";
    const userId = this.conversations.upsertUser({
      userId: input.userId,
      displayName: input.displayName,
      locale
    });

    const conversation = this.conversations.ensureConversation({
      conversationId: input.conversationId,
      userId,
      title: null
    });

    this.conversations.setConversationTitleIfEmpty(conversation.id, input.text);

    const safety = assessSafety(input.text);

    const userMessage = this.conversations.saveMessage({
      conversationId: conversation.id,
      role: "user",
      body: input.text,
      language: locale,
      riskLevel: safety.riskLevel
    });

    const memoryItems = userId ? this.memory.getActiveMemory(userId) : [];
    const knowledge = this.knowledge.searchRelevant(input.text, 4);
    const systemPrompt = buildSystemPrompt({
      locale,
      memorySummary: buildMemorySummary(memoryItems),
      retrievedKnowledge: knowledge,
      safety
    });

    const history = this.conversations.getMessages(conversation.id, config.maxHistoryMessages);
    const model = this.selectModel(input.text);
    const providerMessages = this.buildProviderMessages({
      systemPrompt,
      history: history.map((message) => ({ role: message.role, body: message.body }))
    });

    let structuredReply: StructuredModelReply;

    try {
      structuredReply = await this.provider.generateStructuredReply({
        model,
        messages: providerMessages
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error("[ChatService] Provider error:", errorMessage, error);
      if (errorMessage.includes("DEEPSEEK_API_KEY")) {
        throw error;
      }

      const fallback = [
        "I want to be careful here, and I'm not fully confident I can answer that reliably right now.",
        "Please try again in a moment, and if your question is urgent or high-stakes, check with a qualified scholar or trusted professional."
      ].join(" ");

      const assistantMessage = this.conversations.saveMessage({
        conversationId: conversation.id,
        role: "assistant",
        body: fallback,
        language: locale,
        citations: [],
        riskLevel: safety.riskLevel,
        modelProvider: "deepseek",
        modelName: model
      });

      this.conversations.saveSafetyEvents({
        conversationId: conversation.id,
        messageId: userMessage.id,
        categories: safety.categories,
        severity: safety.riskLevel,
        actionTaken: `Fallback response due to provider error: ${errorMessage}`
      });

      return {
        conversationId: conversation.id,
        userId,
        assistantMessageId: assistantMessage.id,
        reply: fallback,
        citations: [],
        riskLevel: safety.riskLevel,
        nextStep: null,
        requiresScholarReferral: true
      };
    }

    const citations = this.mapCitationIdsToSources(structuredReply.citation_ids, knowledge);
    const mergedMemory = this.mergeMemoryCandidates(
      structuredReply.memory_candidates,
      deriveLocalMemoryCandidates({ text: input.text, locale })
    );

    const assistantMessage = this.conversations.saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      body: structuredReply.reply,
      language: locale,
      citations,
      riskLevel: safety.riskLevel,
      modelProvider: "deepseek",
      modelName: model
    });

    if (userId && mergedMemory.length > 0) {
      this.memory.saveCandidates(userId, mergedMemory, userMessage.id);
    }

    this.conversations.saveSafetyEvents({
      conversationId: conversation.id,
      messageId: userMessage.id,
      categories: safety.categories,
      severity: safety.riskLevel,
      actionTaken:
        safety.riskLevel === "high"
          ? "Serious supportive response and urgent human support guidance required."
          : "Standard guarded response."
    });

    return {
      conversationId: conversation.id,
      userId,
      assistantMessageId: assistantMessage.id,
      reply: structuredReply.reply,
      citations,
      riskLevel: safety.riskLevel,
      nextStep: structuredReply.next_step ?? null,
      requiresScholarReferral: structuredReply.requires_scholar_referral ?? false
    };
  }
}
