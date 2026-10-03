import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  SUPABASE_URL: z.string().optional().default("https://placeholder.supabase.co"),
  SUPABASE_ANON_KEY: z.string().optional().default("placeholder-anon-key"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default("placeholder-service-key"),
  GEMINI_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().default("dfqlabs-os2-jwt-secret-default")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
