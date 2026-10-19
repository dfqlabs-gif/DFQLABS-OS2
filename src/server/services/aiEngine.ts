import { Lead } from "../../shared/types/index.js";
import { env } from "../config/env.js";

export interface BriefingResult { overview: string; keyFacts: string[]; recommendedHook: string; }
export interface FirstTouchDraftResult { draftText: string; evidenceUsed: string[]; }

const STYLE = `DFQLABS outreach style: human, warm, concise, professional, specific, useful before asking for anything. Never fake familiarity. Never invent facts. The offer is a free strategic audit worth ₦150,000. The message should feel like a thoughtful one-to-one WhatsApp message, not a mass campaign. Preserve the core intent and positioning while varying wording and sentence structure so repeated outreach does not look copied or spammy.`;

async function gemini(prompt: string): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.55, maxOutputTokens: 220 } })
    });
    if (!response.ok) return null;
    const json = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim() || null;
  } catch { return null; }
}

export class AIEngineService {
  public static async generateBriefing(lead: Lead): Promise<BriefingResult> {
    const verifiedFacts = lead.evidence?.filter((e) => e.category === "VERIFIED_FACT").map((e) => e.evidenceText) ?? [];
    return {
      overview: `Prospect briefing for ${lead.companyName} (${lead.businessType ?? "Real Estate"}) in ${lead.location ?? "Nigeria"}.`,
      keyFacts: verifiedFacts.length > 0 ? verifiedFacts : ["No verified prospect-specific facts have been recorded yet."],
      recommendedHook: lead.location ? `Use only verified observations about ${lead.location} and the prospect's content.` : "Lead with a useful observation, not generic praise."
    };
  }

  public static async generateFirstTouch(lead: Lead): Promise<FirstTouchDraftResult> {
    // This is DFQLABS's proven control message. Do not paraphrase or ask AI to rewrite it.
    // Only replace the company-name placeholder; preserve all other wording and punctuation exactly.
    const template = "Hi [Company Name],\n\nI'm writing you because we noticed a huge positioning gap on your IG page that could be costing you higher-value buyers.\nIn fact we did a quick 6 min breakdown showing you and how you can fix it—should I send it?";
    const draftText = template.replace("[Company Name]", lead.companyName);
    const evidenceUsed = (lead.evidence ?? [])
      .filter((item) => item.category === "VERIFIED_FACT" || item.category === "REASONABLE_OBSERVATION")
      .map((item) => item.evidenceText);
    return { draftText, evidenceUsed };
  }

  public static async generateFollowUp(lead: Lead, history: Array<{ direction: string; content: string }>): Promise<FirstTouchDraftResult> {
    const recent = history.slice(-8).map((m) => `${m.direction}: ${m.content}`).join("\n");
    const prompt = `${STYLE}
You are the single DFQLABS Sales Brain. Read the entire supplied conversation before writing. If the latest prospect reply is positive (for example “yes”, “sure”, “I’m interested”), acknowledge it briefly, explain that the free strategic audit is worth ₦150,000, takes about 2–3 business days, and briefly say what the audit covers. If they ask “is this free?”, answer that directly: yes, it is free. If they are not interested, close politely in 2–3 lines and do not keep selling. If they ask a question or raise an objection, answer that actual question rather than repeating the original pitch. If there is no reply, use a light non-pushy follow-up. Never invent facts, meetings, commitments or dates.
Company: ${lead.companyName}
Conversation:
${recent}
Return only the message text.`;
    const generated = await gemini(prompt);
    const fallback = history.some((m) => m.direction === "INBOUND")
      ? `Thanks for getting back to us. Based on what you've shared, I can send over the free strategic audit. Would you like me to proceed?`
      : `Hi, just following up on my earlier message. I’d be happy to share the free strategic audit if it would be useful. Would you like me to send the details?`;
    return { draftText: generated || fallback, evidenceUsed: [] };
  }
}
