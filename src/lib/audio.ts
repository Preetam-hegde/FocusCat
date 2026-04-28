import type { AmbientTrack } from "@/lib/types";

const TRACKS: AmbientTrack[] = ["rain", "cafe", "forest", "brown"];
export type AmbientLevels = Record<AmbientTrack, number>;

const DEFAULT_AMBIENT_LEVELS: AmbientLevels = {
  rain: 0.25,
  cafe: 0,
  forest: 0.2,
  brown: 0.1
};

const TRACK_GAIN_MULTIPLIER: AmbientLevels = {
  rain: 1.45,
  cafe: 1.25,
  forest: 1.35,
  brown: 1.05
};

const AMBIENT_FILE_BY_TRACK: Record<AmbientTrack, string> = {
  rain: "/ambient-rain-loop.m4a",
  cafe: "/ambient-cafe-loop.m4a",
  forest: "/ambient-forest-loop.m4a",
  brown: "/ambient-brown-loop.m4a"
};

let ambientSharedState: {
  engine: AmbientEngine | null;
  enabled: boolean;
  levels: AmbientLevels;
} = {
  engine: null,
  enabled: false,
  levels: DEFAULT_AMBIENT_LEVELS
};

type AmbientEngine = ReturnType<typeof createAmbientEngine>;

export function getDefaultAmbientLevels() {
  return { ...DEFAULT_AMBIENT_LEVELS };
}

export function getAmbientSharedState() {
  return ambientSharedState;
}

export function setAmbientSharedState(partial: Partial<typeof ambientSharedState>) {
  ambientSharedState = { ...ambientSharedState, ...partial };
}

export function playAlertTone() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(990, context.currentTime + 0.2);

  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.3);

  oscillator.onended = () => {
    context.close().catch(() => undefined);
  };
}

export function createAmbientEngine() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.82;
  master.connect(context.destination);

  const gains: Record<AmbientTrack, GainNode> = {
    rain: context.createGain(),
    cafe: context.createGain(),
    forest: context.createGain(),
    brown: context.createGain()
  };

  const elements: Record<AmbientTrack, HTMLAudioElement> = {
    rain: new Audio(AMBIENT_FILE_BY_TRACK.rain),
    cafe: new Audio(AMBIENT_FILE_BY_TRACK.cafe),
    forest: new Audio(AMBIENT_FILE_BY_TRACK.forest),
    brown: new Audio(AMBIENT_FILE_BY_TRACK.brown)
  };

  TRACKS.forEach((track) => {
    const element = elements[track];
    element.loop = true;
    element.preload = "auto";
    element.crossOrigin = "anonymous";

    const source = context.createMediaElementSource(element);

    if (track === "rain") {
      const high = context.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 200;

      const low = context.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 9000;

      source.connect(high);
      high.connect(low);
      low.connect(gains[track]);
    } else if (track === "cafe") {
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1250;
      filter.Q.value = 0.45;
      source.connect(filter);
      filter.connect(gains[track]);
    } else if (track === "forest") {
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2400;
      source.connect(filter);
      filter.connect(gains[track]);
    } else {
      source.connect(gains[track]);
    }

    gains[track].gain.value = 0;
    gains[track].connect(master);
  });

  return {
    setVolume(track: AmbientTrack, value: number) {
      const scaled = Math.max(0, Math.min(1, value * TRACK_GAIN_MULTIPLIER[track]));
      gains[track].gain.setTargetAtTime(scaled, context.currentTime, 0.03);
    },
    async resume() {
      if (context.state !== "running") {
        await context.resume();
      }

      await Promise.all(
        TRACKS.map(async (track) => {
          try {
            await elements[track].play();
          } catch {
            // Ignore user-agent autoplay errors; play is retried by next interaction.
          }
        })
      );
    },
    async suspend() {
      TRACKS.forEach((track) => {
        elements[track].pause();
      });

      if (context.state === "running") {
        await context.suspend();
      }
    },
    async close() {
      TRACKS.forEach((track) => {
        const element = elements[track];
        element.pause();
        element.currentTime = 0;
      });

      await context.close();
    }
  };
}
