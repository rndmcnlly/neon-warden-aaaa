/**
 * STUB overlay (Workstream 0): the build label and parsed URL flags, so it is
 * obvious which skip-to or auto-play mode is active. The build label is a
 * placeholder string until the i18n layer exists; Workstream 2 moves it to a
 * `LineId`.
 */

import type { SimState, UrlFlags } from "../contracts/index.ts";

export interface DevOverlay {
  update(state: SimState): void;
}

export function createDevOverlay(
  root: HTMLElement,
  flags: UrlFlags,
): DevOverlay {
  const panel = document.createElement("div");
  panel.className = "dev-overlay";
  const title = document.createElement("h1");
  title.textContent = "Neon Warden: vertical slice build";
  const flagList = document.createElement("pre");
  flagList.textContent = JSON.stringify(flags, null, 2);
  const status = document.createElement("p");
  panel.append(title, flagList, status);
  root.appendChild(panel);

  return {
    update(state) {
      status.textContent =
        `tick ${state.tick}  score ${state.score}  kills ${state.kills}`;
    },
  };
}
