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

  // Step 1: Domain map lookup
  const domain = getRootDomain(url);
  const candidates = domain ? domainCategoryMap[domain] : undefined;

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
    // Domain is in map but no matching category exists
    return {
      categoryId: null,
      suggestedCategoryName: candidates[0] ?? null,
      confidence: "medium",
      matchedBy: "domain",
    };
  }

  // Step 2: Browser folder hint
  if (folderHint) {
    const match = matchCategoryByName(folderHint, existingCategories);
    if (match) {
      return {
        categoryId: match.id,
        suggestedCategoryName: folderHint,
        confidence: "medium",
        matchedBy: "folder",
      };
    }
  }

  // Step 3: Keyword fallback — tokenize site name, match against category names
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

    // Also check if any token matches a category name partially
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
