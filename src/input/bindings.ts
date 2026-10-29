/**
 * Pure binding logic: which actions a key or button triggers, and how a
 * remap resolves conflicts. No DOM here, so it runs under `deno test`.
 *
 * Conflicts are judged per context. Gameplay and menus are never active at
 * the same time, so Space can be both Fire and Confirm, and Esc both Pause
 * and Back. Two gameplay actions on one key, though, would be a conflict.
 */

import type { Action, Binding } from "../contracts/index.ts";

export type Bindings = Readonly<Record<Action, Binding>>;

export const ACTIONS: readonly Action[] = [
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "fire",
  "focus",
  "pause",
  "confirm",
  "back",
];

const MOVES: readonly Action[] = [
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
];

/** Actions that are live at the same time and so must not share an input. */
export const CONTEXTS: Readonly<
  Record<"gameplay" | "menu", readonly Action[]>
> = {
  gameplay: [...MOVES, "fire", "focus", "pause"],
  menu: [...MOVES, "confirm", "back"],
};

/** True when `a` and `b` are ever live together. */
export function actionsCollide(a: Action, b: Action): boolean {
  if (a === b) return false;
  return Object.values(CONTEXTS).some((group) =>
    group.includes(a) && group.includes(b)
  );
}

export function actionsForKey(bindings: Bindings, code: string): Action[] {
  return ACTIONS.filter((action) => bindings[action].keys.includes(code));
}

export function actionsForButton(bindings: Bindings, index: number): Action[] {
  return ACTIONS.filter((action) => bindings[action].buttons.includes(index));
}

/** A slot in the controls table: two keyboard columns, one gamepad column. */
export type BindSlot =
  | { readonly device: "key"; readonly index: 0 | 1 }
  | { readonly device: "button"; readonly index: 0 };

export type BindInput = string | number;

/** One side effect of a remap, so the UI can say what moved where. */
export interface BindingMove {
  readonly input: BindInput;
  readonly from: Action;
  /** Where the displaced action's old input went, if a swap happened. */
  readonly swappedIn: BindInput | null;
}

export interface RebindResult {
  readonly bindings: Bindings;
  readonly moves: readonly BindingMove[];
}

function listFor(binding: Binding, slot: BindSlot): readonly BindInput[] {
  return slot.device === "key" ? binding.keys : binding.buttons;
}

function withList(
  binding: Binding,
  slot: BindSlot,
  list: readonly BindInput[],
): Binding {
  return slot.device === "key"
    ? { ...binding, keys: list as string[] }
    : { ...binding, buttons: list as number[] };
}

/**
 * Puts `input` into `action`'s slot. Any colliding action that already used
 * `input` loses it and, when possible, receives the input `action` gave up
 * (a swap), so remapping rarely leaves something unbound.
 */
export function rebind(
  bindings: Bindings,
  action: Action,
  slot: BindSlot,
  input: BindInput,
): RebindResult {
  const next: Record<Action, Binding> = { ...bindings };
  const ownList = listFor(bindings[action], slot);
  const previous = ownList[slot.index] ?? null;
  const moves: BindingMove[] = [];

  for (const other of ACTIONS) {
    if (!actionsCollide(action, other)) continue;
    const otherList = listFor(next[other], slot);
    const at = otherList.indexOf(input);
    if (at === -1) continue;
    const canSwap = previous !== null && previous !== input &&
      !otherList.includes(previous);
    const replaced = otherList.map((value, i) =>
      i === at ? (canSwap ? previous : null) : value
    ).filter((value): value is BindInput => value !== null);
    next[other] = withList(next[other], slot, replaced);
    moves.push({ input, from: other, swappedIn: canSwap ? previous : null });
  }

  // Place the input, dropping any duplicate of it elsewhere in this action.
  const own = ownList.filter((value, i) => value !== input || i === slot.index);
  const placed = [...own];
  if (slot.index < placed.length) placed[slot.index] = input;
  else placed.push(input);
  next[action] = withList(next[action], slot, dedupe(placed));

  return { bindings: next, moves };
}

function dedupe(list: readonly BindInput[]): BindInput[] {
  return list.filter((value, i) => list.indexOf(value) === i);
}

/** Actions left with no key and no button, for an "Unbound" warning. */
export function unboundActions(bindings: Bindings): Action[] {
  return ACTIONS.filter((action) =>
    bindings[action].keys.length === 0 && bindings[action].buttons.length === 0
  );
}
