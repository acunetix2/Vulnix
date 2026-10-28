"use client";

import { useCallback, useEffect, useId, useMemo, useRef } from "react";

/**
 * VulnixLegalGraphicBanner
 *
 * Isometric neon-purple cube skyline with:
 *  - true 30° geometry (the top face keeps its shape; only vertical edges grow)
 *  - three depth rows (far / mid / near) with fog, blur and mouse parallax
 *  - layered-sine height motion (less mechanical than a single eased loop)
 *  - windows anchored to the base that light up as a cube rises, with flicker
 *  - mirrored floor reflection (a <use> clone, so it follows the animation free)
 *  - ambient occlusion + light pooling on the floor, pulsing with cube height
 *  - perspective floor grid, rim lighting, hero bloom, rising particles, scanlines
 *
 * One requestAnimationFrame loop drives everything, pauses off-screen,
 * and renders a still frame when the user prefers reduced motion.
 */

/* ───────────────────────── helpers ───────────────────────── */

const TAN30 = Math.tan(Math.PI / 6);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const pts = (...p) => p.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(" ");

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Face polygons for an isometric cube whose front-bottom corner is (cx, base). */
function cubePoints(cx, base, hw, h) {
  const dh = hw * TAN30;
  const fb = [cx, base];
  const lb = [cx - hw, base - dh];
  const rb = [cx + hw, base - dh];
  const ft = [cx, base - h];
  const lt = [cx - hw, base - dh - h];
  const rt = [cx + hw, base - dh - h];
  const bt = [cx, base - 2 * dh - h];
  return {
    top: pts(lt, bt, rt, ft),
    left: pts(lt, ft, fb, lb),
    right: pts(ft, rt, rb, fb),
    rim: pts(lt, ft, rt),
  };
}

/** Two layered sines → organic 0..1 height curve. */
function height01(t, period) {
  const a = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period);
  const b = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / (period * 0.37) + 1.3);
  return 0.8 * a + 0.2 * b;
}

/* ───────────────────────── scene data ───────────────────────── */

// Far rows sit higher on screen, are dimmer, softer and move less with the mouse.
const ROWS = [
  { amp: 2.5, opacity: 0.55, blur: 0.8, glowK: 0.25 }, // far
  { amp: 6, opacity: 0.9, blur: 0, glowK: 0.5 }, // mid
  { amp: 10, opacity: 1, blur: 0, glowK: 0.6 }, // near
];

const CUBES = [
  // far row
  { id: "f1", row: 0, cx: 60, base: 118, hw: 22, minH: 14, maxH: 24, period: 3.9, delay: 0.4 },
  { id: "f2", row: 0, cx: 300, base: 119, hw: 24, minH: 18, maxH: 30, period: 3.6, delay: 2.0 },
  { id: "f3", row: 0, cx: 456, base: 117, hw: 26, minH: 22, maxH: 36, period: 4.6, delay: 1.8 },
  { id: "f4", row: 0, cx: 548, base: 117, hw: 18, minH: 14, maxH: 24, period: 3.3, delay: 0.2 },
  { id: "f5", row: 0, cx: 930, base: 119, hw: 26, minH: 16, maxH: 28, period: 3.5, delay: 3.2 },
  // mid row
  { id: "m1", row: 1, cx: 108, base: 125, hw: 33, minH: 24, maxH: 40, period: 3.8, delay: 0.7, accent: true },
  { id: "m2", row: 1, cx: 230, base: 125, hw: 35, minH: 40, maxH: 58, period: 4.4, delay: 1.4, windows: true, seed: 11 },
  { id: "m3", row: 1, cx: 772, base: 125, hw: 37, minH: 40, maxH: 60, period: 4.2, delay: 1.5, windows: true, seed: 23 },
  // near row
  { id: "n1", row: 2, cx: 168, base: 130, hw: 38, minH: 30, maxH: 46, period: 4.2, delay: 0 },
  { id: "n2", row: 2, cx: 290, base: 130, hw: 26, minH: 18, maxH: 30, period: 3.6, delay: 2.1 },
  { id: "n3", row: 2, cx: 644, base: 130, hw: 46, minH: 46, maxH: 64, period: 4.0, delay: 0.9, hero: true },
  { id: "n4", row: 2, cx: 852, base: 130, hw: 44, minH: 26, maxH: 42, period: 3.9, delay: 2.6, windows: true, seed: 37 },
];

