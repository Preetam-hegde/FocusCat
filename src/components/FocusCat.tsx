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
type CatAnimation = "sitting_down" | "looking_around" | "laying_down" | "walking" | "running" | "running2";

type SpriteSet = "black_1" | "brown_8" | "orange_0" | "white_grey_1";

const SPRITE_SIZE = 32;
const OUTPUT_SIZE = 150;
const FRAMES_PER_ANIMATION = 4;

const SPRITE_SET_ORDER: SpriteSet[] = ["orange_0", "black_1"];

const THEME_PRIMARY_SET: Record<"ember" | "mist" | "grove", SpriteSet> = {
  ember: "orange_0",
  mist: "black_1",
  grove: "orange_0",
};

const MOOD_ANIMATIONS: Record<CatMood, CatAnimation[]> = {
  sleep: ["sitting_down", "laying_down"],
  play: ["running", "running2"],
  stretch: ["walking", "running"],
};

const IDLE_ANIMATION: Record<Exclude<CatIdleEvent, null>, CatAnimation> = {
  yawn: "laying_down",
  twitch: "looking_around",
  blink: "looking_around",
};

const ANIMATION_FPS: Record<CatAnimation, number> = {
  sitting_down: 2,
  looking_around: 2,
  laying_down: 2,
  walking: 4,
  running: 6,
  running2: 7,
};

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

const spriteCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadSpriteImg(src: string): Promise<HTMLImageElement | null> {
  const hit = spriteCache.get(src);
  if (hit) return hit;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  spriteCache.set(src, promise);
  return promise;
}

function framePath(spriteSet: SpriteSet, animation: CatAnimation, frameIndex: number) {
  return `/sprites/split/${spriteSet}/${animation}_${frameIndex}.png`;
}

function getAnimationFrames(spriteSet: SpriteSet, animation: CatAnimation) {
  return Array.from({ length: FRAMES_PER_ANIMATION }, (_, index) => framePath(spriteSet, animation, index));
}

