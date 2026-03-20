import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { apiRouter } from "./routes/api.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

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
