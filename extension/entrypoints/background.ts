import { defineBackground } from "wxt/sandbox";
import { onUserChanged } from "../lib/auth";
import { getCategories, addSiteToCategory } from "../lib/firestore";
import { classifySite } from "../shared/classifySite";
import { normalizeUrl } from "../shared/normalizeUrl";
import { getRootDomain, generateSiteId } from "../shared/utils";
import type { Category, Website } from "../shared/types";

interface BookmarkNode extends chrome.bookmarks.BookmarkTreeNode {
  children?: BookmarkNode[];
}

interface QueuedBookmark {
  title: string;
  url: string;
  folderHint?: string;
}

let currentUser: { uid: string } | null = null;
let cachedCategories: Category[] = [];
let syncInProgress = false;
let mirrorDeletions = false;
const bookmarkQueue: QueuedBookmark[] = [];

// ── Auth ────────────────────────────────────────────────────────────────────

onUserChanged((user) => {
  currentUser = user ? { uid: user.uid } : null;
  if (currentUser) {
    refreshCategories().then(() => flushBookmarkQueue());
  } else {
    cachedCategories = [];
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function refreshCategories(): Promise<void> {
  if (!currentUser) return;
  try {
    cachedCategories = await getCategories(currentUser.uid);
  } catch {
    // Will retry on next operation
  }
}

function findOrCreateMatchingCategory(siteName: string, siteUrl: string, folderHint?: string): string | null {
  const result = classifySite(siteName, siteUrl, cachedCategories, folderHint);
  if (result.categoryId) return result.categoryId;
  return null;
}

async function addBookmarkToFoyer(
  title: string,
  url: string,
  folderHint?: string
): Promise<{ added: boolean; categoryName?: string }> {
  if (!currentUser) return { added: false };

  const normalizedUrl = normalizeUrl(url);

  for (const cat of cachedCategories) {
    for (const site of cat.websites) {
      if (normalizeUrl(site.url) === normalizedUrl) {
        return { added: false };
      }
    }
  }

  const categoryId = findOrCreateMatchingCategory(title, url, folderHint);
  if (!categoryId) return { added: false };

  const domain = getRootDomain(url);
  const site: Website = { id: generateSiteId(), name: title, url, domain };

  try {
    await addSiteToCategory(currentUser.uid, categoryId, site);
    await refreshCategories();
    return { added: true, categoryName: cachedCategories.find(c => c.id === categoryId)?.name };
  } catch {
    return { added: false };
  }
}

// ── Bookmark Queue ──────────────────────────────────────────────────────────

function queueBookmark(title: string, url: string, folderHint?: string) {
  bookmarkQueue.push({ title, url, folderHint });
}

async function flushBookmarkQueue() {
  if (!currentUser) return;
  let count = 0;
  while (bookmarkQueue.length > 0) {
    const item = bookmarkQueue.shift();
    if (!item) continue;
    const result = await addBookmarkToFoyer(item.title, item.url, item.folderHint);
    if (result.added) count++;
  }
  if (count > 0) {
    await updateBadge(count);
  }
}

async function updateBadge(count: number) {
  const prev = await chrome.action.getBadgeText({});
  const total = (parseInt(prev || "0") + count).toString();
  await chrome.action.setBadgeText({ text: total });
  await chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
}

// ── Phase 2: Native ★ Bookmark Interception ──────────────────────────────────

async function onBookmarkCreated(id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) {
  if (!bookmark.url || syncInProgress) return;
  if (!bookmark.url.startsWith("http")) return;

  let folderName: string | undefined;
  if (bookmark.parentId) {
    try {
      const parent = await chrome.bookmarks.get(bookmark.parentId);
      if (parent[0] && !parent[0].url) {
        folderName = parent[0].title;
      }
    } catch { /* ignore */ }
  }

  if (!currentUser) {
    queueBookmark(bookmark.title, bookmark.url, folderName);
    return;
  }

  const result = await addBookmarkToFoyer(bookmark.title, bookmark.url, folderName);
  if (result.added) {
    const prev = await chrome.action.getBadgeText({});
    const count = (parseInt(prev || "0") + 1).toString();
    await chrome.action.setBadgeText({ text: count });
    await chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
  }
}

// ── Phase 3: Initial Sync ────────────────────────────────────────────────────

function flattenBookmarkTree(nodes: BookmarkNode[]): { title: string; url: string; folder?: string }[] {
  const result: { title: string; url: string; folder?: string }[] = [];
  function walk(list: BookmarkNode[], parentTitle?: string) {
    for (const node of list) {
      if (node.url && node.url.startsWith("http")) {
        result.push({ title: node.title, url: node.url, folder: parentTitle });
      }
      if (node.children) {
        walk(node.children, node.title || parentTitle);
      }
    }
  }
  walk(nodes);
  return result;
}

async function syncAllBookmarks() {
  if (!currentUser) return;
  syncInProgress = true;

  try {
    const tree = await chrome.bookmarks.getTree();
    const flat = flattenBookmarkTree(tree);

    let addedCount = 0;
    for (const bookmark of flat) {
      const categoryId = findOrCreateMatchingCategory(bookmark.title, bookmark.url, bookmark.folder);
      if (!categoryId) continue;

      const normalized = normalizeUrl(bookmark.url);

      let exists = false;
      for (const cat of cachedCategories) {
        for (const site of cat.websites) {
          if (normalizeUrl(site.url) === normalized) {
            exists = true;
            break;
          }
        }
        if (exists) break;
      }
      if (exists) continue;

      const domain = getRootDomain(bookmark.url);
      const site: Website = { id: generateSiteId(), name: bookmark.title, url: bookmark.url, domain };

      try {
        await addSiteToCategory(currentUser.uid, categoryId, site);
        addedCount++;
      } catch { /* skip individual failures */ }
    }

    await refreshCategories();

    if (addedCount > 0) {
      await chrome.action.setBadgeText({ text: addedCount.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
    }
  } finally {
    syncInProgress = false;
  }
}

// ── Phase 4: Cross-device sync ───────────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    if (!currentUser) return;
    await refreshCategories();
  }, 30000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ── Install Handler ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
  }
});

// ── Message Handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "USER_SIGNED_IN": {
      currentUser = { uid: message.uid };
      refreshCategories().then(() => flushBookmarkQueue());
      sendResponse({ success: true });
      return;
    }

    case "ADD_CURRENT_PAGE": {
      (async () => {
        if (!currentUser) { sendResponse({ success: false, error: "not_signed_in" }); return; }
        await refreshCategories();

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab?.url || !tab?.title) { sendResponse({ success: false, error: "no_tab" }); return; }

        const result = await addBookmarkToFoyer(tab.title, tab.url);
        sendResponse({ success: true, ...result });
      })();
      return true;
    }

    case "SYNC_ALL_BOOKMARKS": {
      (async () => {
        if (!currentUser) { sendResponse({ success: false, error: "not_signed_in" }); return; }
        await refreshCategories();
        await syncAllBookmarks();
        sendResponse({ success: true });
      })();
      return true;
    }

    case "GET_AUTH_STATUS": {
      sendResponse({ signedIn: !!currentUser });
      return;
    }

    case "GET_CATEGORIES": {
      sendResponse({ categories: cachedCategories });
      return;
    }

    case "SET_MIRROR_DELETIONS": {
      mirrorDeletions = message.value;
      sendResponse({ success: true });
      return;
    }
  }
});

// ── Lifecycle ────────────────────────────────────────────────────────────────

export default defineBackground(() => {
  chrome.bookmarks.onCreated.addListener(onBookmarkCreated);
  startPolling();
});
