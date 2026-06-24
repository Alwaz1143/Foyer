"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Website } from "@/lib/types";

const FALLBACKS: ((domain: string, url: string) => string)[] = [
  (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  (domain) => `https://logo.clearbit.com/${domain}`,
  (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  (domain) => `https://api.faviconkit.com/${domain}/128`,
  (_domain, url) => {
    try { return new URL(url).origin + "/favicon.ico"; } catch { return ""; }
  },
];

export default function ShortcutCard({
  site,
  categoryIndex,
  itemIndex,
}: {
  site: Website;
  categoryIndex: number;
  itemIndex: number;
}) {
  const [fallbackIdx, setFallbackIdx] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const [showInitial, setShowInitial] = useState(false);
  const [mounted, setMounted] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSrc = useCallback(() => {
    if (site.customIcon) return site.customIcon;
    if (showInitial) return "";
    return FALLBACKS[fallbackIdx](site.domain, site.url);
  }, [site.customIcon, site.domain, site.url, fallbackIdx, showInitial]);

  const handleError = useCallback(() => {
    if (fallbackIdx < 4) {
      setFallbackIdx((i) => i + 1);
    } else {
      setShowInitial(true);
    }
  }, [fallbackIdx]);

  useEffect(() => { setMounted(true); }, []);

  const delay = (categoryIndex * 0.2) + (Math.floor(itemIndex / 4) * 0.06) + ((itemIndex % 4) * 0.02);
  const animationDelay = `${delay}s`;

  const handleLinkClick = (e: React.MouseEvent) => {
    const parent = (e.currentTarget as HTMLElement).closest(".shortcut-item");
    if (parent?.classList.contains("dragging")) {
      e.preventDefault();
    }
  };

  const showMenuAt = (x: number, y: number) => {
    document.querySelectorAll(".shortcut-menu-dropdown.show").forEach((m) => m.classList.remove("show"));
    document.querySelectorAll(".shortcut-item.menu-open").forEach((m) => m.classList.remove("menu-open"));

    const dropdown = dropdownRef.current;
    if (!dropdown) return;

    const ddWidth = dropdown.offsetWidth;
    const ddHeight = dropdown.offsetHeight;

    let top = y + 4;
    let left = x + 4;

    const margin = 10;
    if (left + ddWidth > window.innerWidth - margin) {
      left = window.innerWidth - ddWidth - margin;
    }
    if (left < margin) left = margin;
    if (top + ddHeight > window.innerHeight - margin) {
      top = y - ddHeight - 4;
    }
    if (top < margin) top = margin;

    dropdown.style.top = top + "px";
    dropdown.style.left = left + "px";

    dropdown.classList.add("show");
    itemRef.current?.classList.add("menu-open");
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showMenuAt(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(".shortcut-menu-dropdown")) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    longPressTimerRef.current = setTimeout(() => {
      if (touchStartRef.current) {
        showMenuAt(touchStartRef.current.x, touchStartRef.current.y);
        touchStartRef.current = null;
      }
      longPressTimerRef.current = null;
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeDropdown();
    const editModal = document.getElementById("editSiteModal");
    if (!editModal) return;
    const nameInput = document.getElementById("editSiteName") as HTMLInputElement | null;
    const urlInput = document.getElementById("editSiteUrl") as HTMLInputElement | null;
    const catSelect = document.getElementById("editSiteCategory") as HTMLSelectElement | null;
    if (nameInput) nameInput.value = site.name;
    if (urlInput) urlInput.value = site.url;
    if (catSelect) catSelect.value = site.domain;
    (window as any).__editingCategoryIndex = categoryIndex;
    (window as any).__editingItemIndex = itemIndex;
    editModal.style.display = "flex";
    nameInput?.focus();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeDropdown();
    if (confirm(`Remove "${site.name}" from shortcuts?`)) {
      (window as any).__deleteSite?.(categoryIndex, itemIndex);
    }
  };

  const closeDropdown = () => {
    document.querySelectorAll(".shortcut-menu-dropdown.show").forEach((m) => m.classList.remove("show"));
    document.querySelectorAll(".shortcut-item.menu-open").forEach((m) => m.classList.remove("menu-open"));
  };

  return (
    <div
      className="shortcut-item"
      data-name={site.name}
      data-category-index={categoryIndex}
      data-item-index={itemIndex}
      draggable
      style={{ animationDelay }}
      ref={itemRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <a
        href={site.url}
        target="_self"
        rel="noopener noreferrer"
        className="shortcut-link"
        aria-label={`Visit ${site.name}`}
        onClick={handleLinkClick}
        onContextMenu={handleContextMenu}
      >
        <div className="shortcut-icon">
          {showInitial ? (
            <span style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-color)" }}>
              {site.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <img
              ref={imgRef}
              src={getSrc()}
              alt={site.name}
              loading="lazy"
              draggable={false}
              onError={handleError}
            />
          )}
        </div>
      </a>
      <span className="shortcut-name" title={site.name}>{site.name}</span>
      {mounted && createPortal(
        <div className="shortcut-menu-dropdown" ref={dropdownRef}>
          <button className="menu-option edit-option" onClick={handleEdit}>
            <i className="fas fa-edit"></i><span>Edit</span>
          </button>
          <button className="menu-option delete-option" onClick={handleDelete}>
            <i className="fas fa-trash"></i><span>Delete</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
