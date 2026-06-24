"use client";

import { useEffect } from "react";
import { searchEngines, MAX_HISTORY_ITEMS } from "@/lib/constants";
import { escapeHtml } from "@/lib/utils";

export function useSearch() {
  useEffect(() => {
    const selector = document.getElementById("engineSelector");
    const _dropdown = document.getElementById("engineDropdown") as HTMLElement | null;
    const form = document.getElementById("unifiedSearchForm") as HTMLFormElement | null;
    const _input = document.getElementById("unifiedSearchInput") as HTMLInputElement | null;
    const _historyDropdown = document.getElementById("searchHistoryDropdown") as HTMLElement | null;

    if (!selector || !_dropdown || !form || !_input || !_historyDropdown) return;

    let currentEngine = localStorage.getItem("selectedSearchEngine") || "google";

    function selectEngine(engineKey: string, save = true) {
      const engine = searchEngines[engineKey];
      if (!engine || !_input || !_dropdown || !_historyDropdown) return;
      currentEngine = engineKey;

      const widget = document.getElementById("unifiedSearchWidget");
      const iconEl = document.getElementById("currentEngineIcon");
      if (widget) widget.style.setProperty("--engine-color", engine.color);
      if (iconEl) iconEl.className = engine.icon;
      _input.placeholder = engine.placeholder;

      _dropdown.querySelectorAll(".engine-option").forEach((opt) => {
        opt.classList.toggle("active", (opt as HTMLElement).dataset.engine === engineKey);
      });

      if (save) localStorage.setItem("selectedSearchEngine", engineKey);
      _historyDropdown.classList.remove("show");
    }

    function getHistory(engine: string): string[] {
      try { return JSON.parse(localStorage.getItem(`searchHistory_${engine}`) || "[]"); }
      catch { return []; }
    }

    function saveHistory(engine: string, query: string) {
      let h = getHistory(engine).filter((item) => item.toLowerCase() !== query.toLowerCase());
      h.unshift(query);
      localStorage.setItem(`searchHistory_${engine}`, JSON.stringify(h.slice(0, MAX_HISTORY_ITEMS)));
    }

    function removeHistory(engine: string, query: string) {
      localStorage.setItem(`searchHistory_${engine}`, JSON.stringify(getHistory(engine).filter((item) => item !== query)));
    }

    function showHistory(filterText = "") {
      if (!_input || !_historyDropdown) return;
      let history = getHistory(currentEngine);
      if (filterText) history = history.filter((item) => item.toLowerCase().includes(filterText.toLowerCase()));
      if (history.length === 0) { _historyDropdown.classList.remove("show"); return; }

      _historyDropdown.innerHTML = history.map((item, idx) => `
        <div class="history-item" data-index="${idx}" data-query="${escapeHtml(item)}">
          <i class="fas fa-history"></i>
          <span class="history-text">${escapeHtml(item)}</span>
          <button type="button" class="history-remove" data-query="${escapeHtml(item)}" title="Remove">
            <i class="fas fa-times"></i>
          </button>
        </div>`).join("");

      _historyDropdown.querySelectorAll(".history-item").forEach((el) => {
        el.addEventListener("click", (e) => {
          if (!(e.target as HTMLElement).closest(".history-remove")) {
            _input.value = (el as HTMLElement).dataset.query || "";
            hideHistory();
            _input.focus();
          }
        });
      });
      _historyDropdown.querySelectorAll(".history-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeHistory(currentEngine, (btn as HTMLElement).dataset.query || "");
          showHistory(_input.value);
        });
      });

      _historyDropdown.classList.add("show");
    }

    function hideHistory() { if (_historyDropdown) _historyDropdown.classList.remove("show"); }

    selector.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = _dropdown.classList.contains("show");
      _dropdown.classList.toggle("show");
      selector.setAttribute("aria-expanded", String(!isOpen));
    });

    _dropdown.querySelectorAll(".engine-option").forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        selectEngine((opt as HTMLElement).dataset.engine || "google");
        _dropdown.classList.remove("show");
        selector.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", (e) => {
      if (!selector.contains(e.target as Node) && !_dropdown.contains(e.target as Node)) {
        _dropdown.classList.remove("show");
        selector.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        _dropdown.classList.remove("show");
        selector.setAttribute("aria-expanded", "false");
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = _input.value.trim();
      if (!query) return;
      const engine = searchEngines[currentEngine];
      if (!engine) return;
      saveHistory(currentEngine, query);
      window.location.href = `${engine.url}${encodeURIComponent(query)}`;
      _input.value = "";
      hideHistory();
    });

    _input.addEventListener("focus", () => showHistory());
    _input.addEventListener("input", () => showHistory(_input.value));

    document.addEventListener("click", (e) => {
      const wrapper = _input.closest(".search-input-wrapper");
      if (!wrapper?.contains(e.target as Node)) hideHistory();
    });

    _input.addEventListener("keydown", (e) => {
      if (!_historyDropdown.classList.contains("show")) return;
      const items = _historyDropdown.querySelectorAll(".history-item");
      const active = _historyDropdown.querySelector(".history-item.active");
      let activeIdx = -1;
      if (active) activeIdx = parseInt((active as HTMLElement).dataset.index || "-1");

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
        items.forEach((el, i) => el.classList.toggle("active", i === next));
        if (items[next]) _input.value = (items[next] as HTMLElement).dataset.query || "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
        items.forEach((el, i) => el.classList.toggle("active", i === prev));
        if (items[prev]) _input.value = (items[prev] as HTMLElement).dataset.query || "";
      } else if (e.key === "Enter" && active) {
        e.preventDefault();
        _input.value = (active as HTMLElement).dataset.query || "";
        hideHistory();
      } else if (e.key === "Escape") {
        hideHistory();
      }
    });

    selectEngine(currentEngine, false);
  }, []);
}
