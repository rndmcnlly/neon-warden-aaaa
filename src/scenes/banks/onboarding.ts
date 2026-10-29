/** Helpful optional corrections, text-only until pending VO is rendered. */
import type { Bank } from "./types.ts";

export const tutorialOtherLeft: Bank = {
  id: "tutorialOtherLeft",
  note:
    "Only a fresh opposite horizontal action during a named direction drill.",
  triggers: [{ on: "app", moment: "tutorialOtherLeft" }],
  speaker: "tutorial_ai",
  cooldownMs: 16000,
  priority: 20,
  variants: [
    {
      id: "bank.tutorialOtherLeft.1",
      vo: false,
      en: "No, your other left. Let's try that direction again.",
      es: "No, la otra izquierda. Probemos otra vez en esa dirección.",
      zh: "不对，是另一边的左。我们再试一次。",
    },
    {
      id: "bank.tutorialOtherLeft.2",
      vo: false,
      en: "A fine direction. For this step, try the opposite one.",
      es: "Buena dirección. Para este paso, prueba hacia el otro lado.",
      zh: "这个方向也不错。不过这一步，请试试反方向。",
    },
    {
      id: "bank.tutorialOtherLeft.3",
      vo: false,
      en: "Mirrored controls? Not today. Try the other side.",
      es: "¿Controles invertidos? Hoy no. Prueba hacia el otro lado.",
      zh: "方向反过来了？今天没有哦。试试另一边。",
    },
    {
      id: "bank.tutorialOtherLeft.4",
      vo: false,
      en:
        "Navigation has two sides to every story. We need the other side here.",
      es: "La navegación tiene dos lados. Aquí necesitamos el otro.",
      zh: "导航也要听听两边的意见。这次，请往另一边。",
    },
  ],
};

export const tutorialLockout: Bank = {
  id: "tutorialLockout",
  note:
    "Fresh fire while explicitly practicing rest, never an unknown key or accessibility setting.",
  triggers: [{ on: "app", moment: "tutorialLockout" }],
  speaker: "tutorial_ai",
  cooldownMs: 16000,
  priority: 20,
  variants: [
    {
      id: "bank.tutorialLockout.1",
      vo: false,
      en:
        "Command lockout. Not really. Just let the trigger rest for this step.",
      es:
        "Comando bloqueado. Es broma. En este paso, deja descansar el gatillo.",
      zh: "指令已锁定。开玩笑的。这一步，先松开扳机，让它歇一歇。",
    },
    {
      id: "bank.tutorialLockout.2",
      vo: false,
      en: "That shot can wait. Release fire and watch the charge build.",
      es:
        "Ese disparo puede esperar. Suelta el gatillo y mira cómo sube la carga.",
      zh: "这一枪可以等等。松开开火键，看看能量慢慢蓄满。",
    },
    {
      id: "bank.tutorialLockout.3",
      vo: false,
      en: "A brief ceasefire. The gun does its homework while you rest.",
      es: "Un pequeño alto al fuego. El arma hace su tarea mientras descansas.",
      zh: "先停火一小会儿。你休息的时候，武器会自己做功课。",
    },
    {
      id: "bank.tutorialLockout.4",
      vo: false,
      en:
        "The trigger has received your enthusiasm. Now give it a moment to recharge.",
      es:
        "El gatillo ya recibió tu entusiasmo. Ahora dale un momento para recargarse.",
      zh: "扳机已经感受到你的热情了。现在给它一点时间充能吧。",
    },
  ],
};
