"use client";

import type { Category } from "@/lib/types";
import { getCategoryDisplayName } from "@/lib/utils";
import ShortcutCard from "./ShortcutCard";

export default function CategorySection({
  category,
  categoryIndex,
}: {
  category: Category;
  categoryIndex: number;
}) {
  const displayName = getCategoryDisplayName(category) || category.name || "Untitled Section";
  const icon = (category.icon && category.icon.trim()) || "📁";

  const handleEditSection = (e: React.MouseEvent) => {
    e.stopPropagation();
    const modal = document.getElementById("sectionModal");
    const title = document.getElementById("sectionModalTitle");
    const nameInput = document.getElementById("sectionName") as HTMLInputElement | null;
    const iconInput = document.getElementById("sectionIcon") as HTMLInputElement | null;
    const sectionIdInput = document.getElementById("sectionId") as HTMLInputElement | null;
    const submitBtn = modal?.querySelector(".btn-primary");
    if (!modal || !nameInput || !title) return;
    nameInput.value = displayName;
    if (iconInput) iconInput.value = icon;
    if (sectionIdInput) sectionIdInput.value = category.id;
    title.textContent = "Edit Section";
    if (submitBtn) submitBtn.textContent = "Save Changes";
    (window as any).__editingSectionIndex = categoryIndex;
    (window as any).__sectionModalMode = "edit";
    modal.style.display = "flex";
    nameInput.focus();
  };

  const handleDragStart = (e: React.DragEvent) => {
    const header = e.currentTarget as HTMLElement;
    const section = header.parentElement;
    if (!section) return;
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
    section.classList.add("dragging-section");
    (window as any).__draggedSectionIndex = categoryIndex;
    (window as any).__draggedSectionElement = section;

    const placeholder = document.createElement("div");
    placeholder.className = "section-placeholder";
    placeholder.style.height = section.offsetHeight + "px";
    (window as any).__sectionPlaceholder = placeholder;

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", header.innerHTML);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const header = e.currentTarget as HTMLElement;
    header.style.opacity = "";
    header.parentElement?.classList.remove("dragging-section");
    const placeholder = (window as any).__sectionPlaceholder;
    if (placeholder?.parentNode) placeholder.parentNode.removeChild(placeholder);
    document.querySelectorAll(".category-section").forEach((s) => s.classList.remove("drag-over"));
    (window as any).__draggedSectionIndex = null;
    (window as any).__draggedSectionElement = null;
    (window as any).__sectionPlaceholder = null;
  };

  return (
    <div className="category-section" data-category-id={category.id}>
      <div
        className="category-header"
        draggable
        data-section-index={categoryIndex}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <span className="section-drag-handle">
          <i className="fas fa-grip-vertical"></i>
        </span>
        <div className="category-header-content">
          <span className="category-icon">{icon}</span>
          <h3 className="category-title">{displayName}</h3>
        </div>
        <span className="category-count">{(category.websites ?? []).length}</span>
        <button
          className="section-edit-btn"
          type="button"
          aria-label={`Edit ${displayName} section`}
          onClick={handleEditSection}
        >
          <i className="fas fa-pen"></i>
        </button>
      </div>
      <div className="category-grid" data-category-index={categoryIndex}>
        {(category.websites ?? []).map((site, idx) => (
          <ShortcutCard
            key={site.id || idx}
            site={site}
            categoryIndex={categoryIndex}
            itemIndex={idx}
          />
        ))}
      </div>
    </div>
  );
}
