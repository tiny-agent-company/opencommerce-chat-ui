"use client";

import { useEffect, useRef } from "react";
import { fbm, hash, smooth } from "@/lib/noise";

// Ported from opencommerce-agentcard-web/src/components/binary-stage.tsx.
/* Cell size of the character lattice, and the digits' size, in CSS px. */
const CW = 9;
const CH = 13;
const FONT_PX = 11;

type Glyph = { x: number; y: number; alpha: number; blue: boolean; star: boolean };

/* How the field fades across its box, as an ellipse on the box's own
   proportions: "out" is solid in the middle and gone at the edges (behind
   the hero's card); "in" is clear in the middle and gathers at the edges
   (round the CTA's copy). Baked into each glyph's alpha rather than laid on
   as a CSS mask: a mask over a canvas that redraws makes the browser
   recomposite the whole masked layer on every flicker, and on a big card
   that held up painting the copy on top of it. */
type Fade = "out" | "in";

function fadeAt(fade: Fade, nx: number, ny: number) {
  if (fade === "out") {
    const d = Math.hypot(nx, ny);
    return 1 - smooth(Math.min(1, Math.max(0, (d - 0.68) / 0.32)));
  }
  const d = Math.hypot(nx / 1.44, ny / 1.7);
  return Math.min(1, Math.max(0, (d - 0.48) / 0.52));
}

/* ── THE BINARY STAGE ────────────────────────────────────────────────────────
   A faint field of *s and @s — Agentcard's mark and the address sign —
   whose density follows a noise map, so it reads as solid clumps that break
   up into scattered glyphs at their coasts and open ground between: mostly
   faint ink, with a few runs inside the clumps in Agentcard blue. A few
   glyphs flip now and then while it's on screen; under reduced motion the
   field is still. */
export function BinaryStage({ seed = 3, fade = "out", className }: { seed?: number; fade?: Fade; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const root = getComputedStyle(document.documentElement);
    const ink = root.getPropertyValue("--palette-ink").trim();
    const blue = root.getPropertyValue("--palette-blue").trim();
    const mono = root.getPropertyValue("--font-code").trim() || "monospace";
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let glyphs: Glyph[] = [];
    let timer = 0;
    let visible = false;

    const paint = (g: Glyph) => {
      ctx.globalAlpha = g.alpha;
      ctx.fillStyle = g.blue ? blue : ink;
      ctx.fillText(g.star ? "*" : "@", g.x + CW / 2, g.y);
    };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `400 ${FONT_PX}px ${mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const cols = Math.ceil(width / CW);
      const rows = Math.ceil(height / CH);
      glyphs = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const land = fbm(c / 16, r / 11, seed);
          // Solid inside the clumps; at the coast, a digit survives only now
          // and then, so the edges crumble into scattered *s and @s.
          const odds = smooth(Math.min(1, Math.max(0, (land - 0.4) / 0.16)));
          if (hash(c * 7 + 11, r * 13 + 5) > odds) continue;
          const f = fadeAt(fade, ((c + 0.5) * CW * 2) / width - 1, ((r + 0.5) * CH * 2) / height - 1);
          if (f < 0.03) continue;

          // Blue comes in short horizontal runs, deep inside a clump.
          const blueZone = land > 0.56 && fbm(c / 7 + 40, r / 3.5, seed + 6) > 0.64;
          glyphs.push({
            x: c * CW,
            y: r * CH,
            blue: blueZone,
            alpha: (blueZone ? 0.6 : 0.12 + odds * 0.08) * f,
            star: hash(c * 3 + 1, r * 5 + 2) > 0.45,
          });
        }
      }

      ctx.clearRect(0, 0, width, height);
      glyphs.forEach(paint);
      ctx.globalAlpha = 1;
    };

    const flicker = () => {
      if (!glyphs.length) return;
      const n = Math.max(1, Math.round(glyphs.length * 0.01));
      for (let i = 0; i < n; i++) {
        const g = glyphs[(Math.random() * glyphs.length) | 0];
        g.star = !g.star;
        ctx.clearRect(g.x, g.y, CW, CH);
        paint(g);
      }
      ctx.globalAlpha = 1;
    };

    const start = () => {
      window.clearInterval(timer);
      if (visible && !motion.matches && !document.hidden) timer = window.setInterval(flicker, 140);
    };

    motion.addEventListener("change", start);
    document.addEventListener("visibilitychange", start);
    const ro = new ResizeObserver(build);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      ro.observe(canvas);
      io.observe(canvas);
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      motion.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", start);
      ro.disconnect();
      io.disconnect();
    };
  }, [seed, fade]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
