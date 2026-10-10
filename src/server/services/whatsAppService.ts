import { validateNigerianMobilePhone } from "../utils/phoneNormalizer.js";

export type WhatsAppContactStatus =
  | "NOT_CHECKED"
  | "LINK_AVAILABLE"
  | "MANUALLY_CONFIRMED"
  | "NOT_CONFIRMED"
  | "INVALID_NUMBER";

export interface WhatsAppContactInfo {
  phoneRaw: string;
  phoneNormalized?: string;
  status: WhatsAppContactStatus;
  clickToChatUrl?: string;
  isConfirmed: boolean;
  disclaimer: string;
}

export class WhatsAppService {
  public static buildTargetUrl(phoneNormalized: string, messageText: string): string {
    const cleanPhone = phoneNormalized.replace(/\+/g, "").replace(/\s/g, "");
    const encodedText = encodeURIComponent(messageText);
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }

  public static getContactInfo(rawPhone?: string, messageText = ""): WhatsAppContactInfo {
    const validation = validateNigerianMobilePhone(rawPhone);

    const disclaimer = "Link availability indicates structural phone format validity only and does not verify active WhatsApp registration.";

    if (!validation.isValid || !validation.normalized) {
      return {
        phoneRaw: rawPhone || "",
        status: "INVALID_NUMBER",
        isConfirmed: false,
        disclaimer
      };
    }

    const clickToChatUrl = this.buildTargetUrl(validation.normalized, messageText);

    return {
      phoneRaw: validation.raw,
      phoneNormalized: validation.normalized,
      status: "LINK_AVAILABLE",
      clickToChatUrl,
      isConfirmed: false,
      disclaimer
    };
  }
}
