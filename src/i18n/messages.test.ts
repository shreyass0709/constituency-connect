import { describe, expect, it } from "vitest";
import en from "./en.json";
import hi from "./hi.json";

/**
 * The one thing that actually goes wrong with two catalogues: a key added to one and
 * forgotten in the other, which ships an English string into a Hindi page — or worse,
 * a missing-message error at runtime. This fails the build instead.
 */
function paths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    paths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message catalogues", () => {
  it("have exactly the same keys in every language", () => {
    const english = paths(en).sort();
    const hindi = paths(hi).sort();

    expect(hindi.filter((key) => !english.includes(key))).toEqual([]);
    expect(english.filter((key) => !hindi.includes(key))).toEqual([]);
  });

  it("has no untranslated leftovers — every Hindi string differs from the English one", () => {
    const flat = (value: unknown, prefix = ""): [string, string][] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) =>
            flat(child, prefix ? `${prefix}.${key}` : key),
          )
        : [[prefix, String(value)]];

    const english = new Map(flat(en));
    // Punctuation-only strings (an em dash, a colon) are the same in both by design.
    const shared = flat(hi).filter(([key, value]) => {
      const source = english.get(key);
      return source === value && /\p{Letter}/u.test(value);
    });

    expect(shared).toEqual([]);
  });
});
