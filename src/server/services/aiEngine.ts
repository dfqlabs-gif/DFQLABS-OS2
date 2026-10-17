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
    const evidence = lead.evidence ?? [];
    const verifiedFacts = evidence.filter((e) => e.category === "VERIFIED_FACT").map((e) => e.evidenceText);
    const observations = evidence.filter((e) => e.category === "REASONABLE_OBSERVATION").map((e) => e.evidenceText);
    const instagram = lead.socialProfiles?.find((profile) => profile.platform === "INSTAGRAM");
    const hasInstagramEvidence = Boolean(instagram && evidence.some((item) =>
      item.sourceType === "INSTAGRAM_BIO" || item.sourceType === "POST_CAPTION" ||
      (item.sourceUrl && /instagram\.com/i.test(item.sourceUrl))
    ));
    const breakdownAlreadyPrepared = [...verifiedFacts, ...observations].some((fact) =>
      /(?:6[- ]minute|six[- ]minute|breakdown|audit video).{0,70}(?:recorded|prepared|created|ready|completed)|(?:recorded|prepared|created|ready|completed).{0,70}(?:6[- ]minute|six[- ]minute|breakdown|audit video)/i.test(fact)
    );

    const prompt = `${STYLE}
Write ONE first-touch WhatsApp message for DFQLABS using this proven outreach structure as the CONTROL:
"Hi [Company Name],

We noticed a positioning gap on your Instagram page that could be costing you higher-value buyers.
In fact, we did a quick 6-minute breakdown showing you and how you can fix it—should I send it?"

Personalize only where supplied evidence supports it. Keep the message short and close to this control's structure: (1) specific positioning/content opportunity, (2) potential relevance to higher-value property buyers, (3) offer a short 6-minute breakdown, (4) permission-based question. Do not turn this into a generic introduction or pitch the ₦150,000 audit in the first message.

Company: ${lead.companyName}
Contact: ${lead.contactName || "not provided"}
Business type: ${lead.businessType || lead.description || "real estate company"}
Instagram profile: ${instagram?.handleOrUrl || "not recorded"}
Instagram-specific evidence available: ${hasInstagramEvidence ? "yes" : "no"}
Verified facts: ${verifiedFacts.join(" | ") || "none"}
Reasonable observations: ${observations.join(" | ") || "none"}
Has evidence that a 6-minute breakdown is already prepared: ${breakdownAlreadyPrepared ? "yes" : "no"}

Rules:
- Address the company/contact naturally; prefer "Hi [Company Name]," unless a real contact name makes a one-to-one greeting more natural.
- Only say "we noticed a positioning gap on your Instagram page" when Instagram-specific evidence supports a concrete gap. Otherwise use a softer, accurate opportunity statement; if no Instagram profile is recorded, do not claim to have reviewed its Instagram page.
- Do not claim the breakdown has already been recorded/prepared unless supplied evidence explicitly confirms that. If not confirmed, say "We can put together a quick 6-minute breakdown..." or equivalent.
- Do not invent a problem, project, achievement, location, buyer loss, prior interaction, or completed research.
- Do not claim the prospect is losing buyers as a proven fact; frame impact as a possibility.
- No emojis, no flattery, no generic "I'm reaching out from DFQLABS" opening, no audit pricing in this first message.
- Aim for 35–65 words. End with a simple permission-based question. Return only the message text.`;

    const generated = await gemini(prompt);
    const fallback = instagram
      ? `Hi ${lead.companyName},

We noticed an opportunity to strengthen how your Instagram page attracts higher-value property buyers. We can put together a quick 6-minute breakdown showing what we spotted and how you could address it.

Would you like me to send it?`
      : `Hi ${lead.companyName},

We help real estate businesses strengthen their positioning to attract higher-value property buyers. We can put together a quick 6-minute breakdown of opportunities relevant to your business and how you could address them.

Would you like me to send it?`;

    return { draftText: generated || fallback, evidenceUsed: [...verifiedFacts, ...observations] };
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
