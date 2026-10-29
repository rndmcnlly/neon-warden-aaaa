/**
 * Developer overlay: shows the active URL flags and a live tick counter.
 *
 * The panel only appears when a URL flag is active, so normal play and
 * screenshots stay clean. Its text is developer-facing, the one allowed
 * exception to the LineId rule.
 */

import type { SimState, UrlFlags } from "../contracts/index.ts";

export interface DevOverlay {
  update(state: SimState): void;
}

function hasActiveFlags(flags: UrlFlags): boolean {
  return flags.skipTo !== null || flags.autoPlay !== null ||
    flags.seed !== null || flags.warnings.length > 0;
}

export function createDevOverlay(
  root: HTMLElement,
  flags: UrlFlags,
): DevOverlay {
  if (!hasActiveFlags(flags)) return { update() {} };

  const panel = document.createElement("div");
  panel.className = "dev-overlay";
  const title = document.createElement("h1");
  title.textContent = "dev flags";
  const flagList = document.createElement("pre");
  flagList.textContent = JSON.stringify(flags, null, 2);
  const status = document.createElement("p");
  panel.append(title, flagList, status);
  root.appendChild(panel);

  return {
    update(state) {
      status.textContent =
        `tick ${state.tick}  ${state.phase}  sector ${state.sector}  ` +
        `score ${state.score}  kills ${state.kills}` +
        (state.outcome ? `  outcome ${state.outcome}` : "");
    },
  };
}
