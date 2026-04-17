---
quick_id: 260416-sac
description: PDF polish — restore title, reposition contact/license block, normalize photo sizing
type: execute
wave: 1
depends_on: []
files_modified:
  - pool-app/src/lib/actions/generate-pdf.ts
  - pool-app/scripts/generate-pdf-proof.ts
autonomous: false
must_haves:
  truths:
    - "PDF shows 'Pool/Spa Inspection' title under the logo"
    - "Contact / license block sits in a paper-form-matching position (not jammed directly under the logo one-line)"
    - "Landscape photos do not dominate the page; portrait photos are not squeezed into narrow slivers"
    - "All prior behavior preserved: numbered questions, no generated section headings, question-specific photos under their questions, Q108 drains leftovers, extras before signature, no photo appendix"
  artifacts:
    - path: "pool-app/src/lib/actions/generate-pdf.ts"
      provides: "Updated PDF generation with title, repositioned contact block, normalized photo sizing"
    - path: "pool-app/scripts/generate-pdf-proof.ts"
      provides: "Same visual changes mirrored so the proof script produces the same output the live action does"
    - path: "C:/Users/renea/Downloads/Kimberly Hennessy-report (2).pdf"
      provides: "Corrected PDF proof for human review"
  key_links:
    - from: "generate-pdf.ts header block"
      to: "scripts/generate-pdf-proof.ts header block"
      via: "identical drawing code"
      pattern: "Pool/Spa Inspection"
    - from: "photo-sizing math"
      to: "jsPDF addImage calls (both Q108 and per-question paths, in both files)"
      via: "shared sizing helper applied consistently"
      pattern: "imgW.*imgH|imgH.*imgW"
---

<objective>
Final PDF polish pass — three focused, surgical changes to the header layout and
photo sizing. No redesign, no new features, no photo-placement-logic changes, no
numbering / wording / signature-order changes. Only:

1. Restore the "Pool/Spa Inspection" title under the logo.
2. Reposition the phone / email / license block to better match the printed paper
   form layout.
3. Normalize photo sizing so portrait and landscape images feel balanced — no
   dominance, no slivers.

Purpose: produce a proof PDF that matches the paper form's top-of-page layout
and reads cleanly across mixed photo orientations. Alex is reviewing this with
the pool-company client, so the output must look like a polished version of
their existing paper form.
Output: updated `generate-pdf.ts`, matching `generate-pdf-proof.ts`, and one
regenerated proof PDF at `C:/Users/renea/Downloads/Kimberly Hennessy-report (2).pdf`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@pool-app/CLAUDE.md
@pool-app/AGENTS.md
@pool-app/src/lib/actions/generate-pdf.ts
@pool-app/scripts/generate-pdf-proof.ts
@.planning/quick/260416-krc-fix-form-photo-fields-to-upload-blob-and/260416-krc-SUMMARY.md
@.planning/quick/260416-mdz-restore-numbered-question-fidelity-and-i/260416-mdz-SUMMARY.md

<current_header_layout>
Header block as it exists today in both generate-pdf.ts and the proof script:

```
[ Centered logo, 50mm × 40mm ]
[ phone | email | license  — one line, centered, 9pt ]
[ horizontal rule ]
[ disclaimer (2 paragraphs, 7.5pt) ]
[ horizontal rule ]
[ Job title (14pt bold) ]
[ Submitted by | Date ]
```

What is missing / wrong vs the paper form:
- No "Pool/Spa Inspection" title under the logo
- The contact / license line sits immediately under the logo; on the paper form
  the contact block sits lower / to the side of the header, not glued to the logo
</current_header_layout>

<current_photo_sizing>
Both files use this pattern (3 places in generate-pdf.ts, 3 in the proof):

```ts
const ar = imgProps.height / imgProps.width;
let imgW = CONTENT_WIDTH;          // 180mm — full page width
let imgH = ar * imgW;
if (imgH > 75) {                    // cap tall images
  imgH = 75;
  imgW = imgH / ar;
}
```

Effects:
- Landscape (ar < 1): imgH = ar * 180 — e.g. 4:3 landscape → 135mm tall, full
  width. Dominates the page.
- Portrait (ar > 1): imgH initially ar * 180, hits the 75mm cap, imgW shrinks to
  75/ar — e.g. 3:4 portrait → width 56mm, a narrow sliver centered on the page.
- Result: landscape and portrait from the same job feel wildly different sizes.

