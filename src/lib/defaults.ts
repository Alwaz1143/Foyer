import type { Category } from "./types";

export const defaultCategories: Category[] = [
  {
    id: "social",
    name: "🌐 Social Media",
    icon: "🌐",
    websites: [
      { id: "", name: "X (Twitter)", url: "https://twitter.com", domain: "twitter.com" },
      { id: "", name: "Instagram", url: "https://www.instagram.com", domain: "instagram.com" },
      { id: "", name: "Reddit", url: "https://www.reddit.com", domain: "reddit.com" },
      { id: "", name: "LinkedIn", url: "https://www.linkedin.com", domain: "linkedin.com" },
    ],
  },
  {
    id: "productivity",
    name: "🎯 Productivity",
    icon: "🎯",
    websites: [
      { id: "", name: "Notion", url: "https://www.notion.so", domain: "notion.so" },
      { id: "", name: "Gmail", url: "https://mail.google.com", domain: "mail.google.com" },
      { id: "", name: "Google Drive", url: "https://drive.google.com", domain: "drive.google.com" },
      { id: "", name: "Trello", url: "https://trello.com", domain: "trello.com" },
    ],
  },
  {
    id: "ai",
    name: "🤖 Artificial Intelligence",
    icon: "🤖",
    websites: [
      { id: "", name: "ChatGPT", url: "https://chat.openai.com", domain: "openai.com" },
      { id: "", name: "Perplexity", url: "https://www.perplexity.ai", domain: "perplexity.ai" },
      { id: "", name: "Claude AI", url: "https://claude.ai", domain: "claude.ai" },
    ],
  },
  {
    id: "sports",
    name: "⚽ Sports",
    icon: "⚽",
    websites: [
      { id: "", name: "ESPN", url: "https://www.espn.com", domain: "espn.com" },
      { id: "", name: "ESPNcricinfo", url: "https://www.espncricinfo.com", domain: "espncricinfo.com" },
      { id: "", name: "Sky Sports", url: "https://www.skysports.com", domain: "skysports.com" },
    ],
  },
  {
    id: "news",
    name: "📰 News & Media",
    icon: "📰",
    websites: [
      { id: "", name: "BBC News", url: "https://www.bbc.com/news", domain: "bbc.com" },
      { id: "", name: "Reuters", url: "https://www.reuters.com", domain: "reuters.com" },
      { id: "", name: "The New York Times", url: "https://www.nytimes.com", domain: "nytimes.com" },
    ],
  },
  {
    id: "entertainment",
    name: "🎬 Entertainment",
    icon: "🎬",
    websites: [
      { id: "", name: "YouTube", url: "https://www.youtube.com", domain: "youtube.com" },
      { id: "", name: "Spotify", url: "https://www.spotify.com", domain: "spotify.com" },
      { id: "", name: "Netflix", url: "https://www.netflix.com", domain: "netflix.com" },
      { id: "", name: "Twitch", url: "https://www.twitch.tv", domain: "twitch.tv" },
    ],
  },
  {
    id: "games",
    name: "🎮 Games",
    icon: "🎮",
    websites: [
      { id: "", name: "Chess.com", url: "https://www.chess.com", domain: "chess.com" },
      { id: "", name: "Wordle", url: "https://www.nytimes.com/games/wordle", domain: "nytimes.com" },
      { id: "", name: "Skribbl", url: "https://skribbl.io", domain: "skribbl.io" },
    ],
  },
];
