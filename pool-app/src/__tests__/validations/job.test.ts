import { describe, it, expect } from "vitest";
import { createJobSchema } from "@/lib/validations/job";

describe("createJobSchema", () => {
  it("accepts name only", () => {
    const result = createJobSchema.safeParse({ name: "Smith Residence" });
    expect(result.success).toBe(true);
  });

  it("accepts jobNumber only", () => {
    const result = createJobSchema.safeParse({ jobNumber: "2024-042" });
    expect(result.success).toBe(true);
  });

  it("accepts both name and jobNumber", () => {
    const result = createJobSchema.safeParse({
      name: "Smith",
      jobNumber: "042",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty input", () => {
    const result = createJobSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects both undefined", () => {
    const result = createJobSchema.safeParse({
      name: undefined,
      jobNumber: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 chars", () => {
    const result = createJobSchema.safeParse({ name: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects jobNumber over 50 chars", () => {
    const result = createJobSchema.safeParse({ jobNumber: "x".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejects empty string name without jobNumber", () => {
    // name with .min(1) rejects empty string, and no jobNumber to satisfy refine
    const result = createJobSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
