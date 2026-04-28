"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LofiStation } from "@/lib/types";

const STATIONS: LofiStation[] = [
  { id: "lofi", label: "Lofi Girl", youtubeId: "jfKfPfyJRdk" },
  { id: "focus", label: "Deep Focus", youtubeId: "4xDzrJKXOOY" },
  { id: "instrumental", label: "Instrumental Study", youtubeId: "lTRiuFIWV54" }
];

type YtPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  loadVideoById: (videoId: string) => void;
  setVolume: (volume: number) => void;
  getPlayerState?: () => number;
  destroy: () => void;
};

function hasPlayerMethod<K extends keyof YtPlayer>(
  player: YtPlayer | null,
  method: K
): player is YtPlayer & Required<Pick<YtPlayer, K>> {
  return Boolean(player && typeof player[method] === "function");
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: {
          height: string;
          width: string;
          videoId: string;
          playerVars: Record<string, number>;
          events: {
            onReady: (event: { target: { setVolume: (volume: number) => void } }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YtPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function LofiPlayer({ compact = false }: { compact?: boolean }) {
  const playerRef = useRef<YtPlayer | null>(null);
  const volumeRef = useRef(40);
  const playingRef = useRef(false);
  const rawId = useId();
  const containerId = `yt-player-${rawId.replace(/[:]/g, "")}`;

  const [activeStationId, setActiveStationId] = useState(STATIONS[0].id);
  const [volume, setVolume] = useState(40);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const createPlayer = () => {
      if (!window.YT || playerRef.current) return;

      playerRef.current = new window.YT.Player(containerId, {
        height: compact ? "180" : "220",
        width: "100%",
        videoId: STATIONS[0].youtubeId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: (event) => {
            setReady(true);
            event.target.setVolume(volumeRef.current);
          },
          onStateChange: (event) => {
            // YouTube states: 1 = playing, 2 = paused, 0 = ended.
            if (event.data === 1) {
              setPlaying(true);
            }
            if (event.data === 2 || event.data === 0) {
              setPlaying(false);
            }
          }
        }
      });
    };

    if (window.YT) {
      createPlayer();
    } else {
      const existingScript = document.querySelector("script[data-youtube-api]");
      window.onYouTubeIframeAPIReady = createPlayer;

      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.dataset.youtubeApi = "true";
        document.body.appendChild(script);
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [compact, containerId]);

  useEffect(() => {
    const station = STATIONS.find((item) => item.id === activeStationId);
    const player = playerRef.current;

    if (!station || !ready || !hasPlayerMethod(player, "loadVideoById")) return;

    player.loadVideoById(station.youtubeId);

    if (playingRef.current && hasPlayerMethod(player, "playVideo")) {
      player.playVideo();
    }
  }, [activeStationId, ready]);

  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;

    if (playing && hasPlayerMethod(player, "playVideo")) {
      player.playVideo();
    } else if (!playing && hasPlayerMethod(player, "pauseVideo")) {
      player.pauseVideo();
    }
  }, [playing, ready]);

  useEffect(() => {
    if (hasPlayerMethod(playerRef.current, "setVolume")) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  return (
    <section className="panel">
      <div className="section-head">
        <h3>Lofi Stream</h3>
        <span className="lofi-status">
          <span
            className={`eq-bars${playing ? " eq-active" : ""}`}
            aria-hidden="true"
          >
            <span className="eq-bar" />
            <span className="eq-bar" />
            <span className="eq-bar" />
          </span>
          {playing ? "Now playing" : "Paused"}
        </span>
      </div>

      <div className="station-row">
        {STATIONS.map((station) => (
          <button
            key={station.id}
            className={activeStationId === station.id ? "active-station" : ""}
            onClick={() => setActiveStationId(station.id)}
          >
            {station.label}
          </button>
        ))}
      </div>

      <p className="meta station-current">
        Station: {STATIONS.find((station) => station.id === activeStationId)?.label}
      </p>

      <div id={containerId} className="youtube-frame" />

      <div className="actions-row">
        <button
          className="accent"
          disabled={!ready}
          onClick={() => {
            if (playing && hasPlayerMethod(playerRef.current, "pauseVideo")) {
              playerRef.current.pauseVideo();
              setPlaying(false);
            } else if (hasPlayerMethod(playerRef.current, "playVideo")) {
              playerRef.current.playVideo();
              setPlaying(true);
            }
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <label className="volume-row">
          Volume
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              playerRef.current?.setVolume(next);
            }}
          />
        </label>
      </div>
    </section>
  );
}
