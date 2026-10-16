# Nine ethical theories, one model call

The code behind our lab [Nine Ethical Theories, One Model Call](https://plainfunction.com.au/labs/ethics-clef).

It's a small Cloudflare Worker. You describe an action, like "keep a wallet I found on the train", and it asks Cloudflare's Clef-flash model the same question nine ways, once for each ethical theory. It gets back a probability from each and says whether the theories agree or argue. The write-up explains what we found and why the disagreement is the useful part.

## Running it

You need Node 22 or later, and Cloudflare Workers Paid for the real model (Clef-flash isn't on the free plan).

```bash
npm install
npm test                  # unit tests, with a fake model
npx wrangler dev --remote # the try-it page on http://localhost:8787, using the real model
npm run scenarios         # runs scenarios.json against the running Worker, writes results/
```

`POST /judge` with `{ "action": "...", "context": "..." }` returns the nine probabilities and a verdict.

## About this repo

This repo is synced automatically from another source, so it's read-only: pull requests and pushes aren't accepted here. If you spot a problem, tell us through [plainfunction.com.au/contact](https://plainfunction.com.au/contact).

Fork it and do what you like with it under the licence below.
