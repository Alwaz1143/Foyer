import { defineBackground } from "wxt/sandbox";
import { onUserChanged } from "../lib/auth";
import { getCategories, addSiteToCategory, addPendingBookmark, getPendingBookmarks, removePendingBookmark, clearAllPending } from "../lib/firestore";
import { classifySite } from "../shared/classifySite";
import type { ClassificationResult } from "../shared/classifySite";
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
let bookmarkQueue: QueuedBookmark[] = [];

const QUEUE_STORAGE_KEY = "foyer_bookmark_queue";

async function persistQueue() {
  try {
    await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: bookmarkQueue });
  } catch { /* storage quota exceeded — best effort */ }
}

async function restoreQueue(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
    const restored = result[QUEUE_STORAGE_KEY];
    if (Array.isArray(restored) && restored.length > 0) {
      bookmarkQueue = restored;
      // Fire queue after restoring if user is signed in
      if (currentUser) await flushBookmarkQueue();
    }
  } catch { /* ignore read errors */ }
}

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

async function addBookmarkToFoyer(
  title: string,
  url: string,
  folderHint?: string
): Promise<{
  added: boolean;
  alreadyExists: boolean;
  categoryName?: string;
  classification: ClassificationResult;
}> {
  const classification = classifySite(title, url, cachedCategories, folderHint);

  if (!currentUser) {
    return { added: false, alreadyExists: false, classification };
  }

  // Dedup check
  const normalizedUrl = normalizeUrl(url);
  for (const cat of cachedCategories) {
    for (const site of cat.websites) {
      if (normalizeUrl(site.url) === normalizedUrl) {
        return { added: false, alreadyExists: true, classification };
      }
    }
  }

  if (!classification.categoryId) {
    return { added: false, alreadyExists: false, classification };
  }

  const domain = getRootDomain(url);
  const site: Website = { id: generateSiteId(), name: title, url, domain };

  try {
    await addSiteToCategory(currentUser.uid, classification.categoryId, site);
    await refreshCategories();
    return {
      added: true,
      alreadyExists: false,
      categoryName: cachedCategories.find(c => c.id === classification.categoryId)?.name,
      classification,
    };
  } catch {
    return { added: false, alreadyExists: false, classification };
  }
}

// ── Bookmark Queue ──────────────────────────────────────────────────────────

function queueBookmark(title: string, url: string, folderHint?: string) {
  bookmarkQueue.push({ title, url, folderHint });
  persistQueue();
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
  await persistQueue();
  if (count > 0) {
    await updateBadge(count);
  }
}

// ── Badge ────────────────────────────────────────────────────────────────────

async function updateBadge(count: number) {
  const prev = await chrome.action.getBadgeText({});
  const total = (parseInt(prev || "0") + count).toString();
  await chrome.action.setBadgeText({ text: total });
  await chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
}

