"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useWallpaper } from "@/hooks/useWallpaper";
import { useUnsplash } from "@/hooks/useUnsplash";
import WallpaperPicker from "@/components/WallpaperPicker";
import MediaPlayer from "@/components/MediaPlayer";
import { useSearch } from "@/hooks/useSearch";
import { useCategories } from "@/contexts/CategoriesContext";
import { classifySite } from "@/lib/classifySite";
import { getRootDomain, escapeHtml } from "@/lib/utils";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { parseBookmarkHtml } from "@/lib/bookmarkParser";
import type { ParsedBookmark } from "@/lib/types";
import { UNSPLASH_CONFIG } from "@/lib/constants";
import { showToast } from "@/lib/toast";
import { foyerKey } from "@/lib/storage";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { usePendingBookmarks, addPendingBookmark } from "@/hooks/usePendingBookmarks";
import ShortcutGrid from "@/components/ShortcutGrid";
import ClockWidget from "@/components/ClockWidget";
import CalendarWidget from "@/components/CalendarWidget";
import WeatherWidget from "@/components/WeatherWidget";
import NewsWidget from "@/components/NewsWidget";
import { useWidgetSettings } from "@/hooks/useWidgetSettings";

function closeModal(id: string) {
  const m = document.getElementById(id);
  if (m) m.style.display = "none";
}

