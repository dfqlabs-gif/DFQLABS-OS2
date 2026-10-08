import { getSupabaseClient } from "../config/supabase.js";
import { PersistentProspectService } from "./persistentProspectService.js";
import { normalizeSocialIdentifier } from "../utils/socialNormalizer.js";
import { User } from "../../shared/types/index.js";

const DEFAULT_LOCATIONS = ["Abuja", "Kano", "Kaduna", "Jos", "Asaba", "Benin City", "Akwa Ibom"];
const DEFAULT_INDUSTRIES = ["real estate developer", "luxury realtor", "real estate agency", "property investment company"];

type SearchResult = { title?: string; link?: string; snippet?: string };
interface LeadFinderSettings {
  dailyTarget: number;
  minimumScore: number;
  locations: string[];
  industries: string[];
  preferredContact: string;
}

type Candidate = {
  companyName: string;
  location: string;
  description: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  source: string;
  score: number;
  quality: "EXCELLENT" | "HIGH" | "GOOD" | "MEDIUM";
  outreachReady: boolean;
  breakdown: Record<string, number>;
};

function normalize(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function domain(value?: string): string {
  try {
    const u = new URL(value || "");
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch { return ""; }
}

function socialId(value?: string): string {
  if (!value) return "";
  return value.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").split("?")[0];
}

function cleanDiscoveryText(value?: string): string {
  if (!value) return "";
  const cleaned = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /(<|>|\b)(table|tbody|thead|tr|td|script|style)(\b|>)/i.test(value)) return "";
  if (/\b(study|research|survey|article|blog|news|directory|report|jobs|vacancy|pdf)\b/i.test(cleaned) && cleaned.length > 240) return "";
  return cleaned.slice(0, 500);
}

function extractEmail(text: string): string | undefined {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function extractPhone(text: string): string | undefined {
  const candidates = text.match(/(?:\+?234|0)[0-9\s().-]{9,18}/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("234")) return `+${digits}`;
    if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  }
  return undefined;
}

