import { describe, expect, it } from "vitest";

import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit, then blocks until the window ends", () => {
    const key = `test:${crypto.randomUUID()}`;
    const start = 1_000_000;

    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000, start).allowed).toBe(true);
    }

    const blocked = rateLimit(key, 3, 60_000, start + 10_000);
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 50 });

    // A new window starts once the old one is over
    expect(rateLimit(key, 3, 60_000, start + 60_000).allowed).toBe(true);
  });

  it("counts each key separately", () => {
    const a = `test:${crypto.randomUUID()}`;
    const b = `test:${crypto.randomUUID()}`;

    expect(rateLimit(a, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(rateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it("forgets a key after reset", () => {
    const key = `test:${crypto.randomUUID()}`;

    rateLimit(key, 1, 60_000);
    expect(rateLimit(key, 1, 60_000).allowed).toBe(false);

    resetRateLimit(key);
    expect(rateLimit(key, 1, 60_000).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address", () => {
    const request = new Request("http://x", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });

    expect(clientIp(request)).toBe("203.0.113.5");
  });

  it("falls back when no proxy header is present", () => {
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
