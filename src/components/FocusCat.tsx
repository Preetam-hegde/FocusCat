"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimerMode } from "@/lib/types";

type FocusCatProps = {
  mode: TimerMode;
  isRunning: boolean;
  theme?: "ember" | "mist" | "grove";
  compact?: boolean;
};

type CatMood = "sleep" | "play" | "stretch";
type CatExpression = "sleepy" | "calm" | "happy" | "mischief";
type CatIdleEvent = "yawn" | "twitch" | "blink" | null;

// ─── Personality ──────────────────────────────────────────────────────────────
// This cat: Lilac ticked tabby · silver eyes · blue nose · green bell collar
// Personality: Methodical, dry-witted, quietly devoted, mildly chaotic on breaks

const CAT_PERSONALITIES: Record<CatMood, string[]> = {
  sleep: [
    "Entered low-power mode. Bell silent. Dreams: encrypted.",
    "Lilac loaf. Fully deployed. Do not disturb.",
    "Purr engine at idle. Recharging for the next sprint.",
    "Silver eyes closed. Trust the rest.",
    "Soft paws, quiet bell, deep processing.",
    "Nap protocol engaged. All systems nominal.",
  ],
  play: [
    "Bell jingling at maximum capacity. No regrets.",
    "Chaos mode unlocked. Silver eyes: wide. Whiskers: forward.",
    "Break quest active: zoomies, hydration, mild mayhem.",
    "The green bell demands to be heard.",
    "Lilac blur detected. Velocity: unknowable.",
    "Gremlin hours. Fully authorized.",
  ],
  stretch: [
    "Silver eyes locked on the objective. Unblinking.",
    "Bell still. Paws ready. Focused.",
    "Ticked fur, ticked off distractions. Time to work.",
    "Patience of a hunter. Precision of a predator.",
    "Lilac ghost in the focus zone. Nothing escapes notice.",
    "The collar bell is quiet because I chose it to be.",
    "Watching the task like prey. It will not escape.",
  ],
};

const CAT_QUOTES: Record<CatMood, string[]> = {
  sleep: [
    "Pause is not laziness. It is calibration.",
    "Even the sharpest mind needs a blanket burrito moment.",
    "Tiny reset. Massive comeback.",
    "Rest now so future-you can cook.",
    "The body rests. The subconscious works overtime.",
    "You earned this. Close the tabs. Close the eyes.",
    "Sleep is not the enemy of progress. It is the engine.",
    "Recharge is part of the sprint.",
  ],
  play: [
    "Break mode: wiggle first, worry later.",
    "Hydrate, stretch, then attack the next sprint.",
    "A short break is a productivity power-up.",
    "Your brain just did reps. Let it purr for a minute.",
    "Motion is medicine. Get up. Move. Return stronger.",
    "The best ideas arrive when you stop chasing them.",
    "Breaks are not lost time. They are invested time.",
    "Let the mind wander. It knows where to come back.",
  ],
  stretch: [
    "Focus is a superpower built one minute at a time.",
    "Do the boring reps. They become extraordinary results.",
    "Small progress still moves the finish line.",
    "Stay with the sprint. Momentum is almost here.",
    "The task is not the obstacle. Distraction is.",
    "One more clean minute. Then another.",
    "Precision over speed. Depth over breadth.",
    "You are closer than you think. Stay.",
    "The work compounds. Every session matters.",
  ],
};

const REACTION_EMOJI: Record<CatMood, string[]> = {
  sleep: ["💤", "😴", "🌙", "✨", "💭"],
  play:  ["⚡", "🐾", "✨", "💥", "🎯"],
  stretch: ["🔥", "⚡", "🎯", "💡", "✨"],
};

// ─── Sprite rendering ─────────────────────────────────────────────────────────

const SPRITE_BASE = "https://cgen-tools.github.io/pixel-cat-maker/sprites/split/";

// Per-theme cat layer config (ClanGen sprite layer names)
type CatConfig = {
  pelt: string;          // pelt layer name
  tint: string | null;   // multiply tint colour, null = no tint needed
  eyes: string;          // primary eye layer
  eyes2: string;         // secondary eye layer (glint)
  skin: string;          // nose/paw pad layer
  collar: string;        // accessory layer
  label: string;         // display label shown in persona
};

