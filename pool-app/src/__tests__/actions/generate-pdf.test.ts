import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted trace for the jsPDF mock. Each new MockDoc resets the trace,
// so the latest generateJobPdf call is what we inspect.
const pdfTrace = vi.hoisted(() => ({
  textCalls: [] as unknown[][],
  addImageCalls: [] as unknown[][],
  addPageCount: 0,
}));

vi.mock("jspdf", () => {
  class MockDoc {
    constructor(_opts: unknown) {
      pdfTrace.textCalls = [];
      pdfTrace.addImageCalls = [];
      pdfTrace.addPageCount = 0;
    }
    setFont = () => {};
    setFontSize = () => {};
    setLineWidth = () => {};
    setProperties = () => {};
    line = () => {};
    text = (...args: unknown[]) => {
      pdfTrace.textCalls.push(args);
    };
    // Minimal wrap: single-line for every string, empty for anything else.
    splitTextToSize = (s: unknown) => (typeof s === "string" ? [s] : [""]);
    addImage = (...args: unknown[]) => {
      pdfTrace.addImageCalls.push(args);
    };
    addPage = () => {
      pdfTrace.addPageCount++;
    };
    // Fixed aspect so fitPhoto resolves deterministically.
    getImageProperties = () => ({ width: 100, height: 80 });
    output = () => "stub_base64_pdf_data";
  }
  return { jsPDF: MockDoc };
});

vi.mock("@/lib/db", () => ({
  db: {
    job: {
      findUnique: vi.fn(),
    },
  },
}));

import { generateJobPdf } from "@/lib/actions/generate-pdf";
import { db } from "@/lib/db";

const fakeImageBytes = new ArrayBuffer(4);

function photoMeta(url: string) {
  // filename derived from the last URL segment; size/uploadedAt are stubs
  // that the render path doesn't inspect beyond PhotoMetadata shape.
  return {
    url,
    filename: `${url.split("/").pop() ?? url}.jpg`,
    size: 100,
    uploadedAt: "2026-04-20",
  };
}

function okFetchResponse() {
  return { arrayBuffer: async () => fakeImageBytes } as unknown as Response;
}

function fetchedUrls(): string[] {
  return vi
    .mocked(globalThis.fetch)
    .mock.calls.map((call) => call[0] as string);
}

function jpegImageCount(): number {
  // Format arg (addImage signature): addImage(data, format, x, y, w, h, ...)
  // Logo uses "PNG"; real photos use "JPEG". Filter to count only real
  // photo embeds, excluding the logo.
  return pdfTrace.addImageCalls.filter((args) => args[1] === "JPEG").length;
}

function textWasDrawn(target: string): boolean {
  return pdfTrace.textCalls.some((args) => {
    const first = args[0];
    if (Array.isArray(first)) return first.some((line) => line === target);
    return first === target;
  });
}

function remarksTextareaField(id: string, order: number, label: string) {
  return { id, type: "textarea", label, required: false, order };
}

function photoField(id: string, order: number, label: string) {
  return { id, type: "photo", label, required: false, order };
}

beforeEach(() => {
  vi.clearAllMocks();
  pdfTrace.textCalls = [];
  pdfTrace.addImageCalls = [];
  pdfTrace.addPageCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => okFetchResponse()),
  );
});

