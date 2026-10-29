/**
 * Moments gallery, step 2: pick the best instance of each moment type from
 * the capture timelines, cut a short clip around it, and measure it.
 *
 *   deno run -A --no-lock research/2026-10-28-moments/cut.ts
 *
 * Reads captures/<id>/timeline.json and capture.mp4 (from capture.ts).
 * Writes clips/<moment>.mp4 (H.264 + AAC), clips/<moment>.jpg (poster at
 * the anchor) and moments.json (clips, measurements, missing list) for the
 * gallery. Pickers are data: each returns an anchor time in a capture, or
 * null with a reason.
 */

const HERE = new URL(".", import.meta.url).pathname;
const CAP = `${HERE}captures`;
const CLIPS = `${HERE}clips`;

type Category = "combat" | "nonviolence" | "narrative" | "audio" | "ui";

interface Entry {
  t: number;
  k: "log" | "ev" | "dom";
  e?: any;
  name?: string;
  value?: string;
}
interface Sub {
  t: number;
  text: string;
  visible: boolean;
  layer: string;
  line: string;
}
interface Timeline {
  id: string;
  seconds: number;
  entries: Entry[];
  subs: Sub[];
  words: { t: number; line: string; index: number }[];
}

interface Pick {
  capture: string;
  /** Anchor: the moment itself; the poster frame. */
  t: number;
  /** Seconds before the anchor (default 2). */
  pre?: number;
  /** Clip length (4–10 s, default 7). */
  dur?: number;
  why: string;
}

interface Moment {
  id: string;
  title: string;
  categories: Category[];
  caption: string;
  pick: (tl: Record<string, Timeline>) => Pick | string;
}

const evs = (tl: Timeline, type: string) =>
  tl.entries.filter((e) => e.k === "ev" && e.e.type === type);
const logAt = (tl: Timeline, entry: string) =>
  tl.entries.find((e) => e.k === "log" && e.e === entry)?.t;
const dom = (tl: Timeline, name: string) =>
  tl.entries.filter((e) => e.k === "dom" && e.name === name && e.value);
const near = (xs: Entry[], t: number, w: number) =>
  xs.filter((x) => Math.abs(x.t - t) <= w).length;
const f1 = (x: number) => x.toFixed(1);

/** Earliest instance of a line in any of the captures, in order of preference. */
function line(tl: Record<string, Timeline>, ids: string[], entry: string) {
  for (const id of ids) {
    const t = tl[id] && logAt(tl[id], entry);
    if (t !== undefined) return { capture: id, t };
  }
  return null;
}

