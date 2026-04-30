import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @vercel/blob del()
vi.mock("@vercel/blob", () => ({
  del: vi.fn().mockResolvedValue(undefined),
}));

// Mock Prisma — these actions hit db.$executeRaw directly (atomic SQL
// UPDATEs against the photos jsonb column). Each test sets the resolved
// value: 1 = row affected (happy), 0 = no rows (job not found path).
vi.mock("@/lib/db", () => ({
  db: {
    $executeRaw: vi.fn().mockResolvedValue(1),
    job: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  savePhotoMetadata,
  deletePhoto,
  setPhotoIncludedInPdf,
} from "@/lib/actions/photos";
import { db } from "@/lib/db";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$executeRaw).mockResolvedValue(1);
});

describe("savePhotoMetadata", () => {
  it("appends photo to job photos array via raw SQL UPDATE", async () => {
    await savePhotoMetadata("job-1", {
      url: "https://blob.vercel-storage.com/new.jpg",
      filename: "new.jpg",
      size: 800000,
    });

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const call = vi.mocked(db.$executeRaw).mock.calls[0];
    const subs = call.slice(1) as unknown[];
    expect(subs[0]).toContain(
      '"url":"https://blob.vercel-storage.com/new.jpg"',
    );
    expect(subs[0]).toContain('"filename":"new.jpg"');
    expect(subs[0]).toContain('"size":800000');
    expect(subs[1]).toBe("job-1");
    expect(revalidatePath).toHaveBeenCalledWith("/jobs/job-1");
  });

  it("works for the first photo (SQL handles NULL/empty via COALESCE)", async () => {
    await savePhotoMetadata("job-2", {
      url: "https://blob.vercel-storage.com/first.jpg",
      filename: "first.jpg",
      size: 600000,
    });

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const call = vi.mocked(db.$executeRaw).mock.calls[0];
    const subs = call.slice(1) as unknown[];
    expect(subs[0]).toContain(
      '"url":"https://blob.vercel-storage.com/first.jpg"',
    );
    expect(subs[1]).toBe("job-2");
  });

  it("throws when job not found (zero rows affected)", async () => {
    vi.mocked(db.$executeRaw).mockResolvedValueOnce(0);

    await expect(
      savePhotoMetadata("no-job", { url: "x", filename: "x", size: 0 }),
    ).rejects.toThrow("Job not found");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deletePhoto", () => {
  it("deletes blob and removes photo from array via raw SQL UPDATE", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce({
      status: "DRAFT",
      formData: {},
    } as never);

    await deletePhoto("job-1", "https://blob.vercel-storage.com/delete.jpg");

    expect(del).toHaveBeenCalledWith(
      "https://blob.vercel-storage.com/delete.jpg",
    );
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const call = vi.mocked(db.$executeRaw).mock.calls[0];
    const subs = call.slice(1) as unknown[];
    expect(subs[0]).toBe("https://blob.vercel-storage.com/delete.jpg");
    expect(subs[1]).toBe("job-1");
    expect(revalidatePath).toHaveBeenCalledWith("/jobs/job-1");
  });

  it("throws when job not found (findUnique returns null)", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce(null);

    await expect(
      deletePhoto("no-job", "https://blob.vercel-storage.com/x.jpg"),
    ).rejects.toThrow("Job not found");
    expect(del).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("refuses delete when job is SUBMITTED (server-side guard mirrors UI)", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce({
      status: "SUBMITTED",
      formData: {},
    } as never);

    await expect(
      deletePhoto("submitted-1", "https://blob.vercel-storage.com/x.jpg"),
    ).rejects.toThrow("Cannot delete photos from a submitted job");
    // Critical: neither destructive op runs before the guard rejects.
    expect(del).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("refuses delete when job is an editable copy (carries __sourceJobId)", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce({
      status: "DRAFT",
      formData: { __sourceJobId: "src-original" },
    } as never);

    await expect(
      deletePhoto("copy-1", "https://blob.vercel-storage.com/shared.jpg"),
    ).rejects.toThrow("Cannot delete photos from an editable copy");
    // Critical: del() must NOT run on a shared blob — that would also
    // break the source job's reference to the same URL.
    expect(del).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("setPhotoIncludedInPdf", () => {
  it("writes includedInPdf=false on the matching URL via jsonb_set, preserving siblings (URL params + JSONB literal)", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce({
      status: "DRAFT",
    } as never);

    await setPhotoIncludedInPdf(
      "job-1",
      "https://blob.vercel-storage.com/p1.jpg",
      false,
    );

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const call = vi.mocked(db.$executeRaw).mock.calls[0];
    const subs = call.slice(1) as unknown[];
    // Substitution order in the action: photoUrl, includedJson, jobId.
    expect(subs[0]).toBe("https://blob.vercel-storage.com/p1.jpg");
    expect(subs[1]).toBe("false");
    expect(subs[2]).toBe("job-1");

    // Verify the SQL uses jsonb_set on a CASE branch keyed by elem->>'url'
    // — that's what guarantees only the matching photo is rewritten and
    // sibling photo objects pass through unchanged. Prisma's tagged-template
    // call shape: call[0] IS the TemplateStringsArray (array-like with join).
    const sql = (call[0] as readonly string[]).join("?");
    expect(sql).toContain("jsonb_set");
    expect(sql).toContain("elem->>'url'");
    expect(sql).toContain("jsonb_array_elements");
    expect(sql).toContain("ORDER BY ordinality");

    expect(revalidatePath).toHaveBeenCalledWith("/jobs/job-1");
  });

  it("writes includedInPdf=true when re-including a previously excluded photo", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce({
      status: "DRAFT",
    } as never);

    await setPhotoIncludedInPdf(
      "job-1",
      "https://blob.vercel-storage.com/re-include.jpg",
      true,
    );

    const call = vi.mocked(db.$executeRaw).mock.calls[0];
    const subs = call.slice(1) as unknown[];
    expect(subs[1]).toBe("true");
  });

  it("throws when job not found (findUnique returns null) — guard fires before any SQL", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce(null);

    await expect(
      setPhotoIncludedInPdf(
        "no-job",
        "https://blob.vercel-storage.com/x.jpg",
        false,
      ),
    ).rejects.toThrow("Job not found");
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when row count is 0 (job vanished between findUnique and UPDATE)", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce({
      status: "DRAFT",
    } as never);
    vi.mocked(db.$executeRaw).mockResolvedValueOnce(0);

    await expect(
      setPhotoIncludedInPdf(
        "ghost-job",
        "https://blob.vercel-storage.com/x.jpg",
        false,
      ),
    ).rejects.toThrow("Job not found");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses when job is SUBMITTED — terminal state cannot have its PDF makeup edited (post-submit edits go through createEditableCopy)", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce({
      status: "SUBMITTED",
    } as never);

    await expect(
      setPhotoIncludedInPdf(
        "submitted-1",
        "https://blob.vercel-storage.com/x.jpg",
        false,
      ),
    ).rejects.toThrow("Cannot change photo PDF inclusion on a submitted job");
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("ALLOWS toggling on an editable copy — the include flag lives on the copy's own job.photos JSON, not on the shared blob (deliberate divergence from deletePhoto's editable-copy guard)", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValueOnce({
      status: "DRAFT",
    } as never);

    await setPhotoIncludedInPdf(
      "copy-1",
      "https://blob.vercel-storage.com/shared.jpg",
      false,
    );

    // No throw, SQL ran. The copy's PDF makeup is editable; only the
    // shared blob is off-limits (which this action never touches — no
    // del() call, only a JSON UPDATE on the copy's own row).
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
