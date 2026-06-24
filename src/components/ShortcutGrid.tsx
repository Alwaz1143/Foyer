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

  // Attach item-level drag event listeners to all shortcut items
  useEffect(() => {
    let draggedElement: HTMLElement | null = null;
    let draggedCategoryIndex: number | null = null;
    let draggedItemIndex: number | null = null;
    let placeholder: HTMLElement | null = null;

    const handleDragStart = (e: Event) => {
      const de = e as DragEvent;
      const el = e.currentTarget as HTMLElement;
      if ((window as any).__draggedSectionIndex !== null && (window as any).__draggedSectionIndex !== undefined) {
        de.preventDefault();
        return;
      }
      draggedElement = el;
      draggedCategoryIndex = parseInt(el.dataset.categoryIndex || "-1");
      draggedItemIndex = parseInt(el.dataset.itemIndex || "-1");
      el.classList.add("dragging");
      de.dataTransfer!.effectAllowed = "move";
      de.dataTransfer!.setData("text/html", el.innerHTML);

      placeholder = document.createElement("div");
      placeholder.className = "shortcut-item placeholder";
      placeholder.style.width = el.offsetWidth + "px";
      placeholder.style.height = el.offsetHeight + "px";

      setTimeout(() => { if (draggedElement) draggedElement.style.opacity = "0.4"; }, 0);
    };

    const handleDragOver = (e: Event) => {
      const de = e as DragEvent;
      if ((window as any).__draggedSectionIndex !== null) return;
      if (!draggedElement || !placeholder) return;
      de.preventDefault();
      de.dataTransfer!.dropEffect = "move";

      const target = (e.target as HTMLElement).closest(".category-grid") as HTMLElement | null;
      if (!target) return;
      if (e.target === draggedElement || draggedElement.contains(e.target as Node)) return;

      const afterElement = getDragAfterElement(target, de.clientX, de.clientY);
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      if (!afterElement) {
        target.appendChild(placeholder);
      } else {
        target.insertBefore(placeholder, afterElement);
      }
    };

    const handleDragEnter = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      if (el !== draggedElement && !el.classList.contains("add-site-btn")) {
        el.classList.add("drag-over");
      }
    };

    const handleDragLeave = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      if (!el.contains((e as DragEvent).relatedTarget as Node)) {
        el.classList.remove("drag-over");
      }
    };

    const handleDrop = (e: Event) => {
      const de = e as DragEvent;
      if (!draggedElement || draggedCategoryIndex === null || draggedItemIndex === null) return;
      de.preventDefault();
      de.stopPropagation();

      const targetGrid = (e.target as HTMLElement).closest(".category-grid") as HTMLElement | null;
      if (!targetGrid) return;

      const dropCatIdx = parseInt(targetGrid.dataset.categoryIndex || "-1");
      let dropItemIdx = 0;

      if (placeholder?.parentNode) {
        const itemsBefore = Array.from(placeholder.parentNode.children)
          .slice(0, Array.from(placeholder.parentNode.children).indexOf(placeholder))
          .filter((child) =>
            child.classList.contains("shortcut-item") &&
            !child.classList.contains("add-site-btn") &&
            !child.classList.contains("placeholder")
          ).length;
        dropItemIdx = itemsBefore;
      }

      moveSite(draggedCategoryIndex, draggedItemIndex, dropCatIdx, dropItemIdx);
    };

    const handleDragEnd = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      el.classList.remove("dragging");
      el.style.opacity = "";
      document.querySelectorAll(".shortcut-item, .category-grid").forEach((item) => item.classList.remove("drag-over"));
      if (placeholder?.parentNode) placeholder.parentNode.removeChild(placeholder);
      draggedElement = null;
      draggedCategoryIndex = null;
      draggedItemIndex = null;
      placeholder = null;
    };

    const items = document.querySelectorAll(".shortcut-item[draggable]");
    items.forEach((item) => {
      item.addEventListener("dragstart", handleDragStart);
      item.addEventListener("dragover", handleDragOver);
      item.addEventListener("drop", handleDrop);
      item.addEventListener("dragend", handleDragEnd);
      item.addEventListener("dragenter", handleDragEnter);
      item.addEventListener("dragleave", handleDragLeave);
    });

    return () => {
      items.forEach((item) => {
        item.removeEventListener("dragstart", handleDragStart);
        item.removeEventListener("dragover", handleDragOver);
        item.removeEventListener("drop", handleDrop);
        item.removeEventListener("dragend", handleDragEnd);
        item.removeEventListener("dragenter", handleDragEnter);
        item.removeEventListener("dragleave", handleDragLeave);
      });
    };
  }, [moveSite, categories]);

  // Attach section-level drag events to category headers
  useEffect(() => {
    const handleSectionDragStart = (e: Event) => {
      const de = e as DragEvent;
      const header = e.currentTarget as HTMLElement;
      const section = header.parentElement;
      if (!section) return;
      header.style.opacity = "0.4";
      section.classList.add("dragging-section");
      const catIdx = parseInt(header.dataset.sectionIndex || "-1");
      (window as any).__draggedSectionIndex = catIdx;
      (window as any).__draggedSectionElement = section;

      const sp = document.createElement("div");
      sp.className = "section-placeholder";
      sp.style.height = section.offsetHeight + "px";
      (window as any).__sectionPlaceholder = sp;
      de.dataTransfer!.effectAllowed = "move";
      de.dataTransfer!.setData("text/html", header.innerHTML);
    };

    const handleSectionDragEnd = (e: Event) => {
      const header = e.currentTarget as HTMLElement;
      header.style.opacity = "";
      header.parentElement?.classList.remove("dragging-section");
      const sp = (window as any).__sectionPlaceholder;
      if (sp?.parentNode) sp.parentNode.removeChild(sp);
      document.querySelectorAll(".category-section").forEach((s) => s.classList.remove("drag-over"));
      (window as any).__draggedSectionIndex = null;
      (window as any).__draggedSectionElement = null;
      (window as any).__sectionPlaceholder = null;
    };

    const headers = document.querySelectorAll(".category-header[draggable]");
    headers.forEach((h) => {
      h.addEventListener("dragstart", handleSectionDragStart);
      h.addEventListener("dragend", handleSectionDragEnd);
    });

    return () => {
      headers.forEach((h) => {
        h.removeEventListener("dragstart", handleSectionDragStart);
        h.removeEventListener("dragend", handleSectionDragEnd);
      });
    };
  }, []);

  // Grid-level section drag over/drop
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleSectionDragOver = (e: Event) => {
      const de = e as DragEvent;
      const draggedIdx = (window as any).__draggedSectionIndex;
      if (draggedIdx === null || draggedIdx === undefined) return;
      de.preventDefault();
      de.dataTransfer!.dropEffect = "move";
      const placeholder = (window as any).__sectionPlaceholder;
      if (!placeholder) return;
      const afterElement = getSectionAfterElement(grid, de.clientY);
      if (!afterElement) grid.appendChild(placeholder);
      else grid.insertBefore(placeholder, afterElement);
    };

    const handleSectionDrop = (e: Event) => {
      const de = e as DragEvent;
      de.preventDefault();
      de.stopPropagation();
      const draggedIdx = (window as any).__draggedSectionIndex;
      if (draggedIdx === null || draggedIdx === undefined) return;
      const placeholder = (window as any).__sectionPlaceholder;
      if (!placeholder?.parentNode) return;

      const allChildren = [...grid.children];
      const pIdx = allChildren.indexOf(placeholder);
      let newIdx = 0;
      for (let i = 0; i < pIdx; i++) {
        if (allChildren[i].classList.contains("category-section") &&
            !allChildren[i].classList.contains("dragging-section")) newIdx++;
      }
      if (draggedIdx !== newIdx) reorderCategories(draggedIdx, newIdx);
    };

    grid.addEventListener("dragover", handleSectionDragOver);
    grid.addEventListener("drop", handleSectionDrop);
    return () => {
      grid.removeEventListener("dragover", handleSectionDragOver);
      grid.removeEventListener("drop", handleSectionDrop);
    };
  }, [reorderCategories]);

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
