/**
 * Reads extraction-output.json and saves it as a FormTemplate in the DB.
 * Usage: npx tsx scripts/save-template-to-db.ts
 */
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
loadEnvConfig(resolve(__dirname, ".."));

import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const data = JSON.parse(
    readFileSync(resolve(__dirname, "extraction-output.json"), "utf-8")
  );
  const t = data.template;

  if (!t || !t.fields?.length) {
    console.error("No template data in extraction-output.json");
    process.exit(1);
  }

  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });
  const db = new PrismaClient({ adapter });

  try {
    const row = await db.formTemplate.create({
      data: {
        name: t.name || "Pool/Spa Inspection",
        description:
          "Pool & Spa inspection form — 108 questions, extracted from PDF",
        category: "Inspection",
        fields: t.fields,
      },
    });
    console.log(`Created template: ${row.id} — "${row.name}"`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
