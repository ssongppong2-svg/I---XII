// I — XII 무작위 완주 시험 (Playwright) — 지도 · 선택지 · 칸 화면 · 보상을 무작위로 고르며 1장 끝까지 간다 (전투는 이긴 것으로)
//   node tests/monkey.cjs [씨앗]      — 정해진 흐름 시험(e2e.cjs)이 지나가지 않는 드문 길에서 오류 · 멈춤을 찾는다
//   멈추면(같은 화면 · 같은 대사가 40번) 그 자리의 상태와 화면(monkey-stuck.png)을 남기고 끝낸다
//   MONKEY_SOUND=1 — 소리를 켠 채로 (배경음 · 장면 배경 소리가 바뀌는 길에서도 오류가 없는지)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' };
const SEED = +(process.argv[2] || 1);
let rs = SEED * 9301 + 49297; const rnd = () => (rs = (rs * 9301 + 49297) % 233280) / 233280;
const pick = a => a[Math.floor(rnd() * a.length)];
(async () => {
  const srv = http.createServer((req, rsp) => { const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(rsp); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(base + '/index.html#debug');
  await page.evaluate(sound => { localStorage.clear(); localStorage.setItem('i12.settings.v1', JSON.stringify({ tutorial: false, textSpeed: 'instant', sound, autoSpeed: 'fast' })); }, !!process.env.MONKEY_SOUND);
  await page.reload();
  await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title .ti-item'));
  await page.click('.ti-item[data-a="start"]');
  await page.waitForSelector('#dfGo');
  await page.click(`.df-num[data-d="${1 + Math.floor(rnd() * 6)}"]`).catch(() => {});
  await page.click('#dfGo');
  const visited = [], nodeTries = {};
  let steps = 0, last = '', stuck = 0;
  const state = () => page.evaluate(() => {
    const scr = (document.querySelector('#screen .screen') || {}).className || '';
    const sc = !document.querySelector('#scene').hidden;
    return { scr, sc, t: sc ? document.querySelector('#dtext').textContent.slice(0, 30) + '|' + document.querySelector('#dname').textContent : (document.querySelector('.nd-title, .rw-title') || {}).textContent, choices: sc && !document.querySelector('#scChoices').hidden, input: sc && !document.querySelector('#scInput').hidden, modal: !!document.querySelector('.modal'), sheet: !!document.querySelector('.sheet'), pos: I12.RUN && I12.RUN.pos, ch: I12.RUN && I12.RUN.chapter };
  });
  while (steps++ < 2500) {
    const s = await state();
    const key = JSON.stringify(s);
    stuck = key === last ? stuck + 1 : 0; last = key;
    if (stuck > 40) {
      console.log('STUCK', key);
      console.log(await page.evaluate(() => ({ name: document.querySelector('#dname').textContent, text: document.querySelector('#dtext').textContent.slice(0, 80), dbox: document.querySelector('#dbox').className, paper: !document.querySelector('#scPaper').hidden, card: !document.querySelector('#scCard').hidden, log: !document.querySelector('#scLogPanel').hidden, active: document.activeElement && (document.activeElement.tagName + '#' + document.activeElement.id + '.' + document.activeElement.className), sceneCls: document.querySelector('#scene').className })));
      await page.screenshot({ path: path.join(process.env.E2E_SHOTS || '.', 'monkey-stuck.png') });
      break;
    }
    try {
      if (s.modal) { await page.click('.modal .btn-main', { timeout: 1500 }).catch(() => page.keyboard.press('Escape')); }
      else if (s.sheet) { const c = await page.$$('.sheet .card:not(.off)'); if (c.length && rnd() < 0.8) await pick(c).click({ timeout: 1500 }).catch(() => {}); else await page.keyboard.press('Escape'); }
      else if (s.sc) {
        if (s.input) { await page.fill('.sc-input input', pick(['크로노스', '카이', '시계공'])); await page.keyboard.press('Enter'); }
        else if (s.choices) { const b = await page.$$('#scChoices button:not([disabled])'); if (b.length) await pick(b).click({ timeout: 1500 }); }
        else await page.keyboard.press('Space');
      }
      else if (/scr-chapterend/.test(s.scr)) { if (await page.$('#ceGo')) { console.log('CHAPTER END reached · steps', steps); break; } await page.waitForTimeout(300); }
      else if (/scr-map/.test(s.scr)) {
        const av = await page.$$('.gn.avail');
        if (av.length) { const g = pick(av); visited.push(await g.getAttribute('data-id')); await g.click({ timeout: 2000 }); await page.waitForTimeout(400); }
        else await page.waitForTimeout(300);
      }
      else if (/scr-battle/.test(s.scr)) {
        const ok = await page.evaluate(() => I12.B && I12.B.started && !I12.B.over && !I12.B.busy);
        if (ok) await page.evaluate(() => I12.core.debugWin()); else await page.waitForTimeout(200);
      }
      else if (/scr-reward/.test(s.scr)) {
        const rel = await page.$$('.rw-relic:not([disabled])'); if (rel.length) await pick(rel).click();
        const cards = await page.$$('.rw-cards .card'); if (cards.length && rnd() < 0.7) await pick(cards).click();
        await page.click('#rwGo', { timeout: 2000 }).catch(() => {});
      }
      else if (/scr-rewind/.test(s.scr)) { await page.click('.rewind-bg').catch(() => {}); }
      else if (/scr-node/.test(s.scr)) {
        const k = s.pos; nodeTries[k] = (nodeTries[k] || 0) + 1;
        const t = nodeTries[k];
        const opts = await page.$$('.nd-opt:not([disabled]), .shop-cards .card, .shop-relic:not(:disabled), .nd-cards .card, .rw-relic:not([disabled]), #ndFight');
        if (t <= 3 && opts.length && rnd() < 0.8) await pick(opts).click({ timeout: 1500 }).catch(() => {});
        else { const lv = await page.$('#ndLeave:not([hidden])'); if (lv) await lv.click({ timeout: 1500 }).catch(() => {}); else if (opts.length) await pick(opts).click({ timeout: 1500 }).catch(() => {}); }
      }
      else await page.waitForTimeout(200);
    } catch (e) { /* 클릭 실패는 다음 차례에 */ }
    await page.waitForTimeout(60);
  }
  const R = await page.evaluate(() => ({ ch: I12.RUN.chapter, cleared: I12.RUN.cleared, hp: I12.RUN.hp, deck: I12.RUN.deck.length, relics: I12.RUN.relics.length, flags: Object.keys(I12.RUN.flags.ev || {}).join(','), types: I12.RUN.visited.map(id => I12.RUN.map.nodes[id].story || I12.RUN.map.nodes[id].type).join(' ') }));
  console.log('seed', SEED, 'steps', steps, JSON.stringify(R));
  console.log('errors', errs.length ? errs.slice(0, 8) : 'none');
  await browser.close(); srv.close();
  const ok = !errs.length && R.cleared === 1;
  console.log(ok ? '완주 · 오류 없음' : '실패 — 끝까지 못 갔거나 오류가 있다');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('시험 중단:', e); process.exit(1); });
