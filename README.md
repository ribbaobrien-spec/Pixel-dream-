# Pixel Dream — AI Wallpaper & Logo Studio

A responsive browser-based AI creation studio with a company swap board. Create wallpapers and business logo ideas, or post items and services your company can trade for something it needs.

## Live site

[Open Pixel Dream](https://ribbaobrien-spec.github.io/Pixel-dream-/)

The site is a static GitHub Pages app. It needs no build step.

## Security and privacy

The app keeps the OpenAI API key in Cloudflare Worker secrets and validates server-side request sizes and fields. The company exchange is public: a poster's business contact email is shown to visitors after they check the consent box. Do not post an address that should remain private.

The image-generation endpoint is publicly reachable and can incur OpenAI charges. Origin checks and browser CORS rules are not authentication and do not stop a scripted client from sending requests. Use a hard spending limit or billing alert on the OpenAI account, and configure a server-side rate limit or bot check before inviting broad public traffic.

## Image generation and API key security

The browser sends image requests to the Cloudflare Worker at:

`https://hello-world-curly-water-4b09.ribbaobrien.workers.dev/generate`

The Worker calls OpenAI using the `OPENAI_API_KEY` secret configured in Cloudflare. The API key must stay in the Worker secret store; never put it in browser code, HTML, or this repository. Wallpaper and logo image generation require an OpenAI API account with image generation access and may incur API charges. The company exchange stores public swap listings in Cloudflare KV. Business contact emails appear on public offers only after the poster agrees.

The Worker accepts requests only from the Pixel Dream GitHub Pages origin. If you move the site to a custom domain, update the Worker’s allowed origin too. The company exchange also needs a Cloudflare KV binding named `TRADE_LISTINGS` connected to the `pixel-dream-trades` namespace.

## Install Pixel Dream as a phone app

On Android, open the live site in Chrome and tap **Install app** when it appears, or choose **Install app** / **Add to Home screen** from Chrome’s menu.

On iPhone or iPad, open the site in Safari, tap **Share**, then **Add to Home Screen**.

After the first visit, the studio shell can open offline. Image generation still needs an internet connection.

## Deploy the static site

GitHub Pages serves the root of the `main` branch. Commits to `main` publish automatically.

## Configure the Worker

In Cloudflare, open the `hello-world-curly-water-4b09` Worker, then go to **Settings → Variables and Secrets**. Add `OPENAI_API_KEY` as a **Secret** and save. Do not add it as a public variable or commit it to GitHub.

The Worker source is in `worker.js`. Deploy that file to the Worker service after changing its code.
