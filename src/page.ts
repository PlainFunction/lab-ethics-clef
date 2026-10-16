/** A one-page form for trying /judge in a browser. No build step, no dependencies. */
export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ethics check | Clef-flash</title>
<style>
  :root { --paper:#F7F7FF; --ink:#131112; --body:#60656F; --accent:#279AF1; --rose:#C49991; --line:#E2E3EE; --ok:#1F8A4C; --bad:#B42318; }
  * { box-sizing: border-box }
  body { margin:0; background:var(--paper); color:var(--body); font:16px/1.5 system-ui, sans-serif }
  main { max-width:760px; margin:0 auto; padding:32px 16px 64px; display:grid; gap:20px }
  h1 { color:var(--ink); font:600 28px/1.2 Georgia, serif; margin:0 }
  label { color:var(--ink); font-weight:600; display:grid; gap:6px }
  textarea { font:inherit; padding:10px 12px; border:1px solid var(--line); border-radius:6px; background:#fff; color:var(--ink) }
  button { justify-self:start; font:600 15px system-ui; color:#fff; background:#1E3A72; border:0; border-radius:6px; padding:10px 18px; cursor:pointer }
  button:disabled { opacity:.6 }
  .verdict { font:600 20px Georgia, serif; color:var(--ink) }
  .stats { font:13px ui-monospace, monospace; display:flex; flex-wrap:wrap; gap:6px 18px }
  .row { display:grid; grid-template-columns:190px 1fr 48px; gap:12px; align-items:center; font-size:14px }
  .row b { color:var(--ink); font-weight:500 }
  .row.off { opacity:.6 }
  .bar { height:10px; background:var(--line); border-radius:5px; position:relative; overflow:hidden }
  .bar i { position:absolute; inset:0 auto 0 0; border-radius:5px }
  .num { font:13px ui-monospace, monospace; text-align:right }
  .error { color:var(--bad) }
  @media (max-width:520px) { .row { grid-template-columns:1fr 48px } .bar { grid-column:1 / -1; order:3 } }
</style>
</head>
<body>
<main>
  <h1>Is it ethical? Nine theories, one call</h1>
  <form id="f" style="display:grid;gap:14px">
    <label for="action">Action
      <textarea id="action" rows="3" required minlength="10" maxlength="1500">Keep a wallet I found on the train. It has $80 and a driver's licence in it.</textarea>
    </label>
    <label for="context">Context (optional)
      <textarea id="context" rows="2" maxlength="1500"></textarea>
    </label>
    <button id="go">Check it</button>
  </form>
  <section id="out" aria-live="polite"></section>
</main>
<script>
const f = document.getElementById('f'), out = document.getElementById('out'), go = document.getElementById('go')
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]))
const words = { agreed_ethical: 'The theories agree: permissible', agreed_unethical: 'The theories agree: not permissible', contested: 'Contested: the theories disagree' }
f.addEventListener('submit', async e => {
  e.preventDefault()
  go.disabled = true; out.innerHTML = '<p>Asking Clef-flash…</p>'
  try {
    const res = await fetch('/judge', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: document.getElementById('action').value, context: document.getElementById('context').value }) })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || res.status)
    const pct = p => Math.round(p * 100) + '%'
    const colour = p => p >= 0.7 ? 'var(--ok)' : p <= 0.3 ? 'var(--bad)' : 'var(--rose)'
    out.innerHTML = '<div style="display:grid;gap:14px">'
      + '<div class="verdict">' + words[j.verdict] + '</div>'
      + '<div class="stats"><span>mean ' + pct(j.mean) + '</span><span>lowest ' + pct(j.min) + '</span><span>highest ' + pct(j.max) + '</span><span>spread ' + pct(j.spread) + '</span><span>' + j.forCount + ' of 8 for</span>'
      + '<span>main concern: ' + esc(j.mainConcern.choice) + '</span><span>stakes: ' + esc(j.stakes.label) + '</span></div>'
      + j.theories.map(t => '<div class="row' + (t.inVerdict ? '' : ' off') + '"><b>' + esc(t.name) + (t.inVerdict ? '' : ' (not counted)') + '</b>'
        + '<div class="bar"><i style="width:' + pct(t.probability) + ';background:' + colour(t.probability) + '"></i></div>'
        + '<span class="num">' + pct(t.probability) + '</span></div>').join('')
      + '</div>'
  } catch (err) {
    out.innerHTML = '<p class="error">That didn\\'t work: ' + esc(err.message) + '</p>'
  } finally { go.disabled = false }
})
</script>
</body>
</html>`