export default function HomePage() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.uid ?? null;
  const [showUncategorizedActions, setShowUncategorizedActions] = useState(false);
  const { toggleWallpaper, setWallpaper } = useWallpaper();
  const { connected, startOAuth, markAsLiked } = useUnsplash();
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  useSearch();
  const { settings: widgetSettings, setSetting } = useWidgetSettings();
  const { categories, addSite, editSite, moveSite, addCategory, editCategory, deleteCategory, replaceAll, importBookmarks } = useCategories();
  const { pendingCount, pendingBookmarks, confirmOne, skipOne, confirmAll, skipAll } = usePendingBookmarks();

  // User menu + basic click handlers
  useEffect(() => {
    const avatarBtn = document.getElementById("userAvatarBtn");
    const userMenu = document.getElementById("userMenu");

    const toggleMenu = (e: MouseEvent) => {
      e.stopPropagation();
      userMenu?.classList.toggle("show");
    };
    const closeMenu = (e: MouseEvent) => {
      if (!avatarBtn?.contains(e.target as Node) && !userMenu?.contains(e.target as Node)) {
        userMenu?.classList.remove("show");
      }
    };
    avatarBtn?.addEventListener("click", toggleMenu);
    document.addEventListener("click", closeMenu);

    const handleSignOut = async () => { await signOut(); router.replace("/login"); };
    document.getElementById("signOutBtn")?.addEventListener("click", handleSignOut);
    document.getElementById("wallpaperToggle")?.addEventListener("click", toggleWallpaper);
    const closeShortcutMenus = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".shortcut-menu-dropdown")) {
        document.querySelectorAll(".shortcut-menu-dropdown.show").forEach((m) => m.classList.remove("show"));
        document.querySelectorAll(".shortcut-item.menu-open").forEach((m) => m.classList.remove("menu-open"));
      }
    };
    document.addEventListener("click", closeShortcutMenus);

    const closeModals = (e: MouseEvent) => {
      ["addSiteModal", "editSiteModal", "sectionModal", "settingsModal"].forEach((id) => {
        if (e.target === document.getElementById(id)) closeModal(id);
      });
    };
    window.addEventListener("click", closeModals);

    return () => {
      avatarBtn?.removeEventListener("click", toggleMenu);
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("click", closeShortcutMenus);
      window.removeEventListener("click", closeModals);
    };
  }, [signOut, router, toggleWallpaper]);

  // Settings modal
  useEffect(() => {
    const openSettingsBtn = document.getElementById("openSettingsBtn");
    const closeSettingsModal = document.getElementById("closeSettingsModal");
    const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
    const settingsForm = document.getElementById("settingsForm") as HTMLFormElement | null;
    const wallpaperKeywords = document.getElementById("wallpaperKeywords") as HTMLTextAreaElement | null;

    const handleOpenSettings = () => {
      document.getElementById("userMenu")?.classList.remove("show");
      if (wallpaperKeywords) {
        const uid = uidRef.current;
        let kw =
          localStorage.getItem(foyerKey("customWallpaperKeywords", uid)) ||
          localStorage.getItem("customWallpaperKeywords");
        if (!kw) {
          kw = UNSPLASH_CONFIG.query;
          localStorage.setItem(foyerKey("customWallpaperKeywords", uid), kw);
        }
        wallpaperKeywords.value = kw;
      }
      const m = document.getElementById("settingsModal");
      if (m) m.style.display = "flex";
    };
    const handleCloseSettings = () => closeModal("settingsModal");
    const handleCancelSettings = () => closeModal("settingsModal");
    const handleSettingsSubmit = (e: Event) => {
      e.preventDefault();
      const uid = uidRef.current;
      if (wallpaperKeywords) {
        localStorage.setItem(foyerKey("customWallpaperKeywords", uid), wallpaperKeywords.value);
      }
      const widgetKeys = ["clock", "calendar", "weather", "news", "search"];
      widgetKeys.forEach((key) => {
        const el = document.getElementById(`widgetToggle${key.charAt(0).toUpperCase() + key.slice(1)}`) as HTMLInputElement | null;
        if (el) {
          localStorage.setItem(foyerKey(`widget_${key}`, uid), String(el.checked));
        }
      });
      window.dispatchEvent(new Event("widgetsettingschange"));
      closeModal("settingsModal");
      showToast("Settings saved!");
    };

    openSettingsBtn?.addEventListener("click", handleOpenSettings);
    closeSettingsModal?.addEventListener("click", handleCloseSettings);
    cancelSettingsBtn?.addEventListener("click", handleCancelSettings);
    settingsForm?.addEventListener("submit", handleSettingsSubmit);

    return () => {
      openSettingsBtn?.removeEventListener("click", handleOpenSettings);
      closeSettingsModal?.removeEventListener("click", handleCloseSettings);
      cancelSettingsBtn?.removeEventListener("click", handleCancelSettings);
      settingsForm?.removeEventListener("submit", handleSettingsSubmit);
    };
  }, []);

  // Add Site modal
  useEffect(() => {
    const addSiteBtn = document.getElementById("addSiteBtn");
    const closeModalBtn = document.getElementById("closeModal");
    const cancelBtn = document.getElementById("cancelBtn");
    const form = document.getElementById("addSiteForm") as HTMLFormElement | null;
    const urlInput = document.getElementById("siteUrl") as HTMLInputElement | null;
    const catSelect = document.getElementById("siteCategory") as HTMLSelectElement | null;
    const hintEl = document.getElementById("detectHint");

    const detectCategory = () => {
      if (!urlInput || !catSelect || !categories.length) return;
      const url = urlInput.value.trim();
      if (!url) { if (hintEl) hintEl.textContent = ""; return; }
      const name = (document.getElementById("siteName") as HTMLInputElement)?.value.trim() || "";
      const result = classifySite(name, url, categories);
      if (result.confidence !== "none" && result.categoryId) {
        catSelect.value = result.categoryId;
        if (hintEl) hintEl.textContent = `Detected: ${result.suggestedCategoryName || ""}`;
      } else if (result.confidence === "medium" && result.suggestedCategoryName) {
        if (hintEl) hintEl.textContent = `Suggested: ${result.suggestedCategoryName} (create section first)`;
      } else {
        if (hintEl) hintEl.textContent = "";
      }
    };

    const handleOpenAdd = () => {
      const m = document.getElementById("addSiteModal");
      if (m) m.style.display = "flex";
      const nameInput = document.getElementById("siteName") as HTMLInputElement | null;
      nameInput?.focus();
      if (hintEl) hintEl.textContent = "";
    };
    const handleCloseAdd = () => { closeModal("addSiteModal"); if (hintEl) hintEl.textContent = ""; };
    const handleCancelAdd = () => { closeModal("addSiteModal"); if (hintEl) hintEl.textContent = ""; };
    const handleAddSubmit = (e: Event) => {
      e.preventDefault();
      const name = (document.getElementById("siteName") as HTMLInputElement)?.value.trim();
      const url = (document.getElementById("siteUrl") as HTMLInputElement)?.value.trim();
      const catId = (document.getElementById("siteCategory") as HTMLSelectElement)?.value;
      if (!name || !url || !catId) return;
      addSite(name, url, catId);
      closeModal("addSiteModal");
      form?.reset();
      if (hintEl) hintEl.textContent = "";
      showToast(`"${name}" added!`);
    };

    addSiteBtn?.addEventListener("click", handleOpenAdd);
    closeModalBtn?.addEventListener("click", handleCloseAdd);
    cancelBtn?.addEventListener("click", handleCancelAdd);
    form?.addEventListener("submit", handleAddSubmit);
    urlInput?.addEventListener("blur", detectCategory);

    return () => {
      addSiteBtn?.removeEventListener("click", handleOpenAdd);
      closeModalBtn?.removeEventListener("click", handleCloseAdd);
      cancelBtn?.removeEventListener("click", handleCancelAdd);
      form?.removeEventListener("submit", handleAddSubmit);
      urlInput?.removeEventListener("blur", detectCategory);
    };
  }, [addSite, categories]);

  // Edit Site modal (submit only; open is handled by ShortcutCard)
  useEffect(() => {
    const closeEditModal = document.getElementById("closeEditModal");
    const cancelEditBtn = document.getElementById("cancelEditBtn");
    const form = document.getElementById("editSiteForm") as HTMLFormElement | null;

    const handleCloseEdit = () => closeModal("editSiteModal");
    const handleCancelEdit = () => closeModal("editSiteModal");
    const handleEditSubmit = (e: Event) => {
      e.preventDefault();
      const catIdx = (window as any).__editingCategoryIndex;
      const itemIdx = (window as any).__editingItemIndex;
      if (catIdx === undefined || itemIdx === undefined) return;
      const name = (document.getElementById("editSiteName") as HTMLInputElement)?.value.trim();
      const url = (document.getElementById("editSiteUrl") as HTMLInputElement)?.value.trim();
      if (!name || !url) return;
      const domain = getRootDomain(url);

      const catSelect = document.getElementById("editSiteCategory") as HTMLSelectElement | null;
      if (catSelect) {
        const targetCatId = catSelect.value;
        const targetCatIdx = categories.findIndex((c) => c.id === targetCatId);
        if (targetCatIdx >= 0 && targetCatIdx !== catIdx) {
          editSite(catIdx, itemIdx, { name, url, domain });
          moveSite(catIdx, itemIdx, targetCatIdx, categories[targetCatIdx].websites.length);
          closeModal("editSiteModal");
          (window as any).__editingCategoryIndex = undefined;
          (window as any).__editingItemIndex = undefined;
          showToast("Site updated!");
          return;
        }
      }
      editSite(catIdx, itemIdx, { name, url, domain });
      closeModal("editSiteModal");
      (window as any).__editingCategoryIndex = undefined;
      (window as any).__editingItemIndex = undefined;
      showToast("Site updated!");
    };

    closeEditModal?.addEventListener("click", handleCloseEdit);
    cancelEditBtn?.addEventListener("click", handleCancelEdit);
    form?.addEventListener("submit", handleEditSubmit);

    return () => {
      closeEditModal?.removeEventListener("click", handleCloseEdit);
      cancelEditBtn?.removeEventListener("click", handleCancelEdit);
      form?.removeEventListener("submit", handleEditSubmit);
    };
  }, [editSite, moveSite, categories]);

  // Section modal
  useEffect(() => {
    const addSectionBtn = document.getElementById("addSectionBtn");
    const closeSectionModal = document.getElementById("closeSectionModal");
    const cancelSectionBtn = document.getElementById("cancelSectionBtn");
    const form = document.getElementById("sectionForm") as HTMLFormElement | null;

    const handleAddSection = () => {
      const title = document.getElementById("sectionModalTitle");
      if (title) title.textContent = "Add Section";
      (document.getElementById("sectionId") as HTMLInputElement)!.value = "";
      const submitBtn = document.querySelector("#sectionModal .btn-primary");
      if (submitBtn) submitBtn.textContent = "Save Section";
      (document.getElementById("sectionName") as HTMLInputElement)!.value = "";
      (document.getElementById("sectionIcon") as HTMLInputElement)!.value = "";
      const m = document.getElementById("sectionModal");
      if (m) m.style.display = "flex";
      document.getElementById("sectionName")?.focus();
      (window as any).__editingSectionIndex = undefined;
      (window as any).__sectionModalMode = undefined;
    };

    const handleCloseSection = () => {
      const idx = (window as any).__editingSectionIndex;
      if (idx !== undefined && idx !== null) {
        const sectionName = categories[idx]?.name || "this section";
        if (confirm(`Delete "${sectionName}" and all its shortcuts? This cannot be undone.`)) {
          deleteCategory(idx);
          showToast(`"${sectionName}" deleted`);
        }
      }
      closeModal("sectionModal");
      (window as any).__editingSectionIndex = undefined;
      (window as any).__sectionModalMode = undefined;
    };

    const handleCancelSection = () => {
      closeModal("sectionModal");
      (window as any).__editingSectionIndex = undefined;
      (window as any).__sectionModalMode = undefined;
    };

    const handleSectionSubmit = (e: Event) => {
      e.preventDefault();
      const name = (document.getElementById("sectionName") as HTMLInputElement)?.value.trim();
      const icon = (document.getElementById("sectionIcon") as HTMLInputElement)?.value.trim();
      const sectionId = (document.getElementById("sectionId") as HTMLInputElement)?.value;
      if (!name) return;
      if (sectionId) {
        const idx = categories.findIndex((c) => c.id === sectionId);
        if (idx >= 0) editCategory(idx, name, icon);
        showToast("Section updated!");
      } else {
        addCategory(name, icon);
        showToast("Section added!");
      }
      closeModal("sectionModal");
      form?.reset();
    };

    addSectionBtn?.addEventListener("click", handleAddSection);
    closeSectionModal?.addEventListener("click", handleCloseSection);
    cancelSectionBtn?.addEventListener("click", handleCancelSection);
    form?.addEventListener("submit", handleSectionSubmit);

    return () => {
      addSectionBtn?.removeEventListener("click", handleAddSection);
      closeSectionModal?.removeEventListener("click", handleCloseSection);
      cancelSectionBtn?.removeEventListener("click", handleCancelSection);
      form?.removeEventListener("submit", handleSectionSubmit);
    };
  }, [categories, addCategory, editCategory, deleteCategory]);

  // Export / Import
  useEffect(() => {
    const exportBtn = document.getElementById("exportDataBtn");
    const importBtn = document.getElementById("importDataBtn");
    const importFileInput = document.getElementById("importFileInput") as HTMLInputElement | null;

    const handleExport = () => {
      const data = JSON.stringify(categories, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `foyer-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Data exported!");
    };

    const handleImportClick = () => importFileInput?.click();

    const handleImportChange = () => {
      const file = importFileInput?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (!Array.isArray(data)) throw new Error("Invalid format");
          replaceAll(data);
          showToast("Data imported!");
        } catch {
          showToast("Invalid JSON file!", "error");
        }
      };
      reader.readAsText(file);
      importFileInput.value = "";
    };

    exportBtn?.addEventListener("click", handleExport);
    importBtn?.addEventListener("click", handleImportClick);
    importFileInput?.addEventListener("change", handleImportChange);

    return () => {
      exportBtn?.removeEventListener("click", handleExport);
      importBtn?.removeEventListener("click", handleImportClick);
      importFileInput?.removeEventListener("change", handleImportChange);
    };
  }, [categories, replaceAll]);

  // Bookmark Import modal
  useEffect(() => {
    const importBtn = document.getElementById("importBookmarksBtn");
    const closeBtn = document.getElementById("closeImportModal");
    const cancelBtn = document.getElementById("cancelImportBtn");
    const confirmBtn = document.getElementById("confirmImportBtn");
    const doneBtn = document.getElementById("closeImportDoneBtn");
    const fileInput = document.getElementById("importBookmarkFile") as HTMLInputElement | null;

    let parsedBookmarks: ParsedBookmark[] = [];

    const resetModal = () => {
      (window as any).__uncategorizedBookmarks = undefined;
      (window as any).__importOverrides = undefined;
      setShowUncategorizedActions(false);
      document.getElementById("importStepUpload")!.style.display = "";
      document.getElementById("importStepPreview")!.style.display = "none";
      document.getElementById("importStepDone")!.style.display = "none";
      confirmBtn!.style.display = "none";
      doneBtn!.style.display = "none";
      cancelBtn!.textContent = "Cancel";
      if (fileInput) fileInput.value = "";
      parsedBookmarks = [];
    };

    const openImportModal = () => {
      resetModal();
      const m = document.getElementById("importBookmarksModal");
      if (m) m.style.display = "flex";
    };

    const closeImportModal = () => {
      closeModal("importBookmarksModal");
      resetModal();
    };

    const handleFileChange = () => {
      const file = fileInput?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const html = ev.target?.result as string;
        if (!html) return;
        parsedBookmarks = parseBookmarkHtml(html);
        if (parsedBookmarks.length === 0) {
          showToast("No valid bookmarks found in the file.", "error");
          return;
        }

        const skipExisting = (document.getElementById("importSkipExisting") as HTMLInputElement)?.checked ?? true;
        const categories = (window as any).__categories || [];

        let filtered = parsedBookmarks;
        if (skipExisting) {
          const existingUrls = new Set<string>();
          for (const cat of categories) {
            for (const site of cat.websites || []) {
              existingUrls.add(site.url.trim().toLowerCase());
            }
          }
          filtered = parsedBookmarks.filter((b) => !existingUrls.has(b.url.trim().toLowerCase()));
        }

        const tbody = document.getElementById("importTableBody")!;
        tbody.innerHTML = filtered.map((b) => {
          const result = classifySite(b.title, b.url, categories, b.folder);
          const badge = result.confidence === "high" ? "🟢 High" :
            result.confidence === "medium" ? "🟡 Medium" :
            result.confidence === "low" ? "🟠 Low" : "⚪ None";
          const categoryOptions = categories.map((c: any) =>
            `<option value="${c.id}" ${c.id === result.categoryId ? 'selected' : ''}>${c.icon || ''} ${escapeHtml(c.name)}</option>`
          ).join('');
          return `<tr>
            <td class="import-title">${escapeHtml(b.title)}</td>
            <td class="import-folder">${b.folder ? escapeHtml(b.folder) : '—'}</td>
            <td class="import-category">
              <select data-url="${normalizeUrl(b.url)}" class="import-category-select">
                <option value="" ${!result.categoryId ? 'selected' : ''}>— Uncategorized —</option>
                ${categoryOptions}
              </select>
            </td>
            <td class="import-confidence"><span class="confidence-badge confidence-${result.confidence}">${badge}</span></td>
          </tr>`;
        }).join("");

        // Wire up change listeners for category overrides
        const overrides: Record<string, string> = {};
        (window as any).__importOverrides = overrides;
        tbody.querySelectorAll(".import-category-select").forEach((sel) => {
          sel.addEventListener("change", (e) => {
            const select = e.currentTarget as HTMLSelectElement;
            const url = select.dataset.url!;
            const val = select.value;
            if (val) overrides[url] = val;
            else delete overrides[url];
          });
        });

        document.getElementById("importSummary")!.textContent =
          `Found ${parsedBookmarks.length} bookmarks${skipExisting ? `. ${filtered.length} new after removing existing.` : "."}`;

        document.getElementById("importStepUpload")!.style.display = "none";
        document.getElementById("importStepPreview")!.style.display = "";
        confirmBtn!.style.display = "";
        cancelBtn!.textContent = "Back";
      };
      reader.readAsText(file);
    };

    const handleConfirm = () => {
      const autoCreate = (document.getElementById("importAutoCreate") as HTMLInputElement)?.checked ?? false;
      const highConfidenceOnly = (document.getElementById("importHighConfidence") as HTMLInputElement)?.checked ?? true;
      const categories = (window as any).__categories || [];
      const skipExisting = (document.getElementById("importSkipExisting") as HTMLInputElement)?.checked ?? true;

      let toImport = parsedBookmarks;
      if (skipExisting) {
        const existingUrls = new Set<string>();
        for (const cat of categories) {
          for (const site of cat.websites || []) {
            existingUrls.add(site.url.trim().toLowerCase());
          }
        }
        toImport = parsedBookmarks.filter((b) => !existingUrls.has(b.url.trim().toLowerCase()));
      }

      const overrides = (window as any).__importOverrides || {};
      const result = importBookmarks(toImport, { autoCreateCategories: autoCreate, categoryOverrides: overrides, autoImportHighConfidence: highConfidenceOnly });

      // Write pending items to Firestore for later review
      if (highConfidenceOnly && result.pending.length > 0 && uidRef.current) {
        for (const item of result.pending) {
          addPendingBookmark(
            uidRef.current,
            item.bookmark.title,
            item.bookmark.url,
            item.classification,
            "import",
            item.bookmark.folder,
            item.bookmark.icon,
          ).catch(() => {});
        }
      }

      document.getElementById("importStepPreview")!.style.display = "none";
      document.getElementById("importStepDone")!.style.display = "";
      confirmBtn!.style.display = "none";
      doneBtn!.style.display = "";
      cancelBtn!.style.display = "none";

      let summary = `✅ Added <strong>${result.added}</strong> bookmarks`;
      if (result.skipped > 0) summary += `, skipped <strong>${result.skipped}</strong> duplicates`;
      if (result.createdCategories.length > 0) summary += `<br>📁 Created sections: <strong>${result.createdCategories.join(", ")}</strong>`;
      if (highConfidenceOnly && result.pending.length > 0) {
        summary += `<br>📋 <strong>${result.pending.length}</strong> bookmark${result.pending.length > 1 ? 's' : ''} saved for review — check the <i class="fas fa-bell"></i> badge on your avatar`;
      }
      if (result.uncategorized.length > 0 && !autoCreate) {
        summary += `<br>⚠️ <strong>${result.uncategorized.length}</strong> bookmarks could not be categorized`;
        (window as any).__uncategorizedBookmarks = result.uncategorized;
        setShowUncategorizedActions(true);
      } else if (result.uncategorized.length > 0) {
        summary += `<br>⚠️ <strong>${result.uncategorized.length}</strong> bookmarks could not be categorized`;
      }
      document.getElementById("importDoneSummary")!.innerHTML = summary;

      showToast(`Imported ${result.added} bookmarks!`);
    };

    importBtn?.addEventListener("click", openImportModal);
    closeBtn?.addEventListener("click", closeImportModal);
    cancelBtn?.addEventListener("click", closeImportModal);
    confirmBtn?.addEventListener("click", handleConfirm);
    doneBtn?.addEventListener("click", closeImportModal);
    fileInput?.addEventListener("change", handleFileChange);

    return () => {
      importBtn?.removeEventListener("click", openImportModal);
      closeBtn?.removeEventListener("click", closeImportModal);
      cancelBtn?.removeEventListener("click", closeImportModal);
      confirmBtn?.removeEventListener("click", handleConfirm);
      doneBtn?.removeEventListener("click", closeImportModal);
      fileInput?.removeEventListener("change", handleFileChange);
    };
  }, [importBookmarks]);

  // First-login prompt handlers
  const persistPromptDismissed = () => {
    if (!user) return;
    localStorage.setItem(foyerKey("bookmarkImportPromptShown", user.uid), "true");
    try {
      updateDoc(doc(db, "users", user.uid), {
        "settings.bookmarkImportPromptShown": true,
      });
    } catch { /* best-effort */ }
  };

  const handlePromptLater = () => {
    const modal = document.getElementById("bookmarkImportPromptModal");
    if (modal) modal.style.display = "none";
  };

  const handleDontShowAgain = () => {
    persistPromptDismissed();
    const modal = document.getElementById("bookmarkImportPromptModal");
    if (modal) modal.style.display = "none";
  };

  const handlePromptImportNow = () => {
    persistPromptDismissed();
    const modal = document.getElementById("bookmarkImportPromptModal");
    if (modal) modal.style.display = "none";
    const importModal = document.getElementById("importBookmarksModal");
    if (importModal) importModal.style.display = "flex";
  };

  const handlePromptBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handlePromptLater();
    }
  };

  // Populate category dropdowns
  useEffect(() => {
    ["siteCategory", "editSiteCategory", "uncategorizedCategorySelect"].forEach((selectId) => {
      const sel = document.getElementById(selectId) as HTMLSelectElement | null;
      if (!sel) return;
      sel.innerHTML = "";
      categories.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.icon && cat.icon.trim() ? `${cat.icon} ${cat.name}` : cat.name;
        sel.appendChild(opt);
      });
    });
  }, [categories]);

  // Uncategorized action button handlers
  const handleCreateSections = () => {
    const uncategorized = (window as any).__uncategorizedBookmarks as any[] | undefined;
    (window as any).__uncategorizedBookmarks = undefined;
    setShowUncategorizedActions(false);
    if (!uncategorized || uncategorized.length === 0) return;
    const result = importBookmarks(uncategorized, { autoCreateCategories: true });
    const summary = document.getElementById("importDoneSummary")!;
    summary.innerHTML += `<br>📁 Created sections: <strong style="color:var(--accent-color)">${result.createdCategories.join(", ")}</strong>`;
    showToast(`Organized ${result.added} uncategorized bookmarks into sections!`);
  };

  const handleAddToCategory = () => {
    const uncategorized = (window as any).__uncategorizedBookmarks as any[] | undefined;
    (window as any).__uncategorizedBookmarks = undefined;
    setShowUncategorizedActions(false);
    if (!uncategorized || uncategorized.length === 0) return;
    const select = document.getElementById("uncategorizedCategorySelect") as HTMLSelectElement | null;
    const categoryId = select?.value;
    if (!categoryId) {
      showToast("Please select a category first.", "error");
      return;
    }
    let added = 0;
    for (const b of uncategorized) {
      addSite(b.title, b.url, categoryId, b.icon);
      added++;
    }
    const summary = document.getElementById("importDoneSummary")!;
    summary.innerHTML += `<br>➕ Added <strong>${added}</strong> uncategorized bookmarks to selected section`;
    showToast(`Added ${added} bookmarks!`);
  };

  // First-login bookmark import prompt
  useEffect(() => {
    if (!user || categories.length === 0) return;
    let cancelled = false;

    const promptShownRef = (window as any).__bookmarkPromptShown;
    if (promptShownRef) return;

    // Fast path — already dismissed permanently in this browser
    if (localStorage.getItem(foyerKey("bookmarkImportPromptShown", user.uid)) === "true") return;

    const checkPrompt = async () => {
      if (cancelled) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;
        const settings = userDoc.data()?.settings;
        if (settings?.bookmarkImportPromptShown === true) return;

        (window as any).__bookmarkPromptShown = true;
        const modal = document.getElementById("bookmarkImportPromptModal");
        if (modal) modal.style.display = "flex";
      } catch {
        // Silently fail
      }
    };
    checkPrompt();
    return () => { cancelled = true; };
  }, [user, categories]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        (document.getElementById("unifiedSearchInput") as HTMLInputElement | null)?.focus();
      }
      if (e.key === "Escape") {
        for (const id of ["addSiteModal", "editSiteModal", "sectionModal", "settingsModal", "bookmarkImportPromptModal"]) {
          const m = document.getElementById(id);
          if (m && m.style.display === "flex") { m.style.display = "none"; break; }
        }
        (window as any).__editingSectionIndex = undefined;
        (window as any).__sectionModalMode = undefined;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Expose categories for vanilla legacy code
  useEffect(() => {
    (window as any).__categories = categories;
  }, [categories]);

  return (
    <AuthGuard>
      <div id="wallpaperBackground" className="wallpaper-bg"></div>

      <div className="user-avatar-container" id="userAvatarContainer">
        <button className="user-avatar-btn" id="userAvatarBtn" aria-label="Account menu" title="Account">
          <img id="userAvatarImg" alt="" className="avatar-photo" style={{ display: "none" }} />
          <span id="userAvatarInitials" className="avatar-initials"></span>
        </button>
        {pendingCount > 0 && (
          <div className="pending-badge" id="pendingBadge" title={`${pendingCount} app${pendingCount > 1 ? 's' : ''} need review`}
            onClick={() => {
              const m = document.getElementById("reviewPendingModal");
              if (m) m.style.display = "flex";
            }}>
            {pendingCount > 9 ? '9+' : pendingCount}
          </div>
        )}
        <div className="user-menu" id="userMenu">
          <div className="user-menu-info">
            <div className="user-menu-name" id="userMenuName"></div>
            <div className="user-menu-email" id="userMenuEmail"></div>
          </div>
          <div className="user-menu-sep"></div>
          <button className="user-menu-item" id="openSettingsBtn" type="button"><i className="fas fa-cog"></i><span>Settings</span></button>
          <button className="user-menu-item" id="unsplashConnectBtn" type="button"
            onClick={() => {
              document.getElementById("userMenu")?.classList.remove("show");
              if (!connected) startOAuth();
            }}>
            <i className={`fas ${connected ? "fa-check-circle" : "fa-camera-retro"}`}
              style={connected ? { color: "#1db954" } : undefined}></i>
            <span>{connected ? "Unsplash Connected" : "Connect Unsplash"}</span>
          </button>
          <a href="https://www.chai4.me/alwaz" target="_blank" rel="noopener noreferrer" className="user-menu-item" style={{ textDecoration: "none", color: "var(--text-color)" }}>
            <i className="fas fa-mug-hot" style={{ color: "#f59e0b" }}></i><span>Buy me a Chai</span>
          </a>
          <div className="user-menu-sep"></div>
          <button className="user-menu-item danger" id="signOutBtn" type="button"><i className="fas fa-arrow-right-from-bracket"></i><span>Sign Out</span></button>
        </div>
      </div>

      <div className="container">
        <div className="widgets-area">
          {widgetSettings.clock && <ClockWidget />}
          {widgetSettings.calendar && <CalendarWidget />}

        {widgetSettings.search && (
            <div className="widget unified-search-widget" id="unifiedSearchWidget" style={{ "--engine-color": "#4285F4" } as React.CSSProperties}>
              <div className="widget-header">
                <button type="button" className="engine-selector" id="engineSelector" aria-label="Select search engine" aria-expanded="false">
                  <span id="currentEngineIcon" className="engine-selector-icon"><i className="fab fa-google"></i></span>
                  <i className="fas fa-chevron-down engine-dropdown-arrow"></i>
                </button>
                <div className="engine-dropdown" id="engineDropdown">
                  <button type="button" className="engine-option" data-engine="google">
                    <span className="engine-option-svg-icon">
                      <svg height="1em" style={{flex:"none",lineHeight:"1"}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M23 12.245c0-.905-.075-1.565-.236-2.25h-10.54v4.083h6.186c-.124 1.014-.797 2.542-2.294 3.569l-.021.136 3.332 2.53.23.022C21.779 18.417 23 15.593 23 12.245z" fill="#4285F4"></path><path d="M12.225 23c3.03 0 5.574-.978 7.433-2.665l-3.542-2.688c-.948.648-2.22 1.1-3.891 1.1a6.745 6.745 0 01-6.386-4.572l-.132.011-3.465 2.628-.045.124C4.043 20.531 7.835 23 12.225 23z" fill="#34A853"></path><path d="M5.84 14.175A6.65 6.65 0 015.463 12c0-.758.138-1.491.361-2.175l-.006-.147-3.508-2.67-.115.054A10.831 10.831 0 001 12c0 1.772.436 3.447 1.197 4.938l3.642-2.763z" fill="#FBBC05"></path><path d="M12.225 5.253c2.108 0 3.529.892 4.34 1.638l3.167-3.031C17.787 2.088 15.255 1 12.225 1 7.834 1 4.043 3.469 2.197 7.062l3.63 2.763a6.77 6.77 0 016.398-4.572z" fill="#EB4335"></path></svg>
                    </span>
                    <span>Google</span>
                  </button>
                  <button type="button" className="engine-option" data-engine="youtube"><i className="fab fa-youtube"></i><span>YouTube</span></button>
                  <button type="button" className="engine-option" data-engine="perplexity">
                    <span className="engine-option-svg-icon">
                      <svg height="1em" style={{flex:"none",lineHeight:"1"}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M19.785 0v7.272H22.5V17.62h-2.935V24l-7.037-6.194v6.145h-1.091v-6.152L4.392 24v-6.465H1.5V7.188h2.884V0l7.053 6.494V.19h1.09v6.49L19.786 0zm-7.257 9.044v7.319l5.946 5.234V14.44l-5.946-5.397zm-1.099-.08l-5.946 5.398v7.235l5.946-5.234V8.965zm8.136 7.58h1.844V8.349H13.46l6.105 5.54v2.655zm-8.982-8.28H2.59v8.195h1.8v-2.576l6.192-5.62zM5.475 2.476v4.71h5.115l-5.115-4.71zm13.219 0l-5.115 4.71h5.115v-4.71z" fill="#22B8CD" fillRule="nonzero"></path></svg>
                    </span>
                    <span>Perplexity</span>
                  </button>
                  <button type="button" className="engine-option" data-engine="chatgpt">
                    <span className="engine-option-svg-icon">
                      <svg fill="currentColor" fillRule="evenodd" height="1em" style={{flex:"none",lineHeight:"1"}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"></path></svg>
                    </span>
                    <span>ChatGPT</span>
                  </button>
                  <button type="button" className="engine-option" data-engine="claude">
                    <span className="engine-option-svg-icon">
                      <svg height="1em" style={{flex:"none",lineHeight:"1"}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fillRule="nonzero"></path></svg>
                    </span>
                    <span>Claude</span>
                  </button>
                  <button type="button" className="engine-option" data-engine="gemini">
                    <span className="engine-option-svg-icon">
                      <svg height="1em" style={{flex:"none",lineHeight:"1"}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path></svg>
                    </span>
                    <span>Gemini</span>
                  </button>
                  <button type="button" className="engine-option" data-engine="x"><i className="fab fa-x-twitter"></i><span>X</span></button>
                  <button type="button" className="engine-option" data-engine="reddit"><i className="fab fa-reddit-alien"></i><span>Reddit</span></button>
                  <button type="button" className="engine-option" data-engine="wikipedia"><i className="fab fa-wikipedia-w"></i><span>Wikipedia</span></button>
                </div>
              </div>
              <form className="widget-form" id="unifiedSearchForm">
                <div className="search-input-wrapper">
                  <button type="button" className="ai-mode-toggle" id="aiModeToggle" title="Toggle Google AI mode">
                    <svg className="ai-sparkle-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"/>
                    </svg>
                  </button>
                  <input type="text" placeholder="Search Google..." className="widget-input" id="unifiedSearchInput" autoComplete="off" />
                  <div className="search-history-dropdown" id="searchHistoryDropdown"></div>
                </div>
                <button type="submit" className="widget-btn" id="searchSubmitBtn"><i className="fas fa-search"></i></button>
              </form>
            </div>
        )}

          {widgetSettings.weather && <WeatherWidget />}
          {widgetSettings.news && <NewsWidget />}
        </div>

        <div className="section-actions">
          <div className="action-buttons">
            <button className="section-btn" id="addSectionBtn" type="button"><i className="fas fa-layer-group"></i><span className="btn-text">Add Section</span></button>
            <button className="section-btn" id="addSiteBtn" type="button"><i className="fas fa-plus"></i><span className="btn-text">Add Site</span></button>
          </div>
          <div className="data-controls">
            <button className="data-btn export-btn" id="exportDataBtn" type="button" title="Export all data to JSON file"><i className="fas fa-download"></i><span className="btn-text">Export</span></button>
            <button className="data-btn import-btn" id="importDataBtn" type="button" title="Import data from JSON file"><i className="fas fa-upload"></i><span className="btn-text">Import</span></button>
            <button className="data-btn bookmark-import-btn" id="importBookmarksBtn" type="button" title="Import browser bookmarks"><i className="fas fa-bookmark"></i><span className="btn-text">Bookmarks</span></button>
          </div>
        </div>
        <input type="file" id="importFileInput" accept=".json" style={{ display: "none" }} />

        <ShortcutGrid />
      </div>

      <div id="settingsModal" className="modal">
        <div className="modal-content">
          <div className="modal-header"><h2>Foyer Settings</h2><button className="close-btn" id="closeSettingsModal" aria-label="Close settings">&times;</button></div>
          <form id="settingsForm" className="modal-form">
            <div className="form-group">
              <label htmlFor="wallpaperKeywords">Unsplash Wallpaper Keywords (comma separated):</label>
              <textarea id="wallpaperKeywords" rows={4} placeholder="e.g., Mountains, Ocean waves, Cyberpunk city..."
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-text)", fontFamily: "inherit", resize: "vertical" }}></textarea>
            </div>
            <div className="form-group widgets-settings-group">
              <label className="widgets-settings-label">Widgets</label>
              <div className="widgets-settings-grid">
                <label className="toggle-switch">
                  <i className="fa-regular fa-clock"></i>
                  <span className="toggle-label-text">Clock</span>
                  <input type="checkbox" id="widgetToggleClock" defaultChecked={widgetSettings.clock} />
                  <span className="toggle-slider"></span>
                </label>
                <label className="toggle-switch">
                  <i className="fa-regular fa-calendar"></i>
                  <span className="toggle-label-text">Calendar</span>
                  <input type="checkbox" id="widgetToggleCalendar" defaultChecked={widgetSettings.calendar} />
                  <span className="toggle-slider"></span>
                </label>
                <label className="toggle-switch">
                  <i className="fa-solid fa-cloud-sun"></i>
                  <span className="toggle-label-text">Weather</span>
                  <input type="checkbox" id="widgetToggleWeather" defaultChecked={widgetSettings.weather} />
                  <span className="toggle-slider"></span>
                </label>
                <label className="toggle-switch">
                  <i className="fa-regular fa-newspaper"></i>
                  <span className="toggle-label-text">News</span>
                  <input type="checkbox" id="widgetToggleNews" defaultChecked={widgetSettings.news} />
                  <span className="toggle-slider"></span>
                </label>
                <label className="toggle-switch">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <span className="toggle-label-text">Search Bar</span>
                  <input type="checkbox" id="widgetToggleSearch" defaultChecked={widgetSettings.search} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" id="cancelSettingsBtn">Cancel</button>
              <button type="submit" className="btn-primary">Save Settings</button>
            </div>
          </form>
        </div>
      </div>

      <div id="addSiteModal" className="modal">
        <div className="modal-content">
          <div className="modal-header"><h2>Add New Site</h2><button className="close-btn" id="closeModal">&times;</button></div>
          <form id="addSiteForm" className="modal-form">
            <div className="form-group"><label htmlFor="siteName">Site Name:</label><input type="text" id="siteName" placeholder="e.g., My Site" required /></div>
            <div className="form-group"><label htmlFor="siteUrl">URL:</label><input type="text" id="siteUrl" placeholder="e.g., example.com or https://example.com" required /></div>
            <div className="form-group"><label htmlFor="siteCategory">Category:</label><select id="siteCategory" required></select><div id="detectHint" className="detect-hint"></div></div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" id="cancelBtn">Cancel</button>
              <button type="submit" className="btn-primary">Add Site</button>
            </div>
          </form>
        </div>
      </div>

      <div id="editSiteModal" className="modal">
        <div className="modal-content">
          <div className="modal-header"><h2>Edit Site</h2><button className="close-btn" id="closeEditModal">&times;</button></div>
          <form id="editSiteForm" className="modal-form">
            <div className="form-group"><label htmlFor="editSiteName">Site Name:</label><input type="text" id="editSiteName" placeholder="e.g., My Site" required /></div>
            <div className="form-group"><label htmlFor="editSiteUrl">URL:</label><input type="text" id="editSiteUrl" placeholder="e.g., example.com or https://example.com" required /></div>
            <div className="form-group"><label htmlFor="editSiteCategory">Category:</label><select id="editSiteCategory" required></select></div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" id="cancelEditBtn">Cancel</button>
              <button type="submit" className="btn-primary">Update Site</button>
            </div>
          </form>
        </div>
      </div>

      <div id="sectionModal" className="modal">
        <div className="modal-content">
          <div className="modal-header"><h2 id="sectionModalTitle">Add Section</h2><button className="close-btn" id="closeSectionModal" aria-label="Close section modal" title="Delete section"><i className="fa-regular fa-trash-can" style={{ color: "#ff4d4d", fontSize: "14px" }}></i></button></div>
          <form id="sectionForm" className="modal-form">
            <input type="hidden" id="sectionId" />
            <div className="form-group"><label htmlFor="sectionName">Section Name:</label><input type="text" id="sectionName" placeholder="e.g., Design Tools" maxLength={40} required /></div>
            <div className="form-group"><label htmlFor="sectionIcon">Section Icon (emoji or letter):</label><input type="text" id="sectionIcon" placeholder="e.g., 🎨 or D" maxLength={2} /></div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" id="cancelSectionBtn">Cancel</button>
              <button type="submit" className="btn-primary">Save Section</button>
            </div>
          </form>
        </div>
      </div>

      <div id="importBookmarksModal" className="modal">
        <div className="modal-content import-modal-content">
          <div className="modal-header">
            <h2 id="importModalTitle">Import Bookmarks</h2>
            <button className="close-btn" id="closeImportModal" aria-label="Close import modal">&times;</button>
          </div>
          <div className="modal-form" id="importModalBody">
            <div id="importStepUpload">
              <p style={{ marginBottom: 16, color: "var(--text-color)" }}>
                Export your bookmarks from your browser as an HTML file, then upload it here.
                Foyer will automatically categorize them into your existing sections.
              </p>
              <div className="form-group">
                <label htmlFor="importBookmarkFile">Bookmark HTML file:</label>
                <input type="file" id="importBookmarkFile" accept=".html" />
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="importSkipExisting" defaultChecked style={{ width: 18, height: 18 }} />
                <label htmlFor="importSkipExisting" style={{ margin: 0 }}>Skip bookmarks that already exist</label>
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="importAutoCreate" style={{ width: 18, height: 18 }} />
                <label htmlFor="importAutoCreate" style={{ margin: 0 }}>Create new sections for unmatched domains</label>
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="importHighConfidence" defaultChecked style={{ width: 18, height: 18 }} />
                <label htmlFor="importHighConfidence" style={{ margin: 0 }}>Only auto-import high-confidence matches (rest saved for review)</label>
              </div>
            </div>
            <div id="importStepPreview" style={{ display: "none" }}>
              <p id="importSummary" style={{ marginBottom: 12, color: "var(--text-color)", fontWeight: 500 }}></p>
              <div className="import-table-wrapper" style={{ maxHeight: 420, overflowY: "auto", border: "1px solid var(--input-border)", borderRadius: 12, marginBottom: 12 }}>
                <table className="import-table" id="importPreviewTable">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Folder</th>
                      <th>Category</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody id="importTableBody"></tbody>
                </table>
              </div>
            </div>
            <div id="importStepDone" style={{ display: "none" }}>
              <p id="importDoneSummary" style={{ color: "var(--text-color)", fontSize: 16, lineHeight: 1.6 }}></p>
              {showUncategorizedActions && (
                <div id="importUncategorizedActions" style={{ marginTop: 16, borderTop: "1px solid var(--input-border)", paddingTop: 16 }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 12 }}>
                    <i className="fas fa-question-circle" style={{ marginRight: 6 }}></i>
                    Uncategorized bookmarks can be organized automatically:
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" className="btn-primary" id="createSectionsBtn"
                      onClick={handleCreateSections}>
                      <i className="fas fa-layer-group" style={{ marginRight: 6 }}></i>Create sections by domain
                    </button>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                      <select id="uncategorizedCategorySelect" style={{
                        padding: "10px 14px", border: "2px solid var(--input-border)", borderRadius: 12,
                        background: "var(--input-bg)", color: "var(--input-text)", fontSize: 14, minWidth: 180,
                        cursor: "pointer",
                      }}></select>
                      <button type="button" className="btn-secondary" id="addUncategorizedBtn"
                        onClick={handleAddToCategory}>Add Here</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-actions" style={{ padding: "0 28px 24px" }}>
            <button type="button" className="btn-secondary" id="cancelImportBtn">Cancel</button>
            <button type="button" className="btn-primary" id="confirmImportBtn" style={{ display: "none" }}>Import</button>
            <button type="button" className="btn-primary" id="closeImportDoneBtn" style={{ display: "none" }}>Done</button>
          </div>
        </div>
      </div>

      <div id="bookmarkImportPromptModal" className="modal" onClick={handlePromptBackdrop}>
        <div className="modal-content" style={{ maxWidth: 440 }}>
          <div className="modal-header">
            <h2><i className="fas fa-bookmark" style={{ marginRight: 8, color: "var(--accent-color)" }}></i>Import Your Bookmarks?</h2>
            <button className="close-btn" id="closeBookmarkPromptBtn" aria-label="Close" onClick={handlePromptLater}>&times;</button>
          </div>
          <div className="modal-form">
            <p style={{ color: "var(--text-color)", lineHeight: 1.6, marginBottom: 12 }}>
              You can import bookmarks from your browser to organize them into sections on Foyer.
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>
              Export your bookmarks as an HTML file from any browser, upload it here, and we'll automatically sort them.
            </p>
          </div>
          <div className="modal-actions" style={{ padding: "0 28px 24px", gap: 10 }}>
            <button type="button" className="btn-secondary" id="dontShowAgainBtn" onClick={handleDontShowAgain}>Don't Show Again</button>
            <button type="button" className="btn-primary" id="importNowPromptBtn" onClick={handlePromptImportNow}>
              <i className="fas fa-upload" style={{ marginRight: 6 }}></i>Import Now
            </button>
          </div>
        </div>
      </div>

      <div id="reviewPendingModal" className="modal">
        <div className="modal-content" style={{ maxWidth: 700 }}>
          <div className="modal-header">
            <h2><i className="fas fa-clipboard-list" style={{ marginRight: 10 }}></i>Review Uncategorized Apps</h2>
            <button className="close-btn" id="closeReviewPendingBtn" aria-label="Close review" onClick={() => closeModal("reviewPendingModal")}>&times;</button>
          </div>
          <div className="modal-form">
            {pendingBookmarks.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "40px 0" }}>
                <i className="fas fa-check-circle" style={{ fontSize: 48, display: "block", marginBottom: 16, color: "#1db954" }}></i>
                No uncategorized apps pending review.
              </p>
            ) : (
              <>
                <p style={{ color: "var(--text-color)", marginBottom: 12 }}>
                  {pendingBookmarks.length} app{pendingBookmarks.length > 1 ? 's' : ''} could not be automatically categorized. Assign them to a section or skip them.
                </p>
                <div className="import-table-wrapper" style={{ maxHeight: 400, overflowY: "auto", border: "1px solid var(--input-border)", borderRadius: 12, marginBottom: 12 }}>
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Confidence</th>
                        <th style={{ width: 140, textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingBookmarks.map((p) => {
                        const badgeText = p.confidence === "high" ? "🟢 High" :
                          p.confidence === "medium" ? "🟡 Medium" :
                          p.confidence === "low" ? "🟠 Low" : "⚪ None";
                        return (
                          <tr key={p.id}>
                            <td className="import-title" title={p.url}>{escapeHtml(p.title)}</td>
                            <td>
                              <select className="import-category-select" data-pending-id={p.id}>
                                <option value="">— Uncategorized —</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>{c.icon} {escapeHtml(c.name)}</option>
                                ))}
                              </select>
                            </td>
                            <td><span className={`confidence-badge confidence-${p.confidence}`}>{badgeText}</span></td>
                            <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                              <button className="btn-primary-sm" style={{ marginRight: 6, padding: "4px 12px", fontSize: 13, borderRadius: 8 }}
                                onClick={async () => {
                                  const sel = document.querySelector(`select[data-pending-id="${p.id}"]`) as HTMLSelectElement;
                                  const catId = sel?.value;
                                  if (!catId) { showToast("Select a category first.", "error"); return; }
                                  await confirmOne(p.id, catId);
                                  showToast(`Added ${p.title} to section.`);
                                }}>Add</button>
                              <button className="btn-secondary-sm" style={{ padding: "4px 12px", fontSize: 13, borderRadius: 8 }}
                                onClick={async () => {
                                  await skipOne(p.id);
                                  showToast("Skipped.");
                                }}>Skip</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          {pendingBookmarks.length > 0 && (
            <div className="modal-actions" style={{ padding: "0 28px 24px" }}>
              <button type="button" className="btn-secondary" onClick={async () => { await skipAll(); showToast("All skipped."); }}><i className="fas fa-times" style={{ marginRight: 6 }}></i>Skip All</button>
              <button type="button" className="btn-primary" onClick={async () => {
                for (const p of pendingBookmarks) {
                  const sel = document.querySelector(`select[data-pending-id="${p.id}"]`) as HTMLSelectElement;
                  const catId = sel?.value;
                  if (catId) {
                    await confirmOne(p.id, catId);
                  }
                }
                showToast("Confirmed all with selected categories.");
              }}><i className="fas fa-check" style={{ marginRight: 6 }}></i>Confirm All</button>
            </div>
          )}
        </div>
      </div>

      <div id="unsplashPopup" className="unsplash-popup">
        <p className="unsplash-popup-title"><i className="fas fa-heart"></i> Like this photo?</p>
        <div className="unsplash-popup-btns">
          <button className="unsplash-popup-btn primary" id="connectUnsplashPopupBtn" type="button"><i className="fas fa-link"></i> Connect Unsplash</button>
          <a className="unsplash-popup-btn secondary" id="openInUnsplashBtn" href="#" target="_blank" rel="noopener noreferrer"><i className="fas fa-arrow-up-right-from-square"></i> Open in Unsplash</a>
        </div>
      </div>

      <div id="foyerToast" className="foyer-toast" role="status" aria-live="polite"></div>

      <div id="photoCredit" className="photo-credit">
        <a id="imageLink" href="#" target="_blank" rel="noopener noreferrer" title="Save to Foyer collection"><i className="fa-solid fa-heart"></i></a>
        <span>Photo by <a id="photographerLink" href="#" target="_blank" rel="noopener noreferrer"></a> on <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a></span>
        <button id="wallpaperToggle" className="wallpaper-reload-btn" aria-label="Load new wallpaper" title="Load new wallpaper"><i className="fa-solid fa-arrows-rotate"></i></button>
        <button id="wallpaperPickerBtn" className="wallpaper-reload-btn" aria-label="Open wallpaper picker" title="Browse wallpapers"
          onClick={() => setShowWallpaperPicker(true)}><i className="fa-solid fa-images"></i></button>
      </div>

      <WallpaperPicker
        open={showWallpaperPicker}
        onClose={() => setShowWallpaperPicker(false)}
        connected={connected}
        startOAuth={startOAuth}
        setWallpaper={setWallpaper}
        markAsLiked={markAsLiked}
      />

      <MediaPlayer />
    </AuthGuard>
  );
}


