/**
 * Staged asset loading. Assets are registered under a stage (`boot` on page
 * load, `menu` after the first click, `gameplay` when a run starts, `ending`
 * near the boss) and each stage loads in the background with at most a few
 * downloads at once. Anything not loaded yet is simply missing: callers play
 * silence (or subtitles only) instead of waiting. A stage reports progress,
 * so the loading bar is real.
 *
 * Generic over the loaded type so tests can load strings instead of audio.
 */

export type Stage = "boot" | "menu" | "gameplay" | "ending";

export const STAGES: readonly Stage[] = ["boot", "menu", "gameplay", "ending"];

export interface StageProgress {
  readonly stage: Stage;
  readonly done: number;
  readonly failed: number;
  readonly total: number;
}

export interface LoaderOptions {
  readonly concurrency?: number;
  readonly timeoutMs?: number;
}

export class StagedLoader<T> {
  private readonly urls = new Map<Stage, Set<string>>();
  private readonly cache = new Map<string, T>();
  private readonly inflight = new Map<string, Promise<T | undefined>>();
  private readonly failed = new Set<string>();
  private readonly listeners = new Set<(p: StageProgress) => void>();
  private readonly concurrency: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly fetchOne: (url: string) => Promise<T>,
    options: LoaderOptions = {},
  ) {
    this.concurrency = options.concurrency ?? 3;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  add(stage: Stage, url: string): void {
    let set = this.urls.get(stage);
    if (!set) this.urls.set(stage, set = new Set());
    set.add(url);
  }

  /** The asset if it has arrived, else `undefined` (never waits). */
  get(url: string): T | undefined {
    return this.cache.get(url);
  }

  /** True once a fetch of `url` has failed (it will not be retried). */
  hasFailed(url: string): boolean {
    return this.failed.has(url);
  }

  /** Fetches one asset now (deduplicated). Resolves `undefined` on failure. */
  request(url: string): Promise<T | undefined> {
    const cached = this.cache.get(url);
    if (cached !== undefined) return Promise.resolve(cached);
    let p = this.inflight.get(url);
    if (!p) {
      p = withTimeout(this.fetchOne(url), this.timeoutMs)
        .then((asset) => {
          this.cache.set(url, asset);
          return asset;
        })
        .catch(() => {
          this.failed.add(url);
          return undefined;
        })
        .finally(() => this.inflight.delete(url));
      this.inflight.set(url, p);
    }
    return p;
  }

  /** Loads a stage, `concurrency` at a time. Never rejects. */
  async loadStage(stage: Stage): Promise<StageProgress> {
    const queue = [...(this.urls.get(stage) ?? [])];
    const total = queue.length;
    let done = 0;
    let failed = 0;
    const report = (): StageProgress => ({ stage, done, failed, total });
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const asset = await this.request(url);
        if (asset === undefined) failed++;
        done++;
        for (const listener of this.listeners) listener(report());
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, total) }, worker),
    );
    return report();
  }

  /** Progress after each finished asset. Returns unsubscribe. */
  onProgress(listener: (p: StageProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}
