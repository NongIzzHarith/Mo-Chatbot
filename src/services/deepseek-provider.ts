import OpenAI from "openai";
import { z } from "zod";

import { config } from "../config.js";
import type { StructuredModelReply } from "../lib/types.js";

const structuredReplySchema = z.object({
  reply: z.string().min(1),
  next_step: z.string().optional(),
  citation_ids: z.array(z.string()).optional(),
  memory_candidates: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string().min(1),
        confidence: z.number().min(0).max(1)
      })
    )
    .optional(),
  requires_scholar_referral: z.boolean().optional()
});

export class DeepSeekProvider {
  private readonly client = new OpenAI({
    apiKey: config.deepseekApiKey,
    baseURL: config.deepseekBaseUrl
  });

  private static coerceJson(content: string): StructuredModelReply {
    const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return structuredReplySchema.parse(parsed);
  }

  async generateStructuredReply(input: {
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  }): Promise<StructuredModelReply> {
    if (!config.deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured.");
    }

    const completion = await this.client.chat.completions.create({
      model: input.model,
      messages: input.messages as any,
      temperature: 0.6,
      response_format: { type: "json_object" }
    } as any);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek returned an empty response.");
    }

    return DeepSeekProvider.coerceJson(content);
  }
}
