import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    job: {
      create: vi
        .fn()
        .mockResolvedValue({ id: "test-id", status: "DRAFT" }),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createJob } from "@/lib/actions/jobs";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createJob", () => {
  it("creates job with name", async () => {
    const formData = new FormData();
    formData.set("name", "Smith Residence");

    const result = await createJob(null, formData);

    expect(db.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Smith Residence",
        status: "DRAFT",
      }),
    });
    expect(result).toEqual({ success: true });
  });

  it("creates job with jobNumber", async () => {
    const formData = new FormData();
    formData.set("jobNumber", "2024-042");

    const result = await createJob(null, formData);

    expect(db.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobNumber: "2024-042",
      }),
    });
    expect(result).toEqual({ success: true });
  });

  it("returns error when neither name nor jobNumber", async () => {
    const formData = new FormData();

    const result = await createJob(null, formData);

    expect(result).toHaveProperty("error");
    expect(db.job.create).not.toHaveBeenCalled();
  });

  it("calls revalidatePath on success", async () => {
    const formData = new FormData();
    formData.set("name", "Test Job");

    await createJob(null, formData);

    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("returns success on valid create", async () => {
    const formData = new FormData();
    formData.set("name", "Another Job");
    formData.set("jobNumber", "2024-099");

    const result = await createJob(null, formData);

    expect(result).toEqual({ success: true });
  });
});
