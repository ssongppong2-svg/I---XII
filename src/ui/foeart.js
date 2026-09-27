// 적 임시 그림 — assets에 그림(art-sd · art)이 오기 전까지 격자 · 목록 · 대사 초상화에 쓴다
import { art } from './assets.js';
import { FOES } from '../data/foes.js';

const SVG = {
  // 기계 — 1 · 2장
  watcher: `<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="18" ry="4" fill="#000" opacity=".45"/>
    <path d="M22 52 L8 40 L10 58Z M78 52 L92 40 L90 58Z" fill="#5E5448" stroke="#B89A62" stroke-width="1.5"/>
    <circle cx="50" cy="54" r="27" fill="#2B2620" stroke="#B89A62" stroke-width="2.5"/>
    <circle cx="50" cy="54" r="17" fill="#120E0C" stroke="#6E5A3A" stroke-width="2"/>
    <circle cx="50" cy="54" r="10" fill="#FF3B4E"/><circle cx="50" cy="54" r="4" fill="#FFE3E8"/>
    <path d="M50 81 V96 M42 92 H58" stroke="#8C7448" stroke-width="3" stroke-linecap="round"/>
    <path d="M36 30 L50 20 L64 30" fill="none" stroke="#B89A62" stroke-width="2"/></svg>`,
  hound: `<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="34" ry="5" fill="#000" opacity=".5"/>
    <path d="M18 70 C22 56 40 52 60 56 L74 50 L86 58 L84 70 L70 74 L66 90 L60 110 L54 110 L56 90 L36 90 L32 110 L26 110 L28 88 C20 84 16 78 18 70Z" fill="#3A3028" stroke="#C0955A" stroke-width="2"/>
    <circle cx="78" cy="60" r="3.2" fill="#FF5C6E"/>
    <path d="M76 70 L88 72 L80 76Z" fill="#E8D6A8"/>
    <circle cx="44" cy="72" r="9" fill="none" stroke="#C0955A" stroke-width="2.4" stroke-dasharray="3 2.4"/>
    <path d="M18 70 L6 60" stroke="#C0955A" stroke-width="3" stroke-linecap="round"/></svg>`,
  warden: `<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="32" ry="5" fill="#000" opacity=".5"/>
    <rect x="26" y="34" width="44" height="60" rx="6" fill="#2E2A26" stroke="#B8903E" stroke-width="2"/>
    <rect x="34" y="20" width="28" height="18" rx="4" fill="#3A342C" stroke="#B8903E" stroke-width="2"/>
    <rect x="40" y="26" width="16" height="5" rx="2" fill="#FF6A55"/>
    <path d="M62 44 H92 V96 L77 108 L62 96Z" fill="#45403A" stroke="#D6AE62" stroke-width="2.5"/>
    <circle cx="77" cy="72" r="9" fill="none" stroke="#D6AE62" stroke-width="3"/>
    <path d="M32 94 V110 M58 94 V110" stroke="#6E5A3A" stroke-width="7" stroke-linecap="round"/></svg>`,
  beetle: `<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="30" ry="5" fill="#000" opacity=".5"/>
    <path d="M24 100 L14 110 M34 104 L28 114 M76 100 L86 110 M66 104 L72 114" stroke="#8C6A3A" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="50" cy="80" rx="32" ry="26" fill="#6E1A1A" stroke="#D0784A" stroke-width="2.5"/>
    <path d="M50 54 V106" stroke="#2A0A0A" stroke-width="3"/>
    <circle cx="50" cy="48" r="12" fill="#2E2622" stroke="#D0784A" stroke-width="2"/>
    <circle cx="45" cy="47" r="2.6" fill="#FFB84A"/><circle cx="55" cy="47" r="2.6" fill="#FFB84A"/>
    <path d="M50 36 C52 26 60 24 64 18" fill="none" stroke="#E8D6A8" stroke-width="2"/><circle cx="65" cy="17" r="3" fill="#FFB84A"/></svg>`,
  gatekeeper: `<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="40" ry="6" fill="#000" opacity=".55"/>
    <rect x="18" y="26" width="56" height="72" rx="8" fill="#26221F" stroke="#C9A45E" stroke-width="2.5"/>
    <rect x="28" y="8" width="36" height="22" rx="5" fill="#35302A" stroke="#C9A45E" stroke-width="2.5"/>
    <rect x="34" y="15" width="24" height="7" rx="3" fill="#FF3B4E"/>
    <path d="M68 30 H98 V100 L83 116 L68 100Z" fill="#3E3934" stroke="#F2D38F" stroke-width="3"/>
    <circle cx="83" cy="66" r="12" fill="none" stroke="#F2D38F" stroke-width="3.5" stroke-dasharray="4 3"/>
    <path d="M24 98 V114 M62 98 V114" stroke="#6E5A3A" stroke-width="9" stroke-linecap="round"/></svg>`,
  alpha: `<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="40" ry="6" fill="#000" opacity=".55"/>
    <path d="M10 66 C14 48 36 42 60 48 L76 38 L92 48 L90 64 L74 70 L70 90 L64 112 L56 112 L58 90 L34 90 L30 112 L22 112 L24 86 C12 82 8 76 10 66Z" fill="#2E2520" stroke="#E0A060" stroke-width="2.4"/>
    <circle cx="84" cy="50" r="4" fill="#FF3B4E"/>
    <path d="M82 62 L96 64 L86 70Z" fill="#E8D6A8"/>
    <path d="M40 46 L44 30 L50 44 L56 28 L60 46" fill="#E0A060"/>
    <circle cx="40" cy="68" r="11" fill="none" stroke="#E0A060" stroke-width="2.6" stroke-dasharray="3.4 2.6"/>
    <rect x="56" y="58" width="12" height="7" rx="1.5" fill="#B8C4CF" stroke="#2A2F36"/></svg>`,
  // 인간 — 3장부터 (그림이 있으면 그림을 쓴다)
  rifle: '<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="26" ry="5" fill="#000" opacity=".5"/><path d="M30 112 C32 80 38 64 50 62 C62 64 68 80 70 112Z" fill="#2B2328" stroke="#C9A45E" stroke-width="2"/><rect x="30" y="22" width="40" height="40" rx="14" fill="#1E1A20" stroke="#C9A45E" stroke-width="2"/><circle cx="50" cy="42" r="11" fill="#E8D6A8"/><path d="M50 34v8l6 4" stroke="#2B2328" stroke-width="2" fill="none"/><rect x="24" y="14" width="52" height="10" rx="3" fill="#2B2328" stroke="#C9A45E" stroke-width="2"/><path d="M36 84 H96" stroke="#6B4A2E" stroke-width="5" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="30" ry="5" fill="#000" opacity=".5"/><path d="M26 112 C28 78 36 62 48 60 C60 62 66 78 68 112Z" fill="#2A2A2E" stroke="#B8903E" stroke-width="2"/><rect x="30" y="22" width="36" height="38" rx="12" fill="#2E2E33" stroke="#B8903E" stroke-width="2"/><path d="M36 38h24M36 44h24" stroke="#0E0E10" stroke-width="3"/><path d="M60 50 H94 V100 L77 112 L60 100Z" fill="#35353B" stroke="#D6AE62" stroke-width="2.5"/><circle cx="77" cy="78" r="9" fill="none" stroke="#D6AE62" stroke-width="3"/></svg>',
  bomb: '<svg viewBox="0 0 100 120"><ellipse cx="50" cy="114" rx="30" ry="5" fill="#000" opacity=".5"/><rect x="54" y="30" width="18" height="46" rx="6" fill="#9A2A2A" stroke="#5A1414" stroke-width="2"/><rect x="72" y="36" width="16" height="40" rx="6" fill="#B03030" stroke="#5A1414" stroke-width="2"/><path d="M24 112 C26 80 34 64 46 62 C58 64 64 80 66 112Z" fill="#3A2C26" stroke="#A8845A" stroke-width="2"/><rect x="24" y="24" width="36" height="36" rx="6" fill="#2E2622" stroke="#A8845A" stroke-width="2"/><path d="M42 32v14M35 39h14" stroke="#E8DCC8" stroke-width="3"/><rect x="10" y="74" width="12" height="10" rx="2" fill="#B03030"/></svg>',
};

// 격자 위 SD: art-sd 그림 → 없으면 임시 그림
export function foeSdHTML(type) {
  const D = FOES[type];
  const u = D && (art(D.art + '-sd') || null);
  return u ? `<img src="${u}" alt="" draggable="false">` : (SVG[type] || SVG.watcher);
}
// 대사 초상화 · 도감: 스탠딩(art) → SD → 임시 그림
export function foeArtHTML(type) {
  const D = FOES[type];
  const u = D && (art(D.art) || art(D.art + '-sd'));
  return u ? `<img src="${u}" alt="" draggable="false">` : (SVG[type] || SVG.watcher);
}
export const foeArtKeys = types => types.flatMap(t => FOES[t] ? [FOES[t].art, FOES[t].art + '-sd'] : []);
