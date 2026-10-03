import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app.js";

describe("prospects endpoints", () => {
  const app = createApp();

  it("checks duplicates via POST /api/v1/prospects/duplicate-check", async () => {
    const res = await request(app)
      .post("/api/v1/prospects/duplicate-check")
      .set("Authorization", "Bearer specialist-token")
      .send({ phone: "08012345678" });

    expect(res.status).toBe(200);
    expect(res.body.matchType).toBe("EXACT_MATCH");
  });

  it("creates a new prospect via POST /api/v1/prospects", async () => {
    const res = await request(app)
      .post("/api/v1/prospects")
      .set("Authorization", "Bearer specialist-token")
      .send({
        companyName: "Guzape Heights Developer",
        contactName: "Ibrahim",
        phone: "08099887766",
        description: "Developing 12 luxury terrace units in Guzape."
      });

    expect(res.status).toBe(201);
    expect(res.body.lead).toBeDefined();
    expect(res.body.lead.companyName).toBe("Guzape Heights Developer");
    expect(res.body.lead.pipelineStage).toBe("UNCONTACTED");
  });

  it("lists prospects via GET /api/v1/prospects", async () => {
    const res = await request(app)
      .get("/api/v1/prospects")
      .set("Authorization", "Bearer specialist-token");

    expect(res.status).toBe(200);
    expect(res.body.leads).toBeDefined();
    expect(Array.isArray(res.body.leads)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });
});
