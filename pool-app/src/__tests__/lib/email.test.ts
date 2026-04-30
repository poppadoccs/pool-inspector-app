import { describe, it, expect } from "vitest";
import { buildSubmissionEmail } from "@/lib/email";
import { DEFAULT_TEMPLATE } from "@/lib/forms";

describe("buildSubmissionEmail", () => {
  const baseProps = {
    jobTitle: "Smith Residence",
    jobNumber: "2024-042",
    submittedBy: "Mike",
    formData: {
      customer_name: "John Smith",
      address: "123 Main St",
      pool_type: "Inground",
      pool_shape: "Rectangular",
      length: "32",
      width: "16",
      depth_shallow: "3.5",
      depth_deep: "8",
      has_pump: true,
      has_filter: true,
      has_heater: false,
      has_lights: false,
      notes: "Blue tile preferred",
    },
    template: DEFAULT_TEMPLATE,
    photos: [
      {
        url: "https://blob.example.com/photo1.jpg",
        filename: "site-front.jpg",
        size: 500000,
        uploadedAt: "2024-01-15T10:00:00Z",
      },
    ],
  };

  it("includes job title and number", () => {
    const html = buildSubmissionEmail(baseProps);
    expect(html).toContain("Smith Residence");
    expect(html).toContain("#2024-042");
  });

  it("includes submitter name", () => {
    const html = buildSubmissionEmail(baseProps);
    expect(html).toContain("Mike");
  });

  it("renders form field labels and values", () => {
    const html = buildSubmissionEmail(baseProps);
    expect(html).toContain("Customer Name");
    expect(html).toContain("John Smith");
    expect(html).toContain("Pool Type");
    expect(html).toContain("Inground");
    expect(html).toContain("Length (ft)");
    expect(html).toContain("32");
  });

  it("renders checkboxes as Yes/No", () => {
    const html = buildSubmissionEmail(baseProps);
    expect(html).toContain("Pump Installed");
    // true → Yes
    expect(html.indexOf("Yes")).toBeGreaterThan(-1);
    // false → No
    expect(html.indexOf("No")).toBeGreaterThan(-1);
  });

  it("renders photo thumbnails with links", () => {
    const html = buildSubmissionEmail(baseProps);
    expect(html).toContain("https://blob.example.com/photo1.jpg");
    expect(html).toContain("Photos (1)");
    expect(html).toContain("Click any photo to view full size");
  });

  it("omits photo section when no photos", () => {
    const html = buildSubmissionEmail({ ...baseProps, photos: [] });
    expect(html).not.toContain("Photos (");
    expect(html).not.toContain("Click any photo");
  });

  it("escapes HTML in user content", () => {
    const html = buildSubmissionEmail({
      ...baseProps,
      formData: {
        ...baseProps.formData,
        notes: '<script>alert("xss")</script>',
      },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("shows dash for empty optional fields", () => {
    const html = buildSubmissionEmail({
      ...baseProps,
      formData: { ...baseProps.formData, notes: "" },
    });
    // The dash character is inside a span
    expect(html).toContain("—");
  });

  // ── PDF include/exclude split (excluded-photo feature, non-PDF side) ────
  describe("PDF inclusion split", () => {
    const inc = (url: string, includedInPdf?: boolean) => ({
      url,
      filename: url.split("/").pop() ?? url,
      size: 100,
      uploadedAt: "2026-04-28T00:00:00Z",
      ...(includedInPdf === undefined ? {} : { includedInPdf }),
    });

    it("when no photos are excluded, output is unchanged: 'Photos (N)' renders, no excluded section appears", () => {
      const html = buildSubmissionEmail({
        ...baseProps,
        photos: [
          inc("https://blob.example.com/a.jpg"),
          inc("https://blob.example.com/b.jpg", true),
        ],
      });
      expect(html).toContain("Photos (2)");
      expect(html).not.toContain("Excluded from PDF");
      expect(html).not.toContain("for reference");
    });

    it("when some photos are excluded, both sections render with correct counts and disjoint photo URLs (no duplicate rendering)", () => {
      const html = buildSubmissionEmail({
        ...baseProps,
        photos: [
          inc("https://blob.example.com/keep1.jpg"),
          inc("https://blob.example.com/keep2.jpg", true),
          inc("https://blob.example.com/drop1.jpg", false),
          inc("https://blob.example.com/drop2.jpg", false),
        ],
      });

      // Heading counts reflect the split (2 included, 2 excluded), NOT the total.
      expect(html).toContain("Photos (2)");
      expect(html).toContain("Excluded from PDF — for reference (2)");

      // Each URL appears exactly TWICE in the HTML (once as <a href>, once
      // as <img src>) — i.e., once per photo, NOT four times. This proves
      // no photo is rendered in both sections.
      const occurrences = (s: string) =>
        (
          html.match(
            new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          ) ?? []
        ).length;
      expect(occurrences("https://blob.example.com/keep1.jpg")).toBe(2);
      expect(occurrences("https://blob.example.com/keep2.jpg")).toBe(2);
      expect(occurrences("https://blob.example.com/drop1.jpg")).toBe(2);
      expect(occurrences("https://blob.example.com/drop2.jpg")).toBe(2);
    });

    it("when ALL photos are excluded, included section is omitted but excluded section renders all of them (excluded photos never disappear from email)", () => {
      const html = buildSubmissionEmail({
        ...baseProps,
        photos: [
          inc("https://blob.example.com/x1.jpg", false),
          inc("https://blob.example.com/x2.jpg", false),
        ],
      });
      // No 'Photos (N)' header from the included section — included is empty.
      expect(html).not.toMatch(/Photos \(\d+\)/);
      expect(html).toContain("Excluded from PDF — for reference (2)");
      expect(html).toContain("https://blob.example.com/x1.jpg");
      expect(html).toContain("https://blob.example.com/x2.jpg");
    });

    it("excluded section is omitted entirely when no photos are excluded (no empty heading, no stray copy)", () => {
      const html = buildSubmissionEmail({
        ...baseProps,
        photos: [inc("https://blob.example.com/only.jpg")],
      });
      expect(html).not.toContain("Excluded from PDF");
      expect(html).not.toContain("for reference");
    });

    it("legacy photos with no `includedInPdf` field are treated as included (preserves pre-feature behavior for jobs uploaded before this feature shipped)", () => {
      const html = buildSubmissionEmail({
        ...baseProps,
        photos: [
          inc("https://blob.example.com/legacy1.jpg"), // no field
          inc("https://blob.example.com/legacy2.jpg"), // no field
        ],
      });
      expect(html).toContain("Photos (2)");
      expect(html).not.toContain("Excluded from PDF");
    });
  });
});
