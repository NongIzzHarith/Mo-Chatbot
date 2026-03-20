import { fileURLToPath } from "node:url";
import path from "node:path";
import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { apiRouter } from "./routes/api.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(apiRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(500).json({
    error: "Unhandled server error",
    details: error instanceof Error ? error.message : "Unknown error"
  });
});

app.listen(config.port, () => {
  console.log(`Mo backend listening on http://localhost:${config.port}`);
});
