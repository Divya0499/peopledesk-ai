import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("Correct horse 1");

    expect(await verifyPassword("Correct horse 1", stored)).toBe(true);
    expect(await verifyPassword("correct horse 1", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("never stores the password itself, and salts every hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");

    expect(first).not.toContain("same password");
    expect(first).toMatch(/^scrypt\$[^$]+\$[^$]+$/);
    expect(first).not.toBe(second);
  });

  it("rejects stored values it can't read instead of throwing", async () => {
    for (const stored of ["", "plaintext", "bcrypt$a$b", "scrypt$$", "scrypt$abc"]) {
      expect(await verifyPassword("anything", stored)).toBe(false);
    }
  });
});
