# AI Opinion Map

**[Open the app on GitHub Pages](https://jsherman999.github.io/ai_cagematch/)**

A Bluesky-only, browser-only app. No backend, Docker, proxy, build step, or runtime dependencies are required.

## Use

1. Paste your provider API key. Recognizable prefixes select the provider automatically; otherwise select its name from the dropdown. No endpoint URL is needed.
2. Paste an individual public Bluesky post URL (`https://bsky.app/profile/…/post/…`).
3. The browser fetches the provider's model list. Choose a text chat model, then click **Analyze thread**.
4. Inspect the top 20 posters, ranked by the number of retrieved posts in that thread. Select a poster to see scores, confidence, rationale, and supporting post links.

The initial graph contains **20 fictional demo posters** and works without a key. **New demo crowd** regenerates that sample without network calls. Demo data is always labeled.

The three axes are:

- **Potential:** 0 = little transformative potential; 100 = enormous potential for good or harm.
- **Outlook:** 0 = catastrophe/extinction; 100 = prosperity/utopia.
- **Frequency (height):** actual retrieved post count, computed in the browser—not estimated by the LLM.

Drag or use arrow keys to rotate, pinch with two fingers, scroll, or use +/− to zoom, and press 0 to reset. Mobile graph labels use a smaller font; one finger rotates and two fingers zoom without rotating. Top-down view hides height; counts remain in the people list. Posters with insufficient evidence remain in the top-20 list as unclassified and are not placed at an invented neutral position. Starting analysis clears the previous graph and people. The graph panel shows discovered posters with animated, deduplicated retrieved-post counts (up to 20 cards), then a pulsing model-analysis stage. The finished graph appears only after validated results arrive. Failed or cancelled analysis leaves a stopped progress view; retry or load a new demo crowd. Reduced-motion preferences disable the animations.

## Architecture and key handling

```text
Browser on GitHub Pages
  ├── public.api.bsky.app: retrieve the linked thread, without credentials
  ├── selected LLM provider: list models and analyze posts directly
  └── local computation: counts, top 20, evidence checks, and 3D rendering
```

The API key is held only in the current page's memory and sent in the Authorization header directly to the selected provider’s built-in endpoint. The app does not use localStorage, sessionStorage, cookies, analytics, or an intermediary server. The key is never sent to Bluesky or GitHub. No requests are made on initial load except the app's own static assets. Credentials are not embedded in the repository. The page code can access an entered key while running; use only a site and provider you trust.

Recognized key prefixes: OpenAI project/service-account keys (`sk-proj-`, `sk-svcacct-`), Anthropic API keys (`sk-ant-api…-`), OpenRouter (`sk-or-v1-`), Groq (`gsk_`), and xAI (`xai-`). Detection is a local format hint, not authentication. Generic `sk-` keys and Google-style `AIza` keys are ambiguous and require selection; the app never tries a key against several services. A known prefix conflicting with the chosen provider is rejected before a request. Changing the key clears any previous manual selection.

Provider presets include OpenAI, Anthropic, OpenRouter, Groq, xAI, Google Gemini, DeepSeek, and Mistral. Anthropic uses its native Models and Messages APIs; the others use OpenAI-compatible APIs. Preset availability is not a guarantee of CORS access or model permissions. API formats can change, and live access requires a valid key.

**Your provider must permit browser requests (CORS)** for its model-list and chat endpoints, including its authentication and Content-Type headers. Anthropic uses its supported direct-browser opt-in header. OpenAI-compatible does not automatically mean browser-compatible. If access is blocked, the app reports it explicitly and never falls back to a proxy. Provider endpoints must use HTTPS without URL credentials, query strings, or redirects. Provider keys and API usage are billed by the provider; submitted text is subject to its policies.

## Scope and limitations

- Only the linked Bluesky post and its descendants connected by reply edges are included. A reply URL stays within that reply's branch. Ancestors, siblings outside the branch, feeds, profiles, DMs, X URLs, and other sites are excluded.
- Handles are resolved through Bluesky's public API. `getPostThread` uses `parentHeight=0`; missing descendant subtrees are fetched separately. Linked articles, embedded quoted posts, images, videos, and profile history are not fetched or interpreted. Analysis is text-only.
- Retrieval is limited to **500 posts and 40 thread requests**. Bluesky may hide, delete, or cap replies and does not guarantee exhaustive pagination. Detected incomplete coverage is labeled; all counts and rankings refer to **retrieved** posts. The root post counts as one post. Ties use stable author IDs.
- The model receives only the top posters' supplied text, grouped under temporary author labels. Names/handles are omitted from the grouping metadata to reduce reputation-based judgments, though platform IDs and text itself can still identify authors.
- Model input is bounded to 6,000 characters per author and 2,000 per post. Sampling is disclosed; frequency still counts all retrieved posts.
- Model responses require bounded scores or null, confidence, rationale, and evidence. Quotes must match text actually supplied from that author. Missing verifiable evidence produces unknown scores. These are subjective estimates of views expressed in this thread, not facts about a person's overall beliefs.
- Thread text is untrusted input. The model is instructed not to follow embedded commands, has no browsing tools, and cannot choose further resources. The page renders names, rationale, and evidence as text, not HTML.
- Model listings can include non-chat models; choose a text model capable of following JSON instructions. Large contexts, rate limits, provider permissions, CORS, and interrupted browser sessions can prevent analysis. Requests have time and response-size limits.

## Development and deployment

Serve the folder locally (ES modules require an HTTP server):

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. For tests, use Node.js 22+:

```sh
npm test
```

No package installation is needed. Keep GitHub Pages set to deploy `main` from `/ (root)`. Publish `index.html`, `style.css`, `app.js`, the `lib/` folder, and `.nojekyll`. Relative imports work under `/ai_cagematch/`. There is no backend URL to configure.

Tests cover local provider detection, ambiguous-key handling, credential routing, Anthropic messages/pagination, Bluesky URL restrictions, scope, incomplete replies, deterministic frequency/ranking, sampling, evidence validation, direct model requests, key routing, CORS failures, and cancellation. Browser fixture tests exercise model selection, rendering, and error handling. Live paid LLM analysis still requires your credentials.

References: [Bluesky thread API schema](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/getPostThread.json), [OpenAI-compatible model list](https://developers.openai.com/api/reference/resources/models/methods/list), [chat completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