async function drawFrame(canvas: HTMLCanvasElement, frameUrl: string) {
  const img = await loadSpriteImg(frameUrl);
  if (!img) return;
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.drawImage(img, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
}

function preloadFrames(urls: string[]) {
  urls.forEach((url) => {
    void loadSpriteImg(url);
  });
}

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

function resolveAnimation(mood: CatMood, idleEvent: CatIdleEvent, previous?: CatAnimation): CatAnimation {
  if (idleEvent) return IDLE_ANIMATION[idleEvent];
  return pick(MOOD_ANIMATIONS[mood], previous);
}

function rotateSpriteSet(theme: "ember" | "mist" | "grove", previous?: SpriteSet): SpriteSet {
  const primary = THEME_PRIMARY_SET[theme];
  const shouldUsePrimary = Math.random() < 0.7;
  if (shouldUsePrimary && previous !== primary) return primary;
  return pick(SPRITE_SET_ORDER, previous);
}

type FocusCatState = {
  manualMood: CatMood | null;
  quote: string;
  expressionSeed: number;
  expressionOverride: CatExpression | null;
  persona: string;
  idleEvent: CatIdleEvent;
  tapPulse: boolean;
  animation: CatAnimation;
  frameIndex: number;
  spriteSet: SpriteSet;
};

export const FocusCat = memo(function FocusCat({ mode, isRunning, theme = "ember", compact = false }: FocusCatProps) {
  const autoMood = resolveMood(mode, isRunning);
  const [state, setState] = useState<FocusCatState>(() => ({
    manualMood: null,
    quote: first(CAT_QUOTES[autoMood]),
    expressionSeed: 0,
    expressionOverride: null,
    persona: first(CAT_PERSONALITIES[autoMood]),
    idleEvent: null,
    tapPulse: false,
    animation: first(MOOD_ANIMATIONS[autoMood]),
    frameIndex: 0,
    spriteSet: THEME_PRIMARY_SET[theme],
  }));

  const timersRef = useRef<{
    expression: number | null;
    idle: number | null;
    idleClear: number | null;
    moodRevert: number | null;
    tapPulse: number | null;
  }>({ expression: null, idle: null, idleClear: null, moodRevert: null, tapPulse: null });

  const clickingRef = useRef(false);

  const mood = state.manualMood ?? autoMood;
  const expression = useMemo(
    () => state.expressionOverride ?? expressionFromMood(mood, state.expressionSeed),
    [mood, state.expressionOverride, state.expressionSeed],
  );

  const animationFrames = useMemo(
    () => getAnimationFrames(state.spriteSet, state.animation),
    [state.spriteSet, state.animation],
  );

  const activeFrame = animationFrames[state.frameIndex] ?? animationFrames[0];

  useEffect(() => {
    setState((p) => {
      const nextSpriteSet = p.spriteSet === THEME_PRIMARY_SET[theme] ? p.spriteSet : THEME_PRIMARY_SET[theme];
      if (nextSpriteSet === p.spriteSet) return p;
      return { ...p, spriteSet: nextSpriteSet, frameIndex: 0 };
    });
  }, [theme]);

  // Re-pick animation only when mood changes; idle events update animation directly in their own setState calls.
  useEffect(() => {
    setState((p) => {
      const nextAnimation = resolveAnimation(mood, p.idleEvent, p.animation);
      if (p.animation === nextAnimation) return p;
      return { ...p, animation: nextAnimation, frameIndex: 0 };
    });
  }, [mood]);

  // Quote + personality rotation and animation variation.
  useEffect(() => {
    const primeId = window.setTimeout(() => {
      setState((p) => ({
        ...p,
        persona: pick(CAT_PERSONALITIES[mood], p.persona),
        expressionSeed: p.expressionSeed + 1,
        animation: resolveAnimation(mood, p.idleEvent, p.animation),
        frameIndex: 0,
        spriteSet: rotateSpriteSet(theme, p.spriteSet),
      }));
    }, 0);

    const intervalId = window.setInterval(() => {
      setState((p) => ({
        ...p,
        quote: pick(CAT_QUOTES[mood], p.quote),
        persona: pick(CAT_PERSONALITIES[mood], p.persona),
        expressionSeed: Math.random() > 0.48 ? p.expressionSeed + 1 : p.expressionSeed,
        animation: resolveAnimation(mood, p.idleEvent, p.animation),
        frameIndex: 0,
        spriteSet: rotateSpriteSet(theme, p.spriteSet),
      }));
    }, 12000);

    return () => {
      window.clearTimeout(primeId);
      window.clearInterval(intervalId);
    };
  }, [mood, theme]);

  // Auto idle events trigger look-around and rest animations.
  useEffect(() => {
    const timers = timersRef.current;
    const IDLE_EVENTS: Exclude<CatIdleEvent, null>[] = ["yawn", "twitch", "blink"];

    const scheduleNext = () => {
      const delay = 14000 + Math.random() * 18000;
      timers.idle = window.setTimeout(() => {
        const event = IDLE_EVENTS[Math.floor(Math.random() * IDLE_EVENTS.length)];
        setState((p) => ({
          ...p,
          idleEvent: event,
          animation: resolveAnimation(mood, event, p.animation),
          frameIndex: 0,
        }));

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
  }, [mood]);

  // Cleanup timers on unmount.
  useEffect(() => {
    const t = timersRef.current;
    return () => {
      [t.expression, t.idle, t.idleClear, t.moodRevert, t.tapPulse].forEach((id) => {
        if (id !== null) window.clearTimeout(id);
      });
    };
  }, []);

  // Animation clock.
  useEffect(() => {
    if (animationFrames.length < 2) return;
    const fps = ANIMATION_FPS[state.animation];
    const intervalMs = Math.max(50, Math.floor(1000 / fps));

    const id = window.setInterval(() => {
      setState((p) => ({
        ...p,
        frameIndex: (p.frameIndex + 1) % animationFrames.length,
      }));
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [animationFrames.length, state.animation]);

  // Preload active and likely next animations to keep transitions smooth.
  useEffect(() => {
    const preload = new Set<string>();
    animationFrames.forEach((frame) => preload.add(frame));
    MOOD_ANIMATIONS[mood].forEach((anim) => {
      getAnimationFrames(state.spriteSet, anim).forEach((frame) => preload.add(frame));
    });
    preloadFrames([...preload]);
  }, [animationFrames, mood, state.spriteSet]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeFrame) return;
    drawFrame(canvas, activeFrame).catch(() => {});
  }, [activeFrame]);

  const handleCatTap = useCallback(() => {
    // Debounce: ignore clicks within 600ms of the last one.
    if (clickingRef.current) return;
    clickingRef.current = true;
    window.setTimeout(() => { clickingRef.current = false; }, 600);

    const nextMood: CatMood = mood === "sleep" ? "play" : mood === "play" ? "stretch" : "sleep";
    const t = timersRef.current;

    if (t.expression !== null) window.clearTimeout(t.expression);
    if (t.moodRevert !== null) window.clearTimeout(t.moodRevert);
    if (t.tapPulse !== null) window.clearTimeout(t.tapPulse);

    setState((p) => ({
      ...p,
      manualMood: nextMood,
      quote: pick(CAT_QUOTES[nextMood], p.quote),
      persona: pick(CAT_PERSONALITIES[nextMood], p.persona),
      expressionOverride: nextMood === "sleep" ? "sleepy" : "happy",
      tapPulse: true,
      animation: resolveAnimation(nextMood, null, p.animation),
      frameIndex: 0,
      spriteSet: rotateSpriteSet(theme, p.spriteSet),
    }));

    t.tapPulse = window.setTimeout(() => {
      setState((p) => ({ ...p, tapPulse: false }));
      t.tapPulse = null;
    }, 260);

    t.expression = window.setTimeout(() => {
      setState((p) => ({ ...p, expressionOverride: null }));
      t.expression = null;
    }, 1100);

    // Revert manual mood back to auto after 30 seconds.
    t.moodRevert = window.setTimeout(() => {
      setState((p) => ({ ...p, manualMood: null }));
      t.moodRevert = null;
    }, 30000);
  }, [mood, theme]);

  return (
    <section className={compact ? "focus-pet focus-pet-compact" : "focus-pet"} aria-live="polite" aria-atomic="true">
      <div className="focus-pet-stage">
        <button
          type="button"
          className={`focus-pet-cat-btn${state.tapPulse ? " focus-pet-cat-btn-tap" : ""}`}
          onClick={handleCatTap}
          aria-label="Nudge companion"
        >
          <canvas
            ref={canvasRef}
            className={`focus-cat focus-cat-${mood} focus-cat-anim-${state.animation} focus-cat-expression-${expression} focus-cat-idle-${state.idleEvent ?? "none"}`}
            width={OUTPUT_SIZE}
            height={OUTPUT_SIZE}
            aria-hidden="true"
          />
        </button>
      </div>

      <p className="focus-pet-quote">&ldquo;{state.quote}&rdquo;</p>
      <p className="focus-pet-persona">{state.persona}</p>
    </section>
  );
});