async function setBadgeToPendingCount() {
  if (!currentUser) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "Foyer" });
    return;
  }
  try {
    const pending = await getPendingBookmarks(currentUser.uid);
    if (pending.length > 0) {
      await chrome.action.setBadgeText({ text: pending.length.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
      await chrome.action.setTitle({
        title: `${pending.length} bookmark${pending.length > 1 ? "s" : ""} awaiting confirmation`,
      });
    } else {
      await chrome.action.setBadgeText({ text: "" });
      await chrome.action.setTitle({ title: "Foyer" });
    }
  } catch {
    await chrome.action.setBadgeText({ text: "" });
  }
}

// ── Phase 2: Native ★ Bookmark Interception ──────────────────────────────────

async function onBookmarkCreated(id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) {
  if (!bookmark.url) return;
  if (!bookmark.url.startsWith("http")) return;
  if (syncInProgress) {
    queueBookmark(bookmark.title, bookmark.url);
    return;
  }

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
    await updateBadge(1);
  } else if (!result.alreadyExists && currentUser) {
    // Not a duplicate — store as pending in Firestore for user to confirm
    try {
      await addPendingBookmark(
        currentUser.uid,
        bookmark.title,
        bookmark.url,
        normalizeUrl(bookmark.url),
        folderName,
        result.classification,
      );
      await setBadgeToPendingCount();
    } catch { /* best-effort */ }
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

      const result = classifySite(bookmark.title, bookmark.url, cachedCategories, bookmark.folder);
      if (!result.categoryId) continue;

      const domain = getRootDomain(bookmark.url);
      const site: Website = { id: generateSiteId(), name: bookmark.title, url: bookmark.url, domain };

      try {
        await addSiteToCategory(currentUser.uid, result.categoryId, site);
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
    flushBookmarkQueue();
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
        sendResponse({ success: true, added: result.added, categoryName: result.categoryName });
      })().catch((err) => { console.error("Foyer: ADD_CURRENT_PAGE handler error:", err); sendResponse({ success: false, error: err.message }); });
      return true;
    }

    case "SYNC_ALL_BOOKMARKS": {
      (async () => {
        if (!currentUser) { sendResponse({ success: false, error: "not_signed_in" }); return; }
        await refreshCategories();
        await syncAllBookmarks();
        sendResponse({ success: true });
      })().catch((err) => { console.error("Foyer: SYNC_ALL_BOOKMARKS handler error:", err); sendResponse({ success: false, error: err.message }); });
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

    case "GET_PENDING_BOOKMARKS": {
      (async () => {
        if (!currentUser) { sendResponse({ pendingBookmarks: [] }); return; }
        const list = await getPendingBookmarks(currentUser.uid);
        sendResponse({ pendingBookmarks: list });
      })().catch((err) => { console.error("Foyer: GET_PENDING_BOOKMARKS handler error:", err); sendResponse({ success: false, error: err.message }); });
      return true;
    }

    case "CONFIRM_BOOKMARK": {
      (async () => {
        if (!currentUser) { sendResponse({ success: false, error: "not_signed_in" }); return; }
        const { pendingId, title, url, folderHint, categoryId } = message;
        const classification = classifySite(title, url, cachedCategories, folderHint);

        const targetId = categoryId || classification.categoryId;
        if (!targetId) {
          sendResponse({ success: false, error: "no_category" });
          return;
        }

        const normalizedUrl = normalizeUrl(url);
        let alreadyExists = false;
        for (const cat of cachedCategories) {
          for (const site of cat.websites) {
            if (normalizeUrl(site.url) === normalizedUrl) {
              alreadyExists = true;
              break;
            }
          }
          if (alreadyExists) break;
        }

        if (alreadyExists) {
          await removePendingBookmark(currentUser.uid, pendingId);
          await setBadgeToPendingCount();
          sendResponse({ success: false, error: "already_exists" });
          return;
        }

        const domain = getRootDomain(url);
        const site: Website = { id: generateSiteId(), name: title, url, domain };

        try {
          await addSiteToCategory(currentUser.uid, targetId, site);
          await refreshCategories();
          await removePendingBookmark(currentUser.uid, pendingId);
          await setBadgeToPendingCount();
          const categoryName = cachedCategories.find(c => c.id === targetId)?.name;
          sendResponse({ success: true, categoryName });
        } catch {
          sendResponse({ success: false, error: "write_failed" });
        }
      })().catch((err) => { console.error("Foyer: CONFIRM_BOOKMARK handler error:", err); sendResponse({ success: false, error: err.message }); });
      return true;
    }

    case "SKIP_PENDING_BOOKMARK": {
      (async () => {
        if (!currentUser) { sendResponse({ success: false }); return; }
        await removePendingBookmark(currentUser.uid, message.pendingId);
        await setBadgeToPendingCount();
        sendResponse({ success: true });
      })().catch((err) => { console.error("Foyer: SKIP_PENDING_BOOKMARK handler error:", err); sendResponse({ success: false, error: err.message }); });
      return true;
    }

    case "CLEAR_PENDING_BOOKMARKS": {
      (async () => {
        if (!currentUser) { sendResponse({ success: false }); return; }
        await clearAllPending(currentUser.uid);
        await setBadgeToPendingCount();
        sendResponse({ success: true });
      })().catch((err) => { console.error("Foyer: CLEAR_PENDING_BOOKMARKS handler error:", err); sendResponse({ success: false, error: err.message }); });
      return true;
    }
  }
});

// ── Lifecycle ────────────────────────────────────────────────────────────────

export default defineBackground(() => {
  chrome.bookmarks.onCreated.addListener(onBookmarkCreated);
  startPolling();
  restoreQueue();
});
