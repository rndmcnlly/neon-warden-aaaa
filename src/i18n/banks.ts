/**
 * Text-only bank variants (`bank.*` ids) as a lookup table, so `t()` can
 * show them as subtitles. The text itself lives with its bank in
 * `src/scenes/banks/`; voiced variants (`var_*`, `stat_*`) come through the
 * script table instead, like every VO line.
 */

import { ALL_BANKS } from "../scenes/banks/index.ts";
import type { LocalizedText } from "./types.ts";

export const BANK_TEXT: Readonly<Record<string, LocalizedText>> = Object
  .fromEntries(
    ALL_BANKS.flatMap((bank) =>
      bank.variants
        .filter((variant) => !variant.vo)
        .map((variant) => [
          variant.id,
          { en: variant.en, es: variant.es, zh: variant.zh },
        ])
    ),
  );