const ROW_H = 11;
const WIN_H = 6;
const RIGHT_COLORS = ["#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7"];
const LEFT_COLORS = ["#a855f7", "#9333ea", "#7e22ce"];

function makeWindows(cfg) {
  const rng = mulberry32(cfg.seed || 1);
  const pad = 5;
  const gap = 3;
  const cols = Math.max(2, Math.floor((cfg.hw - 4) / 10));
  const winW = (cfg.hw - 2 * pad - (cols - 1) * gap) / cols;
  const rows = Math.floor(cfg.maxH / ROW_H);
  const out = [];
  for (const side of ["l", "r"]) {
    const palette = side === "r" ? RIGHT_COLORS : LEFT_COLORS;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = side === "r" ? pad : -cfg.hw + pad;
        out.push({
          side,
          x: x0 + c * (winW + gap),
          y: -(r + 1) * ROW_H + (ROW_H - WIN_H) / 2,
          w: winW,
          top: (r + 1) * ROW_H,
          thr: -0.6 + rng() * 1.4, // high threshold = mostly dark window
          speed: 0.35 + rng() * 1.1,
          phase: rng() * Math.PI * 2,
          fill: palette[Math.floor(rng() * palette.length)],
        });
      }
    }
  }
  return out;
}

/* ───────────────────────── cube ───────────────────────── */

// Vulnix "V" mark, traced from the brand logo (914 × 914 space, disc centred at 457,457).
const LOGO = {
  arm: "M127 214 H243 Q272 214 289 240 L530 578 L486 738 Q470 742 452 740 Q436 736 424 720 L146 370 Q127 348 127 326 Z",
  light: "M453 398 L578 242 Q602 215 632 215 H778 Q792 215 786 228 L546 532 Q541 538 536 531 L453 412 Q447 404 453 398 Z",
  facet: "M788 228 V392 Q788 426 758 454 L506 722 Q494 736 486 738 L530 578 L542 536 Z",
};
const DISC_DEPTH = 55; // how far the coin is raised off the cube face (logo units)
const V_DEPTH = 85; // how far the V is raised off the coin
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerpColor = (a, b, t) => {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};
// Extrusion offset toward the viewer, expressed in the right face's skewed frame.
const extrude = (d) => `translate(${(d * 0.866).toFixed(1)} ${d.toFixed(1)})`;

/** Static 3D mark: a raised coin with the V extruded on top. Drawn once, never re-rendered per frame. */
function LogoMark({ ids }) {
  const discSteps = 6;
  const vSteps = 8;
  return (
    <g>
      {/* coin edge */}
      {Array.from({ length: discSteps }, (_, i) => (
        <circle
          key={`d${i}`}
          cx="457"
          cy="457"
          r="457"
          transform={extrude((DISC_DEPTH * i) / discSteps)}
          fill={lerpColor("#14072e", "#3b1b86", i / discSteps)}
        />
      ))}
      {/* coin face + neon bezel */}
      <circle cx="457" cy="457" r="457" transform={extrude(DISC_DEPTH)} fill="#090912" />
      <circle
        cx="457"
        cy="457"
        r="448"
        transform={extrude(DISC_DEPTH)}
        fill="none"
        stroke="#c084fc"
        strokeOpacity="0.55"
        strokeWidth="10"
      />
      {/* V side walls */}
      {Array.from({ length: vSteps }, (_, k) => (
        <use
          key={`v${k}`}
          href={`#${ids.logoShape}`}
          fill={lerpColor("#1a0a4a", "#3a1c96", k / vSteps)}
          transform={extrude(DISC_DEPTH + (V_DEPTH * k) / vSteps)}
        />
      ))}
      {/* V front cap, with the logo's three facets */}
      <g
        transform={extrude(DISC_DEPTH + V_DEPTH)}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="5"
        strokeLinejoin="round"
      >
        <path d={LOGO.arm} fill={`url(#${ids.logoArm})`} />
        <path d={LOGO.facet} fill={`url(#${ids.logoFacet})`} />
        <path d={LOGO.light} fill={`url(#${ids.logoLight})`} />
      </g>
    </g>
  );
}

