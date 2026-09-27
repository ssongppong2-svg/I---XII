// I — XII 흐름 시험 (Playwright)
//   npm i -D playwright   (또는 NODE_PATH로 전역 설치본을 가리키기)
//   node tests/e2e.cjs            — 저장소 폴더를 직접 띄워서 시험한다
//   E2E_URL=http://... node tests/e2e.cjs   — 이미 띄운 주소로 시험
//   E2E_SHOTS=폴더 를 주면 화면을 찍어 둔다
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.E2E_SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`); if (!ok) fails.push(msg); };

(async () => {
  let srv = null, base = process.env.E2E_URL;
  if (!base) { srv = await serve(); base = `http://127.0.0.1:${srv.address().port}`; }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT|fonts\.g/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));

  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  const sceneOpen = () => page.evaluate(() => !document.querySelector('#scene').hidden);
  // 장면 끝까지 — 건너뛰기는 선택지 앞에서 멈추므로, 선택지가 뜨면 고를 수 있는 첫 번째를 누른다
  const clearScene = async () => {
    for (let i = 0; i < 100 && await sceneOpen(); i++) {
      if (await page.evaluate(() => !document.querySelector('#scChoices').hidden)) await page.click('#scChoices button:not([disabled])', { timeout: 3000 }).catch(() => {});
      else await page.click('#scSkipBtn', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);
    }
  };
  const choicesShown = () => page.evaluate(() => !document.querySelector('#scChoices').hidden);
  const logText = async () => { await page.keyboard.press('KeyL'); const t = await page.evaluate(() => document.querySelector('#scLogList').textContent); await page.keyboard.press('Escape'); return t; };
  const waitScreen = (cls, timeout = 20000) => page.waitForFunction(c => { const s = document.querySelector('#screen .screen'); return s && s.classList.contains(c); }, cls, { timeout });
  const waitMap = () => page.waitForFunction(() => document.querySelector('.scr-map .gn.avail'), null, { timeout: 25000 });
  const battleReady = () => page.waitForFunction(() => I12.B.started && !I12.B.over && !I12.B.busy && document.querySelector('#scene').hidden, null, { timeout: 15000 });
  const toTitleAndContinue = async () => {
    await page.reload();
    await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title .ti-item'));
    await page.click('.ti-item[data-a="start"]');
    await page.click('.ti-item[data-a="continue"]');
  };
  const winToReward = async () => {
    await battleReady();
    await page.evaluate(() => I12.core.debugWin());
    await page.waitForFunction(() => document.querySelector('.scr-reward') || !document.querySelector('#scene').hidden, null, { timeout: 20000 });
    await clearScene();
    await waitScreen('scr-reward');
  };
  const run = () => page.evaluate(() => JSON.parse(JSON.stringify(I12.RUN)));

  const enterNode = async (sel, patch = '') => {
    const id = await page.evaluate(([s, patch]) => {
      const n = Object.values(I12.RUN.map.nodes).find(x => (s === 'boss' ? x.type === 'boss' : s.startsWith('s') ? x.story === s : x.id === s));
      if (patch) new Function('n', 'RUN', patch)(n, I12.RUN);
      I12.RUN.pos = n.prev[0] || I12.RUN.pos;
      I12.flow.enterNode(n.id);
      return n.id;
    }, [sel, patch]);
    return id;
  };
  const sceneWait = () => page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 15000 });
  const recurSnap = () => page.evaluate(() => JSON.parse(localStorage.getItem('i12.run.recur.v1')));
  const afterFightToMap = async () => { await winToReward(); await page.click('#rwGo'); await waitMap(); };

  await page.goto(base + '/index.html#debug');
  await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title'));
  await page.evaluate(() => localStorage.clear());
  const stepUntil = async (fn, n = 80, ms = 110) => { for (let i = 0; i < n; i++) { if (await page.evaluate(fn)) return true; if (await choicesShown()) return false; await page.keyboard.press('Space'); await page.waitForTimeout(ms); } return page.evaluate(fn); };
  const resultShown = () => page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none, .nd .nd-cards, .nd .deck-grid, #ndFight, .nd .nd-result') || (document.querySelector('.scr-node .nd-title') && document.querySelector('#scene').hidden && !document.querySelector('#ndLeave').hidden), null, { timeout: 15000 });

  console.log('1. 타이틀 → 예전 판 저장 안내 → 난이도 → 01 회상(못총) · 02 각성(후드 쓴 사람 · 불안정한 I) → 지도');
  await page.evaluate(() => localStorage.setItem('i12.run.auto.v1', JSON.stringify({ v: 2, name: '옛 여정', chapter: 1, diff: 1, created: 1 })));
  await page.reload();
  await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title .ti-item'));
  check(await page.evaluate(() => !!document.querySelector('.scr-title img.scr-bg')), '타이틀 배경 그림');
  check(await page.evaluate(() => [...document.querySelectorAll('.ti-item')].map(b => b.textContent.trim()).join(',')) === 'Start,Settings,Credits,Exit', '타이틀 메뉴 Start · Settings · Credits · Exit');
  await page.click('.ti-item[data-a="credits"]');
  check(await page.evaluate(() => !document.querySelector('#tiCredits').hidden && document.querySelectorAll('.tc-board dt').length === 4), 'Credits — 역할 4줄');
  await page.keyboard.press('Escape');
  await shot('01-title');
  await page.click('.ti-item[data-a="start"]');
  await page.waitForSelector('.modal .btn-main');
  check(await page.evaluate(() => /예전 판의 여정/.test(document.querySelector('.modal').textContent) && /전면 개작본/.test(document.querySelector('.modal').textContent)), '예전 판(v2) 저장 — 이어 할 수 없다고 알려 준다');
  await page.click('.modal .btn-main');
  await waitScreen('scr-difficulty');
  check(await page.evaluate(() => !localStorage.getItem('i12.run.auto.v1')), '새 게임을 고르면 예전 여정은 지워진다');
  await page.click('.df-num[data-d="4"]');
  await page.click('#dfGo');
  await sceneWait();
  // 01 — 검은 화면 · 주인공 이름칸은 ??? · 방문자는 목소리만 · 못총 그림
  check(await stepUntil(() => document.querySelector('#dname').textContent === '???'), '01: 이름을 정하기 전 — 주인공 이름칸 ???');
  check(await stepUntil(() => document.querySelector('#dname').textContent === '방문자의 목소리' && !document.querySelector('#ptGuest').classList.contains('in')), '01: 방문자는 모습 없이 목소리만');
  check(await stepUntil(() => !document.querySelector('#scCg').hidden && !!document.querySelector('#scCg img')), '01: 장력 가속 못총 그림');
  await shot('02-nailgun');
  check(await stepUntil(() => document.querySelector('#dname').textContent === '후드 쓴 사람', 90), '02: 마르트는 아직 「후드 쓴 사람」');
  check(await stepUntil(() => !document.querySelector('#scDial').hidden && document.querySelector('#scDial').classList.contains('flicker'), 40), '02: 권능 문자판 — I만 불안정하게 점등');
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 10000 });
  check(await page.evaluate(() => [...document.querySelectorAll('#scChoices button')].map(b => b.textContent).join('|').includes('손을 잡는다')), '02: 선택 — 손을 잡는다 / 난간을 잡는다');
  await page.click('#scChoices button');
  await clearScene();
  await waitMap();
  await shot('03-map');
  let R = await run();
  check(R.name === '' && R.diff === 4 && R.chapter === 1 && R.v === 3 && R.flags.ev.took_hand, `이름은 아직 없음 · 난이도 IV · 저장 판 3 · 02 선택 깃발 (${JSON.stringify(R.name)} · v${R.v})`);
  check(R.goal === '회수소를 빠져나간다' && R.saves.left === 5, `목표 · 저장 횟수 (${R.goal} · ${R.saves.left})`);
  const nodes = await page.evaluate(() => { const o = {}; for (const n of Object.values(I12.RUN.map.nodes)) (o[n.type] = o[n.type] || []).push(n.id); return o; });
  const spine = await page.evaluate(() => I12.RUN.map.layers.map(l => l.length === 1 ? (I12.RUN.map.nodes[l[0]].story || I12.RUN.map.nodes[l[0]].type) : '·').join(' '));
  check(R.map.layers.length === 21 && spine === 'start s03 s04 · · s05 s06 s07 · s08 s09 s10 · s11 s12 s13 · s14 · s15 boss', `지도 21층 — 이야기 칸 뼈대 (${spine})`);
  const rows = await page.evaluate(() => { const L = I12.RUN.map.layers, N = I12.RUN.map.nodes; return { top: L.slice(0, 11).flat().every(id => N[id].row === 0), bottom: L.slice(11).flat().every(id => N[id].row === 1), dir: N[L[1][0]].x < N[L[10][0]].x && N[L[11][0]].x > N[L[20][0]].x }; });
  check(rows.top && rows.bottom && rows.dir, '지도: 두 줄 — 위 줄 왼→오, 아래 줄 오→왼 (끝에 보스)');
  check(await page.evaluate(() => document.querySelectorAll('.mech .gn.t-story .sno').length === 13 && /출고되지 않은 물건/.test(document.querySelector('.mech').textContent) && /16·17/.test(document.querySelector('.mech').textContent)), '지도: 이야기 칸 13개 · 보스 16·17');
  check(!nodes.elite && nodes.boss.length === 1 && R.map.layers.every(l => l.length <= 2), '1장: 정예 없음 · 사이 층은 톱니 두 개');
  const least = await page.evaluate(() => I12.ch.CHAPTERS[1].atLeast);
  check(Object.entries(least).every(([t, c]) => (nodes[t] || []).length >= c), `지도: 사이 칸 최소 개수 — ${Object.entries(least).map(([t, c]) => `${t} ${(nodes[t] || []).length}/${c}`).join(' · ')}`);

  console.log('2. 03 출고되지 않은 물건 — 재귀 지점 · 학습 전투(재귀 설명창 + 03-010) · 쓰러지면 곧장 재도전 · 승리 대사');
  const s03 = R.map.layers[1][0];
  await page.click(`.gn.avail[data-id="${s03}"]`);
  await waitScreen('scr-node');
  await sceneWait();
  check(await page.evaluate(() => document.querySelector('#dname').textContent === '감시 시계'), '03: 감시 시계가 먼저 말한다 (03-001)');
  await clearScene();
  await waitScreen('scr-battle');
  await page.waitForSelector('.tut', { timeout: 10000 });
  check(await page.evaluate(() => I12.B.rows === 6 && I12.B.foes.length === 1 && I12.B.foes[0].type === 'watcher' && document.querySelector('#meName').textContent === '???'), '03: 6×6 판 · 감시 시계 1기 · 이름칸 ???');
  let snap = await recurSnap();
  check(snap.pending === s03 && snap.map.nodes[s03].preDone && snap.saves.left === 5, '03: 전투 직전 재귀 지점 (저장 횟수는 그대로)');
  // 튜토리얼을 넘겨 「재귀」 설명창까지 — 주인공의 한마디(03-010)
  for (let i = 0; i < 4 && !(await page.evaluate(() => /재귀/.test((document.querySelector('.tut b') || {}).textContent || ''))); i++) { await page.click('.tut button[data-a="next"]'); await page.waitForTimeout(500); }
  check(await page.evaluate(() => /이 감각/.test(document.querySelector('#fx').textContent + I12.B.logs.map(l => l.t).join())), '03: 재귀 설명창 — 「이 감각…… 아까 눈을 떴을 때도.」');
  await shot('04-s03-battle');
  await page.click('.tut button[data-a="skip"]');
  await battleReady();
  await page.evaluate(() => I12.core.debugLose());
  await waitScreen('scr-rewind');
  check(await page.evaluate(() => !!document.querySelector('.rw-note') && document.querySelector('#scene').hidden), '재귀: 대사 없이 바늘만 (전투 패배는 정사가 아니다)');
  await page.click('.rewind-bg');
  await waitScreen('scr-battle', 15000);
  await page.waitForTimeout(300);
  check(!(await sceneOpen()) && (await run()).stats.deaths === 1, '03: 쓰러지면 앞 대사 없이 곧장 그 전투로');
  // 재도전에서 두 번째 루프까지 — 한마디(03-010)는 처음 한 번만 (안내가 꺼진 판에서는 두 번째 루프에 나온다)
  for (const k of ['KeyA', 'KeyD', 'KeyA', 'KeyD']) { await battleReady(); await page.keyboard.press(k); await page.waitForTimeout(600); }
  await page.waitForFunction(() => I12.B.loop >= 2, null, { timeout: 10000 });
  check(await page.evaluate(() => !I12.B.logs.some(l => /이 감각/.test(l.t))), '03: 재도전 — 한마디(03-010)는 다시 하지 않는다');
  await battleReady();
  await page.evaluate(() => I12.core.debugWin());
  await sceneWait();
  check(await page.evaluate(() => /후드 쓴 사람/.test(document.querySelector('#dname').textContent)), '03: 승리 대사 (03-011)');
  await clearScene();
  await waitScreen('scr-reward');
  const cards0 = (await run()).deck.length;
  await page.click('.rw-cards .card');
  await page.click('#rwGo');
  await waitMap();
  R = await run();
  check(R.deck.length === cards0 + 1 && R.goal === '추위를 피할 곳으로 간다', `보상 카드가 덱에 들어간다 · 03 뒤 목표 (${R.goal})`);

  console.log('3. 04 그 이름을 아는 사람 — 안전한 휴식(회복) · 이름 입력 · 지원 받기 · 새로고침');
  await page.evaluate(() => { I12.RUN.hp = 2; });
  await enterNode('s04');
  await waitScreen('scr-node');
  await sceneWait();
  await page.waitForTimeout(300);
  check((await run()).hp === 4, '04: 들어오면 먼저 회복 (HP 2 → 4)');
  for (let i = 0; i < 80 && await page.evaluate(() => document.querySelector('#scInput').hidden); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(90); }
  check(await page.evaluate(() => !document.querySelector('#scInput').hidden && document.querySelector('#scInName').value === '크로노스' && /접힌 그림/.test(document.querySelector('#scInPrompt').textContent)), '04: 접힌 그림 아래의 이름 — 기본값 「크로노스」');
  await shot('05-name');
  await page.click('#scInOk');
  check(await stepUntil(() => /크로노스 님/.test(document.querySelector('#dtext').textContent) && document.querySelector('#dname').textContent === '마르트', 30), '04: 마르트가 「크로노스 님」 (04-008)');
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 8000 });
  const c04 = await page.evaluate(() => [...document.querySelectorAll('#scChoices button')].map(b => b.textContent));
  check(c04.length === 2 && /받는다/.test(c04[0]) && /회복약 \+1/.test(c04[0]) && /받지 않는다/.test(c04[1]), '04: 지원 — 받는다 / 받지 않는다 (얻는 것 표시)');
  await page.click('#scChoices button');
  await clearScene();
  await resultShown();
  R = await run();
  check(R.name === '크로노스' && R.items.potion === 1 && R.items.kit === 1 && R.goal === '시장에서 정비공 오르를 만난다', `04: 이름 · 회복약 1 · 정비 부품 1 · 목표 (${R.name} · ${JSON.stringify(R.items)} · ${R.goal})`);
  await toTitleAndContinue();
  await waitScreen('scr-node');
  await resultShown();
  check(!(await sceneOpen()) && (await run()).items.potion === 1 && (await run()).hp === 4, '04: 새로고침해도 결과만 (회복 · 지원을 두 번 받지 않는다)');
  await page.click('#ndLeave');
  await waitMap();
  check(await page.evaluate(() => /오르를 만난다/.test(document.querySelector('#mapGoal').textContent) && document.querySelector('#mapGoal').classList.contains('new') && /새 목표/.test(document.querySelector('#mapGoal').textContent)), '지도 위쪽에 목표 — 바뀐 뒤 처음이면 「새 목표」로 빛난다');
  await page.evaluate(() => { I12.RUN.hp = 2; I12.router.go('map', {}); });
  await waitMap();
  await page.click('#mapRes [data-bag="potion"]');
  await page.waitForTimeout(200);
  R = await run();
  check(R.hp === 4 && R.items.potion === 0, `가방: 지도에서 회복약 — HP +2 (${R.hp})`);

  console.log('4. 05 녹슨 자동인형 — 부품으로 수리');
  await enterNode('s05');
  await waitScreen('scr-node');
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check(await page.evaluate(() => { const b = [...document.querySelectorAll('#scChoices button')]; return b.length === 3 && !b[0].disabled && /정비 부품 −1/.test(b[0].textContent); }), '05: 세 갈래 — 수리(부품이 있으면) · 기록 · 정지');
  await page.click('#scChoices button');
  await clearScene();
  await resultShown();
  R = await run();
  check(R.items.kit === 0 && R.flags.ev.doll_fixed, '05: 정비 부품 −1 · 자동인형 수리 깃발');
  await page.click('#ndLeave');
  await waitMap();

  console.log('5. 06 동전이 있어도 없는 것 — 오르 · 전투 B02 · 튜토리얼 2');
  await enterNode('s06');
  await waitScreen('scr-node');
  await sceneWait();
  check(await page.evaluate(() => document.querySelector('#dname').textContent === '오르' && document.querySelector('#ptGuest').dataset.tone === 'or'), '06: 오르 — 신도 그림에 주황 색조');
  await shot('06-or');
  await clearScene();
  await waitScreen('scr-battle');
  await page.waitForSelector('.tut', { timeout: 10000 });
  check(await page.evaluate(() => I12.B.foes.map(f => f.type).sort().join() === 'charger,watcher' && I12.RUN.flags.ev.or_met), '06: 감시 시계 + 돌진 기계 · 튜토리얼 2');
  await afterFightToMap();

  console.log('6. 07 아무도 공짜로 덥지 않다 — 바넷 · 상점 · 나갈 때 외투의 빚');
  await enterNode('s07');
  await waitScreen('scr-node');
  await sceneWait();
  check(await page.evaluate(() => document.querySelector('#dname').textContent === '바넷'), '07: 바넷 (암시장 상인 그림)');
  await clearScene();
  await page.waitForSelector('.shop-cards .card');
  check(await page.evaluate(() => !document.querySelector('.st-ask') && !document.querySelector('#ndLeave').classList.contains('wait')), '07: 질문 없이 상점 — 사는 것은 선택');
  await page.click('#ndLeave');
  await sceneWait();
  check(await stepUntil(() => /빈칸 손님/.test(document.querySelector('#dtext').textContent), 60), '07: 나갈 때 — 「빈칸 손님. 외투 하나.」');
  await clearScene();
  await waitMap();
  check((await run()).flags.ev.coat_debt, '07: 외투의 빚');

  console.log('7. 08 신을 앉힐 의자가 없다 — 은신처 회복 · 세 사람 대화');
  await page.evaluate(() => { I12.RUN.hp = 3; });
  await enterNode('s08');
  await waitScreen('scr-node');
  await sceneWait();
  check(await stepUntil(() => document.querySelector('#scene').classList.contains('trio'), 40), '08: 세 사람이 함께 서는 대화 (손님 칸 둘)');
  check(await page.evaluate(() => document.querySelector('#ptGuest2').classList.contains('in') && [...document.querySelectorAll('.pt-guest')].some(g => g.dataset.tone === 'eda')), '08: 에다 — 신도 그림에 푸른 색조');
  await shot('07-s08-trio');
  await clearScene();
  await resultShown();
  R = await run();
  check(R.hp === 5 && R.goal === '정비 예배당에서 기록을 찾는다', `08: 기본 회복 (HP ${R.hp}) · 목표`);
  await page.click('#ndLeave');
  await waitMap();

  console.log('8. 09 빌린 길 — 가림길(경계 그대로 · 구석에서 · 송신이 늦다)');
  await page.evaluate(() => { I12.RUN.alert = 0; });
  await enterNode('s09');
  await waitScreen('scr-node');
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  const c09 = await page.evaluate(() => [...document.querySelectorAll('#scChoices button')].map(b => b.textContent));
  check(/경계 그대로/.test(c09[0]) && /송신이 한 박자 늦다/.test(c09[0]) && /경계 \+1단계/.test(c09[1]), '09: 경로 두 가지 — 이익을 미리 보여 준다');
  await page.click('#scChoices button');
  await clearScene();
  await waitScreen('scr-battle');
  await battleReady();
  const b09 = await page.evaluate(() => ({ p: I12.B.p, sig: I12.B.foes.filter(f => f.type === 'watcher').map(f => f.sig), log: I12.B.logs.map(l => l.t).join('|'), alert: I12.RUN.alert }));
  check(b09.p.r === 5 && b09.p.c === 0 && b09.sig[0] === 5 && /가림길/.test(b09.log) && b09.alert === 0, `09: 구석에서 시작 · 송신까지 5행동 · 기록에 표시 (${JSON.stringify(b09.p)} · ${b09.sig})`);
  await page.evaluate(() => { I12.B.signals = 1; });
  await winToReward();
  check(await page.evaluate(() => I12.run.alertStage()) === 1, '09: 송신이 끝났으면 이긴 뒤 경계 한 단계');
  await page.click('#rwGo');
  await waitMap();

  console.log('9. 10 신에게서 떼어 낸 것 — 기록(미송신) · II의 박자');
  await enterNode('s10');
  await waitScreen('scr-node');
  await sceneWait();
  check(await stepUntil(() => !document.querySelector('#scPaper').hidden && /미송신/.test(document.querySelector('#scPaperT').textContent), 60), '10: 최신 이상 보고는 미송신 기록 (종이 패널)');
  check(await stepUntil(() => !document.querySelector('#scDial').hidden && !!document.querySelector('#scDial .dn.pulse'), 40), '10: II의 표식 — 문자판의 II가 반응');
  await clearScene();
  await resultShown();
  check((await run()).goal === '하층 난방실에서 화물 승강기를 살린다', '10: 목표 — 난방실');
  await page.click('#ndLeave');
  await waitMap();

  console.log('10. 11 다시 돌려 보겠다는 말 — 점검 두 가지(순서만 고른다)');
  await enterNode('s11');
  await waitScreen('scr-node');
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  await page.click('#scChoices button:nth-child(2)');   // 승인 장치 먼저
  check(await stepUntil(() => document.querySelector('#scPaper').classList.contains('panel') && document.querySelector('#scPaper').classList.contains('deny'), 10), '11: 권한 패널 — 최상위 재분배 명령은 봉인');
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check(await page.evaluate(() => document.querySelectorAll('#scChoices button').length === 1 && /기본 구동/.test(document.querySelector('#scChoices').textContent)), '11: 남은 점검 하나 — 둘 다 확인해야 넘어간다');
  await clearScene();
  await resultShown();
  await page.click('#ndLeave');
  await waitMap();

  console.log('11. 12 닫히는 쪽에 남은 사람 — 경고등 · 철회된 권한 · 오르');
  await enterNode('s12');
  await waitScreen('scr-node');
  await sceneWait();
  check(await stepUntil(() => document.querySelector('#scene').dataset.tint === 'alarm', 20), '12: 경고등');
  check(await stepUntil(() => document.querySelector('#scPaper').classList.contains('deny') && /철회된 권한/.test(document.querySelector('#scPaperX').textContent), 20), '12: 「철회된 권한」만 표시된다');
  await shot('08-s12');
  await clearScene();
  await resultShown();
  R = await run();
  check(R.flags.ev.or_dead && !(await page.evaluate(() => !!document.querySelector('.ev-none'))), '12: 오르의 죽음 (얻은 것 없음 줄은 쓰지 않는다)');
  await page.click('#ndLeave');
  await waitMap();

  console.log('12. 13 잘못을 설명하는 사람 — 두렵다고 말한다');
  await enterNode('s13');
  await waitScreen('scr-node');
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  await page.click('#scChoices button:nth-child(2)');
  await clearScene();
  await resultShown();
  check((await run()).flags.ev.argue_fear, '13: 두렵다고 말했다');
  await page.click('#ndLeave');
  await waitMap();

  console.log('13. 톱니 칸 화면 — 「떠난다」 버튼으로 나가기');
  for (const t of ['rest', 'shop', 'blackmarket', 'forge', 'implant', 'abyss', 'tent', 'shrine', 'alley']) {
    const id = nodes[t] && nodes[t][0];
    if (!id) { console.log(`  · ${t} 없음 (이번 지도)`); continue; }
    await page.evaluate(([id, t]) => { I12.RUN.alert = 0; I12.RUN.parts = 300; I12.RUN.shards = 3; if (t === 'alley') I12.RUN.map.nodes[id].alley = 'hide'; I12.flow.enterNode(id); }, [id, t]);
    await waitScreen('scr-node');
    await page.waitForTimeout(300);
    if (['rest', 'abyss', 'tent', 'alley'].includes(t)) { await page.click('.nd-opt'); await page.waitForTimeout(300); }
    if (t === 'shop') await page.click('.shop-cards .card');
    if (t === 'shrine') await page.click('.rw-relic');
    if (await page.$('#ndFight')) { await page.click('#ndFight'); await afterFightToMap(); check(true, `${t}: 습격 전투 뒤 지도로`); continue; }
    await page.click('#ndLeave');
    await waitMap();
    check(true, `${t}: 떠난다 → 지도`);
  }

  console.log('14. 사건 — 그때에 맞는 사건 · 결과 · 새로고침 · 건너뛰기 · 기시감 없음');
  const evIds = nodes.event || [];
  const evInfo = await page.evaluate(ids => ids.map(id => { const n = I12.RUN.map.nodes[id]; return { id, ev: n.event, layer: n.layer }; }), evIds);
  const phaseOk = await page.evaluate(info => info.every(x => { const ph = I12.ch.CHAPTERS[1].phases[x.layer]; return true && ph; }), evInfo);
  check(evIds.length >= 3 && new Set(evInfo.map(x => x.ev)).size === evInfo.length && phaseOk, `지도: 사건 칸 ${evIds.length}개 · 같은 사건 없음`);
  const leaveEvent = async () => {
    if (await page.$('#ndFight')) { await page.click('#ndFight'); await afterFightToMap(); }
    else { await page.click('#ndLeave'); await waitMap(); }
  };
  await page.evaluate(id => { I12.RUN.alert = 0; I12.RUN.parts = 300; I12.RUN.hp = 3; I12.flow.enterNode(id); }, evIds[0]);
  await waitScreen('scr-node');
  await sceneWait();
  for (let i = 0; i < 80 && !(await choicesShown()); i++) { await page.click('#dbox'); await page.waitForTimeout(110); }
  const chs = await page.evaluate(() => [...document.querySelectorAll('#scChoices button')].map(b => !!b.querySelector('small')));
  check(chs.length >= 2 && chs.every(Boolean), `사건: 선택지 ${chs.length}개 — 모두 얻고 잃는 것 표시`);
  await page.click('#scChoices button:not([disabled])');
  for (let i = 0; i < 60 && await sceneOpen(); i++) { if (await choicesShown()) await page.click('#scChoices button:not([disabled])'); else await page.click('#dbox'); await page.waitForTimeout(110); }
  await resultShown();
  const e1 = await run();
  check(e1.map.nodes[evIds[0]].ev && e1.map.nodes[evIds[0]].ev.done && e1.flags.seen['ev:' + evInfo[0].ev], '사건: 끝나면 결과가 저장된다');
  await toTitleAndContinue();
  await waitScreen('scr-node');
  await resultShown();
  const e2 = await run();
  check(!(await sceneOpen()) && e2.parts === e1.parts && e2.hp === e1.hp && e2.alert === e1.alert && e2.deck.length === e1.deck.length, '사건: 새로고침해도 두 번 받지 않는다');
  await leaveEvent();
  await page.evaluate(([id, name]) => { I12.RUN.alert = 10; I12.RUN.parts = 300; I12.RUN.hp = 3; I12.RUN.flags.seen['ev:' + name] = '지난번의 선택'; I12.flow.enterNode(id); }, [evIds[1], evInfo[1].ev]);
  await waitScreen('scr-node');
  const pre = await run();
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check(!(await logText()).includes('재귀하기 전의 기억'), '사건: 되돌아와 다시 만나도 기시감 대사는 없다 (재귀 지점 재도전은 정사가 아니다)');
  await page.click('#scChoices button:not([disabled])');
  await page.click('#dbox');
  await toTitleAndContinue();
  await waitScreen('scr-node');
  await sceneWait();
  const post = await run();
  check(post.parts === pre.parts && post.alert === pre.alert && post.hp === pre.hp && !post.map.nodes[evIds[1]].ev, '사건: 장면 도중에 끄면 처음부터 — 효과가 두 번 들어가지 않는다');
  await clearScene();
  await resultShown();
  await leaveEvent();

  console.log('15. 직접 저장 → 패배 → 재귀(지도로)');
  await page.click('#mSave');
  await page.waitForSelector('.modal .btn-main');
  await page.click('.modal .btn-main');
  await page.waitForTimeout(300);
  const saved = await run();
  check(saved.saves.left === 4, `저장 횟수 줄어듦 (${saved.saves.left})`);
  const fightId = await page.evaluate(() => (Object.values(I12.RUN.map.nodes).find(x => x.type === 'battle' && !I12.RUN.visited.includes(x.id)) || Object.values(I12.RUN.map.nodes).find(x => x.type === 'battle')).id);
  await page.evaluate(id => I12.flow.enterNode(id), fightId);
  await waitScreen('scr-battle');
  await battleReady();
  await page.evaluate(() => I12.core.debugLose());
  await waitScreen('scr-rewind');
  await page.click('.rewind-bg');
  await waitMap();
  const rw = await run();
  check(rw.pos === saved.pos && rw.hp === saved.hp && rw.deck.length === saved.deck.length && rw.recur === saved.recur + 1, '재귀: 저장한 자리 · HP · 덱으로 · 재귀 횟수 +1');

  console.log('16. 경계도 100 → 발각 전투');
  await page.evaluate(() => { I12.RUN.alert = 100; I12.router.go('map', {}); });
  await waitScreen('scr-battle', 25000);
  await winToReward();
  await page.click('#rwGo');
  await waitMap();
  check((await run()).alert === 50, '발각 전투를 이기면 경계도 50');

  console.log('17. 14 불을 끄는 값 — 쉬지 않고 출발(에다 대화는 15로)');
  await enterNode('s14');
  await waitScreen('scr-node');
  await sceneWait();
  await clearScene();
  await page.waitForSelector('.nd-opt');
  await page.waitForFunction(() => /습격받을 확률 \d+%/.test(document.querySelector('#ndText').textContent), null, { timeout: 8000 }).catch(() => {});   // 칸 화면 글은 타자로 찍힌다
  check(await page.evaluate(() => /습격받을 확률 \d+%/.test(document.querySelector('#ndText').textContent) && document.querySelectorAll('.nd-opt').length === 2 && /물품만 정리하고 출발/.test(document.querySelector('.nd-opts').textContent)), '14: 선택 전에 습격 확률 · 두 가지(쉰다 / 물품만 정리)');
  await page.click('.nd-opt:nth-child(2)');
  await page.waitForSelector('#ndLeave:not([hidden])');
  await page.click('#ndLeave');
  await sceneWait();
  await clearScene();
  await waitMap();
  R = await run();
  check(!R.flags.ev.eda_talk && R.goal === '신호교를 건너 외곽문으로 간다' && R.flags.ev.barnett_back, '14: 쉬지 않았으니 에다 대화는 아직 · 목표 갱신');

  console.log('18. 15 누구를 세는가 — 곡사포 기계 · 전투 뒤 에다 대화(못 봤으니 여기서 한 번)');
  await page.evaluate(() => { I12.RUN.alert = 0; });
  await enterNode('s15');
  await waitScreen('scr-node');
  await sceneWait();
  await clearScene();
  await waitScreen('scr-battle');
  await battleReady();
  check(await page.evaluate(() => I12.B.foes.map(f => f.type).sort().join() === 'mortar,watcher'), '15: 곡사포 기계 + 감시 시계');
  await page.evaluate(() => I12.core.debugWin());
  await sceneWait();
  let sawEda = false;
  for (let i = 0; i < 70 && await sceneOpen() && !sawEda; i++) { sawEda = await page.evaluate(() => /수프 다 드셨어요/.test(document.querySelector('#dtext').textContent)); await page.keyboard.press('Space'); await page.waitForTimeout(90); }
  check(sawEda, '15: 14에서 못 본 에다 대화가 여기서 나온다');
  await clearScene();
  await waitScreen('scr-reward');
  check((await run()).flags.ev.eda_talk, '15: 에다 대화는 이제 본 것으로');
  await page.click('#rwGo');
  await waitMap();

  console.log('19. 16 · 17 대형 감시기계 — 앞 대화(16) · 상태 한 줄 · 단계 대사(한 번만) · 쓰러지면 전투부터');
  const bossId = await enterNode('boss');
  await waitScreen('scr-battle');
  await sceneWait();
  check((await recurSnap()).pending === bossId, '보스: 들어가는 순간 재귀 지점');
  check(await stepUntil(() => /사망자 한 명/.test(document.querySelector('#dtext').textContent), 20), '보스 앞 16: 「외곽 이송. 환자와 동행자. 그리고 사망자 한 명.」');
  check(await stepUntil(() => !document.querySelector('#scSys').hidden && /격리 중/.test(document.querySelector('#scSys').textContent), 90), '16 끝: 외부 송신 격리 중 — 상태 한 줄');
  await clearScene();
  await battleReady();
  const lay = await page.evaluate(() => ({ rows: I12.B.rows, cells: document.querySelectorAll('#board .cell').length }));
  check(lay.rows === 7 && lay.cells === 42, '보스전: 보스 줄 + 6×6 (7줄)');
  await page.evaluate(() => { I12.core.debugHurtBoss(0.6); });
  await sceneWait();
  check(await stepUntil(() => /인류 보호 절차/.test(document.querySelector('#dtext').textContent), 30) && await page.evaluate(() => I12.B.phase === 1), '보스: 2단계 — 외장 손상 · 「인류 보호 절차」');
  await clearScene();
  await shot('09-boss');
  await battleReady();
  check(await page.evaluate(() => document.querySelector('#bossRow').dataset.dmg === '1'), '보스: 단계가 넘어가면 외장 손상 표시');
  await page.evaluate(() => I12.core.debugLose());
  await waitScreen('scr-rewind');
  await page.click('.rewind-bg');
  await waitScreen('scr-battle', 15000);
  await page.waitForTimeout(600);
  check(!(await sceneOpen()), '보스: 쓰러지면 앞 대화 없이 전투부터 (대본: 그 전투의 재시도)');
  await battleReady();
  await page.evaluate(() => { I12.core.debugHurtBoss(0.6); });
  await page.waitForTimeout(700);
  check(!(await sceneOpen()) && await page.evaluate(() => I12.B.phase === 1), '보스: 재도전에서 단계 대사는 다시 멈추지 않는다');
  await winToReward();
  check(await page.evaluate(() => document.querySelector('#rwGo').disabled), '보스 유물을 고르기 전에는 넘어갈 수 없다');
  await page.click('.rw-relic');
  await page.click('#rwGo');

  console.log('20. 18 외투 한 벌의 빚 → 조용한 장 끝 → 준비 중');
  await sceneWait();
  check(await stepUntil(() => document.querySelector('#dname').textContent === '알 수 없는 목소리' && /오지 마/.test(document.querySelector('#dtext').textContent), 140), '18: 「오지 마.」 — II의 목소리');
  await clearScene();
  await waitScreen('scr-chapterend');
  await page.waitForSelector('#ceGo');
  check(await page.evaluate(() => /다음 목적지 — II가 있는 시설/.test(document.querySelector('.ce').textContent) && !!document.querySelector('.ce.quiet .ce-dial .dn.on') && !!document.querySelector('.ce-dial .dn.pulse')), '장 끝: I만 점등 · II는 다음 목적지로만 · 조용한 끝');
  await shot('10-chapterend');
  await toTitleAndContinue();
  await waitScreen('scr-chapterend');
  await page.waitForSelector('#ceGo');
  check(!(await sceneOpen()), '장 끝 화면에서 새로고침 → 끝 장면은 다시 보지 않는다');
  await page.click('#ceGo');
  await page.waitForSelector('#ceTitle');
  check((await run()).chapter === 2, '2장(준비 중)으로 넘어간다');
  await page.click('#ceTitle');
  await waitScreen('scr-title');

  check(errs.length === 0, `자바스크립트 오류 없음${errs.length ? ' — ' + errs.join(' | ') : ''}`);
  await browser.close();
  if (srv) srv.close();
  console.log(fails.length ? `\n실패 ${fails.length}개` : '\n모두 통과');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('시험 중단:', e); process.exit(1); });
