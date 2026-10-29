/**
 * Human-readable glyph labels for keys and gamepad buttons, used by on-screen
 * prompts and the controls screen. These are input names, not prose, so they
 * stay out of the LineId space (a "Z" key is a "Z" key in every language).
 */

/** Which glyph family to draw for gamepad prompts. */
export type PadFamily = "xbox" | "playstation" | "nintendo" | "generic";

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  Enter: "Enter",
  NumpadEnter: "Num Enter",
  Escape: "Esc",
  Backspace: "Backspace",
  Tab: "Tab",
  ShiftLeft: "L Shift",
  ShiftRight: "R Shift",
  ControlLeft: "L Ctrl",
  ControlRight: "R Ctrl",
  AltLeft: "L Alt",
  AltRight: "R Alt",
  MetaLeft: "L Meta",
  MetaRight: "R Meta",
  CapsLock: "Caps",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Backquote: "`",
};

/** `KeyboardEvent.code` to a short label: `KeyZ` to `Z`, `Digit1` to `1`. */
export function keyLabel(code: string): string {
  if (code in KEY_NAMES) return KEY_NAMES[code];
  const letter = code.match(/^Key([A-Z])$/);
  if (letter) return letter[1];
  const digit = code.match(/^(?:Digit|Numpad)(\d)$/);
  if (digit) return digit[1];
  return code;
}

/**
 * Standard Gamepad API layout, by index. The physical position is the same
 * across brands; only the printed glyph differs. Nintendo swaps the letters
 * (index 0, the bottom face button, is printed "B").
 */
const PAD_LABELS: Readonly<Record<PadFamily, readonly string[]>> = {
  xbox: [
    "A",
    "B",
    "X",
    "Y",
    "LB",
    "RB",
    "LT",
    "RT",
    "View",
    "Menu",
    "LS",
    "RS",
    "D↑",
    "D↓",
    "D←",
    "D→",
    "Guide",
  ],
  playstation: [
    "×",
    "○",
    "□",
    "△",
    "L1",
    "R1",
    "L2",
    "R2",
    "Create",
    "Options",
    "L3",
    "R3",
    "D↑",
    "D↓",
    "D←",
    "D→",
    "PS",
  ],
  nintendo: [
    "B",
    "A",
    "Y",
    "X",
    "L",
    "R",
    "ZL",
    "ZR",
    "−",
    "+",
    "LS",
    "RS",
    "D↑",
    "D↓",
    "D←",
    "D→",
    "Home",
  ],
  generic: [
    "⓪",
    "①",
    "②",
    "③",
    "L1",
    "R1",
    "L2",
    "R2",
    "Select",
    "Start",
    "L3",
    "R3",
    "D↑",
    "D↓",
    "D←",
    "D→",
    "Home",
  ],
};

export function buttonLabel(index: number, family: PadFamily): string {
  return PAD_LABELS[family][index] ?? `#${index}`;
}

/**
 * Guesses the glyph family from `Gamepad.id`. The strings differ by browser
 * (Chrome includes USB vendor ids, Firefox often does not), so match both the
 * vendor id and common product names, and fall back to generic glyphs.
 */
export function padFamilyFromId(id: string): PadFamily {
  const lower = id.toLowerCase();
  if (/054c|playstation|dualsense|dualshock|wireless controller/.test(lower)) {
    return "playstation";
  }
  if (/057e|nintendo|pro controller|joy-con/.test(lower)) return "nintendo";
  if (/045e|xbox|xinput/.test(lower)) return "xbox";
  return "generic";
}
