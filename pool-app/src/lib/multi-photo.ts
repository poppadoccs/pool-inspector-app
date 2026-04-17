// Shared constants + helpers for the 5 numbered photo questions that
// accept up to 4 photos each. Every other photo field remains single-slot
// and is untouched by this module.
//
// Reserved-key convention: __-prefixed keys in formData are owned by
// dedicated server actions, never by RHF autosave. See plan 260417-mpf.

export const MULTI_PHOTO_FIELD_IDS: ReadonlySet<string> = new Set([
  "5_picture_of_pool_and_spa_if_applicable",
  "16_photo_of_pool_pump",
  "25_picture_of_cartridge",
  "40_picture_if_leak_is_present_at_chlorinator",
  "71_picture_of_leaks_on_valves_if_applicable",
]);

export const MULTI_PHOTO_CAP = 4;

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
