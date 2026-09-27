// 타자기 — 글을 한 글자씩 찍어 낸다. 굵게 · 색 · 아이콘 같은 꾸밈(HTML)은 처음부터 그대로 두고 글자만 차례로
// 대사창 · 칸 화면 · 지도 칸 설명 · 튜토리얼 · 알림 · 전투 기록이 함께 쓴다
import { SET, TEXT_SPEED } from '../core/settings.js';
import { SFX } from './sfx.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAUSE = /[.!?…]/;
const COMMA = /[,·—]/;

// el 안에 html을 타자로 찍는다
// opt: { speed(ms/글자, 없으면 설정의 글자 속도 × mul), mul, sound: false | 'soft' | 'voice', who(목소리), cursor, onDone }
// 돌려주는 값: { finish() 바로 다 보이기, stop() 멈추기(그 자리에서), get typing }
export function typeInto(el, html, opt = {}) {
  const ctl = { typing: false, finish() {}, stop() {} };
  if (!el) return ctl;
  stopTyping(el);
  el.innerHTML = html;
  const base = TEXT_SPEED[SET.textSpeed];
  const speed = opt.speed != null ? opt.speed : (base ? Math.max(6, base * (opt.mul ?? 1)) : 0);
  if (!speed || reduced()) { if (opt.onDone) opt.onDone(); return ctl; }
  // 글자 조각 모으기 — 공백만 있는 조각은 그대로 둔다
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue) parts.push({ node: n, full: n.nodeValue });
  if (!parts.length) { if (opt.onDone) opt.onDone(); return ctl; }
  parts.forEach(p => { p.node.nodeValue = ''; });
  const cur = opt.cursor === false ? null : Object.assign(document.createElement('i'), { className: 'tw-cur' });
  let pi = 0, ci = 0, t = 0, lastSnd = 0;
  el.classList.add('tw-typing');
  const done = () => {
    clearTimeout(t);
    ctl.typing = false;
    if (cur) cur.remove();
    el.classList.remove('tw-typing');
    if (el._tw === ctl) el._tw = null;
  };
  ctl.finish = () => {
    if (!ctl.typing) return;
    parts.forEach(p => { p.node.nodeValue = p.full; });
    done();
    if (opt.onDone) opt.onDone();
  };
  ctl.stop = () => { if (ctl.typing) done(); };
  const tick = () => {
    if (!el.isConnected) { done(); return; }
    const p = parts[pi];
    const ch = p.full[ci];
    ci++;
    p.node.nodeValue = p.full.slice(0, ci);
    if (cur) p.node.after(cur);
    if (opt.sound && /\S/.test(ch)) {
      const now = performance.now();
      if (now - lastSnd > 34) { lastSnd = now; SFX.type(opt.sound === 'voice' ? opt.who : 'soft'); }
    }
    if (ci >= p.full.length) { pi++; ci = 0; }
    if (pi >= parts.length) { done(); if (opt.onDone) opt.onDone(); return; }
    t = setTimeout(tick, PAUSE.test(ch) ? speed * 6 : COMMA.test(ch) ? speed * 3 : speed);
  };
  ctl.typing = true;
  el._tw = ctl;
  tick();
  return ctl;
}

// 그 요소에서 찍고 있던 타자를 끝까지 바로 보여 준다 (있으면 true)
export function finishTyping(el) {
  if (el && el._tw && el._tw.typing) { el._tw.finish(); return true; }
  return false;
}
export function stopTyping(el) { if (el && el._tw) el._tw.stop(); }

// 한 화면 안의 여러 글을 차례로 (앞 글이 끝나면 다음 글)
export function typeSequence(items, opt = {}) {
  const ctls = [];
  let i = 0, stopped = false;
  const run = () => {
    if (stopped || i >= items.length) { if (!stopped && opt.onDone) opt.onDone(); return; }
    const [el, html] = items[i++];
    if (!el) { run(); return; }
    ctls.push(typeInto(el, html, Object.assign({}, opt, { onDone: run })));
  };
  // 아직 차례가 안 온 글은 비워 둔다 (자리만 잡고)
  items.forEach(([el]) => { if (el) el.innerHTML = ''; });
  run();
  return {
    finish() { stopped = true; ctls.forEach(c => c.finish()); for (; i < items.length; i++) { const [el, html] = items[i]; if (el) el.innerHTML = html; } if (opt.onDone) opt.onDone(); },
    stop() { stopped = true; ctls.forEach(c => c.stop()); },
  };
}
