import type { SearchEngine } from "./types";

export const UNSPLASH_CONFIG = {
  accessKey: process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || "",
  query: "Mountains, Ocean waves, Forest fog, Sunset sky, Aurora lights, Minimalist black, Geometric patterns, Gradient blue, Neon glow, Vaporwave aesthetic, Cyberpunk city, Space nebula, Gaming setup, Dark mode, Futuristic grid",
  orientation: "landscape" as const,
};

export const WALLPAPER_CACHE_KEY = "wallpaperCache";

export const MAX_HISTORY_ITEMS = 8;

export const searchEngines: Record<string, SearchEngine> = {
  google: {
    name: "Google",
    icon: "fab fa-google",
    color: "#4285F4",
    placeholder: "Search Google...",
    url: "https://www.google.com/search?q=",
  },
  youtube: {
    name: "YouTube",
    icon: "fab fa-youtube",
    color: "#FF0000",
    placeholder: "Search YouTube...",
    url: "https://www.youtube.com/results?search_query=",
  },
  perplexity: {
    name: "Perplexity",
    icon: "fas fa-brain",
    color: "#20808D",
    placeholder: "Search Perplexity...",
    url: "https://www.perplexity.ai/search?q=",
  },
  x: {
    name: "X",
    icon: "fab fa-x-twitter",
    color: "#000000",
    placeholder: "Search X...",
    url: "https://twitter.com/search?q=",
  },
  reddit: {
    name: "Reddit",
    icon: "fab fa-reddit-alien",
    color: "#FF4500",
    placeholder: "Search Reddit...",
    url: "https://www.reddit.com/search/?q=",
  },
  wikipedia: {
    name: "Wikipedia",
    icon: "fab fa-wikipedia-w",
    color: "#000000",
    placeholder: "Search Wikipedia...",
    url: "https://en.wikipedia.org/wiki/Special:Search?search=",
  },
};