function IsoCube({ cfg, ids, register }) {
  const { cx, base, hw, minH, maxH, period, delay, hero, accent } = cfg;
  const topRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const rimRef = useRef(null);
  const bloomRef = useRef(null);
  const emblemRef = useRef(null);
  const winEls = useRef([]);

  const wins = useMemo(() => (cfg.windows ? makeWindows(cfg) : []), [cfg]);
  const initial = useMemo(
    () => cubePoints(cx, base, hw, (minH + maxH) / 2),
    [cx, base, hw, minH, maxH]
  );

  useEffect(() => {
    const emblemScale = (hw * 0.72) / 914;

    const update = (t, still) => {
      const e = still ? 0.5 : height01(t - delay, period);
      const h = minH + (maxH - minH) * e;
      const p = cubePoints(cx, base, hw, h);

      topRef.current?.setAttribute("points", p.top);
      leftRef.current?.setAttribute("points", p.left);
      rightRef.current?.setAttribute("points", p.right);
      rimRef.current?.setAttribute("points", p.rim);
      bloomRef.current?.setAttribute("points", p.right);

      // Windows are anchored to the base: rows appear as the cube rises.
      for (let i = 0; i < wins.length; i++) {
        const el = winEls.current[i];
        if (!el) continue;
        const w = wins[i];
        const fade = clamp((h - w.top + 2) / 4, 0, 1);
        const v = still ? 1 : Math.sin(t * w.speed + w.phase);
        const f = still ? 0.8 : smoothstep(w.thr - 0.1, w.thr + 0.1, v);
        el.setAttribute("opacity", (fade * (0.15 + 0.85 * f)).toFixed(3));
      }

      if (hero && emblemRef.current) {
        const s = emblemScale;
        emblemRef.current.setAttribute(
          "transform",
          `translate(${(hw * 0.46 - 457 * s).toFixed(2)} ${(-h / 2 - 1.5 - 457 * s).toFixed(2)}) scale(${s.toFixed(5)})`
        );
      }
      return e;
    };

    return register(cfg.id, update);
  }, [cfg, cx, base, hw, minH, maxH, period, delay, hero, wins, register]);

  const topFill = hero ? ids.heroTop : ids.cubeTop;
  const leftFill = hero ? ids.heroLeft : ids.cubeLeft;
  const rightFill = hero || accent ? ids.heroRight : ids.cubeRight;
  const edge = { stroke: "rgba(255,255,255,0.3)", strokeWidth: 0.6, strokeLinejoin: "round" };

  return (
    <g>
      {hero && (
        <polygon
          ref={bloomRef}
          className="vlgb-bloom"
          points={initial.right}
          fill="#a855f7"
          filter={`url(#${ids.bloomBlur})`}
          style={{ mixBlendMode: "screen" }}
        />
      )}

      <polygon ref={leftRef} points={initial.left} fill={`url(#${leftFill})`} {...edge} />
      <polygon ref={rightRef} points={initial.right} fill={`url(#${rightFill})`} {...edge} />

      {wins.length > 0 && (
        <>
          <g transform={`translate(${cx} ${base}) skewY(30)`}>
            {wins.map((w, i) =>
              w.side === "l" ? (
                <rect
                  key={i}
                  ref={(el) => (winEls.current[i] = el)}
                  x={w.x}
                  y={w.y}
                  width={w.w}
                  height={WIN_H}
                  fill={w.fill}
                  opacity={0}
                />
              ) : null
            )}
          </g>
          <g transform={`translate(${cx} ${base}) skewY(-30)`}>
            {wins.map((w, i) =>
              w.side === "r" ? (
                <rect
                  key={i}
                  ref={(el) => (winEls.current[i] = el)}
                  x={w.x}
                  y={w.y}
                  width={w.w}
                  height={WIN_H}
                  fill={w.fill}
                  opacity={0}
                />
              ) : null
            )}
          </g>
        </>
      )}

      {hero && (
        <g transform={`translate(${cx} ${base}) skewY(-30)`}>
          <g ref={emblemRef}>
            <g className="vlgb-emblem">
              <LogoMark ids={ids} />
            </g>
          </g>
        </g>
      )}

      <polygon ref={topRef} points={initial.top} fill={`url(#${topFill})`} {...edge} />
      {/* rim light on the top edges */}
      <polyline
        ref={rimRef}
        points={initial.rim}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={hero ? 0.9 : 0.65}
        strokeWidth={hero ? 1.1 : 0.9}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  );
}

