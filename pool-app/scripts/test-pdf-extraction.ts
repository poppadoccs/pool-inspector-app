/**
 * Test script: feeds a PDF through the extraction + normalization pipeline
 * and dumps the resulting JSON so you can inspect field labels & types.
 *
 * Usage:
 *   npx tsx scripts/test-pdf-extraction.ts <path-to-pdf>
 *
 * Examples:
 *   npx tsx scripts/test-pdf-extraction.ts ~/Downloads/InspectionForm.pdf
 *   npx tsx scripts/test-pdf-extraction.ts C:/Users/renea/Downloads/InspectionForm.pdf
 *
 * Output: writes results to scripts/extraction-output.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Load .env.local so API keys are available outside Next.js
import { loadEnvConfig } from "@next/env";
loadEnvConfig(resolve(__dirname, ".."));

// The extraction function is a server action — import it directly
// (tsx runs outside Next.js, so the "use server" directive is a no-op)
import { extractFormFromPdf } from "../src/lib/actions/scan";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: npx tsx scripts/test-pdf-extraction.ts <path-to-pdf>");
    process.exit(1);
  }

  const resolved = resolve(pdfPath);
  console.log(`[test] Reading PDF: ${resolved}`);

  const pdfBuffer = readFileSync(resolved);
  const pdfBase64 = pdfBuffer.toString("base64");
  console.log(`[test] PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

  console.log("[test] Running extraction + normalization...");
  const result = await extractFormFromPdf(pdfBase64);

  if (!result.success) {
    console.error(`[test] Extraction failed: ${result.error}`);
    process.exit(1);
  }

  if (result.mock) {
    console.warn("[test] ⚠ No AI provider available — got mock template, not real extraction.");
    console.warn("[test]   Set GOOGLE_GENERATIVE_AI_API_KEY or start Ollama to test real extraction.");
  }

  const template = result.template!;
  console.log(`\n[test] Template: ${template.name}`);
  console.log(`[test] Fields: ${template.fields.length}`);
  console.log("");

  // Pretty-print field summary
  for (const f of template.fields) {
    const parts = [
      f.label.padEnd(50),
      f.type.padEnd(10),
      f.section ? `[${f.section}]` : "",
    ];
    if (f.options?.length) parts.push(`opts: ${f.options.join(", ")}`);
    if (f.placeholder) parts.push(`ph: "${f.placeholder}"`);
    console.log(`  ${parts.join("  ").trimEnd()}`);
  }

  // Dump full JSON
  const outPath = resolve(__dirname, "extraction-output.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n[test] Full JSON written to: ${outPath}`);
}

main().catch((err) => {
  console.error("[test] Fatal error:", err);
  process.exit(1);
});