Note: in generate-pdf.ts the image is centered via `imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2`,
but in the proof script the image is anchored at `MARGIN` with width `CONTENT_WIDTH`
(so the proof script does NOT currently shrink width when height is capped —
 it stretches. Fix both.)
</current_photo_sizing>

<paper_form_reference>
The printed Poolsmith's paper inspection form has (top to bottom):
1. Logo (top-left or centered)
2. "Pool/Spa Inspection" title — large, bold, under logo
3. Company contact / license block — separate block, slightly smaller, typically
   aligned to a side or placed lower in the header, NOT stacked one-line tight
   against the logo
4. Disclaimer block
5. Job title / customer info
6. Numbered questions

We do not have a pixel-exact reference. The user has accepted "better match" —
not "pixel-exact". A reasonable interpretation: stacked block beneath the title
with phone / email / license on separate lines, or a right-aligned block beside
the title. Executor picks the cleanest of these that reads well on A4.
</paper_form_reference>

<interfaces>
Both files currently share identical drawing code for:
- Header (logo + contact line)
- Photo sizing math (3 call sites in each)

They MUST stay in sync. After this task, both must produce the same visual
output for the same job. The action is what ships to production; the proof
script is what Alex regenerates locally to review.

Existing constants (unchanged):
```ts
const PAGE_WIDTH = 210;     // A4 mm
const MARGIN = 15;
const CONTENT_WIDTH = 180;  // PAGE_WIDTH - MARGIN * 2
```

Company constants (unchanged):
```ts
const COMPANY_PHONE   = "407-223-5379";
const COMPANY_EMAIL   = "poolsmithsrenovations@gmail.com";
const COMPANY_LICENSE = "License CPC1459862";
```

Photo-sizing target behavior:
- Max width: CONTENT_WIDTH (180mm)
- Max height: 75mm (unchanged cap)
- NEW: min width floor so portraits don't shrink to < ~70mm
- NEW: target rendered area that feels consistent across orientations
  (executor's judgment — e.g. cap landscape to ~110–130mm wide so it doesn't
   fill full width, give portraits ~70–90mm width)