describe("generateJobPdf — remarks-photo render path", () => {
  it("renders remarks note text AND fetches + embeds each photo in its *_photos bucket", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      name: "Test Job",
      submittedBy: null,
      submittedAt: null,
      workerSignature: null,
      photos: [
        photoMeta("http://test.local/r1"),
        photoMeta("http://test.local/r2"),
      ],
      formData: {
        "15_remarks_notes": "Worker observed a minor seep near the pump seal.",
        __photoAssignmentsByField: {
          "15_remarks_notes_photos": [
            "http://test.local/r1",
            "http://test.local/r2",
          ],
        },
        __photoAssignmentsReviewed: true,
      },
      template: {
        id: "t1",
        name: "Test Template",
        fields: [
          remarksTextareaField("15_remarks_notes", 15, "Section 15 Remarks"),
          photoField("108_additional_photos", 108, "Additional Photos"),
        ],
      },
    } as never);

    const res = await generateJobPdf("job-1");
    expect(res).toEqual({ success: true, data: "stub_base64_pdf_data" });

    // Note text was drawn into the PDF (textarea value block).
    expect(
      textWasDrawn("Worker observed a minor seep near the pump seal."),
    ).toBe(true);

    // Section label was also drawn.
    expect(textWasDrawn("Section 15 Remarks")).toBe(true);

    // Both remarks photos were fetched AND embedded as JPEG images.
    const urls = fetchedUrls();
    expect(urls).toContain("http://test.local/r1");
    expect(urls).toContain("http://test.local/r2");
    expect(jpegImageCount()).toBe(2);
  });

  it("consumed remarks photos do NOT also drain into Q108 Additional Photos", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      photos: [
        photoMeta("http://test.local/r1"),
        photoMeta("http://test.local/r2"),
      ],
      formData: {
        "15_remarks_notes": "n",
        __photoAssignmentsByField: {
          "15_remarks_notes_photos": [
            "http://test.local/r1",
            "http://test.local/r2",
          ],
        },
        __photoAssignmentsReviewed: true,
      },
      template: {
        id: "t1",
        name: "Test Template",
        fields: [
          remarksTextareaField("15_remarks_notes", 15, "Section 15 Remarks"),
          photoField("108_additional_photos", 108, "Additional Photos"),
        ],
      },
    } as never);

    const res = await generateJobPdf("job-1");
    expect(res.success).toBe(true);

    const urls = fetchedUrls();
    // Each remarks URL fetched exactly once — Pass 2.5 consumption
    // removed them from the Q108 drain queue.
    expect(urls.filter((u) => u === "http://test.local/r1")).toHaveLength(1);
    expect(urls.filter((u) => u === "http://test.local/r2")).toHaveLength(1);
    // Total fetches = 2 remarks photos; no Q108 drain duplication.
    expect(urls).toHaveLength(2);
    // Exactly 2 JPEG addImages (no third from a drain re-render).
    expect(jpegImageCount()).toBe(2);
  });

  it("sibling isolation: section-15 photos render under section 15, section-33 under section 33", async () => {
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      photos: [
        photoMeta("http://test.local/fifteen"),
        photoMeta("http://test.local/thirtythree"),
      ],
      formData: {
        "15_remarks_notes": "note 15",
        "33_remarks_notes": "note 33",
        __photoAssignmentsByField: {
          "15_remarks_notes_photos": ["http://test.local/fifteen"],
          "33_remarks_notes_photos": ["http://test.local/thirtythree"],
        },
        __photoAssignmentsReviewed: true,
      },
      template: {
        id: "t1",
        name: "Test Template",
        fields: [
          remarksTextareaField("15_remarks_notes", 15, "Section 15 Remarks"),
          remarksTextareaField("33_remarks_notes", 33, "Section 33 Remarks"),
        ],
      },
    } as never);

    const res = await generateJobPdf("job-1");
    expect(res.success).toBe(true);

    const urls = fetchedUrls();
    expect(urls.filter((u) => u === "http://test.local/fifteen")).toHaveLength(
      1,
    );
    expect(
      urls.filter((u) => u === "http://test.local/thirtythree"),
    ).toHaveLength(1);
    // Template order: section 15 (order 15) before section 33 (order 33),
    // so "fifteen" must be fetched before "thirtythree" — proves the URL
    // attached to each bucket flows into the corresponding section.
    const idx15 = urls.indexOf("http://test.local/fifteen");
    const idx33 = urls.indexOf("http://test.local/thirtythree");
    expect(idx15).toBeGreaterThanOrEqual(0);
    expect(idx33).toBeGreaterThanOrEqual(0);
    expect(idx15).toBeLessThan(idx33);
  });

  it("regression: non-remarks multi-photo legacy mirror + Q108 drain still render as before", async () => {
    // Pre-new-shape data: Q5 has its legacy mirror URL. One orphan photo
    // drains into Q108 via Pass 3 (no reviewed flag, no remarks activity).
    // Proves this task's Pass 2.5 consumption only affects remarks-photo
    // owners, not the pre-existing paths.
    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      photos: [
        photoMeta("http://test.local/q5"),
        photoMeta("http://test.local/drain"),
      ],
      formData: {
        "5_picture_of_pool_and_spa_if_applicable": "http://test.local/q5",
      },
      template: {
        id: "t1",
        name: "Test Template",
        fields: [
          photoField("5_picture_of_pool_and_spa_if_applicable", 5, "Q5"),
          photoField("108_additional_photos", 108, "Additional Photos"),
        ],
      },
    } as never);

    const res = await generateJobPdf("job-1");
    expect(res.success).toBe(true);

    const urls = fetchedUrls();
    // Q5 fetched via legacy-mirror resolution.
    expect(urls).toContain("http://test.local/q5");
    // Unassigned orphan drains into Q108 at render time.
    expect(urls).toContain("http://test.local/drain");
    expect(jpegImageCount()).toBe(2);
  });

  it("per-photo failure fallback: a single bad remarks-photo fetch does not corrupt the rest of the render", async () => {
    // Three remarks photos; middle one's fetch is rejected. The other
    // two must still fetch and embed, and the bad one must surface a
    // "[photo could not be loaded]" fallback line rather than throwing.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "http://test.local/bad") {
          throw new Error("Simulated network failure");
        }
        return okFetchResponse();
      }),
    );

    vi.mocked(db.job.findUnique).mockResolvedValue({
      id: "job-1",
      status: "DRAFT",
      photos: [
        photoMeta("http://test.local/good1"),
        photoMeta("http://test.local/bad"),
        photoMeta("http://test.local/good2"),
      ],
      formData: {
        "15_remarks_notes": "remarks note value",
        __photoAssignmentsByField: {
          "15_remarks_notes_photos": [
            "http://test.local/good1",
            "http://test.local/bad",
            "http://test.local/good2",
          ],
        },
        __photoAssignmentsReviewed: true,
      },
      template: {
        id: "t1",
        name: "Test Template",
        fields: [
          remarksTextareaField("15_remarks_notes", 15, "Section 15 Remarks"),
        ],
      },
    } as never);

    const res = await generateJobPdf("job-1");
    // Generation still completes successfully — the bad photo doesn't
    // abort the pipeline.
    expect(res).toEqual({ success: true, data: "stub_base64_pdf_data" });

    const urls = fetchedUrls();
    // All three fetches were attempted in order.
    expect(urls).toEqual([
      "http://test.local/good1",
      "http://test.local/bad",
      "http://test.local/good2",
    ]);

    // Exactly two successful JPEG embeds (good1 and good2; bad skipped).
    expect(jpegImageCount()).toBe(2);

    // The fallback line was drawn instead of the bad photo.
    expect(textWasDrawn("[photo could not be loaded]")).toBe(true);

    // Note text still rendered — a failed photo fetch didn't disrupt the
    // textarea section that precedes it.
    expect(textWasDrawn("remarks note value")).toBe(true);
  });
});
