# HighP Browser Activity Companion (Extension)

A lightweight, Chromium-compatible browser extension for **Brave, Google Chrome, and Microsoft Edge**.

## Privacy-First Architecture
- **Active Domain Only**: Detects and reports only the currently active website domain (e.g. `notion.so`, `github.com`).
- **No Browsing History**: Never captures or stores browsing history.
- **No Search History / Full URLs**: All paths, query parameters (`?token=...`, `?q=...`), hashes, and credentials are automatically stripped.
- **No Passwords or Form Fields**: Zero content scripting or keystroke interception.
- **Localhost Communication**: Transmits data strictly to the local HighP Desktop Agent at `http://127.0.0.1:41789/api/browser/activity`.

## How to Install in Brave, Google Chrome, or Microsoft Edge
1. Open your browser:
   - **Brave**: `brave://extensions`
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select this directory: `c:\Users\Admin\Desktop\HighP Agent\desktop-agent\browser-extension` (or click "Open Folder" inside the HighP Desktop Agent app).
5. The extension is now active and automatically communicates with your HighP Desktop Agent!
