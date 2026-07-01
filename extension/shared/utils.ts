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
    const parts = hostname.split(".");
    if (parts.length > 2) {
      return parts.slice(-2).join(".");
    }
    return hostname;
  } catch {
    let cleaned = input.replace(/^(https?:\/\/)?(www\.)?/, "");
    cleaned = cleaned.split("/")[0] || cleaned;
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts.slice(-2).join(".");
    }
    return cleaned;
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
