import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  JWT_SECRET: z.string().min(32).default("dfqlabs-os2-development-secret-change-me-32"),
  MVP_FOUNDER_EMAIL: z.string().email().default("founder@dfqlabs.com"),
  MVP_FOUNDER_PASSWORD: z.string().min(8).default("password123"),
  MVP_SPECIALIST_EMAIL: z.string().email().default("specialist@dfqlabs.com"),
  MVP_SPECIALIST_PASSWORD: z.string().min(8).default("password123")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

if (parsed.data.NODE_ENV === "production" && parsed.data.JWT_SECRET.includes("change-me")) {
  throw new Error("JWT_SECRET must be explicitly configured in production");
}

export const env = parsed.data;
