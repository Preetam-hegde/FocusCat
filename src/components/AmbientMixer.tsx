"use client";

import { useEffect, useRef, useState } from "react";
import {
  createAmbientEngine,
  getAmbientSharedState,
  getDefaultAmbientLevels,
  setAmbientSharedState,
  type AmbientLevels
} from "@/lib/audio";
import type { AmbientTrack } from "@/lib/types";

type Engine = ReturnType<typeof createAmbientEngine>;
type TrackState = AmbientLevels;

const LABELS: Record<AmbientTrack, string> = {
  rain: "Rainy Street & Birds",
  cafe: "Medieval Tavern",
  forest: "History Ambient",
  brown: "Relaxing Guitar"
};

const TRACKS: AmbientTrack[] = ["rain", "cafe", "forest", "brown"];

function sanitizeLevels(candidate: unknown): TrackState {
  const defaults = getDefaultAmbientLevels();
  if (!candidate || typeof candidate !== "object") return defaults;
  const value = candidate as Partial<Record<AmbientTrack, number>>;

  return {
    rain: typeof value.rain === "number" ? Math.max(0, Math.min(1, value.rain)) : defaults.rain,
    cafe: typeof value.cafe === "number" ? Math.max(0, Math.min(1, value.cafe)) : defaults.cafe,
    forest: typeof value.forest === "number" ? Math.max(0, Math.min(1, value.forest)) : defaults.forest,
    brown: typeof value.brown === "number" ? Math.max(0, Math.min(1, value.brown)) : defaults.brown
  };
}

const MIX_PRESETS: Array<{ label: string; levels: TrackState }> = [
  {
    label: "Rain & Tavern",
    levels: { rain: 0.55, cafe: 0.35, forest: 0, brown: 0 }
  },
  {
    label: "History & Rain",
    levels: { rain: 0.2, cafe: 0, forest: 0.6, brown: 0 }
  },
  {
    label: "Guitar Focus",
    levels: { rain: 0, cafe: 0, forest: 0, brown: 0.75 }
  }
];

export function AmbientMixer({ compact = false }: { compact?: boolean }) {
  const shared = getAmbientSharedState();
  const defaults = getDefaultAmbientLevels();

  const engineRef = useRef<Engine | null>(shared.engine);
  const [enabled, setEnabled] = useState(shared.enabled);
  const [favoriteSaved, setFavoriteSaved] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [levels, setLevels] = useState<TrackState>(() => {
    if (shared.engine) return shared.levels;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("focus-favorite-mix");
      if (stored) {
        try {
          const parsed = sanitizeLevels(JSON.parse(stored));
          setAmbientSharedState({ levels: parsed });
          return parsed;
        } catch {
          return defaults;
        }
      }
    }
    return defaults;
  });

  useEffect(() => {
    return () => {
      // Keep ambient audio alive when this panel unmounts (pane/focus mode switches).
      setAmbientSharedState({ engine: engineRef.current });
    };
  }, []);

  async function ensureEngine() {
    if (!engineRef.current) {
      engineRef.current = createAmbientEngine();
      setAmbientSharedState({ engine: engineRef.current });
      TRACKS.forEach((track) => {
        engineRef.current?.setVolume(track, levels[track]);
      });
    }

    await engineRef.current.resume();
    setAmbientSharedState({ enabled: true });
    setEnabled(true);
  }

  function applyPreset(nextLevels: TrackState, presetLabel: string) {
    setActivePreset(presetLabel);
    const sanitized = sanitizeLevels(nextLevels);
    setAmbientSharedState({ levels: sanitized });
    setLevels(sanitized);
    TRACKS.forEach((track) => {
      engineRef.current?.setVolume(track, sanitized[track]);
    });
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h3>Ambient Mixer</h3>
        <p>{enabled ? "Live mix" : "Standby"}</p>
      </div>

      {!enabled ? (
        <button className="accent" onClick={ensureEngine}>Enable Ambient Audio</button>
      ) : (
        <div className="actions-row">
          <button
            onClick={async () => {
              await engineRef.current?.suspend();
              setAmbientSharedState({ enabled: false });
              setEnabled(false);
            }}
          >
            Pause Ambience
          </button>
          {!compact && (
            <button
              onClick={() => {
                window.localStorage.setItem("focus-favorite-mix", JSON.stringify(levels));
                setFavoriteSaved(true);
                window.setTimeout(() => setFavoriteSaved(false), 1200);
              }}
            >
              Save Favorite Mix
            </button>
          )}
        </div>
      )}

      <div className="mixer-grid">
        {TRACKS.map((track) => (
          <label key={track}>
            <span>{LABELS[track]}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(levels[track] * 100)}
              onChange={(event) => {
                const nextLevel = Number(event.target.value) / 100;
                setActivePreset(null);
                setLevels((prev) => {
                  const next = { ...prev, [track]: nextLevel };
                  setAmbientSharedState({ levels: next });
                  engineRef.current?.setVolume(track, nextLevel);
                  return next;
                });
              }}
            />
            <div
              className="track-level-bar"
              style={{ width: `${Math.round(levels[track] * 100)}%` }}
            />
          </label>
        ))}
      </div>

      {!compact && (
        <div className="preset-row ambient-preset-row">
          {MIX_PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={activePreset === preset.label ? "preset-active" : ""}
              onClick={() => applyPreset(preset.levels, preset.label)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {favoriteSaved && <p className="meta">Favorite mix saved.</p>}
    </section>
  );
}
