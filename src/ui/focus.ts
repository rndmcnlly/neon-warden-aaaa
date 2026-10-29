/**
 * Spatial focus navigation: from the focused element, move to the nearest
 * focusable element in the pressed direction. One rule handles vertical
 * lists, horizontal tab rows and tile grids alike, for keyboard and gamepad.
 *
 * The geometry (`pickInDirection`) is pure so tests can check it with plain
 * rectangles; the DOM helpers below feed it real layout.
 */

export type Direction = "up" | "down" | "left" | "right";

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Index of the best candidate in `direction` from `from`, or -1. Candidates
 * must lie beyond the source edge; among them, prefer small travel along the
 * direction and penalize sideways drift more, so a list moves straight down
 * rather than diagonally to a nearer neighbor.
 */
export function pickInDirection(
  from: Rect,
  candidates: readonly Rect[],
  direction: Direction,
): number {
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((rect, index) => {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let along: number;
    let across: number;
    // Edge-based "beyond" tests tolerate overlapping rows by one pixel.
    switch (direction) {
      case "up":
        if (rect.top + rect.height > from.top + 1) return;
        along = fy - cy;
        across = Math.abs(cx - fx);
        break;
      case "down":
        if (rect.top < from.top + from.height - 1) return;
        along = cy - fy;
        across = Math.abs(cx - fx);
        break;
      case "left":
        if (rect.left + rect.width > from.left + 1) return;
        along = fx - cx;
        across = Math.abs(cy - fy);
        break;
      case "right":
        if (rect.left < from.left + from.width - 1) return;
        along = cx - fx;
        across = Math.abs(cy - fy);
        break;
    }
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

export const NAV_SELECTOR = "[data-nav]:not([disabled]):not([hidden])";

export function navigables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(NAV_SELECTOR)].filter((el) =>
    el.offsetParent !== null
  );
}

/** Moves focus within `root`; wraps vertically in single-column menus. */
export function moveFocus(root: HTMLElement, direction: Direction): boolean {
  const items = navigables(root);
  if (items.length === 0) return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active || !items.includes(active)) {
    focusElement(items[0]);
    return true;
  }
  const others = items.filter((el) => el !== active);
  const index = pickInDirection(
    active.getBoundingClientRect(),
    others.map((el) => el.getBoundingClientRect()),
    direction,
  );
  if (index >= 0) return focusElement(enterRow(active, others[index], root));
  // Wrap only along a list's axis, so a grid edge stops instead of jumping.
  // A "grid" wraps in reading order: off a column's bottom to the top of
  // the next column, so Down alone visits every tile.
  if (
    root.dataset.wrap === "grid" && (direction === "down" || direction === "up")
  ) {
    const index = nextColumn(
      active.getBoundingClientRect(),
      others.map((el) => el.getBoundingClientRect()),
      direction === "down",
    );
    if (index >= 0) return focusElement(others[index]);
  }
  if (root.dataset.wrap === "vertical") {
    if (direction === "down") return focusElement(items[0]);
    if (direction === "up") return focusElement(items[items.length - 1]);
  }
  return false;
}

/**
 * Which cell of an entry row a player lands on: the one marked for their
 * device (`data-nav-entry="pad"` for a gamepad, `"key"` otherwise), else the
 * first. Pure, so the rule is testable without a DOM.
 */
export function pickEntry(
  entries: readonly (string | undefined)[],
  device: string | undefined,
): number {
  const want = device === "gamepad" ? "pad" : "key";
  const index = entries.indexOf(want);
  return index >= 0 ? index : 0;
}

/**
 * Entering a `[data-nav-row]` from outside it (Down from the tab strip into
 * the remap table) lands on the row's entry cell instead of whichever column
 * happened to sit under the tab, so a keyboard player starts in the Keyboard
 * column. Moves within a row, or between rows, keep pure geometry.
 */
function enterRow(
  active: HTMLElement,
  target: HTMLElement,
  root: HTMLElement,
): HTMLElement {
  const row = target.closest<HTMLElement>("[data-nav-row]");
  if (!row) return target;
  const group = row.parentElement;
  if (group?.contains(active)) return target;
  const cells = navigables(row);
  const device = root.closest<HTMLElement>("[data-device]")?.dataset.device;
  return cells[pickEntry(cells.map((c) => c.dataset.navEntry), device)] ??
    target;
}

/**
 * Index of the top tile of the next column to the right (`forward`), or the
 * bottom tile of the previous column to the left; -1 at the grid's end.
 */
export function nextColumn(
  from: Rect,
  candidates: readonly Rect[],
  forward: boolean,
): number {
  let best = -1;
  candidates.forEach((rect, index) => {
    const beyond = forward
      ? rect.left >= from.left + from.width - 1
      : rect.left + rect.width <= from.left + 1;
    if (!beyond) return;
    if (best < 0) {
      best = index;
      return;
    }
    const b = candidates[best];
    // Nearest column first, then its top (forward) or bottom (backward) tile.
    const dx = Math.abs(rect.left - from.left) - Math.abs(b.left - from.left);
    const dy = forward ? rect.top - b.top : b.top - rect.top;
    if (dx < -1 || (Math.abs(dx) <= 1 && dy < 0)) best = index;
  });
  return best;
}

export function focusElement(el: HTMLElement): boolean {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

/** Focuses the element marked `data-autofocus`, else the first navigable. */
export function focusInitial(root: HTMLElement, key?: string | null): void {
  const items = navigables(root);
  const remembered = key
    ? items.find((el) => el.dataset.key === key)
    : undefined;
  const target = remembered ??
    items.find((el) => el.hasAttribute("data-autofocus")) ?? items[0];
  if (target) focusElement(target);
}
