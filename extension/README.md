# Foyer Browser Extension

Save sites to your Foyer dashboard and sync bookmarks across devices.

## Install

1. **Open Brave** and go to `brave://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `extension/.output/chrome-mv3/` folder

## First-Time Setup

1. Click the Foyer icon in your toolbar
2. If you used Google login before:
   - Go to your Foyer dashboard → click your profile → **Reset password**
   - Set a password for your account
3. In the extension popup: enter your email + password → **Sign In**
4. Click the sync icon (↻) to import all existing bookmarks

## Features

- **Add to Foyer** — saves the current page to your dashboard
- **Auto-sync** — ★ bookmark any page = auto-added to Foyer
- **Bulk sync** — the sync button imports all existing bookmarks at once

## Update

After rebuilding: `brave://extensions` → click the refresh icon on Foyer's card.

## Build

```bash
cd extension
npm install
npm run build
```

## Package

```bash
npx wxt zip
# Output: .output/foyer-extension-1.0.0-chrome.zip
```
