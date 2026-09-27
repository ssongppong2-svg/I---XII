// 톱니 모양 SVG 경로 — 지도의 톱니 · 아이콘 · 장식이 같이 쓴다
// r = 맞물림 반지름(피치원), n = 톱니 수, depth = 톱니 높이
const f = v => Math.round(v * 100) / 100;

export function gearD(r, n, depth = Math.max(2.4, (Math.PI * 2 * r / n) * 0.62), holeR = 0) {
  const p = Math.PI * 2 / n, Ro = r + depth / 2, Rr = r - depth / 2;
  const pt = (R, a) => `${f(R * Math.cos(a))} ${f(R * Math.sin(a))}`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const c = i * p - Math.PI / 2;
    const seg = [pt(Rr, c - p * 0.5), pt(Rr, c - p * 0.25), pt(Ro, c - p * 0.13), pt(Ro, c + p * 0.13), pt(Rr, c + p * 0.25)];
    d += (i === 0 ? 'M' : 'L') + seg.join('L');
  }
  d += 'Z';
  if (holeR > 0) d += circleD(holeR);
  return d;
}

// 원 하나 (evenodd로 구멍을 낼 때)
export function circleD(R, cx = 0, cy = 0) {
  return `M${f(cx + R)} ${f(cy)}A${f(R)} ${f(R)} 0 1 0 ${f(cx - R)} ${f(cy)}A${f(R)} ${f(R)} 0 1 0 ${f(cx + R)} ${f(cy)}Z`;
}

// 톱니 조각 (부서진 톱니 쐐기) — 아이콘용
export function gearShardD(r = 9, n = 12) {
  const depth = 3.2, p = Math.PI * 2 / n, Ro = r + depth / 2, Rr = r - depth / 2;
  const P = (R, a) => `${f(12 + R * Math.cos(a))} ${f(20 + R * Math.sin(a))}`;
  const a0 = -Math.PI * 0.86, a1 = -Math.PI * 0.14;
  let d = `M12 20L${P(Rr, a0)}`;
  for (let c = a0 + p * 0.5; c < a1 - p * 0.3; c += p) {
    d += `L${P(Rr, c - p * 0.25)}L${P(Ro, c - p * 0.13)}L${P(Ro, c + p * 0.13)}L${P(Rr, c + p * 0.25)}`;
  }
  d += `L${P(Rr, a1)}L${f(12 + 3 * Math.cos(a1))} ${f(20 + 3 * Math.sin(a1))}L13.4 17.2L10.6 17.6Z`;
  return d;
}
