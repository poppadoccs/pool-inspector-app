// Shared type for photo metadata stored in Job.photos JSON array
export type PhotoMetadata = {
  url: string; // Vercel Blob URL
  filename: string; // Original filename
  size: number; // Size in bytes (after compression)
  uploadedAt: string; // ISO date string
  // Optional. undefined and true both mean "include in PDF" (preserves the
  // pre-feature default). Only an explicit `false` excludes the photo from
  // PDF rendering. The field is set by setPhotoIncludedInPdf and stays on
  // the photo object across saves; legacy photos without the field continue
  // to render exactly as before.
  includedInPdf?: boolean;
};

// HEIC detection helper (per PHOT-06)
export function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  );
}

// Compression options constant (per PHOT-05: max 1MB, 80% quality JPEG)
export const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  initialQuality: 0.8,
  fileType: "image/jpeg" as const,
  useWebWorker: false,
};
