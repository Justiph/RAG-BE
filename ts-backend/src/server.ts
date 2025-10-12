// ts-backend/src/server.ts
import "dotenv/config";
import Fastify from "fastify";
import { registerRoutes } from "./routes.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const app = Fastify({ logger: true });
  await registerRoutes(app);
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Server running on http://localhost:${PORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
