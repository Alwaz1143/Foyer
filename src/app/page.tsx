"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useWallpaper } from "@/hooks/useWallpaper";
import { useUnsplash } from "@/hooks/useUnsplash";
import { useSearch } from "@/hooks/useSearch";
import { useCategories } from "@/contexts/CategoriesContext";
import { UNSPLASH_CONFIG } from "@/lib/constants";
import ShortcutGrid from "@/components/ShortcutGrid";

function showToast(msg: string, type = "success") {
  const toast = document.getElementById("foyerToast");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `foyer-toast foyer-toast--${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function closeModal(id: string) {
  const m = document.getElementById(id);
  if (m) m.style.display = "none";
}

export default function HomePage() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { toggleWallpaper } = useWallpaper();
  const { connected, startOAuth } = useUnsplash();
  useSearch();
  const { categories, addSite, editSite, addCategory, editCategory, deleteCategory, replaceAll } = useCategories();

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
  }, [signOut, router, toggleWallpaper, startOAuth]);

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
        let kw = localStorage.getItem("customWallpaperKeywords");
        if (!kw) {
          kw = UNSPLASH_CONFIG.query;
          localStorage.setItem("customWallpaperKeywords", kw);
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
      if (wallpaperKeywords) localStorage.setItem("customWallpaperKeywords", wallpaperKeywords.value);
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

    const handleOpenAdd = () => {
      const m = document.getElementById("addSiteModal");
      if (m) m.style.display = "flex";
      const nameInput = document.getElementById("siteName") as HTMLInputElement | null;
      nameInput?.focus();
    };
    const handleCloseAdd = () => closeModal("addSiteModal");
    const handleCancelAdd = () => closeModal("addSiteModal");
    const handleAddSubmit = (e: Event) => {
      e.preventDefault();
      const name = (document.getElementById("siteName") as HTMLInputElement)?.value.trim();
      const url = (document.getElementById("siteUrl") as HTMLInputElement)?.value.trim();
      const catId = (document.getElementById("siteCategory") as HTMLSelectElement)?.value;
      if (!name || !url || !catId) return;
      addSite(name, url, catId);
      closeModal("addSiteModal");
      form?.reset();
      showToast(`"${name}" added!`);
    };

    addSiteBtn?.addEventListener("click", handleOpenAdd);
    closeModalBtn?.addEventListener("click", handleCloseAdd);
    cancelBtn?.addEventListener("click", handleCancelAdd);
    form?.addEventListener("submit", handleAddSubmit);

    return () => {
      addSiteBtn?.removeEventListener("click", handleOpenAdd);
      closeModalBtn?.removeEventListener("click", handleCloseAdd);
      cancelBtn?.removeEventListener("click", handleCancelAdd);
      form?.removeEventListener("submit", handleAddSubmit);
    };
  }, [addSite]);

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
      const domain = extractDomain(url);
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
  }, [editSite]);

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

  // Populate category dropdowns
  useEffect(() => {
    ["siteCategory", "editSiteCategory"].forEach((selectId) => {
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        (document.getElementById("unifiedSearchInput") as HTMLInputElement | null)?.focus();
      }
      if (e.key === "Escape") {
        for (const id of ["addSiteModal", "editSiteModal", "sectionModal", "settingsModal"]) {
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
        <section className="search-widgets">
          <div className="widget unified-search-widget" id="unifiedSearchWidget" style={{ "--engine-color": "#4285F4" } as React.CSSProperties}>
            <div className="widget-header">
              <button type="button" className="engine-selector" id="engineSelector" aria-label="Select search engine" aria-expanded="false">
                <i className="fab fa-google" id="currentEngineIcon"></i>
                <i className="fas fa-chevron-down engine-dropdown-arrow"></i>
              </button>
              <div className="engine-dropdown" id="engineDropdown">
                <button type="button" className="engine-option" data-engine="google"><i className="fab fa-google"></i><span>Google</span></button>
                <button type="button" className="engine-option" data-engine="youtube"><i className="fab fa-youtube"></i><span>YouTube</span></button>
                <button type="button" className="engine-option" data-engine="perplexity"><i className="fas fa-brain"></i><span>Perplexity</span></button>
                <button type="button" className="engine-option" data-engine="x"><i className="fab fa-x-twitter"></i><span>X</span></button>
                <button type="button" className="engine-option" data-engine="reddit"><i className="fab fa-reddit-alien"></i><span>Reddit</span></button>
                <button type="button" className="engine-option" data-engine="wikipedia"><i className="fab fa-wikipedia-w"></i><span>Wikipedia</span></button>
              </div>
            </div>
            <form className="widget-form" id="unifiedSearchForm">
              <div className="search-input-wrapper">
                <input type="text" placeholder="Search Google..." className="widget-input" id="unifiedSearchInput" autoComplete="off" />
                <div className="search-history-dropdown" id="searchHistoryDropdown"></div>
              </div>
              <button type="submit" className="widget-btn" id="searchSubmitBtn"><i className="fas fa-search"></i></button>
            </form>
          </div>
        </section>

        <div className="section-actions">
          <div className="action-buttons">
            <button className="section-btn" id="addSectionBtn" type="button"><i className="fas fa-layer-group"></i><span className="btn-text">Add Section</span></button>
            <button className="section-btn" id="addSiteBtn" type="button"><i className="fas fa-plus"></i><span className="btn-text">Add Site</span></button>
          </div>
          <div className="data-controls">
            <button className="data-btn export-btn" id="exportDataBtn" type="button" title="Export all data to JSON file"><i className="fas fa-download"></i><span className="btn-text">Export</span></button>
            <button className="data-btn import-btn" id="importDataBtn" type="button" title="Import data from JSON file"><i className="fas fa-upload"></i><span className="btn-text">Import</span></button>
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
            <div className="form-group"><label htmlFor="siteCategory">Category:</label><select id="siteCategory" required></select></div>
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
      </div>
    </AuthGuard>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
