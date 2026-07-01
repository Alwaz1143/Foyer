import { defineConfig } from "wxt";

export default defineConfig({
  extensionApi: "chrome",
  manifest: {
    name: "Foyer",
    description: "Add sites to your Foyer dashboard and sync bookmarks across devices",
    permissions: ["bookmarks", "storage", "tabs"],
    action: {},
    icons: {
      16: "icons/16.png",
      48: "icons/48.png",
      128: "icons/128.png",
    },
    browser_specific_settings: {
      gecko: {
        id: "foyer@foyer.app",
      },
    },
  },
});
