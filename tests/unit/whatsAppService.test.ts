import { describe, expect, it } from "vitest";
import { WhatsAppService } from "../../src/server/services/whatsAppService.js";

describe("WhatsAppService", () => {
  it("builds a native WhatsApp app deep link instead of a WhatsApp Web URL", () => {
    const url = WhatsAppService.buildTargetUrl("+2348012345678", "Hello DFQLABS");
    expect(url).toBe("whatsapp://send?phone=2348012345678&text=Hello%20DFQLABS");
    expect(url).not.toContain("api.whatsapp.com");
    expect(url).not.toContain("wa.me");
  });

  it("returns a native app link for a valid Nigerian mobile number", () => {
    const info = WhatsAppService.getContactInfo("08012345678", "Hello");
    expect(info.status).toBe("LINK_AVAILABLE");
    expect(info.phoneNormalized).toBe("+2348012345678");
    expect(info.clickToChatUrl).toBe("whatsapp://send?phone=2348012345678&text=Hello");
    expect(info.isConfirmed).toBe(false);
  });

  it("returns INVALID_NUMBER for landline or dummy number", () => {
    const info = WhatsAppService.getContactInfo("08000000000");
    expect(info.status).toBe("INVALID_NUMBER");
    expect(info.clickToChatUrl).toBeUndefined();
  });
});