// Layer name format: {peltPattern}{COLOUR} / eyes{COLOUR} / skin{COLOUR} / collars{NAME}
// Valid pelt colours (from ClanGen): CREAM PALEGINGER GOLDEN GINGER DARKGINGER SIENNA
//   GREY DARKGREY GHOST BLACK WHITE PALEGREY SILVER LIGHTBROWN LILAC BROWN DARKBROWN CHOCOLATE
// Valid eye colours: YELLOW AMBER HAZEL PALEGREEN GREEN BLUE DARKBLUE GREY CYAN EMERALD
//   PALEBLUE PALEYELLOW GOLD HEATHERBLUE COPPER SAGE COBALT SUNLITICE GREENYELLOW BRONZE SILVER
// Valid skin colours (tint/nose): PINK DARKBROWN BROWN LIGHTBROWN BLACK (uppercase in filenames)
// Sprite indices: Adult 6-8 · Longhair Adult 9-11 · Senior 12-14 · Paralyzed 15-17
const THEME_CAT: Record<"ember" | "mist" | "grove", CatConfig> = {
  // Warm ginger — matches Ember theme
  ember: {
    pelt: "classicGINGER",
    tint: null,
    eyes: "eyesAMBER",
    eyes2: "eyes2AMBER",
    skin: "skinPINK",
    collar: "collarsREDBELL",
    label: "Ginger classic tabby · amber eyes · red bell",
  },
  // Cool grey — matches Mist theme (GREY is a valid pelt colour; BLUE is eye-only)
  mist: {
    pelt: "classicGREY",
    tint: null,
    eyes: "eyesBLUE",
    eyes2: "eyes2BLUE",
    skin: "skinPINK",
    collar: "collarsBLUEBELL",
    label: "Grey classic tabby · blue eyes · blue bell",
  },
  // Earthy brown — matches Grove theme
  grove: {
    pelt: "classicBROWN",
    tint: null,
    eyes: "eyesGREEN",
    eyes2: "eyes2GREEN",
    skin: "skinPINK",
    collar: "collarsGREENBELL",
    label: "Brown classic tabby · green eyes · green bell",
  },
};

// Adult pose indices from ClanGen sprite sheet (rows 6-17)
// 6=sit  7=sit-alert  8=stand  9=stand-alert  10=run  11=sleep  12=groom  13=groom-2  16=alert-stand
const MOOD_SPRITE: Record<CatMood, number[]> = {
  sleep:   [11, 6, 7],     // sleeping · drowsy-sit · alert-sit (head-up)
  play:    [10, 12, 13],   // running  · lick-paw  · full-groom
  stretch: [16, 8, 9],    // user's confirmed pose · stand · stand-alert
};

// Module-level cache: keyed by URL, value is the in-flight Promise so parallel
// requests for the same URL share one fetch rather than starting duplicates.
const spriteCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadSpriteImg(src: string): Promise<HTMLImageElement | null> {
  const hit = spriteCache.get(src);
  if (hit) return hit;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  spriteCache.set(src, promise);
  return promise;
}

