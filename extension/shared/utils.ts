const TWO_PART_TLDS = new Set([
  "co.uk", "com.au", "co.in", "co.nz", "co.jp", "co.kr",
  "co.za", "com.br", "org.uk", "ac.uk", "gov.uk",
  "net.au", "org.au", "co.il", "co.id",
  "co.th", "com.mx", "com.ar", "com.sg",
  "or.jp", "ne.jp", "ac.jp", "go.jp",
  "co.nz", "net.nz", "org.nz",
  "co.za", "net.za", "org.za", "gov.za",
  "co.in", "net.in", "org.in", "gov.in", "ac.in",
]);

function extractRoot(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length > 2) {
    const lastTwo = parts.slice(-2).join(".");
    if (TWO_PART_TLDS.has(lastTwo)) {
      return parts.slice(-3).join(".");
    }
    return lastTwo;
  }
  return hostname;
}

export function getRootDomain(input: string): string {
  try {
    let hostname: string;
    if (input.includes("://")) {
      hostname = new URL(input).hostname;
    } else if (input.includes("/")) {
      hostname = new URL("https://" + input).hostname;
    } else {
      hostname = input;
    }
    hostname = hostname.replace(/^www\./, "");
    return extractRoot(hostname);
  } catch {
    let cleaned = input.replace(/^(https?:\/\/)?(www\.)?/, "");
    cleaned = cleaned.split("/")[0] || cleaned;
    return extractRoot(cleaned);
  }
}

export function generateSiteId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function generateCategoryId(name: string, existingIds: Set<string>): string {
  const base = (name || "section")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
  let uniqueId = base;
  let counter = 1;
  while (existingIds.has(uniqueId)) {
    uniqueId = `${base}-${counter}`;
    counter++;
  }
  return uniqueId;
}
