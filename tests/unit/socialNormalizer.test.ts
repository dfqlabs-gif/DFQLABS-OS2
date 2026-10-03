import { describe, expect, it } from "vitest";
import { normalizeSocialIdentifier } from "../../src/server/utils/socialNormalizer.js";

describe("socialNormalizer", () => {
  it("strips @ symbols and whitespace", () => {
    expect(normalizeSocialIdentifier("  @abcproperties_ng  ")).toBe("abcproperties_ng");
  });

  it("strips full Instagram URLs and trailing slashes", () => {
    expect(normalizeSocialIdentifier("https://instagram.com/abcproperties_ng/")).toBe("abcproperties_ng");
    expect(normalizeSocialIdentifier("http://www.instagram.com/abcproperties_ng")).toBe("abcproperties_ng");
  });

  it("strips website domain protocols and www", () => {
    expect(normalizeSocialIdentifier("https://www.abcproperties.com/")).toBe("abcproperties.com");
  });
});
