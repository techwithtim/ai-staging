import type { House } from "./db/schema";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat("en-US");

const plural = (n: number, one: string, many: string) => `${whole.format(n)} ${n === 1 ? one : many}`;

/** The listing facts that were filled in, in the order agents say them. */
export function houseFacts(h: Pick<House, "beds" | "baths" | "sqft" | "price">): string[] {
  const out: string[] = [];
  if (h.beds != null) out.push(plural(h.beds, "bed", "beds"));
  if (h.baths != null) out.push(plural(h.baths, "bath", "baths"));
  if (h.sqft != null) out.push(`${whole.format(h.sqft)} sq ft`);
  if (h.price != null) out.push(money.format(h.price));
  return out;
}

export function photoCount(n: number) {
  return plural(n, "photo", "photos");
}

export function fileSize(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;
}
