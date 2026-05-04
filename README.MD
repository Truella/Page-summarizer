# AI Summarizer — Chrome Extension

A Manifest V3 Chrome Extension that extracts content from any webpage and returns a structured AI-generated summary using Groq's LLaMA model via a secure Vercel proxy.

---

## Demo

[Demo Link](https://example.com)

---

## Features

- Extracts readable article content from any webpage
- Generates bullet-point summary, key insights, and estimated reading time
- Caches summaries per URL — instant load on revisit
- Dark mode support out of the box
- Copy summary to clipboard
- Graceful error handling at every failure point
---

## Project Structure

```
AI_SUMMARIZER/               ← Chrome Extension
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── manifest.json            ← Extension contract (Manifest V3)
├── background.js            ← Service worker, calls Vercel proxy
├── content.js               ← Injected into pages, extracts text
├── popup.html               ← Extension UI (400px popup)
├── popup.js                 ← UI state machine + caching logic
├── styles.css               ← All styles including dark mode

```

---

## Local Installation (Chrome Extension)

This extension is not published to the Chrome Web Store. Follow these steps to install it locally.

**Step 1 — Clone the extension repo**
```bash
git clone https://github.com/Truella/Page-summarizer.git
cd Page-summarizer
```

**Step 2 — Open Chrome Extensions page**
```
chrome://extensions
```

**Step 3 — Enable Developer Mode**

Toggle the "Developer mode" switch in the top-right corner of the extensions page.

**Step 4 — Load the extension**

Click **"Load unpacked"** and select the `Page-summarizer` folder.

**Step 5 — Pin the extension**

Click the puzzle icon in the Chrome toolbar → click the pin icon next to AI Summarizer.

---

## How to Use

1. Navigate to any article, blog post, or news page
2. Click the AI Summarizer icon in the Chrome toolbar
3. Click **"Summarize Page"**
4. The extension extracts the article, sends it to the proxy, and displays:
   - 4–6 bullet point summary
   - 2 key insights
   - Estimated reading time
5. Revisit the same page — the summary loads instantly from cache
6. Use **Re-summarize** to force a fresh API call
7. Use **Copy** to copy the summary to your clipboard

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Chrome Extension                    │
│                                                      │
│  popup.js ──────────────────────────────────────    │
│     │  checks cache (chrome.storage.local)           │
│     │  if miss → asks content.js for page text       │
│     │  sends text to background.js                   │
│     │                                                │
│  content.js                                          │
│     │  runs inside the webpage                       │
│     │  priority ladder: article → main → p tags      │
│     │  cleans + truncates to 3500 words              │
│     │                                                │
│  background.js (service worker)                      │
│     │  receives content from popup                   │
│     └──→ POST to Vercel proxy                        │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Vercel Proxy (api/summarize.js)          │
│                                                      │
│  validates request body                              │
│  builds structured prompt                            │
│  adds GROQ_API_KEY from environment variable         │
│  POST → Groq API (llama-3.3-70b-versatile)          │
│  parses JSON response                                │
│  returns { bullets, insights, readingTime }          │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                   Groq API                           │
│           llama-3.3-70b-versatile                    │
└─────────────────────────────────────────────────────┘
```

---

## AI Integration

**Model:** LLaMA 3.3 70B Versatile via Groq API

**Why Groq:** Groq's inference speed is significantly faster than most AI providers, making the extension feel responsive. The free tier is generous with no regional restrictions.

**Prompt Design:** The prompt instructs the model to return strict JSON with three keys — `bullets`, `insights`, and `readingTime`. Asking for JSON (rather than prose) makes parsing reliable and prevents the model from adding conversational filler to the response. Temperature is set to 0.3 to keep responses factual and consistent rather than creative.

**Content Truncation:** Extracted article text is truncated to 3,500 words before being sent to the API. Most articles front-load their key information, so the top portion is the most valuable for summarization. This also prevents hitting token limits and keeps API costs minimal.

---

## Security Decisions

**No API key in the extension**
The Groq API key never appears in any extension file — not in `background.js`, not in `content.js`, not in `popup.js`, not in storage. It lives exclusively as an environment variable in Vercel's secure secret management system.

**Why a proxy server**
Manifest V3 extensions run entirely in the browser. Any secret stored in the extension — even in `chrome.storage` — can be read by a determined user via DevTools. The only safe place for an API key is a server you control. The Vercel proxy is that server.

**Minimal permissions**
The extension declares only three permissions: `activeTab` (read the current tab), `scripting` (inject content script), and `storage` (cache summaries). No broad host permissions, no access to browsing history, no tabs permission beyond the active tab.

**XSS prevention**
All content from webpages is inserted into the DOM using `textContent` not `innerHTML`. This treats everything as plain text and prevents any injected script tags from executing.

**Message validation**
The background service worker checks `message.action` before processing any message. The Vercel proxy validates the request body before calling Groq. Neither blindly trusts what it receives.

**CORS**
The Vercel proxy sets explicit CORS headers. Only `POST` and `OPTIONS` methods are accepted. All other methods return 405.

---

## Trade-offs

**Proxy dependency**
The extension requires the Vercel proxy to be running. If the proxy goes down, the extension stops working. The trade-off is acceptable because the alternative, storing the API key in the extension, is a security risk.

**Content extraction heuristics**
The priority ladder (`article → main → [role="main"] → .post-body → p tags`) works well on most editorial sites but may struggle with heavily JavaScript-rendered pages (SPAs) or paywalled content where the article text is hidden behind a login wall.

**Truncation at 3,500 words**
Very long articles (academic papers, long-form journalism) get cut. The first 3,500 words are prioritised because most articles front-load their key points. A future improvement would be to chunk long articles and summarize each chunk separately.

**24-hour cache**
Cached summaries expire after 24 hours. For most article content this is fine, but for live news pages that update throughout the day, the cache may serve stale summaries.

---

## Supported Page Types

Works well on: news articles, blog posts, Wikipedia pages, developer documentation, Medium posts, Substack newsletters.

May not work on: login-walled pages, heavily JavaScript-rendered SPAs, PDF embeds, pages with no substantial text content.

---
