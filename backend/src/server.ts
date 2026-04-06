import { mkdir } from "node:fs/promises";
import { loadEnvConfig } from "./config/env.js";
import { connectMongo } from "./db/mongoose.js";
import { buildApp } from "./app.js";

async function main() {
  const env = loadEnvConfig();
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  const app = await buildApp(env);
  await connectMongo(env.MONGODB_URI, app.log);
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    await app.close();
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
