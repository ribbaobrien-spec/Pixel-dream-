# Pixel Dream — AI Wallpaper Studio

A responsive browser-based AI wallpaper creator. Describe an image, choose an art style and screen size, generate a wallpaper, preview it in a phone mockup, and download it.

## Live site

[Open Pixel Dream](https://ribbaobrien-spec.github.io/Pixel-dream-/)

The site is a static GitHub Pages app. It needs no build step.

## Image generation and API key security

The browser sends image requests to the Cloudflare Worker at:

`https://hello-world-curly-water-4b09.ribbaobrien.workers.dev/generate`

The Worker calls OpenAI using the `OPENAI_API_KEY` secret configured in Cloudflare. The API key must stay in the Worker secret store; never put it in browser code, HTML, or this repository. Image generation requires an OpenAI API account with image generation access and may incur API charges.

The Worker accepts requests only from the Pixel Dream GitHub Pages origin. If you move the site to a custom domain, update the Worker’s allowed origin too.

## Install Pixel Dream as a phone app

On Android, open the live site in Chrome and tap **Install app** when it appears, or choose **Install app** / **Add to Home screen** from Chrome’s menu.

On iPhone or iPad, open the site in Safari, tap **Share**, then **Add to Home Screen**.

After the first visit, the studio shell can open offline. Image generation still needs an internet connection.

## Deploy the static site

GitHub Pages serves the root of the `main` branch. Commits to `main` publish automatically.

## Configure the Worker

In Cloudflare, open the `hello-world-curly-water-4b09` Worker, then go to **Settings → Variables and Secrets**. Add `OPENAI_API_KEY` as a **Secret** and save. Do not add it as a public variable or commit it to GitHub.

The Worker source is in `worker.js`. Deploy that file to the Worker service after changing its code.
