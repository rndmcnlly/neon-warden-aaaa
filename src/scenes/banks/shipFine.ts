/**
 * "The ship isn't fine, but you're fine": the line Adam laughed at in the
 * first playtest (`bark_lifelost_001`), grown into a pool so it almost never
 * repeats. The joke is the assistant's sincere priority order: the Pilot's
 * wellbeing, the hull, the invoice, always all three, always in that order,
 * and always a little too fast on the third.
 *
 * Sub-cases (`when`): `hit` for a hull hit that costs a life with lives to
 * spare, `shieldBreak` for the hit the shield absorbed, `nearDeath` when one
 * life is left, `respawn` for the new hull arriving.
 */

import type { Bank } from "./types.ts";

export const shipFine: Bank = {
  id: "shipFine",
  note:
    "Player hit, shield break, near death, respawn. Lines are sincere: she is relieved the Pilot is unhurt, then remembers the hull, then the money.",
  triggers: [
    { on: "event", type: "lifeLost" },
    {
      on: "event",
      type: "hit",
      where: { target: "player", absorbedByShield: true },
    },
  ],
  speaker: "tutorial_ai",
  cooldownMs: 6000,
  priority: 80,
  variants: [
    {
      id: "bark_lifelost_001",
      vo: true,
      when: "hit",
      en: "Hull breach! You're fine. The ship isn't, but you're fine.",
      es: "¡Brecha en el casco! Tú estás bien. La nave no, pero tú estás bien.",
      zh: "船体破损！你没事。飞船有事，但你没事。",
    },
    {
      id: "var_shipfine_001",
      vo: true,
      when: "hit",
      direction: "Quick, relieved, then a small professional wince.",
      en:
        "Hull integrity is down. Your integrity is intact. That's the one I care about.",
      es:
        "La integridad del casco bajó. Tu integridad sigue intacta. Esa es la que me importa.",
      zh: "船体完整度下降了。你的完整度还在。我在乎的是这个。",
    },
    {
      id: "var_shipfine_002",
      vo: true,
      when: "hit",
      direction: "Cheerful incident report, slightly too brisk.",
      en:
        "Minor structural event! You are uninjured. The ship has filed a complaint.",
      es:
        "¡Incidente estructural menor! No tienes ni un rasguño. La nave ya presentó una queja.",
      zh: "轻微结构事件！你毫发无伤。飞船已经提交了投诉。",
    },
    {
      id: "var_shipfine_003",
      vo: true,
      when: "hit",
      direction: "Calm, almost tender, keeping score.",
      en: "The ship is not okay. You are okay. Let's keep that ratio.",
      es: "La nave no está bien. Tú sí. Mantengamos esa proporción.",
      zh: "飞船不太好。你很好。我们保持这个比例吧。",
    },
    {
      id: "bank.shipFine.1",
      vo: false,
      when: "hit",
      en: "Ouch. Not you. The ship said ouch. You're fine.",
      es: "Ay. Tú no. La nave dijo ay. Tú estás bien.",
      zh: "哎哟。不是你。是飞船说的哎哟。你没事。",
    },
    {
      id: "bank.shipFine.2",
      vo: false,
      when: "hit",
      en: "Damage report: ship, yes. You, no. Paperwork, extensive.",
      es: "Reporte de daños: la nave, sí. Tú, no. El papeleo, bastante.",
      zh: "损伤报告：飞船，有。你，没有。文书工作，很多。",
    },
    {
      id: "bank.shipFine.3",
      vo: false,
      when: "hit",
      en:
        "That hit was logged against the hull, not against you. Personally, I think you're doing great.",
      es:
        "Ese impacto quedó registrado contra el casco, no contra ti. En lo personal, creo que vas muy bien.",
      zh: "这次命中记在船体名下，不记在你名下。我个人觉得你表现很好。",
    },
    {
      id: "bank.shipFine.4",
      vo: false,
      when: "hit",
      en: "The ship took that personally. You shouldn't. You're fine.",
      es: "La nave se lo tomó personal. Tú no deberías. Estás bien.",
      zh: "飞船把这当成了针对它的。你别这样想。你没事。",
    },
    {
      id: "var_shipfine_004",
      vo: true,
      when: "shieldBreak",
      direction: "Gently consoling, as if about a houseplant.",
      en:
        "That was the shield. It's okay to be sad about the shield. You're fine, though.",
      es:
        "Ese era el escudo. Está bien sentirse triste por el escudo. Pero tú estás bien.",
      zh: "那是护盾。为护盾难过是可以的。不过你没事。",
    },
    {
      id: "var_shipfine_005",
      vo: true,
      when: "shieldBreak",
      direction: "Proud of the shield, then the fine print at speed.",
      en:
        "Shield's gone. It did its job, and you're fine. The rental agreement is less fine.",
      es:
        "Se acabó el escudo. Cumplió su trabajo y tú estás bien. El contrato de renta, no tanto.",
      zh: "护盾没了。它尽职了，你也没事。租赁协议就没那么没事了。",
    },
    {
      id: "bank.shipFine.5",
      vo: false,
      when: "shieldBreak",
      en: "Shield absorbed one hazard. You absorbed zero. Ideal split.",
      es: "El escudo absorbió un peligro. Tú absorbiste cero. Reparto ideal.",
      zh: "护盾吸收了一次危险。你吸收了零次。完美分配。",
    },
    {
      id: "var_shipfine_006",
      vo: true,
      when: "nearDeath",
      direction: "Bright, then a careful, steady warning.",
      en:
        "One hull left. You're fine! Statistically, you're about to be less fine, so please dodge.",
      es:
        "Te queda un casco. ¡Estás bien! Estadísticamente, estás por estar menos bien, así que esquiva, por favor.",
      zh:
        "只剩一艘飞船了。你没事！不过从统计上看，你马上就要有事了，所以请躲开。",
    },
    {
      id: "var_shipfine_007",
      vo: true,
      when: "nearDeath",
      direction: "Deliberately soothing, slightly too slow.",
      en:
        "Last ship in reserve. I'm not worried. I'm using my calm voice on purpose.",
      es:
        "Última nave de reserva. No estoy preocupada. Estoy usando mi voz tranquila a propósito.",
      zh: "最后一艘备用飞船。我不担心。我是故意用这么平静的语气的。",
    },
    {
      id: "bank.shipFine.6",
      vo: false,
      when: "nearDeath",
      en:
        "Pilot, you're fine. I'm going to keep saying that, and I need it to stay true.",
      es:
        "Piloto, estás bien. Lo voy a seguir diciendo, y necesito que siga siendo cierto.",
      zh: "飞行员，你没事。我会一直这么说，也需要它一直是真的。",
    },
    {
      id: "var_shipfine_008",
      vo: true,
      when: "respawn",
      direction: "Upbeat welcome back, like a new semester.",
      en: "New hull, same you! The old hull is now a learning opportunity.",
      es:
        "¡Casco nuevo, el mismo tú! El casco viejo ahora es una oportunidad de aprendizaje.",
      zh: "新船体，还是你！旧船体现在是一次学习机会。",
    },
    {
      id: "var_shipfine_009",
      vo: true,
      when: "respawn",
      direction: "Warm, then the deduction slipped in, then warm again.",
      en:
        "Hull replaced. Cost deducted. You are, and I mean this, priceless. Within reason.",
      es:
        "Casco reemplazado. Costo descontado. Tú no tienes precio, lo digo en serio. Dentro de lo razonable.",
      zh: "船体已更换。费用已扣除。你是无价的，我是认真的。在合理范围内。",
    },
    {
      id: "bank.shipFine.7",
      vo: false,
      when: "respawn",
      en:
        "Replacement ship issued. It's exactly like the last one, except intact.",
      es:
        "Nave de reemplazo asignada. Es idéntica a la anterior, salvo que está entera.",
      zh: "替换飞船已发放。和上一艘一模一样，只是完好无损。",
    },
    {
      id: "bank.shipFine.8",
      vo: false,
      when: "respawn",
      en: "You're back! The ship isn't, but this one is very similar.",
      es: "¡Volviste! La nave no, pero esta se le parece mucho.",
      zh: "你回来了！飞船没回来，不过这艘和它很像。",
    },
  ],
};
