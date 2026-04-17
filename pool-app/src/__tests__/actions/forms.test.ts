import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    job: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { saveFormData } from "@/lib/actions/forms";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { RESERVED_PHOTO_MAP_KEY, REVIEWED_FLAG } from "@/lib/multi-photo";
import { RESERVED_SUMMARY_KEY } from "@/lib/summary";

const MULTI_FIELD = "5_picture_of_pool_and_spa_if_applicable";

// Helper: the data.formData payload that was written on the latest
// updateMany call. Mirrors what a "reload from DB" would observe.
function writtenFormData(): Record<string, unknown> {
  const calls = vi.mocked(db.job.updateMany).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const arg = calls[calls.length - 1]![0] as {
    data: { formData: Record<string, unknown> };
  };
  return arg.data.formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.job.updateMany).mockResolvedValue({ count: 1 } as never);
});

describe("saveFormData", () => {
  it("saves form data to the job", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: null,
    } as never);

    const formData = { customer_name: "Alice", pool_type: "Inground" };
    await saveFormData("job-1", formData);

    expect(db.job.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", status: "DRAFT" },
      data: { formData },
    });
  });

  it("overwrites existing form data", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: { customer_name: "Old" },
    } as never);

    const formData = { customer_name: "New", address: "123 Main" };
    await saveFormData("job-1", formData);

    expect(db.job.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", status: "DRAFT" },
      data: { formData },
    });
  });

  it("revalidates the job path", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: null,
    } as never);

    await saveFormData("job-1", { name: "Test" });

    expect(revalidatePath).toHaveBeenCalledWith("/jobs/job-1");
  });

  it("throws when job not found", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue(null);

    await expect(saveFormData("bad-id", {})).rejects.toThrow("Job not found");
  });

  // --- Task 2 autosave-preserve proofs ---

  it("preserves __photoAssignmentsByField across autosave", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: {
        customer_name: "X",
        [RESERVED_PHOTO_MAP_KEY]: { [MULTI_FIELD]: ["u1"] },
      },
    } as never);

    await saveFormData("job-1", { customer_name: "Y" });

    const saved = writtenFormData();
    expect(saved.customer_name).toBe("Y");
    expect(saved[RESERVED_PHOTO_MAP_KEY]).toEqual({ [MULTI_FIELD]: ["u1"] });
  });

  it("preserves __summary_items across autosave", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: {
        foo: "a",
        [RESERVED_SUMMARY_KEY]: [{ text: "t", photos: [] }],
      },
    } as never);

    await saveFormData("job-1", { foo: "b" });

    const saved = writtenFormData();
    expect(saved.foo).toBe("b");
    expect(saved[RESERVED_SUMMARY_KEY]).toEqual([{ text: "t", photos: [] }]);
  });

  it("preserves __photoAssignmentsReviewed across autosave", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: { foo: "a", [REVIEWED_FLAG]: true },
    } as never);

    await saveFormData("job-1", { foo: "b" });

    const saved = writtenFormData();
    expect(saved.foo).toBe("b");
    expect(saved[REVIEWED_FLAG]).toBe(true);
  });

  it("filters undefined RHF values (does not delete DB keys)", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: { foo: "keep_me" },
    } as never);

    await saveFormData("job-1", { foo: undefined } as never);

    const saved = writtenFormData();
    expect(saved.foo).toBe("keep_me");
  });

  it("strips __-prefixed keys from client payload", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: {
        foo: "a",
        [RESERVED_PHOTO_MAP_KEY]: { [MULTI_FIELD]: ["good"] },
      },
    } as never);

    await saveFormData("job-1", {
      foo: "b",
      [RESERVED_PHOTO_MAP_KEY]: { [MULTI_FIELD]: ["EVIL_CLIENT_OVERWRITE"] },
    } as never);

    const saved = writtenFormData();
    expect(saved.foo).toBe("b");
    expect(saved[RESERVED_PHOTO_MAP_KEY]).toEqual({ [MULTI_FIELD]: ["good"] });
  });

  it("rejects writes to SUBMITTED jobs", async () => {
    const seeded = { customer_name: "SealedInStone" };
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "SUBMITTED",
      formData: seeded,
    } as never);

    await expect(
      saveFormData("job-1", { customer_name: "ShouldNotWrite" }),
    ).rejects.toThrow(/no longer editable/i);

    expect(db.job.updateMany).not.toHaveBeenCalled();
  });

  it("simulates a reserved-key write between page-load and autosave (fresh-DB-read proof)", async () => {
    // The mock's findUnique return represents "what's in the DB at the
    // moment saveFormData is invoked" — i.e. after assignMultiFieldPhotos
    // has already landed mid-flight. The client's RHF state (arg 2) does
    // NOT know about the reserved key; a stale-client-snapshot merge would
    // drop it. We prove we merge from DB by showing the key survives.
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      formData: {
        foo: "a",
        [RESERVED_PHOTO_MAP_KEY]: { [MULTI_FIELD]: ["mid-flight"] },
      },
    } as never);

    await saveFormData("job-1", { foo: "b" });

    const saved = writtenFormData();
    expect(saved.foo).toBe("b");
    expect(saved[RESERVED_PHOTO_MAP_KEY]).toEqual({
      [MULTI_FIELD]: ["mid-flight"],
    });
  });
});
