import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs vitest with the test database url", () => {
    expect(process.env.DATABASE_URL).toContain("consultorio_test");
  });
});