async function renderCatCanvas(canvas: HTMLCanvasElement, spriteNum: number, config: CatConfig) {
  const S = 50;
  const SCALE = 3;
  const url = (name: string) => `${SPRITE_BASE}${name}_${spriteNum}.png`;

  const offscreen = new OffscreenCanvas(S, S);
  const octx = offscreen.getContext("2d")!;

  const pelt = await loadSpriteImg(url(config.pelt));
  if (pelt) octx.drawImage(pelt, 0, 0, S, S);

  // Optional multiply tint (used for lilac/desaturated pelts)
  if (config.tint) {
    const tintOverlay = new OffscreenCanvas(S, S);
    const tc = tintOverlay.getContext("2d")!;
    tc.drawImage(offscreen, 0, 0);
    tc.globalCompositeOperation = "source-in";
    tc.fillStyle = config.tint;
    tc.fillRect(0, 0, S, S);
    const tinted = new OffscreenCanvas(S, S);
    const tt = tinted.getContext("2d")!;
    tt.drawImage(offscreen, 0, 0);
    tt.globalCompositeOperation = "multiply";
    tt.drawImage(tintOverlay, 0, 0);
    octx.globalCompositeOperation = "source-in";
    octx.drawImage(tinted, 0, 0);
    octx.globalCompositeOperation = "source-over";
  }

  const eyes = await loadSpriteImg(url(config.eyes));
  if (eyes) octx.drawImage(eyes, 0, 0, S, S);
  const eyes2 = await loadSpriteImg(url(config.eyes2));
  if (eyes2) octx.drawImage(eyes2, 0, 0, S, S);

  const lines = await loadSpriteImg(url("lines"));
  if (lines) octx.drawImage(lines, 0, 0, S, S);

  const skin = await loadSpriteImg(url(config.skin));
  if (skin) octx.drawImage(skin, 0, 0, S, S);

  const collar = await loadSpriteImg(url(config.collar));
  if (collar) octx.drawImage(collar, 0, 0, S, S);

  canvas.width = S * SCALE;
  canvas.height = S * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(-SCALE, SCALE);
  ctx.drawImage(offscreen, -S, 0);
  ctx.restore();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(pool: T[], previous?: T): T {
  if (pool.length === 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)];
  while (next === previous) next = pool[Math.floor(Math.random() * pool.length)];
  return next;
}

function first<T>(pool: T[]): T {
  return pool[0];
}

function resolveMood(mode: TimerMode, isRunning: boolean): CatMood {
  if (!isRunning) return "sleep";
  if (mode === "break") return "play";
  return "stretch";
}

function expressionFromMood(mood: CatMood, seed: number): CatExpression {
  if (mood === "sleep") return "sleepy";
  const roll = ((seed * 9301 + 49297) % 233280) / 233280;
  if (mood === "play") {
    if (roll > 0.72) return "mischief";
    if (roll > 0.35) return "happy";
    return "calm";
  }
  if (roll > 0.75) return "happy";
  if (roll > 0.52) return "mischief";
  return "calm";
}

// ─── Component ────────────────────────────────────────────────────────────────

type FocusCatState = {
  manualMood: CatMood | null;
  nudged: boolean;
  quote: string;
  expressionSeed: number;
  expressionOverride: CatExpression | null;
  persona: string;
  idleEvent: CatIdleEvent;
  reactionEmoji: string | null;
  spriteNum: number;
};

