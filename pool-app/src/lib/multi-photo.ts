// Shared constants + helpers for photo capacity across numbered photo
// questions. Per-field buffered caps are the customer source of truth
// (locked 2026-04-20). Every other photo field is single-slot and
// untouched by this module.
//
// Reserved-key convention: __-prefixed keys in formData are owned by
// dedicated server actions, never by RHF autosave.

// Multi-photo numbered questions (Q5, Q16, Q25, Q40, Q71) with their
// buffered per-field caps.
export const MULTI_PHOTO_CAPS: Readonly<Record<string, number>> = {
  "5_picture_of_pool_and_spa_if_applicable": 5,
  "16_photo_of_pool_pump": 5,
  "25_picture_of_cartridge": 4,
  "40_picture_if_leak_is_present_at_chlorinator": 5,
  "71_picture_of_leaks_on_valves_if_applicable": 6,
};

// Derived membership set — kept so call sites stay O(1) without
// re-reading Object.keys.
export const MULTI_PHOTO_FIELD_IDS: ReadonlySet<string> = new Set(
  Object.keys(MULTI_PHOTO_CAPS),
);

// Returns the per-field cap for a multi-photo question id, or undefined
// for any field that is not a multi-photo target. Callers use undefined
// to fall through to single-slot / remarks / Q108 handling.
export function getMultiPhotoCap(fieldId: string): number | undefined {
  return MULTI_PHOTO_CAPS[fieldId];
}

// Q108 "Additional Photos" — a separate single-field bucket with its
// own buffered cap. Not a member of MULTI_PHOTO_CAPS on purpose: its
// ownership and UI semantics differ (admin-chosen membership, no drain).
export const ADDITIONAL_PHOTOS_FIELD_ID = "108_additional_photos";
export const ADDITIONAL_PHOTOS_CAP = 7;

// Remarks/notes fields — 8 textareas that also accept photo attachments
// in the new shape. Canonical ids verified against the extracted form
// template (scripts/extraction-output.json).
export const REMARKS_FIELD_IDS: ReadonlySet<string> = new Set([
  "15_remarks_notes",
  "33_remarks_notes",
  "72_remarks_notes",
  "76_remarks_notes",
  "79_remarks_notes",
  "83_remarks_notes",
  "91_remarks_notes",
  "102_remarks_notes",
]);

// Uniform buffered cap across every remarks/notes field.
export const REMARKS_PHOTO_CAP = 8;

export const RESERVED_PHOTO_MAP_KEY = "__photoAssignmentsByField";
export const REVIEWED_FLAG = "__photoAssignmentsReviewed";

// Resolves a field's photo URLs across the new map shape and the legacy
// single-string mirror. Priority:
//   1. formData["__photoAssignmentsByField"][fieldId] (new shape)
//   2. formData[fieldId] as non-empty string (legacy mirror)
//   3. []
//
// Returns string URLs only — non-string array members are filtered out
// defensively so a malformed DB row never crashes a renderer.
export function readFieldPhotoUrls(
  formData: Record<string, unknown> | null | undefined,
  fieldId: string,
): string[] {
  if (!formData) return [];

  const map = formData[RESERVED_PHOTO_MAP_KEY];
  if (map && typeof map === "object" && !Array.isArray(map)) {
    const entry = (map as Record<string, unknown>)[fieldId];
    if (Array.isArray(entry)) {
      return entry.filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      );
    }
  }

  const legacy = formData[fieldId];
  if (typeof legacy === "string" && legacy.length > 0) {
    return [legacy];
  }

  return [];
}
