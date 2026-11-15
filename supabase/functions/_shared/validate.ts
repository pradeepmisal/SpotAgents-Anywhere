// Hand-written validators (no dependency) for anywhere-agent.schema.json and CompileRequest.
import type { CompileRequest } from "./anywhere-types.ts";

const isStr = (v: unknown, min: number, max: number): v is string =>
  typeof v === "string" && v.length >= min && v.length <= max;

function strArray(v: unknown, path: string, min: number, max: number, itemMax: number, errs: string[]) {
  if (!Array.isArray(v) || v.length < min || v.length > max) {
    errs.push(`${path} must be an array of ${min}-${max} items`);
    return;
  }
  v.forEach((s, i) => {
    if (!isStr(s, 1, itemMax)) errs.push(`${path}[${i}] must be a string of 1-${itemMax} chars`);
  });
}

/** Returns a list of schema violations (empty = valid). */
export function validateCompiled(o: unknown): string[] {
  const errs: string[] = [];
  if (!o || typeof o !== "object" || Array.isArray(o)) return ["root must be an object"];
  const a = o as Record<string, unknown>;
  const allowed = ["persona", "greeting", "facts", "stories", "teaser", "premium", "suggested_questions", "languages"];
  for (const k of Object.keys(a)) if (!allowed.includes(k)) errs.push(`unknown property ${k}`);
  if (!isStr(a.persona, 20, 600)) errs.push("persona must be a string of 20-600 chars");
  if (!isStr(a.greeting, 10, 300)) errs.push("greeting must be a string of 10-300 chars");
  if (!isStr(a.teaser, 20, 600)) errs.push("teaser must be a string of 20-600 chars");
  if (!isStr(a.premium, 20, 3000)) errs.push("premium must be a string of 20-3000 chars");
  if (!Array.isArray(a.facts) || a.facts.length < 1 || a.facts.length > 6) errs.push("facts must have 1-6 items");
  else {
    a.facts.forEach((f, i) => {
      const x = f as Record<string, unknown>;
      if (!x || typeof x !== "object") return errs.push(`facts[${i}] must be an object`);
      if (!isStr(x.claim, 5, 300)) errs.push(`facts[${i}].claim must be 5-300 chars`);
      if (x.basis !== "from_notes" && x.basis !== "common_knowledge") errs.push(`facts[${i}].basis must be from_notes|common_knowledge`);
      for (const k of Object.keys(x)) if (k !== "claim" && k !== "basis") errs.push(`facts[${i}] unknown property ${k}`);
    });
  }
  if (!Array.isArray(a.stories) || a.stories.length > 3) errs.push("stories must have 0-3 items");
  else {
    a.stories.forEach((s, i) => {
      const x = s as Record<string, unknown>;
      if (!x || typeof x !== "object") return errs.push(`stories[${i}] must be an object`);
      if (!isStr(x.title, 0, 80)) errs.push(`stories[${i}].title must be a string up to 80 chars`);
      if (!isStr(x.text, 0, 900)) errs.push(`stories[${i}].text must be a string up to 900 chars`);
      if (!["personal_memory", "local_legend", "practical_tip"].includes(x.kind as string)) errs.push(`stories[${i}].kind invalid`);
      for (const k of Object.keys(x)) if (!["title", "text", "kind"].includes(k)) errs.push(`stories[${i}] unknown property ${k}`);
    });
  }
  strArray(a.suggested_questions, "suggested_questions", 3, 3, 80, errs);
  strArray(a.languages, "languages", 1, 4, 20, errs);
  return errs;
}

export type CleanCompileRequest = Required<CompileRequest>;

/** Returns the cleaned request or an error message. */
export function validateCompileRequest(b: unknown): CleanCompileRequest | string {
  if (!b || typeof b !== "object") return "Invalid JSON";
  const r = b as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (name.length < 1 || name.length > 60) return "name must be 1-60 chars";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (title.length > 60) return "title must be at most 60 chars";
  const place_name = typeof r.place_name === "string" ? r.place_name.trim() : "";
  if (place_name.length > 120) return "place_name must be at most 120 chars";
  const city = typeof r.city === "string" ? r.city.trim() : "";
  if (city.length > 60) return "city must be at most 60 chars";
  const lat = r.lat, lng = r.lng;
  if (typeof lat !== "number" || !(lat >= -90 && lat <= 90)) return "lat must be a number in -90..90";
  if (typeof lng !== "number" || !(lng >= -180 && lng <= 180)) return "lng must be a number in -180..180";
  const radius_m = r.radius_m === undefined ? 60 : r.radius_m;
  if (typeof radius_m !== "number" || !(radius_m >= 10 && radius_m <= 2000)) return "radius_m must be 10..2000";
  const notes = typeof r.notes === "string" ? r.notes.trim() : "";
  if (notes.length < 20 || notes.length > 4000) return "notes must be 20-4000 chars";
  const price_usd = r.price_usd;
  if (typeof price_usd !== "number" || !(price_usd >= 0.01 && price_usd <= 0.10)) return "price_usd must be 0.01-0.10";
  return { name, title, place_name, city, lat, lng, radius_m, notes, price_usd };
}

/** USD (0.01..0.10, whole cents) to pieUSD base units, with bigint only. */
export function priceUnits(priceUsd: number): { units: string; usd: number } {
  const cents = Math.round(priceUsd * 100);
  return { units: (BigInt(cents) * 10n ** 16n).toString(), usd: cents / 100 };
}
