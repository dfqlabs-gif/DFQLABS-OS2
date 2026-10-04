import crypto from "node:crypto";
import { env } from "../config/env.js";
import { LeadService } from "./leadService.js";
import { User } from "../../shared/types/index.js";

type SessionPayload = { sub: string; exp: number };

function sign(value: string): string {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(value).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body + "." + sign(body);
}

function decode(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export async function authenticateCredentials(email: string, password: string): Promise<{ user: User; token: string } | null> {
  const configured = [
    { email: env.MVP_FOUNDER_EMAIL, password: env.MVP_FOUNDER_PASSWORD, role: "FOUNDER" as const, id: "00000000-0000-0000-0000-000000000001", name: "Founder" },
    { email: env.MVP_SPECIALIST_EMAIL, password: env.MVP_SPECIALIST_PASSWORD, role: "OUTREACH_SPECIALIST" as const, id: "00000000-0000-0000-0000-000000000002", name: "Outreach Specialist" }
  ];
  const match = configured.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!match) return null;
  const user = (await LeadService.getUserByIdAsync(match.id)) ?? {
    id: match.id, email: match.email, fullName: match.name, role: match.role, isActive: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  return { user, token: encode({ sub: user.id, exp: Date.now() + 1000 * 60 * 60 * 12 }) };
}

export function userIdFromToken(token: string): string | null {
  return decode(token)?.sub ?? null;
}
