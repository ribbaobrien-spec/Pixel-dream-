# Pixel Dream — AI Wallpaper Studio

A responsive browser-based AI wallpaper creator. Users describe an image, choose an art style and screen size, generate a wallpaper, preview it in a phone mockup, and download it.

## Run locally

Open `index.html` in a modern browser, or serve this folder with any static web server.

## Image generation

This project uses the Pollinations image API and the `black-forest-labs/flux.1-schnell` model. A Pollinations API key is required.

1. Get an API key at [enter.pollinations.ai](https://enter.pollinations.ai/).
2. Open Pixel Dream and paste the key into the API key field.
3. Describe the wallpaper, select a style and size, and generate.

The key is held only in page memory and is not saved to local storage or sent to this project's own server. The browser sends it directly to Pollinations in an Authorization header. Do not put a secret API key into source code or commit one to this repository. Image generation may be subject to provider limits or charges.

## Deploy with GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main** and folder **/ (root)**, then save.
4. Wait for the Pages deployment to finish. GitHub will show the published site URL in the Pages section.

This is a static site; no build step is required.
