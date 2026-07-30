"use client";

import { useState } from "react";
import { useNews } from "@/hooks/useNews";

export default function NewsWidget() {
  const { items, loading, error, retry } = useNews();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="widget widget-news">
      <div className="widget-news-header">
        <span className="widget-news-title">📰 Top Headlines</span>
      </div>
      <div className="widget-news-divider"></div>
      {loading ? (
        <div className="news-loading">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="news-skeleton" style={{ animationDelay: `${i * 0.1}s` }}></div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <div className="widget-error">
          <span className="widget-error-icon">📰</span>
          <span className="widget-error-msg">{error}</span>
          <button className="btn-retry" onClick={retry}>Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div className="news-empty">No headlines available</div>
      ) : (
        <div className="widget-news-list">
          {items.map((item, i) => (
            <div key={i} className="widget-news-item">
              <div className="news-item-main">
                <span className="news-bullet">●</span>
                <span className="news-title-text" onClick={() => toggle(i)}>
                  {item.title}
                </span>
                {item.description && (
                  <span className={`news-toggle${expanded.has(i) ? " open" : ""}`} onClick={() => toggle(i)}>
                    <i className="fas fa-chevron-right"></i>
                  </span>
                )}
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="news-read-btn" title="Open article">
                  <i className="fas fa-external-link-alt"></i>
                </a>
              </div>
              {item.description && (
                <div className={`news-description${expanded.has(i) ? " open" : ""}`}>
                  {item.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="widget-news-footer">
          <span>Updated just now</span>
        </div>
      )}
    </div>
  );
}
