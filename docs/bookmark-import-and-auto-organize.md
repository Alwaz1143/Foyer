# Bookmark Import & Auto-Organize Feature Plan

## Overview

Two related features:
1. **Auto-organizing** — when a bookmark/site is added, Foyer automatically categorizes it into the right section using domain-to-category mapping
2. **Bookmark import** — import browser bookmarks (HTML export) and have them auto-categorized into Foyer sections

## Architecture

### Current State

- No auto-organization or bookmark import exists
- Sites added one-by-one through a manual form (name, URL, category dropdown)
- Categories: 7 defaults + user-created
- Data model: `Category[]` with `{ id, name, icon, websites: [{ id, name, url, domain }] }`
- Storage: localStorage (immediate) + Firestore (debounced batch sync)

### Approach: Algorithmic Domain Mapping (No AI)

AI is overkill — domain-to-category mapping is deterministic, instant, offline, zero cost. A curated domain map covers ~95% of real-world use cases. Unknown domains get keyword-based fallback matching against category names.

---

## Implementation Plan

### Phase 1: Domain Mapping (`src/lib/domainMap.ts` — CREATE)

A curated `Record<string, string[]>` mapping known root domains to suggested category names (~200+ entries):

```typescript
export const domainCategoryMap: Record<string, string[]> = {
  "twitter.com":       ["Social Media", "Social"],
  "x.com":             ["Social Media", "Social"],
  "github.com":        ["Development", "Dev Tools"],
  "notion.so":         ["Productivity", "Tools"],
  "netflix.com":       ["Entertainment", "Streaming"],
  "chat.openai.com":   ["Artificial Intelligence", "AI"],
  "amazon.com":        ["Shopping"],
  "figma.com":         ["Design", "Creative"],
  // ... 200+ more
};
```

**Mapping strategy by category**:

| Category | Example Domains |
|----------|----------------|
| Social Media | twitter.com, x.com, instagram.com, reddit.com, linkedin.com, facebook.com, tiktok.com, discord.com, snapchat.com, pinterest.com, threads.net, telegram.org, whatsapp.com |
| Productivity | notion.so, trello.com, asana.com, todoist.com, slack.com, zoom.us, office.com, clickup.com, plus Google services (mail.google.com, drive.google.com, calendar.google.com, docs.google.com, keep.google.com) |
| Artificial Intelligence | chat.openai.com, chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com, huggingface.co, midjourney.com, stability.ai, anthropic.com |
| Development | github.com, gitlab.com, stackoverflow.com, vercel.com, netlify.com, cloudflare.com, npmjs.com, python.org, react.dev, nextjs.org, docker.com, kubernetes.io, aws.amazon.com, code.visualstudio.com, replit.com |
| Entertainment | youtube.com, netflix.com, spotify.com, twitch.tv, hulu.com, disneyplus.com, hbomax.com, primevideo.com, imdb.com |
| News & Media | bbc.com, cnn.com, reuters.com, nytimes.com, theguardian.com, bloomberg.com, wsj.com, washingtonpost.com, npr.org, axios.com |
| Sports | espn.com, skysports.com, espncricinfo.com, nba.com, nfl.com, formula1.com, the-athletic.com |
| Gaming | chess.com, lichess.org, steampowered.com, epicgames.com, roblox.com, minecraft.net |
| Shopping | amazon.com, ebay.com, etsy.com, walmart.com, target.com, bestbuy.com, aliexpress.com |
| Design / Creative | figma.com, canva.com, dribbble.com, behance.net, adobe.com, unsplash.com, pexels.com |

---

### Phase 2: Bookmark Parser (`src/lib/bookmarkParser.ts` — CREATE)

Parse the Netscape bookmark HTML format (used by Chrome, Firefox, Edge, Safari for export):

```typescript
export interface ParsedBookmark {
  title: string;
  url: string;
  addDate?: number;
  folder?: string; // original folder name from browser (categorization hint)
}

export function parseBookmarkHtml(html: string): ParsedBookmark[]
```

**Logic**:
- Use DOMParser or regex to extract `<DT><A HREF="..." ADD_DATE="...">Title</A>` elements
- Track `<DT><H3>` folder context for nested structures
- Filter out invalid/malformed entries
- Return structured array

---

### Phase 3: Site Classifier (`src/lib/classifySite.ts` — CREATE)

Auto-classify a URL/name into the best-matching existing category:

