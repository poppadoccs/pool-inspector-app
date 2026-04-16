/**
 * Strips ALL section assignments from the Pool/Spa Inspection template.
 * The client wants a pure numbered list with no section headings whatsoever.
 *
 * Usage: cd pool-app && npx tsx scripts/remove-template-sections.ts
 */
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
loadEnvConfig(resolve(__dirname, ".."));

import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const data = JSON.parse(
    readFileSync(resolve(__dirname, "extraction-output.json"), "utf-8"),
  );
  const sourceFields: Array<Record<string, unknown>> = data.template.fields;

  // Remove section from every field — pure numbered list, no headings
  const fixedFields = sourceFields.map((f) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { section: _removed, ...rest } = f;
    return rest;
  });

  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });
  const db = new PrismaClient({ adapter });

  try {
    const templates = await db.formTemplate.findMany({
      where: { name: "Pool/Spa Inspection" },
      select: { id: true, name: true },
    });

    if (templates.length === 0) {
      console.error("No 'Pool/Spa Inspection' template found in DB.");
      process.exit(1);
    }

    for (const t of templates) {
      await db.formTemplate.update({
        where: { id: t.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { fields: fixedFields as any },
      });
      console.log(`Updated template ${t.id} — "${t.name}"`);
    }

    console.log(
      `Done. ${templates.length} template(s) updated — all sections removed.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
