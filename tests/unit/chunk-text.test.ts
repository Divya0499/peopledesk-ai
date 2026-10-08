import { describe, expect, it } from "vitest";

import { chunkText } from "@/lib/chunkText";

const handbook = `NIMBUS HANDBOOK

1. Working Hours
Core hours are 10 AM to 4 PM. Fridays are remote.

2. Leave Policy
Every employee gets 24 days of paid annual leave. Up to 8 days carry forward.
Sick leave is 10 days per year.
`;

describe("chunkText", () => {
  it("keeps every sentence and tags chunks with their section", () => {
    const chunks = chunkText(handbook);
    const all = chunks.map((chunk) => chunk.text).join(" ");

    expect(all).toContain("24 days of paid annual leave");
    expect(all).toContain("Sick leave is 10 days");
    expect(all).toContain("Core hours are 10 AM to 4 PM");

    const leave = chunks.find((chunk) => chunk.text.includes("24 days"));
    expect(leave?.section).toBe("Leave Policy");
  });

  it("returns nothing for empty text", () => {
    expect(chunkText("   \n  ")).toEqual([]);
  });
});