```typescript
export interface ClassificationResult {
  categoryId: string | null;
  suggestedCategoryName: string | null;
  confidence: "high" | "medium" | "low";
}

export function classifySite(
  name: string,
  url: string,
  existingCategories: Category[]
): ClassificationResult
```

**Logic pipeline**:
1. Extract root domain via `getRootDomain(url)`
2. Look up domain in `domainCategoryMap` → get suggested category names
3. Match each suggestion against `existingCategories` by case-insensitive name substring match
4. High confidence: domain matched + category name matched
5. Medium confidence: domain matched but no existing category → suggest category name for creation
6. Low confidence: domain not in map → keyword-match site name against category names
7. No match: return null (user picks manually)

---

### Phase 4: Categories Context Extension (`src/contexts/CategoriesContext.tsx` — MODIFY)

Add bulk import method:

```typescript
importBookmarks(bookmarks: ParsedBookmark[], autoCreateCategories: boolean): {
  added: number;
  createdCategories: string[];
  uncategorized: ParsedBookmark[];
  errors: { bookmark: ParsedBookmark; error: string }[];
}
```

**Logic**:
- Iterate bookmarks, call `classifySite()` for each
- If `autoCreateCategories` is true and no matching category exists, create a new category with the suggested name
- Add each bookmark as a site in its matched/created category
- Unmatched bookmarks collected separately for manual review
- Persist in one batch (localStorage + Firestore)

---

### Phase 5: Import UI — Modal (`src/app/page.tsx` — MODIFY)

New "Import Bookmarks" button alongside Export/Import in the action bar.

**Import Flow**:
1. Click "Import Bookmarks" → opens import modal
2. Step 1: Upload file — file picker for `.html` bookmark export
3. Step 2: Preview — table showing all parsed bookmarks with:
   - Detected category
   - Confidence badge (High/Medium/Low)
   - Category override dropdown (for low/no confidence)
4. Options:
   - "Auto-organize into matching categories" (toggle, default ON)
   - "Create new categories for unmatched domains" (toggle, default OFF)
5. Step 3: Confirm — progress bar, summary result

**Table columns**:
| Title | URL | Detected Category | Confidence | Action |
|-------|-----|-------------------|------------|--------|
| Twitter | twitter.com | Social Media | 🟢 High | ✓ |
| Random Blog | example.com | Uncategorized | ⚪ — | ⌄ dropdown |

**Styling**: Use same modal pattern as existing modals (glassmorphism, backdrop overlay).

---

### Phase 6: Enhanced Add-Site Modal (`src/app/page.tsx` — MODIFY)

When manually adding a site via "Add Site" form:
- On blur of the URL field → auto-detect category → pre-select in dropdown
- Show a subtle "Detected: Social Media" hint badge
- Only changes the dropdown selection, does not auto-submit
- No confidence indicator needed (user always has the final say)

---

### Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/domainMap.ts` | CREATE | 200+ domain → category name mappings |
| `src/lib/bookmarkParser.ts` | CREATE | Netscape HTML bookmark parser |
| `src/lib/classifySite.ts` | CREATE | URL/name → best category classifier |
| `src/contexts/CategoriesContext.tsx` | MODIFY | Add `importBookmarks()` method |
| `src/app/page.tsx` | MODIFY | Import modal UI + auto-category in add form |
| `src/styles/css/modals.css` | MODIFY | Import preview table styles |

---

## Future: Bookmarklet (Separate Feature)

A JS bookmarklet users drag to their browser bookmarks bar for one-click adding:

```javascript
javascript:(function(){
  window.open(
    'https://foyer.app/add?url='+encodeURIComponent(location.href)+
    '&title='+encodeURIComponent(document.title),
    '_blank'
  );
})();
```

Would need:
- `src/app/add/page.tsx` or query-param handler on the home page
- Pre-fills the add-site form with URL + auto-detected category
- Requires user to be logged in

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Classification approach | Domain mapping (algorithmic) | Instant, offline, zero cost, deterministic |
| AI/ML | Not used | Overkill for this use case; adds latency, cost, complexity |
| Import format | Netscape bookmark HTML | Universal across all browsers |
| New categories on import | Opt-in (toggle OFF by default) | Prevents unexpected category proliferation |
| Auto-detect in add form | Yes, on URL blur | Non-intrusive, user can override |
| Bookmarklet | Phase 2 / future | Requires auth handling, separate route |
