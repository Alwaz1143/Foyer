"use client";

import { useEffect, useRef } from "react";
import { useCategories } from "@/contexts/CategoriesContext";
import CategorySection from "./CategorySection";

export default function ShortcutGrid() {
  const { categories, loading, moveSite, reorderCategories, deleteSite } = useCategories();
  const gridRef = useRef<HTMLElement>(null);

  // Expose deleteSite for ShortcutCard to call
  useEffect(() => {
    (window as any).__deleteSite = deleteSite;
  }, [deleteSite]);

  // Event delegation DnD — single listener per event on the container
  useEffect(() => {
    const container = gridRef.current;
    if (!container) return;

    let draggedElement: HTMLElement | null = null;
    let draggedCategoryIndex: number | null = null;
    let draggedItemIndex: number | null = null;
    let placeholder: HTMLElement | null = null;

    const isSectionDrag = () => {
      const idx = (window as any).__draggedSectionIndex;
      return idx !== null && idx !== undefined;
    };

    // ── Drag Start ────────────────────────────────────────────────────

    const handleDragStart = (e: DragEvent) => {
      // Section header drag — let React onDragStart in CategorySection handle it
      if ((e.target as HTMLElement).closest(".category-header[draggable]")) return;

      const item = (e.target as HTMLElement).closest<HTMLElement>(".shortcut-item[draggable]");
      if (!item || isSectionDrag()) return;

      e.dataTransfer!.effectAllowed = "move";
      e.dataTransfer!.setData("text/plain", item.dataset.name ?? "");

      draggedElement = item;
      draggedCategoryIndex = parseInt(item.dataset.categoryIndex || "-1");
      draggedItemIndex = parseInt(item.dataset.itemIndex || "-1");
      item.classList.add("dragging");
      document.body.classList.add("drag-active");

      const dragImg = item.querySelector<HTMLElement>(".shortcut-icon")?.cloneNode(true) as HTMLElement | null;
      if (dragImg) {
        dragImg.style.position = "absolute";
        dragImg.style.top = "-9999px";
        dragImg.style.pointerEvents = "none";
        dragImg.style.borderRadius = "16px";
        dragImg.style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)";
        document.body.appendChild(dragImg);
        e.dataTransfer!.setDragImage(dragImg, dragImg.offsetWidth / 2, dragImg.offsetHeight / 2);
        setTimeout(() => document.body.removeChild(dragImg), 0);
      }

      placeholder = document.createElement("div");
      placeholder.className = "shortcut-item placeholder";
      placeholder.style.width = item.offsetWidth + "px";
      placeholder.style.height = item.offsetHeight + "px";

      setTimeout(() => { if (draggedElement) draggedElement.style.opacity = "0.4"; }, 0);
    };

    // ── Drag Over ─────────────────────────────────────────────────────

    const handleDragOver = (e: DragEvent) => {
      if (isSectionDrag()) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        const sp = (window as any).__sectionPlaceholder;
        if (!sp) return;
        const afterElement = getSectionAfterElement(container, e.clientY);
        if (!afterElement) container.appendChild(sp);
        else container.insertBefore(sp, afterElement);
        return;
      }

      if (!draggedElement || !placeholder) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";

      const targetGrid = (e.target as HTMLElement).closest<HTMLElement>(".category-grid");
      if (!targetGrid) return;

      targetGrid.querySelectorAll(".shortcut-item.drop-hover").forEach((el) => el.classList.remove("drop-hover"));

      const afterElement = getDragAfterElement(targetGrid, e.clientX, e.clientY);
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      if (!afterElement) {
        targetGrid.appendChild(placeholder);
      } else if (targetGrid.contains(afterElement)) {
        targetGrid.insertBefore(placeholder, afterElement);
        if (afterElement.classList.contains("shortcut-item") && !afterElement.classList.contains("add-site-btn")) {
          afterElement.classList.add("drop-hover");
        }
      } else {
        targetGrid.appendChild(placeholder);
      }
    };

    // ── Drag Enter / Leave (visual feedback on grids) ─────────────────

    const handleDragEnter = (e: DragEvent) => {
      const grid = (e.target as HTMLElement).closest<HTMLElement>(".category-grid");
      if (grid) grid.classList.add("drag-over");
    };

    const handleDragLeave = (e: DragEvent) => {
      const grid = (e.target as HTMLElement).closest<HTMLElement>(".category-grid");
      if (grid && !grid.contains(e.relatedTarget as Node)) {
        grid.classList.remove("drag-over");
      }
    };

    // ── Drop ──────────────────────────────────────────────────────────

    const handleDrop = (e: DragEvent) => {
      if (isSectionDrag()) {
        e.preventDefault();
        e.stopPropagation();
        const sp = (window as any).__sectionPlaceholder;
        if (!sp?.parentNode) return;
        const children = [...container.children];
        const pIdx = children.indexOf(sp);
        let newIdx = 0;
        for (let i = 0; i < pIdx; i++) {
          if (children[i].classList.contains("category-section") &&
              !children[i].classList.contains("dragging-section")) newIdx++;
        }
        const draggedIdx = (window as any).__draggedSectionIndex;
        if (draggedIdx !== newIdx) reorderCategories(draggedIdx, newIdx);
        return;
      }

      if (!draggedElement || draggedCategoryIndex === null || draggedItemIndex === null) return;
      e.preventDefault();
      e.stopPropagation();

      const targetGrid = (e.target as HTMLElement).closest<HTMLElement>(".category-grid");
      if (!targetGrid) return;

      const dropCatIdx = parseInt(targetGrid.dataset.categoryIndex || "-1");
      const dropItemIdx = computeDropIndex(targetGrid, placeholder);

      // Clean up drag artifacts before state update
      draggedElement.classList.remove("dragging");
      draggedElement.style.opacity = "";
      document.body.classList.remove("drag-active");
      document.querySelectorAll(".shortcut-item, .category-grid").forEach((el) => el.classList.remove("drag-over", "drop-hover"));
      if (placeholder?.parentNode) placeholder.parentNode.removeChild(placeholder);

      moveSite(draggedCategoryIndex, draggedItemIndex, dropCatIdx, dropItemIdx);

      draggedElement = null;
      draggedCategoryIndex = null;
      draggedItemIndex = null;
      placeholder = null;
    };

    // ── Drag End ──────────────────────────────────────────────────────

    const handleDragEnd = (e: DragEvent) => {
      if (isSectionDrag()) return;
      const item = (e.target as HTMLElement).closest<HTMLElement>(".shortcut-item");
      if (item) {
        item.classList.remove("dragging");
        item.style.opacity = "";
      }
      document.body.classList.remove("drag-active");
      document.querySelectorAll(".shortcut-item, .category-grid").forEach((el) => el.classList.remove("drag-over", "drop-hover"));
      if (placeholder?.parentNode) placeholder.parentNode.removeChild(placeholder);
      draggedElement = null;
      draggedCategoryIndex = null;
      draggedItemIndex = null;
      placeholder = null;
    };

    container.addEventListener("dragstart", handleDragStart);
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("dragenter", handleDragEnter);
    container.addEventListener("dragleave", handleDragLeave);
    container.addEventListener("drop", handleDrop);
    container.addEventListener("dragend", handleDragEnd);

    return () => {
      container.removeEventListener("dragstart", handleDragStart);
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("dragenter", handleDragEnter);
      container.removeEventListener("dragleave", handleDragLeave);
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("dragend", handleDragEnd);
    };
  }, [moveSite, reorderCategories, categories]);

  if (loading) {
    return (
      <section className="shortcuts-grid" id="shortcutsGrid" ref={gridRef}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="category-section" style={{ opacity: 0.6 }}>
            <div className="category-header" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", border: "none" }}>
              <div className="skeleton-shimmer" style={{ width: "24px", height: "24px" }} />
              <div className="skeleton-shimmer" style={{ width: `${80 + i * 30}px`, height: "16px" }} />
            </div>
            <div className="category-grid" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "12px 8px" }}>
                  <div className="skeleton-shimmer" style={{ width: "36px", height: "36px", borderRadius: "8px" }} />
                  <div className="skeleton-shimmer" style={{ width: "55px", height: "10px" }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section className="shortcuts-grid" id="shortcutsGrid" ref={gridRef}>
      {categories.map((cat, idx) => (
        <CategorySection key={cat.id} category={cat} categoryIndex={idx} />
      ))}
    </section>
  );
}

