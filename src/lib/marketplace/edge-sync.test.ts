import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs build script
import { DEST, SHARED, SRC, toDeno } from "../../../scripts/sync-edge-shared.mjs";

describe("edge function shared code", () => {
  it.each(SHARED as string[])("%s matches src (run `npm run sync:edge` if this fails)", (file) => {
    const expected = toDeno(readFileSync(`${SRC}/${file}`, "utf8"), file);
    expect(readFileSync(`${DEST}/${file}`, "utf8")).toBe(expected);
  });
});