const MOMENTS: Moment[] = [
  {
    id: "scan-lock",
    title: "Scan lock and intel tag",
    categories: ["combat", "ui", "audio"],
    caption:
      "Rest, the beam sweeps and dwells, locks: look for the intel tag with the AI state; listen for the dwell tick and lock tone.",
    pick(tl) {
      const s1 = tl["fight-s1"];
      // A lock with its intel right after, away from other locks.
      const locks = evs(s1, "scanLock").filter((l) =>
        evs(s1, "intel").some((i) => i.t >= l.t && i.t - l.t < 0.5) &&
        near(evs(s1, "scanLock"), l.t, 2.5) === 1
      );
      const l = locks[1] ?? locks[0];
      return l
        ? {
          capture: "fight-s1",
          t: l.t,
          pre: 2.5,
          dur: 7,
          why: `lock on ${l.e.kind}, ai ${l.e.ai}`,
        }
        : "no isolated scanLock with intel";
    },
  },
  {
    id: "writ-charge",
    title: "Writ charge and release",
    categories: ["combat", "audio"],
    caption:
      "Charge cells fill 1, 2, 3 while resting, then the Writ goes: listen for the rising charge steps landing on the beat and the release.",
    pick(tl) {
      const s1 = tl["fight-s1"];
      const ch = evs(s1, "chargeLevel");
      for (const [i, c] of ch.entries()) {
        if (c.e.level !== 3) continue;
        const start = [...ch.slice(0, i)].reverse().find((x) =>
          x.e.level === 1
        );
        const spent = ch.slice(i).find((x) => x.e.level === 0);
        if (start && spent && spent.t - start.t < 8) {
          return {
            capture: "fight-s1",
            t: spent.t,
            pre: spent.t - start.t + 1,
            dur: Math.min(10, spent.t - start.t + 3.5),
            why: `level 1 at ${f1(start.t)} s, level 3 at ${
              f1(c.t)
            } s, spent at ${f1(spent.t)} s`,
          };
        }
      }
      return "no full 1-2-3-release cycle under 8 s in fight-s1";
    },
  },
  {
    id: "writ-kill-shot",
    title: "Writ kill shot on the weak point",
    categories: ["combat"],
    caption:
      "A locked Writ on the weak point: the clean kill. Look for the weak-point flash and the bigger payout; listen for the heavier kill sound.",
    pick(tl) {
      for (const id of ["fight-s1", "fight-s3"]) {
        const k = evs(tl[id], "kill").find((k) => k.e.clean);
        if (k) {
          return {
            capture: id,
            t: k.t,
            pre: 3,
            dur: 6,
            why: `clean kill of ${k.e.kind}`,
          };
        }
      }
      return "no clean kill";
    },
  },
  {
    id: "clean-disarm",
    title: "Clean disarm: scout powers down",
    categories: ["nonviolence", "combat"],
    caption:
      "Last weapon part breaks and the scout stops firing: look for the power-down and SCOUTS SPARED; listen for the disarm cue, not an explosion. Its later departure has a separate clip.",
    pick(tl) {
      // In a sector (not the arena, where escorts are wiped), and slow
      // enough to see the power-down: the longest disarm-to-exit span wins
      // (sector-3 scouts leave in under a second; the disarmer's drift).
      let best: Pick | null = null;
      let bestSpan = 0;
      for (const id of ["fight-s1", "fight-s3", "disarm-s2"]) {
        const arena = logAt(tl[id], "scene:boss") ?? Infinity;
        for (const d of evs(tl[id], "disarm")) {
          if (d.t > arena) continue;
          const gone = evs(tl[id], "despawn").find((x) =>
            x.e.id === d.e.id && x.e.reason === "spared"
          );
          if (!gone) continue;
          const span = gone.t - d.t;
          if (span > bestSpan) {
            bestSpan = span;
            best = {
              capture: id,
              t: d.t,
              pre: 2,
              dur: Math.min(10, Math.max(5, span + 3)),
              why: `disarm at ${f1(d.t)} s, leaves (spared) at ${f1(gone.t)} s`,
            };
          }
        }
      }
      return best ?? "no disarm followed by a spared despawn within 7.5 s";
    },
  },
  {
    id: "spared-departure",
    title: "Spared scout leaves the lane",
    categories: ["nonviolence"],
    caption:
      "The scout disarmed earlier leaves alive. The probe records a spared despawn, not a kill; check whether its departure is visually legible.",
    pick(tl) {
      const t = tl["disarm-s2"];
      const d = evs(t, "despawn").find((e) => e.e.reason === "spared");
      return d
        ? {
          capture: "disarm-s2",
          t: d.t,
          pre: 3,
          dur: 6,
          why: `spared despawn of scout ${d.e.id}`,
        }
        : "no spared departure";
    },
  },
  {
    id: "disarm-then-kill",
    title: "Disarmed scout shot down anyway (fight autopilot)",
    categories: ["nonviolence", "combat"],
    caption:
      "The fight autopilot disarms a scout and kills it about half a second later: does the game make that read as a choice, or is it noise?",
    pick(tl) {
      const s1 = tl["fight-s1"];
      for (const d of evs(s1, "disarm")) {
        const k = evs(s1, "kill").find((k) => k.e.id === d.e.id && k.t > d.t);
        if (k) {
          return {
            capture: "fight-s1",
            t: d.t,
            pre: 2,
            dur: 5,
            why: `disarm at ${f1(d.t)} s, killed at ${f1(k.t)} s`,
          };
        }
      }
      return "no disarmed scout was killed";
    },
  },
  {
    id: "part-break",
    title: "Weapon part break",
    categories: ["combat", "audio"],
    caption:
      "One weapon part snaps off a scout that keeps flying: look for the debris and the part going dark; listen for the break crack.",
    pick(tl) {
      for (const id of ["fight-s1", "fight-s3"]) {
        const p = evs(tl[id], "partBreak").find((p) =>
          p.e.target === "enemy" &&
          !evs(tl[id], "disarm").some((d) =>
            d.e.id === p.e.id && Math.abs(d.t - p.t) < 0.3
          )
        );
        if (p) {
          return {
            capture: id,
            t: p.t,
            dur: 6,
            why: `${p.e.partKind} by ${p.e.by}`,
          };
        }
      }
      return "every part break was also the disarming break";
    },
  },
  {
    id: "warden-pods-core",
    title: "Warden pod breaks and the core opens",
    categories: ["combat", "narrative"],
    caption:
      "Two of the Warden's four pods break and the core opens: look for the core reveal; listen for the pod line and the Warden's reaction.",
    pick(tl) {
      for (const id of ["boss-fight", "boss-pacifist"]) {
        const pods = evs(tl[id], "partBreak").filter((p) =>
          p.e.target === "boss"
        );
        const core = evs(tl[id], "coreExposed")[0];
        if (pods.length >= 1 && core) {
          const pre = Math.min(6, core.t - pods[0].t + 1.5);
          return {
            capture: id,
            t: core.t,
            pre,
            dur: Math.min(10, pre + 3.5),
            why: `pods at ${pods.map((p) => f1(p.t)).join(", ")} s, core at ${
              f1(core.t)
            } s`,
          };
        }
      }
      return "no coreExposed";
    },
  },
  {
    id: "graze-chain",
    title: "Graze chain",
    categories: ["nonviolence", "audio", "ui"],
    caption:
      "A run of near-touches fills the graze meter and the count climbs: listen for the graze ticks carrying the musical layer on the beat.",
    pick(tl) {
      let best: { id: string; t: number; n: number } | null = null;
      for (const id of ["disarm-s2", "fight-s3"]) {
        const gz = evs(tl[id], "graze").filter((g) =>
          !tl[id].entries.some((e) =>
            e.k === "log" && e.e === "scene:boss" && e.t < g.t
          )
        );
        for (const g of gz) {
          const n = gz.filter((x) => x.t >= g.t && x.t < g.t + 4).length;
          if (!best || n > best.n) best = { id, t: g.t, n };
        }
      }
      return best
        ? {
          capture: best.id,
          t: best.t,
          pre: 1.5,
          dur: 7,
          why: `${best.n} grazes in 4 s`,
        }
        : "no grazes";
    },
  },
  {
    id: "near-miss-doppler",
    title: "Near-miss whoosh with doppler",
    categories: ["audio"],
    caption:
      "A fast enemy round passes close with little else going on: listen for the whoosh bending in pitch and moving across the stereo field.",
    pick(tl) {
      let best: { id: string; e: Entry; score: number } | null = null;
      for (const id of ["fight-s1", "disarm-s2"]) {
        const nm = evs(tl[id], "nearMiss");
        for (const m of nm) {
          const v = Math.hypot(m.e.relVel.x, m.e.relVel.y);
          const crowd = near(nm, m.t, 1.5) +
            near(evs(tl[id], "kill"), m.t, 1.5);
          const score = v / (1 + m.e.distance) / crowd;
          if (!best || score > best.score) best = { id, e: m, score };
        }
      }
      return best
        ? {
          capture: best.id,
          t: best.e.t,
          pre: 2,
          dur: 5,
          why: `rel speed ${
            f1(Math.hypot(best.e.e.relVel.x, best.e.e.relVel.y))
          }/tick at ${f1(best.e.e.distance)} units, ${
            best.e.e.heavy ? "heavy" : "light"
          }`,
        }
        : "no nearMiss";
    },
  },
  {
    id: "enemy-volley",
    title: "Enemy fire volley",
    categories: ["combat", "audio"],
    caption:
      "The biggest single enemy volley: listen for enemy weapons placed off-key and panned to the shooter, distinct from the player's on-beat fire.",
    pick(tl) {
      let best: { id: string; e: Entry } | null = null;
      for (const id of ["fight-s3", "disarm-s2", "boss-fight"]) {
        for (const v of evs(tl[id], "enemyFired")) {
          if (!best || v.e.bullets > best.e.e.bullets) best = { id, e: v };
        }
      }
      return best
        ? {
          capture: best.id,
          t: best.e.t,
          pre: 2,
          dur: 6,
          why: `${best.e.e.bullets} bullets, ${best.e.e.weapon}`,
        }
        : "no enemyFired";
    },
  },
  {
    id: "pay-climb",
    title: "Pay multiplier climbing",
    categories: ["ui", "combat"],
    caption:
      "PAY and the multiplier climb with kills, breaks and scans: watch the multiplier tick up and turn hot at 2.0.",
    pick(tl) {
      let best: { id: string; t: number; gain: number } | null = null;
      for (const id of ["fight-s1", "fight-s3"]) {
        const pc = evs(tl[id], "payChanged");
        for (const p of pc) {
          const later = pc.filter((x) => x.t > p.t && x.t <= p.t + 7);
          if (!later.length) continue;
          const gain = Math.max(...later.map((x) => x.e.rate)) - p.e.rate;
          if (!best || gain > best.gain) best = { id, t: p.t, gain };
        }
      }
      return best
        ? {
          capture: best.id,
          t: best.t + 3.5,
          pre: 3.5,
          dur: 8,
          why: `rate +${best.gain.toFixed(2)} in 7 s`,
        }
        : "no payChanged";
    },
  },
  {
    id: "pay-halved-hit",
    title: "Player hit: life lost and pay halved",
    categories: ["ui", "combat", "audio"],
    caption:
      "An idle ship takes hits: look for the multiplier halving (rate break) and the life pip going; listen for the hit sting and any bark.",
    pick(tl) {
      const c = tl["continue"];
      const rb = evs(c, "payChanged").find((p) => p.e.reason === "rateBreak");
      return rb
        ? {
          capture: "continue",
          t: rb.t,
          pre: 2.5,
          dur: 6,
          why: `rate to ${rb.e.rate} at life lost`,
        }
        : "no rateBreak";
    },
  },
  {
    id: "shield-absorb",
    title: "Shield absorbs a hit",
    categories: ["combat", "audio"],
    caption: "",
    pick(tl) {
      for (const [id, t] of Object.entries(tl)) {
        const b = t.entries.find((e) =>
          e.k === "log" && /bark:bark_shield/.test(e.e)
        );
        if (b) return { capture: id, t: b.t, why: "shield bark" };
      }
      return "no shield bark or shield pickup in any capture; shield hits are per-shot `hit` events the probe omits, and the autopilots were never hit while shielded";
    },
  },
  {
    id: "radio-lore",
    title: "Radio lore line with on-screen radio text",
    categories: ["narrative", "audio", "ui"],
    caption:
      "Scout channel chatter leaks lore: look for the radio text with its side marker; listen for the voice panned to the speaker's side, under the mix.",
    pick(tl) {
      for (const id of ["fight-s1", "fight-s3", "disarm-s2"]) {
        const r = dom(tl[id], "radio").find((r) =>
          !tl[id].subs.some((s) =>
            s.visible && s.layer === "scripted" && Math.abs(s.t - r.t) < 3
          )
        );
        if (r) {
          return {
            capture: id,
            t: r.t,
            pre: 1.5,
            dur: 8,
            why: r.value!.slice(0, 80),
          };
        }
      }
      return "no radio line clear of scripted dialogue";
    },
  },
  {
    id: "word-pulse-warden",
    title: "Word-pulse subtitle on a Warden line",
    categories: ["ui", "narrative"],
    caption:
      "The Warden's descent line with the spoken word pulsing in the subtitle: check the pulse leads or lags the voice by eye and ear.",
    pick(tl) {
      // Word events carry an empty line id (the subtitle box has no
      // data-line), so take the pulses between desc_001 and the next line.
      const b = tl["boss-fight"];
      const from = logAt(b, "line:desc_001");
      const to = logAt(b, "line:desc_ai_001");
      if (from === undefined || to === undefined) return "no desc_001";
      const w = b.words.filter((w) => w.t >= from && w.t < to);
      return w.length
        ? {
          capture: "boss-fight",
          t: from,
          pre: 1,
          dur: 6,
          why:
            `${w.length} word pulses during desc_001 (word events have an empty line id)`,
        }
        : "no word pulses on a Warden line";
    },
  },
  {
    id: "flashback-powerup",
    title: "Flashback trigger: first powerup",
    categories: ["narrative"],
    caption:
      "The first powerup freezes the run and cuts to the flashback: look for the transition; listen for the music handoff to the flashback cue.",
    pick(tl) {
      const p = evs(tl["fight-s1"], "pickup")[0];
      return p
        ? {
          capture: "fight-s1",
          t: p.t,
          pre: 2,
          dur: 10,
          why: `${p.e.kind} pickup, scene:flashback at ${
            f1(logAt(tl["fight-s1"], "scene:flashback") ?? NaN)
          } s`,
        }
        : "no pickup in fight-s1";
    },
  },
  {
    id: "flashback-recorder",
    title: "Flashback trigger: #0121's flight recorder",
    categories: ["narrative"],
    caption:
      "The sector-3 salvage cache is #0121's derelict recorder: look for the recorder scene; listen for the recorder voice treatment versus the live AI.",
    pick(tl) {
      const p = evs(tl["fight-s3"], "pickup").find((p) =>
        p.e.kind === "recorder"
      );
      return p
        ? {
          capture: "fight-s3",
          t: p.t,
          pre: 2,
          dur: 10,
          why: `recorder pickup, first line flash_rec_001 at ${
            f1(logAt(tl["fight-s3"], "line:flash_rec_001") ?? NaN)
          } s`,
        }
        : "no recorder pickup";
    },
  },
  {
    id: "warden-descent",
    title: "Warden descent speech",
    categories: ["narrative", "audio"],
    caption:
      "WARNING, then the Warden arrives furious and high, not booming: listen for the arena-PA treatment and whether the deflation lands.",
    pick(tl) {
      const t = logAt(tl["boss-fight"], "line:warn_narr_001");
      return t !== undefined
        ? {
          capture: "boss-fight",
          t,
          pre: 1,
          dur: 10,
          why: "warn_narr_001 into desc_001, desc_ai_001, desc_002",
        }
        : "no descent";
    },
  },
  {
    id: "boss-phase",
    title: "Warden phase change",
    categories: ["combat", "narrative", "audio"],
    caption:
      "The Warden shifts phase: look for the pattern change; listen for the phase line and any music step-up.",
    pick(tl) {
      const p =
        evs(tl["boss-fight"], "bossPhase").find((p) => p.e.phase === 3) ??
          evs(tl["boss-fight"], "bossPhase").find((p) => p.e.phase === 2);
      return p
        ? {
          capture: "boss-fight",
          t: p.t,
          pre: 2,
          dur: 7,
          why: `phase ${p.e.phase}`,
        }
        : "no bossPhase";
    },
  },
  {
    id: "kill-ending",
    title: "Kill ending: the Warden falls, the replacement",
    categories: ["narrative"],
    caption:
      "The Warden's last line, WARDEN DOWN, then the epilogue: listen for kill_ai_004, the replacement already in onboarding.",
    pick(tl) {
      const t = logAt(tl["boss-fight"], "line:kill_ai_004");
      return t !== undefined
        ? { capture: "boss-fight", t, pre: 2, dur: 6, why: "kill_ai_004" }
        : "no kill_ai_004";
    },
  },
  {
    id: "warden-falls",
    title: "The Warden falls",
    categories: ["combat", "narrative"],
    caption:
      "The killing blow and the Warden's last words over the WARDEN DOWN banner: is it a triumph, or does it already feel wrong?",
    pick(tl) {
      const d = evs(tl["boss-fight"], "bossDefeated")[0];
      return d
        ? {
          capture: "boss-fight",
          t: d.t,
          pre: 2,
          dur: 8,
          why: "bossDefeated, kill_warden_001",
        }
        : "no bossDefeated";
    },
  },
  {
    id: "ghost-line",
    title: "Warden reacts to the never-fired run",
    categories: ["nonviolence", "narrative"],
    caption:
      "desc_pac_002 into desc_ghost_001, the Warden noticing a pilot who never fired (reached via skipto=boss before the disarmer's first shot; a full disarmer run hears desc_disarm_001 instead).",
    pick(tl) {
      const r = line(tl, ["boss-pacifist"], "line:desc_ghost_001");
      return r
        ? { ...r, pre: 1, dur: 6, why: "desc_ghost_001" }
        : "desc_ghost_001 never played";
    },
  },
  {
    id: "pacifist-ending",
    title: "Pacifist ending: the Pilot's one line and Lanes Kept",
    categories: ["nonviolence", "narrative"],
    caption:
      "The Pilot's single spoken line (pilot_keep_001), then LANES KEPT: listen for whether the one line is earned and audible.",
    pick(tl) {
      const t = logAt(tl["boss-pacifist"], "line:pilot_keep_001");
      return t !== undefined
        ? {
          capture: "boss-pacifist",
          t,
          pre: 2,
          dur: 8,
          why: "pilot_keep_001 into pac_end_005",
        }
        : "pilot_keep_001 never played";
    },
  },
  {
    id: "lanes-kept",
    title: "Lanes Kept banner",
    categories: ["nonviolence", "ui"],
    caption:
      "The pacifist outcome banner and epilogue start: compare its weight with WARDEN DOWN.",
    pick(tl) {
      const b = dom(tl["boss-pacifist"], "banner").find((b) =>
        /LANES KEPT/.test(b.value!)
      );
      return b
        ? { capture: "boss-pacifist", t: b.t, pre: 2, dur: 7, why: b.value! }
        : "no Lanes Kept banner";
    },
  },
  {
    id: "hangar-swap",
    title: "Hangar loadout swap with live preview",
    categories: ["ui"],
    caption:
      "Weapon package swaps with stat deltas, then sensors: watch the preview and the delta colors; listen for the UI ticks.",
    pick(tl) {
      const h = dom(tl["hangar"], "hangar");
      return h.length > 1
        ? {
          capture: "hangar",
          t: h[1].t,
          pre: 2,
          dur: 9,
          why: `${h.length} stat panel changes`,
        }
        : "hangar stats never changed";
    },
  },
  {
    id: "hangar-cosmetics",
    title: "Hangar cosmetics: paint, trim, trail",
    categories: ["ui"],
    caption:
      "Paint, trim and engine trail changes on the live ship preview: is each change visible at a glance?",
    pick(tl) {
      const h = dom(tl["hangar"], "hangar");
      const last = h[h.length - 1];
      return last
        ? {
          capture: "hangar",
          t: last.t + 3,
          pre: 1,
          dur: 10,
          why: "after the sensor swaps",
        }
        : "no hangar";
    },
  },
  {
    id: "tutorial-wink",
    title: "Tutorial wink line",
    categories: ["narrative"],
    caption: "",
    pick(tl) {
      const r = line(
        tl,
        ["tutorial", "tutorial-2x-stall"],
        "line:tut_wink_001",
      );
      return r
        ? { ...r, why: "tut_wink_001" }
        : "the tutorial stalls at module 4 (tut_tap_001, then tut_idle_001 nudges forever) at 2x and 8x: src/app/tutorialDemo.ts scripts only move and focus with no enemy up, so the tap and stream prompts never get a fire press";
    },
  },
  {
    id: "tutorial-stall",
    title: "Tutorial stall at the tap module (bug evidence)",
    categories: ["narrative", "ui"],
    caption:
      "tut_tap_001 asks for a tap, the autopilot never fires with no target up, tut_idle_001 nudges: the reason the wink is missing.",
    pick(tl) {
      const r = line(tl, ["tutorial-2x-stall"], "line:tut_idle_001");
      return r
        ? { ...r, pre: 7, dur: 10, why: "tut_tap_001 then tut_idle_001" }
        : "no stall";
    },
  },
  {
    id: "tutorial-lock",
    title: "Tutorial: first lock and clean kill on the hologram",
    categories: ["combat", "ui"],
    caption:
      "The practice target, the first lock and a clean kill, at 2x: the onboarding voice over the first real verb.",
    pick(tl) {
      const k = evs(tl["tutorial-2x-stall"], "kill")[0];
      return k
        ? {
          capture: "tutorial-2x-stall",
          t: k.t,
          pre: 4,
          dur: 8,
          why: `clean ${k.e.clean}`,
        }
        : "no tutorial kill";
    },
  },
  {
    id: "sector-banner",
    title: "Sector banner",
    categories: ["ui", "narrative"],
    caption:
      "SECTOR 4, Lancer Gate: look at the banner type and timing; listen for the sector sting and intro line.",
    pick(tl) {
      const b = dom(tl["fight-s3"], "banner").find((b) =>
        /SECTOR 4/.test(b.value!)
      );
      return b
        ? { capture: "fight-s3", t: b.t, pre: 1.5, dur: 6, why: b.value! }
        : "no sector banner";
    },
  },
  {
    id: "continue-screen",
    title: "Game over and the continue screen",
    categories: ["ui"],
    caption:
      "Third life lost, GAME OVER, Continue? with continues left: check focus moves and the screen's sound.",
    pick(tl) {
      const c = dom(tl["continue"], "continue")[0];
      return c
        ? {
          capture: "continue",
          t: c.t,
          pre: 2.5,
          dur: 8,
          why: "nw-screen-continue",
        }
        : "no continue screen";
    },
  },
];

