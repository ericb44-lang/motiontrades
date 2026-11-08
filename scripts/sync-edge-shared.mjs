// Copies the shared marketplace rules from src/ into the edge function folder.
// Deno needs explicit ".ts" import paths, so those are added on the way.
// Run: npm run sync:edge   (a unit test fails if the copies are out of date)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

export const SHARED = ["types.ts", "trade-logic.ts", "trade-actions.ts", "rows.ts", "shipping.ts", "stripe-signature.ts"];
export const SRC = "src/lib/marketplace";
export const DEST = "supabase/functions/_shared";

export const toDeno = (code, file) =>
  `// GENERATED from ${SRC}/${file} by scripts/sync-edge-shared.mjs. Do not edit.\n` +
  code.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.ts"');

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(DEST, { recursive: true });
  for (const f of SHARED) writeFileSync(`${DEST}/${f}`, toDeno(readFileSync(`${SRC}/${f}`, "utf8"), f));
  console.log(`Synced ${SHARED.length} files to ${DEST}`);
}
