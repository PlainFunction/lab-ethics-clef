# Nine ethical theories, one model call

The code behind our lab [We Asked an AI Whether to Launch a Nuke](https://plainfunction.com.au/labs/ethics-clef).

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

Every judgement is a paid model call, so a deployed copy answers nowhere until you give it an address: workers.dev and preview URLs are off. Add a custom domain route in `wrangler.toml` and put [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) in front of it. It also takes at most 10 judgements a minute (`JUDGE_LIMIT`), whoever asks.

To switch it off, delete the route (or the Worker). It holds no keys of its own: the model is reached through the `AI` binding, so there's nothing to rotate.

## About this repo

This repo is synced automatically from another source, so it's read-only: pull requests and pushes aren't accepted here. If you spot a problem, tell us through [plainfunction.com.au/contact](https://plainfunction.com.au/contact).

Fork it and do what you like with it under the licence below.