// -- media

async function run(cmd: string, args: string[]): Promise<string> {
  const r = await new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const err = new TextDecoder().decode(r.stderr);
  if (!r.success) throw new Error(`${cmd} failed: ${err.slice(-400)}`);
  return err + new TextDecoder().decode(r.stdout);
}

async function cut(src: string, start: number, dur: number, out: string) {
  await run("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-ss",
    start.toFixed(3),
    "-i",
    src,
    "-t",
    dur.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    out,
  ]);
}

async function poster(src: string, at: number, out: string) {
  await run("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-ss",
    at.toFixed(3),
    "-i",
    src,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:360",
    "-q:v",
    "4",
    out,
  ]);
}

/** Integrated loudness, LRA, true peak, and L/R RMS balance (0 left, 0.5 centre, 1 right). */
async function measure(clip: string) {
  const e = await run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    clip,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ]);
  const summary = e.slice(e.lastIndexOf("Summary:"));
  const num = (re: RegExp) => Number(summary.match(re)?.[1] ?? NaN);
  const a = await run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    clip,
    "-af",
    "astats=measure_overall=none:measure_perchannel=RMS_level",
    "-f",
    "null",
    "-",
  ]);
  const rms = [...a.matchAll(/RMS level dB: (-?[\d.]+|-inf)/g)].map((m) =>
    m[1] === "-inf" ? 0 : 10 ** (Number(m[1]) / 20)
  );
  const [l, r] = rms;
  return {
    lufs: num(/I:\s+(-?[\d.]+) LUFS/),
    lra: num(/LRA:\s+(-?[\d.]+) LU/),
    truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/),
    balance: l + r > 0 ? Math.round((r / (l + r)) * 1000) / 1000 : null,
    lrDb: l > 0 && r > 0 ? Math.round(20 * Math.log10(r / l) * 10) / 10 : null,
  };
}

