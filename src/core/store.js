// 브라우저 저장소 — 막힌 환경(비공개 창 등)에서도 게임은 계속 돌아가야 한다
const NS = 'i12.';
const memory = new Map();   // 저장소가 막혔을 때 이번 세션 동안만 기억

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw === null) return memory.has(key) ? memory.get(key) : fallback;
    return JSON.parse(raw);
  } catch (e) {
    return memory.has(key) ? memory.get(key) : fallback;
  }
}

export function write(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

export function remove(key) {
  memory.delete(key);
  try { localStorage.removeItem(NS + key); } catch (e) { /* 무시 */ }
}