function getSectionAfterElement(grid: HTMLElement, y: number): Element | null {
  const elements = [...grid.querySelectorAll(".category-section:not(.dragging-section)")];
  let closest: { offset: number; element: Element | null } = {
    offset: Number.NEGATIVE_INFINITY,
    element: null,
  };
  for (const child of elements) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  }
  return closest.element;
}

function getDragAfterElement(container: HTMLElement, x: number, y: number): Element | null {
  const elements = [...container.querySelectorAll(".shortcut-item:not(.dragging):not(.add-site-btn):not(.placeholder)")];
  if (elements.length === 0) return null;
  let closest: Element = elements[0];
  let closestDist = Infinity;
  for (const child of elements) {
    const box = child.getBoundingClientRect();
    const dist = Math.sqrt((x - (box.left + box.width / 2)) ** 2 + (y - (box.top + box.height / 2)) ** 2);
    if (dist < closestDist) { closestDist = dist; closest = child; }
  }
  const box = closest.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  if (x > cx || (y > box.top && x > box.left)) {
    const next = closest.nextElementSibling;
    return next && !next.classList.contains("add-site-btn") ? next : null;
  }
  return closest;
}

function computeDropIndex(targetGrid: HTMLElement, placeholder: HTMLElement | null): number {
  if (!placeholder?.parentNode) return 0;
  const children = Array.from(placeholder.parentNode.children);
  const pIdx = children.indexOf(placeholder);
  return children
    .slice(0, pIdx)
    .filter((child) =>
      child.classList.contains("shortcut-item") &&
      !child.classList.contains("add-site-btn") &&
      !child.classList.contains("placeholder")
    ).length;
}
