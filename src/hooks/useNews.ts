"use client";

import { useState, useEffect } from "react";

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

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      const all: NewsItem[] = [];

      await Promise.all(
        FEEDS.map(async (feed) => {
          try {
            const res = await fetch(
              `${RSS2JSON_API}?rss_url=${encodeURIComponent(feed.url)}`
            );
            const data = await res.json();
            if (cancelled) return;
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
          } catch {
            // Silently skip failed feeds
          }
        })
      );

      if (!cancelled) {
        const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 10);
        setItems(shuffled);
      }
      setLoading(false);
    };

    fetchAll();
    const id = setInterval(fetchAll, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { items, loading };
}
