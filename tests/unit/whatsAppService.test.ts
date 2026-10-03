import { describe, expect, it } from "vitest";
import { WhatsAppService } from "../../src/server/services/whatsAppService.js";

describe("whatsAppService", () => {
  it("formats canonical WhatsApp URL with encoded message text", () => {
    const url = WhatsAppService.buildTargetUrl("+2348012345678", "Hello Sarah, nice to meet you!");
    expect(url).toBe("https://api.whatsapp.com/send?phone=2348012345678&text=Hello%20Sarah%2C%20nice%20to%20meet%20you!");
  });
});