export const FocusCat = memo(function FocusCat({ mode, isRunning, theme = "ember", compact = false }: FocusCatProps) {
  const autoMood = resolveMood(mode, isRunning);
  const catConfig = THEME_CAT[theme];
  const [state, setState] = useState<FocusCatState>(() => ({
    manualMood: null,
    nudged: false,
    quote: first(CAT_QUOTES[autoMood]),
    expressionSeed: 0,
    expressionOverride: null,
    persona: first(CAT_PERSONALITIES[autoMood]),
    idleEvent: null,
    reactionEmoji: null,
    spriteNum: MOOD_SPRITE[autoMood][0],
  }));

  const timersRef = useRef<{
    nudged: number | null;
    expression: number | null;
    idle: number | null;
    idleClear: number | null;
    reaction: number | null;
  }>({ nudged: null, expression: null, idle: null, idleClear: null, reaction: null });

  const mood = state.manualMood ?? autoMood;
  const expression = useMemo(
    () => state.expressionOverride ?? expressionFromMood(mood, state.expressionSeed),
    [mood, state.expressionOverride, state.expressionSeed],
  );

  // Quote + personality rotation
  useEffect(() => {
    const primeId = window.setTimeout(() => {
      setState((p) => ({
        ...p,
        persona: pick(CAT_PERSONALITIES[mood], p.persona),
        expressionSeed: p.expressionSeed + 1,
        spriteNum: pick(MOOD_SPRITE[mood], p.spriteNum),
      }));
    }, 0);
    const intervalId = window.setInterval(() => {
      setState((p) => ({
        ...p,
        quote: pick(CAT_QUOTES[mood], p.quote),
        persona: pick(CAT_PERSONALITIES[mood], p.persona),
        expressionSeed: Math.random() > 0.48 ? p.expressionSeed + 1 : p.expressionSeed,
        spriteNum: pick(MOOD_SPRITE[mood], p.spriteNum),
      }));
    }, 12000);
    return () => { window.clearTimeout(primeId); window.clearInterval(intervalId); };
  }, [mood]);

  // Auto idle events — cat randomly yawns, twitches, or blinks
  useEffect(() => {
    const timers = timersRef.current;
    const IDLE_EVENTS: CatIdleEvent[] = ["yawn", "twitch", "blink"];
    const scheduleNext = () => {
      const delay = 14000 + Math.random() * 18000; // 14–32s
      timers.idle = window.setTimeout(() => {
        const event = IDLE_EVENTS[Math.floor(Math.random() * IDLE_EVENTS.length)];
        setState((p) => ({ ...p, idleEvent: event }));
        timers.idleClear = window.setTimeout(() => {
          setState((p) => ({ ...p, idleEvent: null }));
          scheduleNext();
        }, 1400);
      }, delay);
    };
    scheduleNext();
    return () => {
      if (timers.idle !== null) window.clearTimeout(timers.idle);
      if (timers.idleClear !== null) window.clearTimeout(timers.idleClear);
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    const t = timersRef.current;
    return () => {
      [t.nudged, t.expression, t.idle, t.idleClear, t.reaction].forEach((id) => {
        if (id !== null) window.clearTimeout(id);
      });
    };
  }, []);

  // Canvas render — re-runs on sprite rotation or theme change
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCatCanvas(canvas, state.spriteNum, catConfig).catch(() => {});
  }, [state.spriteNum, catConfig]);

  const handleCatTap = useCallback(() => {
    const nextMood: CatMood = mood === "sleep" ? "play" : mood === "play" ? "stretch" : "sleep";
    const emoji = pick(REACTION_EMOJI[nextMood]);

    if (timersRef.current.expression !== null) window.clearTimeout(timersRef.current.expression);
    if (timersRef.current.nudged !== null) window.clearTimeout(timersRef.current.nudged);
    if (timersRef.current.reaction !== null) window.clearTimeout(timersRef.current.reaction);

    setState((p) => ({
      ...p,
      manualMood: nextMood,
      quote: pick(CAT_QUOTES[nextMood], p.quote),
      persona: pick(CAT_PERSONALITIES[nextMood], p.persona),
      expressionOverride: nextMood === "sleep" ? "sleepy" : "happy",
      nudged: true,
      reactionEmoji: emoji,
      spriteNum: pick(MOOD_SPRITE[nextMood]),
    }));

    timersRef.current.expression = window.setTimeout(() => {
      setState((p) => ({ ...p, expressionOverride: null }));
      timersRef.current.expression = null;
    }, 1100);

    timersRef.current.nudged = window.setTimeout(() => {
      setState((p) => ({ ...p, nudged: false }));
      timersRef.current.nudged = null;
    }, 420);

    timersRef.current.reaction = window.setTimeout(() => {
      setState((p) => ({ ...p, reactionEmoji: null }));
      timersRef.current.reaction = null;
    }, 1200);
  }, [mood]);

  return (
    <section className={compact ? "focus-pet focus-pet-compact" : "focus-pet"} aria-live="polite" aria-atomic="true">
      <div className="focus-pet-stage">
        <button
          type="button"
          className={`focus-pet-cat-btn${state.nudged ? " focus-pet-cat-btn-nudged" : ""}`}
          onClick={handleCatTap}
          aria-label="Nudge companion"
        >
          {state.reactionEmoji && (
            <span className="focus-pet-reaction" aria-hidden="true">
              {state.reactionEmoji}
            </span>
          )}
          {/* Sprites: cgen-tools/pixel-cat-maker — CC BY-NC 4.0, ClanGen contributors */}
          <canvas
            ref={canvasRef}
            className={`focus-cat focus-cat-${mood} focus-cat-expression-${expression} focus-cat-idle-${state.idleEvent ?? "none"}`}
            width={150}
            height={150}
            aria-hidden="true"
          />
        </button>
      </div>

      <p className="focus-pet-quote">&ldquo;{state.quote}&rdquo;</p>
      <p className="focus-pet-persona">{state.persona}</p>
    </section>
  );
});
