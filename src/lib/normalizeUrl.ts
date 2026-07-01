export function normalizeUrl(url: string): string {
  try {
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }
    const parsed = new URL(normalized);
    parsed.hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    parsed.protocol = "https:";
    let path = parsed.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    parsed.pathname = path;
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}