// -- main

const tl: Record<string, Timeline> = {};
for await (const d of Deno.readDir(CAP)) {
  if (!d.isDirectory) continue;
  try {
    tl[d.name] = {
      ...JSON.parse(await Deno.readTextFile(`${CAP}/${d.name}/timeline.json`)),
      id: d.name,
    };
  } catch { /* capture without a timeline */ }
}
await Deno.mkdir(CLIPS, { recursive: true });

const clips = [];
const missing = [];
for (const m of MOMENTS) {
  let p: Pick | string;
  try {
    p = m.pick(tl);
  } catch (err) {
    p = `picker error: ${String(err).slice(0, 200)}`;
  }
  if (typeof p === "string") {
    missing.push({
      id: m.id,
      title: m.title,
      categories: m.categories,
      reason: p,
    });
    console.log(`MISSING ${m.id}: ${p}`);
    continue;
  }
  const pre = p.pre ?? 2;
  const dur = Math.min(10, Math.max(4, p.dur ?? 7));
  const cap = tl[p.capture];
  const start = Math.max(0, Math.min(p.t - pre, cap.seconds - dur));
  const src = `${CAP}/${p.capture}/capture.mp4`;
  await cut(src, start, dur, `${CLIPS}/${m.id}.mp4`);
  await poster(
    src,
    Math.min(p.t + 0.3, cap.seconds - 0.1),
    `${CLIPS}/${m.id}.jpg`,
  );
  const meas = await measure(`${CLIPS}/${m.id}.mp4`);
  // Lines and subtitle text inside the window, for the gallery.
  const lines = cap.entries.filter((e) =>
    e.k === "log" && /^(line|bark):/.test(e.e) && e.t >= start &&
    e.t <= start + dur
  ).map((e) => e.e.replace(/^line:/, ""));
  clips.push({
    id: m.id,
    title: m.title,
    categories: m.categories,
    caption: m.caption,
    capture: p.capture,
    query: (cap as unknown as { query: string }).query,
    start: Math.round(start * 100) / 100,
    anchor: Math.round(p.t * 100) / 100,
    seconds: dur,
    why: p.why,
    lines,
    ...meas,
  });
  console.log(
    `${m.id}: ${p.capture} @${f1(p.t)} s, ${
      f1(dur)
    } s, ${meas.lufs} LUFS, bal ${meas.balance}; ${p.why}`,
  );
}

const captures = Object.values(tl).map((t) => ({
  id: t.id,
  title: (t as unknown as { title: string }).title,
  query: (t as unknown as { query: string }).query,
  seconds: Math.round(t.seconds * 10) / 10,
  lufs: (t as unknown as { av: { lufs: number } }).av.lufs,
  truePeak: (t as unknown as { av: { truePeak: number } }).av.truePeak,
  notes: (t as unknown as { notes: string[] }).notes,
  checks: (t as unknown as {
    checks: { id: string; status: string; detail: string }[];
  }).checks
    .map((c) => `${c.status}: ${c.id}: ${c.detail.slice(0, 160)}`),
}));
await Deno.writeTextFile(
  `${HERE}moments.json`,
  JSON.stringify(
    { generated: new Date().toISOString(), captures, clips, missing },
    null,
    1,
  ),
);
console.log(`${clips.length} clips, ${missing.length} missing`);
