import type { Action, Binding, Settings } from "../contracts/index.ts";

function bind(keys: string[], buttons: number[]): Binding {
  return { keys, buttons };
}

/** Standard Gamepad mapping: 0 A, 1 B, 9 Start, 12–15 d-pad, 7 right trigger. */
export const DEFAULT_BINDINGS: Readonly<Record<Action, Binding>> = {
  moveUp: bind(["ArrowUp", "KeyW"], [12]),
  moveDown: bind(["ArrowDown", "KeyS"], [13]),
  moveLeft: bind(["ArrowLeft", "KeyA"], [14]),
  moveRight: bind(["ArrowRight", "KeyD"], [15]),
  fire: bind(["Space", "KeyZ"], [0, 7]),
  focus: bind(["ShiftLeft", "KeyX"], [6]),
  pause: bind(["Escape", "KeyP"], [9]),
  confirm: bind(["Enter", "Space"], [0]),
  back: bind(["Escape", "Backspace"], [1]),
};

export const DEFAULT_SETTINGS: Settings = {
  display: {
    preset: "high",
    renderScale: 1,
    fullscreen: false,
    autoFullscreen: true,
    autoTier: true,
  },
  audio: { master: 0.8, music: 0.7, sfx: 0.8, voice: 1, ui: 0.6, mono: false },
  textLang: "en",
  voiceLang: "en",
  subtitles: {
    enabled: true,
    scale: 1,
    bgOpacity: 0.6,
    speakerNames: true,
    maxLines: 2,
  },
  accessibility: {
    autoFire: false,
    holdToggle: "hold",
    shake: 1,
    reducedFlashing: false,
    reduceMotion: false,
    gameSpeed: 1,
    difficulty: "normal",
    colorIndependentCues: false,
    aimAssist: "touch",
  },
  controls: {
    bindings: DEFAULT_BINDINGS,
    touchScheme: "thumbs",
    touchSensitivity: 1,
    fireSide: "right",
  },
};
