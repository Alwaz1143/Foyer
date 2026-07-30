import type { Category } from "./types";
import { domainCategoryMap } from "./domainMap";
import { getRootDomain } from "./utils";

export interface ClassificationResult {
  categoryId: string | null;
  suggestedCategoryName: string | null;
  confidence: "high" | "medium" | "low" | "none";
  matchedBy: "domain" | "folder" | "keyword" | "none";
}

function getCategoryNames(categories: Category[]): string[] {
  return categories.map((c) => c.name.toLowerCase().trim());
}

function matchCategoryByName(
  search: string,
  categories: Category[]
): Category | null {
  const lower = search.toLowerCase().trim();
  if (lower.length < 3) return null;
  const searchWords = lower.split(/[\s\-_/]+/).filter(Boolean);
  for (const cat of categories) {
    const name = cat.name.toLowerCase().trim();
    const nameWords = name.split(/[\s\-_/]+/);
    if (searchWords.some((sw) => nameWords.some((nw) => nw === sw))) return cat;
    if (lower.length >= 4 && nameWords.some((nw) => nw.includes(lower))) return cat;
    const noIcon = name.replace(/[^\w\s-]/g, "").trim();
    const noIconWords = noIcon.split(/[\s\-_/]+/);
    if (searchWords.some((sw) => noIconWords.some((nw) => nw === sw))) return cat;
  }
  return null;
}

export function classifySite(
  name: string,
  url: string,
  existingCategories: Category[],
  folderHint?: string
): ClassificationResult {
  const none: ClassificationResult = {
    categoryId: null,
    suggestedCategoryName: null,
    confidence: "none",
    matchedBy: "none",
  };

  if (!url && !name) return none;

  // Step 1: Browser folder hint — user's own organization takes priority
  if (folderHint) {
    const match = matchCategoryByName(folderHint, existingCategories);
    if (match) {
      return {
        categoryId: match.id,
        suggestedCategoryName: folderHint,
        confidence: "high",
        matchedBy: "folder",
      };
    }
    // Folder hint provided but no matching category → suggest it for auto-create
    return {
      categoryId: null,
      suggestedCategoryName: folderHint,
      confidence: "medium",
      matchedBy: "folder",
    };
  }

  // Step 2: Domain map lookup — check full hostname first (catches subdomain entries
  // like "mail.google.com"), then fall back to the root domain.
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { /* invalid url */ }
  let candidates = hostname ? domainCategoryMap[hostname] : undefined;
  if (!candidates || candidates.length === 0) {
    const domain = getRootDomain(url);
    candidates = domain ? domainCategoryMap[domain] : undefined;
  }

  if (candidates && candidates.length > 0) {
    for (const candidate of candidates) {
      const match = matchCategoryByName(candidate, existingCategories);
      if (match) {
        return {
          categoryId: match.id,
          suggestedCategoryName: candidate,
          confidence: "high",
          matchedBy: "domain",
        };
      }
    }
    return {
      categoryId: null,
      suggestedCategoryName: candidates[0] ?? null,
      confidence: "medium",
      matchedBy: "domain",
    };
  }

  if (name) {
    const tokens = name
      .toLowerCase()
      .split(/[\s\-_/:]+/)
      .filter((t) => t.length > 2);

    const catNames = getCategoryNames(existingCategories);

    for (const cat of existingCategories) {
      const catLower = cat.name.toLowerCase().trim();
      for (const token of tokens) {
        if (catLower.includes(token)) {
          return {
            categoryId: cat.id,
            suggestedCategoryName: cat.name,
            confidence: "low",
            matchedBy: "keyword",
          };
        }
      }
    }

    for (const token of tokens) {
      for (let i = 0; i < catNames.length; i++) {
        const catName = catNames[i];
        const existingCat = existingCategories[i];
        if (!catName || !existingCat) continue;
        const catWords = catName.split(/[\s\-/]+/);
        for (const word of catWords) {
          if (word.length > 2 && (word.includes(token) || token.includes(word))) {
            return {
              categoryId: existingCat.id,
              suggestedCategoryName: existingCat.name,
              confidence: "low",
              matchedBy: "keyword",
            };
          }
        }
      }
    }
  }

  return none;
}