- Always maintain aspect ratio
- Always center horizontally via `MARGIN + (CONTENT_WIDTH - imgW) / 2`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restore title and reposition contact/license block in both PDF generators</name>
  <files>
    pool-app/src/lib/actions/generate-pdf.ts,
    pool-app/scripts/generate-pdf-proof.ts
  </files>
  <action>
    Apply the SAME header-layout change in both files. The two files currently share
    identical header code — they must stay identical after this change.

    In `generate-pdf.ts`, modify the header block (currently lines ~48–80, from
    `// --- Header: Company branding ---` through the first divider line).
    In `scripts/generate-pdf-proof.ts`, apply the same edit to its matching header
    block (currently lines ~86–118).

    New header order:

    1. **Logo** — keep as-is (50mm × 40mm, centered). The `try { addImage(...) } catch`
       text-fallback branch stays.
    2. **Title** (NEW) — immediately below the logo with ~3mm of breathing room:
       ```ts
       doc.setFontSize(16);
       doc.setFont("helvetica", "bold");
       doc.text("Pool/Spa Inspection", PAGE_WIDTH / 2, y, { align: "center" });
       y += 7;
       ```
    3. **Contact / license block** (REPOSITIONED) — render as a stacked, centered
       block BELOW the title instead of one tight line glued to the logo. Use three
       lines at 9pt so each piece of info reads cleanly:
       ```ts
       doc.setFontSize(9);
       doc.setFont("helvetica", "normal");
       doc.text(COMPANY_PHONE, PAGE_WIDTH / 2, y, { align: "center" });
       y += 4;
       doc.text(COMPANY_EMAIL, PAGE_WIDTH / 2, y, { align: "center" });
       y += 4;
       doc.text(COMPANY_LICENSE, PAGE_WIDTH / 2, y, { align: "center" });
       y += 5;
       ```
       This places the block lower in the header with vertical rhythm that mirrors
       the paper form's separated contact section, instead of the current one-line
       jam. `COMPANY_NAME` stays unused (it was already unused — do not reintroduce).
    4. **Divider line** — keep the existing 0.5 lineWidth horizontal rule, followed
       by `y += 5`.

    Everything after the divider (disclaimer, second rule, job title, submitted-by,
    field loop, photos, signature) is UNCHANGED. Do not touch it.

    In the text-fallback branch (when the logo file is missing), replace the
    existing `COMPANY_NAME` text with both the company name AND the new title
    stacked, so the text fallback still renders a usable header:
    ```ts
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_NAME, PAGE_WIDTH / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(16);
    doc.text("Pool/Spa Inspection", PAGE_WIDTH / 2, y, { align: "center" });
    y += 7;
    ```
    (Same change in both files.)

    Verify both header blocks are byte-identical after the edit (apart from
    `COMPANY_NAME` being unused in the proof script vs. used-in-fallback in the
    action — if the proof script does not reference `COMPANY_NAME` at all, adjust
    its fallback to use the string literal "Poolsmith's Renovations LLC" so the
    two header blocks render identically).

    DO NOT change: disclaimer text/sizing, job-title sizing (14pt bold), submitter
    line, section-heading suppression, photo-placement logic, Q108 drain logic,
    safety drain, signature block.
  </action>
  <verify>
    <automated>cd pool-app && npx tsc --noEmit</automated>
    Manual grep check — both files must contain:
    - `doc.text("Pool/Spa Inspection"` exactly once each
    - Three separate `doc.text(COMPANY_PHONE` / `COMPANY_EMAIL` / `COMPANY_LICENSE` calls
      (NOT the old single concatenated `${PHONE}  |  ${EMAIL}  |  ${LICENSE}` line)
  </verify>
  <done>
    Both `generate-pdf.ts` and `generate-pdf-proof.ts` render the same updated
    header (logo → title → stacked contact block → divider) and `tsc --noEmit`
    passes with no new errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Normalize photo sizing in both PDF generators</name>
  <files>
    pool-app/src/lib/actions/generate-pdf.ts,
    pool-app/scripts/generate-pdf-proof.ts
  </files>
  <action>
    Replace the photo-sizing math at ALL call sites in BOTH files so portrait and
    landscape photos render at visually balanced sizes.

    Sites to edit:
    - `generate-pdf.ts` Q108 drain loop (~lines 191–212)
    - `generate-pdf.ts` per-question photo path (~lines 236–259)
    - `generate-pdf.ts` safety drain after the field loop (~lines 331–350)
    - `generate-pdf-proof.ts` Q108 drain loop (~lines 231–257)
    - `generate-pdf-proof.ts` per-question photo path (~lines 270–297)
    - (if present) `generate-pdf-proof.ts` equivalent of safety drain

    Replace each occurrence of:
    ```ts
    const imgProps = doc.getImageProperties(b64);
    const ar = imgProps.height / imgProps.width;
    let imgW = CONTENT_WIDTH;
    let imgH = ar * imgW;
    if (imgH > 75) {
      imgH = 75;
      imgW = imgH / ar;
    }
    ```
    with a single shared sizing helper + invocation. Add this helper near the top
    of each file (outside the exported function, after the constants):

    ```ts
    // Fits an image inside a balanced box so portrait and landscape photos feel
    // consistent — landscape never fills the full content width, portrait never
    // shrinks below a readable minimum. Aspect ratio always preserved.
    function fitPhoto(props: { width: number; height: number }): {
      imgW: number;
      imgH: number;
    } {
      const MAX_W = 130; // mm — keeps landscape from dominating the page
      const MAX_H = 95;  // mm — allows slightly taller portraits than the old 75
      const MIN_W = 70;  // mm — prevents tall portraits from becoming slivers
      const ar = props.height / props.width; // >1 = portrait, <1 = landscape

      // Start at the max width, then scale down if height exceeds MAX_H.
      let imgW = MAX_W;
      let imgH = ar * imgW;
      if (imgH > MAX_H) {
        imgH = MAX_H;
        imgW = imgH / ar;
      }
      // Floor for portrait so it doesn't become a sliver.
      if (imgW < MIN_W) {
        imgW = MIN_W;
        imgH = ar * imgW;
      }
      return { imgW, imgH };
    }
    ```

    Update each call site to:
    ```ts
    const imgProps = doc.getImageProperties(b64);
    const { imgW, imgH } = fitPhoto(imgProps);
    const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
    ```
    and pass `imgX, y, imgW, imgH` to `doc.addImage(...)`.

    IMPORTANT: in `generate-pdf-proof.ts`, the current code passes `MARGIN` and
    `CONTENT_WIDTH` directly to `addImage` (not a computed `imgX` + `imgW`). This
    stretches every photo to full width. Replace with the same `imgX, y, imgW, imgH`
    pattern used in `generate-pdf.ts` so the proof script and the action render
    identically.

    Preserve the existing page-break math — `if (y + imgH + 8 > 280) { doc.addPage(); y = MARGIN; }`
    — but use the NEW `imgH`. Keep `y += imgH + 6` / `y += imgH + 8` vertical
    advances exactly as they are per-site.

    DO NOT change: which photo goes where, Q108 drain logic, inlinePhotoUrls
    tracking, the failed-photo "[photo could not be loaded]" fallback text, the
    safety drain, or the signature block.
  </action>
  <verify>
    <automated>cd pool-app && npx tsc --noEmit</automated>
    Grep check — each file must contain:
    - Exactly one `function fitPhoto` definition
    - At least two `fitPhoto(imgProps)` invocations
    - Zero occurrences of the old `let imgW = CONTENT_WIDTH;\n      let imgH = ar * imgW;` pattern
  </verify>
  <done>
    Both files use `fitPhoto(...)` at every photo-render site, TypeScript check
    passes, and photo-placement logic (which photo, which question, Q108 drain,
    signature order) is unchanged.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Regenerated PDF proof for the Kimberly Hennessy job with:
    - "Pool/Spa Inspection" title under the logo
    - Stacked, repositioned phone / email / license block
    - Balanced photo sizing across portrait and landscape images
    - Unchanged: numbered questions, no generated section headings, per-question
      inline photos, Q108 leftover drain, extras before signature, no appendix
  </what-built>
  <how-to-verify>
    1. Run the proof script to regenerate the PDF:
       ```
       cd pool-app && npx tsx scripts/generate-pdf-proof.ts
       ```
       It writes to `C:\Users\renea\Downloads\Kimberly Hennessy-report (2).pdf`.
    2. Open the PDF. On page 1 confirm:
       - Logo is centered at the top
       - "Pool/Spa Inspection" appears directly under the logo, centered, bold
       - Phone, email, and license each appear on their OWN centered line below
         the title (not one concatenated line)
       - The disclaimer and everything below is unchanged
    3. Scroll through the photo pages. Confirm:
       - No single landscape photo fills the whole content width edge-to-edge
       - No portrait photo is squeezed into a narrow sliver (< ~70mm wide)
       - Portrait and landscape shots from the same job look like siblings, not
         wildly different sizes
    4. Confirm the things that must NOT have changed:
       - Question numbers (1., 2., …, 108.) are intact
       - No generated section headings (Pool Pump / Spa Pump / etc headings
         should NOT appear — per 260416-mdz, only Q1–Q5 sit under no heading and
         Q6+ headings were suppressed by that task's DB script)
       - Question-specific photos appear under their matching numbered questions
       - Q108 Additional Photos contains ONLY the leftover unmatched photos
       - Worker signature appears at the end, AFTER all photos
       - No "Photo Appendix" section exists
    5. If anything is off, describe the issue and we revise. If it looks right,
       reply "approved".
  </how-to-verify>
  <resume-signal>Type "approved" or describe what needs adjusting.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes clean in `pool-app/`
- Regenerated proof PDF exists at `C:\Users\renea\Downloads\Kimberly Hennessy-report (2).pdf`
- Header block in both `generate-pdf.ts` and `generate-pdf-proof.ts` is visually
  and textually identical (title + stacked contact)
- `fitPhoto` helper exists in both files and is used at every photo-render site
- No old `let imgW = CONTENT_WIDTH; let imgH = ar * imgW;` pattern remains in
  either file
- Human checkpoint returns "approved"
</verification>

<success_criteria>
- Title "Pool/Spa Inspection" restored under the logo in the live PDF action and
  the proof script
- Contact / license block repositioned as a stacked, centered block below the
  title (three lines, not one)
- Photos render at balanced sizes: landscape capped below full-width, portrait
  floored above sliver-width, aspect ratio preserved
- All prior behavior preserved: numbered questions, no generated section
  headings, per-question inline photos, Q108 leftover drain, extras before
  signature, no appendix, signature last
- One fresh proof PDF at `C:\Users\renea\Downloads\Kimberly Hennessy-report (2).pdf`
  approved by Alex
</success_criteria>

<output>
After completion, create `.planning/quick/260416-sac-pdf-polish-restore-title-reposition-cont/260416-sac-SUMMARY.md`
capturing:
- What changed in each file (header + photo sizing)
- Any deviations from the plan (e.g. different MAX_W/MAX_H values landed on after
  visual review)
- Approval status of the regenerated PDF
</output>
