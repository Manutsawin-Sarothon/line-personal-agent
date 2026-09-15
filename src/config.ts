import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  OWNER_LINE_USER_ID: z.string().startsWith("U"),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash-lite"),
  TIMEZONE: z.string().default("Asia/Bangkok"),
  DATABASE_PATH: z.string().default("./data/agent.db"),
  PORT: z.coerce.number().int().positive().default(3000)
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return Env.parse(env);
}
