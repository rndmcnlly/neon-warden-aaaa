import { createFlatLogos } from "../../src/presentation/flatLogos.ts";
import "../../src/presentation/flatLogos.css";

const layer = createFlatLogos(document.querySelector("#logos")!);
// Only this isolated reviewer owns a clock. Production uses Director cue time.
let start: number | null = null;
let handle = 0;
const button = document.querySelector<HTMLButtonElement>("#play")!;
layer.show("studio");
layer.update(2000);
button.onclick = () => {
  cancelAnimationFrame(handle);
  start = null;
  button.hidden = true;
  const frame = (now: number) => {
    start ??= now;
    const elapsed = now - start;
    if (elapsed < 3200) {
      layer.show("studio");
      layer.update(elapsed);
    } else if (elapsed < 6400) {
      layer.show("incubator");
      layer.update(elapsed - 3200);
    } else {
      layer.hide();
    }
    if (elapsed < 8000) handle = requestAnimationFrame(frame);
    else button.hidden = false;
  };
  handle = requestAnimationFrame(frame);
};
Object.assign(globalThis, { logoReview: layer });
