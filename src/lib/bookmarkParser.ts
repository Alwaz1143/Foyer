import type { ParsedBookmark } from "./types";

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function parseBookmarkHtml(html: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = [];
  if (typeof DOMParser === "undefined") return bookmarks;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return bookmarks;
  }

  const folderStack: string[] = [];

  function walkNodes(node: Node) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType !== 1) continue;
      const el = child as HTMLElement;

      if (el.tagName === "DT") {
        for (let j = 0; j < el.childNodes.length; j++) {
          const dtChild = el.childNodes[j];
          if (dtChild.nodeType !== 1) continue;
          const dtEl = dtChild as HTMLElement;
          const tag = dtEl.tagName;

          if (tag === "H3") {
            const folderName = dtEl.textContent?.trim();
            if (folderName) {
              folderStack.push(folderName);
            }
            walkNodes(dtEl.parentElement || dtEl);
            if (folderName) {
              folderStack.pop();
            }
          }

          if (tag === "A") {
            const anchor = dtEl as HTMLAnchorElement;
            const href = anchor.getAttribute("href") || "";
            const title = anchor.textContent?.trim() || anchor.getAttribute("title") || "";
            const addDateStr = anchor.getAttribute("add_date");
            const icon = anchor.getAttribute("icon") || undefined;

            if (!href || !title) continue;
            if (!isValidUrl(href)) continue;

            bookmarks.push({
              title,
              url: href,
              addDate: addDateStr ? parseInt(addDateStr, 10) || undefined : undefined,
              folder: folderStack.length > 0 ? folderStack[folderStack.length - 1] : undefined,
              folderPath: folderStack.length > 0 ? [...folderStack] : undefined,
              icon,
            });
          }

          if (tag === "DL") {
            walkNodes(dtEl);
          }
        }
      }

      if (el.tagName === "DL") {
        walkNodes(el);
      }
    }
  }

  walkNodes(doc.body || doc.documentElement);
  return bookmarks;
}