/* ───────────────────────── banner ───────────────────────── */

export function VulnixLegalGraphicBanner() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = useMemo(() => {
    const n = (s) => `${uid}-${s}`;
    return {
      city: n("city"),
      haze: n("haze"),
      cubeTop: n("cubeTop"),
      cubeLeft: n("cubeLeft"),
      cubeRight: n("cubeRight"),
      heroTop: n("heroTop"),
      heroLeft: n("heroLeft"),
      heroRight: n("heroRight"),
      floorGlow: n("floorGlow"),
      ao: n("ao"),
      lineGlow: n("lineGlow"),
      bloomBlur: n("bloomBlur"),
      logoShape: n("logoShape"),
      logoArm: n("logoArm"),
      logoLight: n("logoLight"),
      logoFacet: n("logoFacet"),
      reflFade: n("reflFade"),
      reflMask: n("reflMask"),
      gridFade: n("gridFade"),
      gridMask: n("gridMask"),
    };
  }, [uid]);

  const rootRef = useRef(null);
  const registry = useRef(new Map());
  const rowCity = useRef([]);
  const rowGround = useRef([]);
  const glowEls = useRef({});
  const target = useRef(0);
  const px = useRef(0);

  const register = useCallback((id, update) => {
    registry.current.set(id, update);
    return () => registry.current.delete(id);
  }, []);

  // Seeded, so SSR and client agree.
  const particles = useMemo(() => {
    const rng = mulberry32(7);
    return Array.from({ length: 10 }, () => ({
      x: 60 + rng() * 880,
      r: 0.8 + rng() * 1,
      dur: 6 + rng() * 6,
      delay: -rng() * 10,
    }));
  }, []);

  const gridLines = useMemo(() => {
    const fan = [];
    for (let k = -10; k <= 10; k++) fan.push({ x1: 500, x2: 500 + k * 120 });
    const cross = [];
    for (let i = 1; i <= 6; i++) cross.push(130 + 60 * Math.pow(i / 6, 2));
    return { fan, cross };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const drawFrame = (t, still) => {
      px.current += (target.current - px.current) * (still ? 1 : 0.06);
      ROWS.forEach((row, i) => {
        const tr = `translate(${(px.current * row.amp).toFixed(2)} 0)`;
        rowCity.current[i]?.setAttribute("transform", tr);
        rowGround.current[i]?.setAttribute("transform", tr);
      });
      registry.current.forEach((update, id) => {
        const e = update(t, still);
        const cfg = CUBES.find((c) => c.id === id);
        const g = glowEls.current[id];
        if (g && cfg) {
          const k = cfg.hero ? 1 : ROWS[cfg.row].glowK;
          g.setAttribute("opacity", (k * (0.2 + 0.65 * e)).toFixed(3));
        }
      });
    };

    if (reduce) {
      drawFrame(0, true);
      return;
    }

    const t0 = performance.now();
    let raf = 0;
    let running = false;
    const loop = (now) => {
      drawFrame((now - t0) / 1000, false);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    if (rootRef.current) io.observe(rootRef.current);
    start();
    return () => {
      io.disconnect();
      stop();
    };
  }, []);

  const onPointerMove = (e) => {
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    target.current = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
  };
  const onPointerLeave = () => {
    target.current = 0;
  };

  return (
    <div
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative w-full overflow-hidden pt-4 pb-0 select-none group max-h-36"
    >
      {/* Ambient purple background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-32 bg-purple-600/15 blur-3xl pointer-events-none opacity-80 transition-opacity duration-700 group-hover:opacity-100" />

      {/* Faint scanlines, fading out toward the top */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(168,85,247,0.05) 0px, rgba(168,85,247,0.05) 1px, transparent 1px, transparent 3px)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent 85%)",
          maskImage: "linear-gradient(to top, black, transparent 85%)",
        }}
      />

      <div className="relative w-full max-w-3xl mx-auto flex justify-center">
        <svg
          viewBox="0 0 1000 190"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto max-h-28 text-purple-500 overflow-visible"
          preserveAspectRatio="xMidYMax meet"
          role="img"
          aria-label="Animated isometric skyline of glowing purple cubes"
        >
          <style>{`
            @keyframes vlgb-emblem { 0%,100% { opacity: .88 } 50% { opacity: 1 } }
            @keyframes vlgb-bloom { 0%,100% { opacity: .35 } 50% { opacity: .85 } }
            @keyframes vlgb-horizon { 0%,100% { opacity: .8 } 50% { opacity: 1 } }
            @keyframes vlgb-rise {
              0%   { transform: translate(0, 0); opacity: 0 }
              15%  { opacity: .8 }
              100% { transform: translate(6px, -90px); opacity: 0 }
            }
            .vlgb-emblem { animation: vlgb-emblem 4s ease-in-out infinite .9s }
            .vlgb-bloom { animation: vlgb-bloom 4s ease-in-out infinite .9s }
            .vlgb-horizon { animation: vlgb-horizon 4s ease-in-out infinite }
            .vlgb-particle { animation-name: vlgb-rise; animation-iteration-count: infinite; animation-timing-function: ease-out; opacity: 0 }
            @media (prefers-reduced-motion: reduce) {
              .vlgb-emblem, .vlgb-bloom, .vlgb-horizon { animation: none }
              .vlgb-particle { animation: none; opacity: 0 }
            }
          `}</style>

          <defs>
            {/* depth-of-field for distant rows */}
            <filter id={ids.haze} x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur stdDeviation="0.8" />
            </filter>

            {/* soft contact shadow */}
            <filter id={ids.ao} x="-30%" y="-100%" width="160%" height="300%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>

            {/* static neon line glow */}
            <filter id={ids.lineGlow} x="-10%" y="-100%" width="120%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* bloom for the hero face (opacity is pulsed, the filter never changes) */}
            <filter id={ids.bloomBlur} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="8" />
            </filter>

            {/* logo facets */}
            <linearGradient id={ids.logoArm} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5b35ec" />
              <stop offset="100%" stopColor="#4a22c8" />
            </linearGradient>
            <linearGradient id={ids.logoLight} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#b794ff" />
              <stop offset="100%" stopColor="#9c63fb" />
            </linearGradient>
            <linearGradient id={ids.logoFacet} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6238d6" />
              <stop offset="100%" stopColor="#4b25b3" />
            </linearGradient>
            <g id={ids.logoShape}>
              <path d={LOGO.arm} />
              <path d={LOGO.facet} />
              <path d={LOGO.light} />
            </g>

            {/* face gradients */}
            <linearGradient id={ids.cubeTop} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f3e8ff" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id={ids.cubeLeft} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6b21a8" />
              <stop offset="100%" stopColor="#4c1d95" />
            </linearGradient>
            <linearGradient id={ids.cubeRight} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9333ea" />
              <stop offset="100%" stopColor="#581c87" />
            </linearGradient>
            <linearGradient id={ids.heroTop} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f3e8ff" />
              <stop offset="100%" stopColor="#d8b4fe" />
            </linearGradient>
            <linearGradient id={ids.heroLeft} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7e22ce" />
              <stop offset="100%" stopColor="#581c87" />
            </linearGradient>
            <linearGradient id={ids.heroRight} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="40%" stopColor="#9333ea" />
              <stop offset="100%" stopColor="#6b21a8" />
            </linearGradient>

            {/* light pooling on the floor */}
            <radialGradient id={ids.floorGlow}>
              <stop offset="0" stopColor="#a855f7" stopOpacity="0.7" />
              <stop offset="1" stopColor="#a855f7" stopOpacity="0" />
            </radialGradient>

            {/* reflection fade + mask */}
            <linearGradient id={ids.reflFade} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={ids.reflMask} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="190">
              <rect x="0" y="130" width="1000" height="60" fill={`url(#${ids.reflFade})`} />
            </mask>

            {/* floor grid fade + mask */}
            <linearGradient id={ids.gridFade} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={ids.gridMask} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="190">
              <rect x="0" y="130" width="1000" height="60" fill={`url(#${ids.gridFade})`} />
            </mask>
          </defs>

          {/* ═══ FLOOR GRID ═══ */}
          <g mask={`url(#${ids.gridMask})`} stroke="#a855f7" strokeOpacity="0.28" strokeWidth="0.5">
            {gridLines.fan.map((l, i) => (
              <line key={`f${i}`} x1={l.x1} y1={130} x2={l.x2} y2={190} />
            ))}
            {gridLines.cross.map((y, i) => (
              <line key={`c${i}`} x1={0} y1={y} x2={1000} y2={y} />
            ))}
          </g>

          {/* ═══ GROUND: ambient occlusion + pooled light, per row ═══ */}
          {ROWS.map((_, ri) => (
            <g key={`g${ri}`} ref={(el) => (rowGround.current[ri] = el)}>
              {CUBES.filter((c) => c.row === ri).map((c) => {
                const dh = c.hw * TAN30;
                return (
                  <g key={c.id}>
                    <ellipse
                      ref={(el) => (glowEls.current[c.id] = el)}
                      cx={c.cx}
                      cy={c.base - dh * 0.4}
                      rx={c.hw * (c.hero ? 3.4 : 2)}
                      ry={dh * (c.hero ? 2.4 : 1.7)}
                      fill={`url(#${ids.floorGlow})`}
                      opacity={0}
                    />
                    <ellipse
                      cx={c.cx}
                      cy={c.base - dh}
                      rx={c.hw * 1.12}
                      ry={dh * 1.15}
                      fill="#12031f"
                      opacity={0.55}
                      filter={`url(#${ids.ao})`}
                    />
                  </g>
                );
              })}
            </g>
          ))}

          {/* ═══ REFLECTION (live clone of the skyline, flipped around y=130) ═══ */}
          <g mask={`url(#${ids.reflMask})`} opacity="0.45" filter={`url(#${ids.haze})`}>
            <use href={`#${ids.city}`} transform="translate(0 260) scale(1 -1)" />
          </g>

          {/* ═══ SKYLINE, back to front ═══ */}
          <g id={ids.city}>
            {ROWS.map((row, ri) => (
              <g
                key={`r${ri}`}
                ref={(el) => (rowCity.current[ri] = el)}
                opacity={row.opacity}
                filter={row.blur ? `url(#${ids.haze})` : undefined}
              >
                {CUBES.filter((c) => c.row === ri).map((c) => (
                  <IsoCube key={c.id} cfg={c} ids={ids} register={register} />
                ))}
              </g>
            ))}
          </g>

          {/* ═══ PARTICLES ═══ */}
          <g fill="#e9d5ff">
            {particles.map((p, i) => (
              <circle
                key={i}
                className="vlgb-particle"
                cx={p.x}
                cy={126}
                r={p.r}
                style={{ animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
              />
            ))}
          </g>

          {/* ═══ NEON HORIZON BASELINE ═══ */}
          <line x1="0" y1="130" x2="1000" y2="130" stroke="#3b0764" strokeWidth="3" />
          <line
            x1="0"
            y1="130"
            x2="1000"
            y2="130"
            stroke="#a855f7"
            strokeWidth="1.75"
            filter={`url(#${ids.lineGlow})`}
            className="vlgb-horizon"
          />
          <line x1="120" y1="130" x2="880" y2="130" stroke="#e9d5ff" strokeWidth="1" strokeOpacity="0.85" />
        </svg>
      </div>
    </div>
  );
}