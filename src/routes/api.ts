import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { ConversationRepository } from "../repositories/conversation-repository.js";
import { FeedbackRepository } from "../repositories/feedback-repository.js";
import { KnowledgeRepository } from "../repositories/knowledge-repository.js";
import { MemoryRepository } from "../repositories/memory-repository.js";
import { ChatService } from "../services/chat-service.js";
import { DeepSeekProvider } from "../services/deepseek-provider.js";

const chatBodySchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  userId: z.string().optional(),
  displayName: z.string().optional(),
  locale: z.string().default("en"),
  text: z.string().min(1).max(5000)
});

const forgetBodySchema = z.object({
  deleteMemory: z.boolean().default(true)
});

const feedbackSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  note: z.string().max(1000).optional()
});

const knowledgeSchema = z.object({
  documents: z
    .array(
      z.object({
        sourceTitle: z.string().min(1).max(300),
        sourceType: z.string().min(1).max(80),
        sourceUrl: z.string().url().optional().nullable(),
        school: z.string().max(120).optional().nullable(),
        tags: z.array(z.string().min(1).max(60)).optional(),
        lastVerifiedAt: z.string().optional().nullable(),
        chunkText: z.string().min(20).max(6000)
      })
    )
    .min(1)
});

const conversations = new ConversationRepository();
const memory = new MemoryRepository();
const knowledge = new KnowledgeRepository();
const feedback = new FeedbackRepository();
const provider = new DeepSeekProvider();
const chatService = new ChatService(conversations, memory, knowledge, provider);

function respondWithZodError(response: Response, error: z.ZodError): Response {
  return response.status(400).json({
    error: "Invalid request body",
    details: error.flatten()
  });
}

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({ ok: true, service: "mo-backend" });
});

apiRouter.post("/v1/chat/message", async (request: Request, response: Response) => {
  const parsed = chatBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return respondWithZodError(response, parsed.error);
  }

  try {
    const result = await chatService.sendMessage({
      conversationId: parsed.data.conversationId ?? undefined,
      userId: parsed.data.userId,
      displayName: parsed.data.displayName,
      locale: parsed.data.locale,
      text: parsed.data.text
    });

    return response.json(result);
  } catch (error) {
    return response.status(500).json({
      error: "Failed to process chat message",
      details: (error as Error).message
    });
  }
});

apiRouter.get("/v1/chat/:conversationId/messages", (request: Request, response: Response) => {
  const { conversationId } = request.params;
  const conversation = conversations.getConversation(conversationId);

  if (!conversation) {
    return response.status(404).json({ error: "Conversation not found" });
  }

  const messages = conversations.getMessages(conversationId, 200);
  return response.json({ conversation, messages });
});

apiRouter.post("/v1/chat/:conversationId/forget", (request: Request, response: Response) => {
  const parsed = forgetBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return respondWithZodError(response, parsed.error);
  }

  const result = conversations.forgetConversation(request.params.conversationId, parsed.data.deleteMemory);

  if (!result.deleted) {
    return response.status(404).json({ error: "Conversation not found" });
  }

  return response.json({ ok: true });
});

apiRouter.get("/v1/users/:userId/memory", (request: Request, response: Response) => {
  const items = memory.getActiveMemory(request.params.userId);
  return response.json({ userId: request.params.userId, items });
});

apiRouter.get("/v1/users/:userId/conversations", (request: Request, response: Response) => {
  const items = conversations.listConversationsForUser(request.params.userId, 100);
  return response.json({ userId: request.params.userId, conversations: items });
});

apiRouter.post("/v1/feedback", (request: Request, response: Response) => {
  const parsed = feedbackSchema.safeParse(request.body);
  if (!parsed.success) {
    return respondWithZodError(response, parsed.error);
  }

  feedback.save(parsed.data);
  return response.status(201).json({ ok: true });
});

apiRouter.post("/v1/knowledge/chunks", (request: Request, response: Response) => {
  const parsed = knowledgeSchema.safeParse(request.body);
  if (!parsed.success) {
    return respondWithZodError(response, parsed.error);
  }

  const inserted = knowledge.insertChunks(parsed.data.documents);
  return response.status(201).json({ ok: true, inserted });
});

apiRouter.get("/v1/knowledge/search", (request: Request, response: Response) => {
  const query = typeof request.query.q === "string" ? request.query.q : "";
  if (!query.trim()) {
    return response.status(400).json({ error: "Missing query parameter q" });
  }

  const results = knowledge.searchRelevant(query, 10);
  return response.json({ results });
});
