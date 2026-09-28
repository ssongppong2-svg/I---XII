// 판을 넘어 남는 기록 — 예전 판에서 겪은 사건 (새 판의 지도에는 덜 본 사건부터 나온다)
import { read, write } from '../core/store.js';

const KEY = 'profile.v1';
function profile() {
  const p = read(KEY) || {};
  p.events = p.events || {};
  return p;
}
export const seenEvents = () => profile().events;
export function markEventSeen(id) {
  const p = profile();
  p.events[id] = (p.events[id] || 0) + 1;
  write(KEY, p);
}
