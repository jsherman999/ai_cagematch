# The AI Opinion Map

A dependency-free, interactive opinion map with ten randomly generated fictional people. Drag to rotate the plane in 3D, scroll or use buttons to zoom, and click a person to inspect their scores. Touch dragging and keyboard controls are supported (focus the graph, then use arrow keys, +/−, or 0 to reset).

Two independent opinions require only two data dimensions. The graph presents that plane in a rotatable 3D perspective without inventing a third score:

- **Potential:** 0 = low / just text completion; 100 = high / transformative and uncertain.
- **Outlook:** 0 = doomer / extinction; 100 = Pollyanna / utopia.

All names and positions are fictional and generated anew on reload or with “Generate a new crowd.” Nothing is sent to a server or saved.

## Run locally

Open `index.html` directly, or serve this folder with `python3 -m http.server 8000` and visit http://localhost:8000.

## GitHub Pages

1. Add `index.html`, `style.css`, `app.js`, and `.nojekyll` to a GitHub repository and push them to your default branch.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select your branch and **/ (root)**, and save.
4. Open the URL GitHub supplies after deployment completes.

No build step, package install, API keys, CDN dependencies, or backend are required. Relative asset paths work on repository and custom-domain Pages sites.
