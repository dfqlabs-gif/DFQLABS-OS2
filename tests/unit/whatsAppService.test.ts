import { describe, expect, it } from "vitest";
import { WhatsAppService } from "../../src/server/services/whatsAppService.js";

describe("WhatsAppService", () => {
  it("builds correct target URL for normalized phone number", () => {
    const url = WhatsAppService.buildTargetUrl("+2348012345678", "Hello DFQLABS");
    expect(url).toBe("https://api.whatsapp.com/send?phone=2348012345678&text=Hello%20DFQLABS");
  });

  it("returns LINK_AVAILABLE for valid Nigerian mobile number", () => {
    const info = WhatsAppService.getContactInfo("08012345678", "Hello");
    expect(info.status).toBe("LINK_AVAILABLE");
    expect(info.phoneNormalized).toBe("+2348012345678");
    expect(info.clickToChatUrl).toContain("2348012345678");
    expect(info.isConfirmed).toBe(false);
  });

  it("returns INVALID_NUMBER for landline or dummy number", () => {
    const info = WhatsAppService.getContactInfo("08000000000");
    expect(info.status).toBe("INVALID_NUMBER");
    expect(info.clickToChatUrl).toBeUndefined();
  });
});
