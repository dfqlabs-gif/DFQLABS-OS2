import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app.js";

describe("auth endpoints", () => {
  const app = createApp();

  it("authenticates via POST /api/v1/auth/login", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "founder@dfqlabs.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe("FOUNDER");
  });

  it("returns active specialist session on GET /api/v1/auth/me", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "specialist@dfqlabs.com", password: "password123" });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe("OUTREACH_SPECIALIST");
  });

  it("returns active founder session on GET /api/v1/auth/me", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "founder@dfqlabs.com", password: "password123" });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("FOUNDER");
  });
});
