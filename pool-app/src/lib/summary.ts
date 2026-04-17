// Structured summary items — replaces the single-blob "107. Summary"
// textarea on new-shape jobs. Legacy jobs whose formData["107_summary"]
// holds a plain string still render identically; that path is selected
// by parseSummaryItems returning null.
//
// Reserved-key convention: formData["__summary_items"] is owned by the
// dedicated saveSummaryItems server action (Task 8). RHF autosave must
// never write this key. See plan 260417-mpf.

export type SummaryItem = { text: string; photos: string[] };

export const RESERVED_SUMMARY_KEY = "__summary_items";

// Capacity policy (see plan §Summary capacity policy for math):
//   soft = inline UI warning chip, non-blocking
//   hard = client save-disable + server-side reject
export const SUMMARY_PHOTO_SOFT_LIMIT = 25;
export const SUMMARY_PHOTO_HARD_LIMIT = 40;

// Parses the reserved __summary_items key into a SummaryItem[] or returns
// null when the value is absent or not a well-formed array of items.
//   null  → legacy path (PDF renders formData["107_summary"] as a text blob)
//   []    → structured path with zero items (user cleared their list)
//   [...] → structured path with items
//
// Item shape: { text: string, photos: string[] }. Any malformed item
// drops the whole array to null so a corrupt row never renders half.
export function parseSummaryItems(
  formData: Record<string, unknown> | null | undefined,
): SummaryItem[] | null {
  if (!formData) return null;

  const raw = formData[RESERVED_SUMMARY_KEY];
  if (!Array.isArray(raw)) return null;

  const out: SummaryItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const rec = item as Record<string, unknown>;
    const text = rec.text;
    const photos = rec.photos;
    if (typeof text !== "string") return null;
    if (!Array.isArray(photos)) return null;
    if (!photos.every((u) => typeof u === "string")) return null;
    out.push({ text, photos: photos as string[] });
  }

  return out;
}

export function countSummaryPhotos(items: SummaryItem[]): number {
  let n = 0;
  for (const item of items) n += item.photos.length;
  return n;
}

export function collectSummaryPhotoUrls(items: SummaryItem[]): string[] {
  const urls: string[] = [];
  for (const item of items) {
    for (const u of item.photos) urls.push(u);
  }
  return urls;
}
