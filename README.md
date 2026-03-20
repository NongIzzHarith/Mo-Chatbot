# Mo Backend

A DeepSeek-powered backend for `Mo`, an Islamic counselor chatbot. This service owns conversation history, lightweight user memory, risk checks, and a small curated knowledge store that the frontend can call over HTTP.

## What it includes

- `POST /v1/chat/message` for the main conversation flow
- SQLite storage for users, conversations, messages, memory, knowledge chunks, feedback, and safety events
- A DeepSeek provider layer built on the OpenAI-compatible SDK
- Basic risk detection for self-harm, abuse, medical, legal, and high-stakes religious questions
- Simple FTS search over curated knowledge chunks
- Memory extraction for goals, tone preference, recurring struggles, and language preference

## Quick start

1. Copy `.env.example` to `.env`
2. Set `DEEPSEEK_API_KEY`
3. Install dependencies with `npm install`
4. Run the server with `npm run dev`

The service starts on `http://localhost:3000` by default.

If the DeepSeek key is missing, the server can still boot, but chat generation will return a clear configuration error until `DEEPSEEK_API_KEY` is set.

## Core endpoints

- `GET /health`
- `POST /v1/chat/message`
- `GET /v1/chat/:conversationId/messages`
- `POST /v1/chat/:conversationId/forget`
- `GET /v1/users/:userId/memory`
- `GET /v1/users/:userId/conversations`
- `POST /v1/feedback`
- `POST /v1/knowledge/chunks`
- `GET /v1/knowledge/search?q=...`

## Example chat request

```json
{
  "conversationId": null,
  "userId": "3d6990f6-ec9f-4b4d-b065-a7f67f772b64",
  "displayName": "Ahmad",
  "locale": "en",
  "text": "I feel guilty because I keep falling back into the same habit."
}
```

## Example chat response

```json
{
  "conversationId": "7b10a7ed-ea43-49aa-87f2-9a899ec8272d",
  "userId": "3d6990f6-ec9f-4b4d-b065-a7f67f772b64",
  "assistantMessageId": "28495086-59a5-49aa-9220-3c3886b81b06",
  "reply": "You are not disqualified because you slipped again...",
  "citations": [],
  "riskLevel": "low",
  "nextStep": "Reduce one trigger tonight and make one sincere dua before sleeping.",
  "requiresScholarReferral": false
}
```
