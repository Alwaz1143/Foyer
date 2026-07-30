"use client";

import { useState, useEffect, useCallback } from "react";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  description: string;
}

const FEEDS = [
  { url: "https://feeds.bbci.co.uk/news/rss.xml", source: "BBC" },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
  { url: "https://hnrss.org/frontpage", source: "HN" },
  { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR" },
];

const RSS2JSON_API = "https://api.rss2json.com/v1/api.json";

export function useNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const all: NewsItem[] = [];
    let feedErrors = 0;

    await Promise.all(
      FEEDS.map(async (feed) => {
        try {
          const res = await fetch(
            `${RSS2JSON_API}?rss_url=${encodeURIComponent(feed.url)}`
          );
          const data = await res.json();
          if (data.items) {
            for (const item of data.items.slice(0, 4)) {
              all.push({
                title: item.title,
                link: item.link,
                source: feed.source,
                description: (item.description?.replace(/<[^>]*>/g, "") || "")
                  .split("\n")
                  .filter((line: string) => !/^(Article URL|Comments URL|Points|# Comments)/.test(line.trim()))
                  .join("\n")
                  .trim(),
              });
            }
          }
        } catch (err) {
          feedErrors++;
          console.error(`News feed failed (${feed.source}):`, err);
        }
      })
    );

    if (all.length > 0) {
      const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 10);
      setItems(shuffled);
      setError(null);
    } else if (feedErrors === FEEDS.length) {
      setError("All news feeds failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      if (!cancelled) await fetchAll();
    };
    doFetch();
    const id = setInterval(doFetch, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchAll, retryCount]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { items, loading, error, retry };
}
