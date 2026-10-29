/**
 * Event reactions from the onboarding assistant: kills, disarms, grazes,
 * pickups, sector starts and clears, pause and resume. Each pool keeps her
 * three-beat rhythm from the tutorial (warmth, the rule, the money) but
 * varies which beat lands, so a run never feels like one joke on a loop.
 *
 * Kills are praised and billed. Disarms puzzle her (lower rate, no form for
 * it) yet she stays polite: the pacifist hint is in her confusion, never in
 * a scolding (BIBLE.md, Tone rule 5).
 */

import type { Bank } from "./types.ts";

export const kill: Bank = {
  id: "kill",
  note: "An enemy destroyed. Light touch: a quarter of kills at most.",
  triggers: [{ on: "event", type: "kill" }],
  conditions: { chance: 0.25 },
  speaker: "tutorial_ai",
  cooldownMs: 12000,
  priority: 60,
  variants: [
    {
      id: "var_kill_001",
      vo: true,
      direction: "Proud, then a small aside about accounting.",
      en:
        "Target removed. Pay adjusted upward. I'm proud of you, and so is accounting.",
      es:
        "Objetivo eliminado. Pago ajustado hacia arriba. Estoy orgullosa de ti, y contabilidad también.",
      zh: "目标已清除。薪酬已上调。我为你骄傲，财务部也是。",
    },
    {
      id: "var_kill_002",
      vo: true,
      direction: "Bright compliment, filing it twice.",
      en: "Lovely shot. That one goes on your record and on your invoice.",
      es: "Qué buen tiro. Ese va a tu expediente y a tu factura.",
      zh: "漂亮的一枪。这一下会记进你的档案，也会记进你的账单。",
    },
    {
      id: "var_kill_003",
      vo: true,
      when: "ram",
      direction: "Startled, then admiring, then the policy at speed.",
      en:
        "Ooh, a ram! Very decisive. The bumper is not covered, but very decisive.",
      es:
        "¡Uy, una embestida! Muy decidido. La defensa no está cubierta, pero muy decidido.",
      zh: "哇，撞击！非常果断。保险杠不在保修范围内，但非常果断。",
    },
    {
      id: "var_kill_004",
      vo: true,
      direction: "Sincere efficiency gospel, a chain of logic she loves.",
      en:
        "That was clean. Clean work is fast work, and fast work is affordable work. Thank you.",
      es:
        "Eso fue limpio. El trabajo limpio es rápido, y el trabajo rápido sale barato. Gracias.",
      zh: "干净利落。干净就是快，快就是省钱。谢谢你。",
    },
    {
      id: "bank.kill.1",
      vo: false,
      en: "Hostile cleared. The lane is a little more open. Billable, too.",
      es: "Hostil despejado. La ruta está un poco más abierta. Y facturable.",
      zh: "敌机已清除。航道又畅通了一点。也可以计费了。",
    },
    {
      id: "bank.kill.2",
      vo: false,
      en:
        "Another one off the books. Well, onto the books. You know what I mean.",
      es:
        "Otro menos en los libros. Bueno, otro más en los libros. Ya me entiendes.",
      zh: "又一个从账上划掉了。呃，是记到账上了。你懂我的意思。",
    },
    {
      id: "bank.kill.3",
      vo: false,
      en:
        "Nicely done. I've added a small gold star to your file. It isn't legal tender.",
      es:
        "Bien hecho. Le puse una estrellita dorada a tu expediente. No es moneda de curso legal.",
      zh: "干得好。我在你的档案上贴了一颗小金星。它不能当钱用。",
    },
    {
      id: "bank.kill.4",
      vo: false,
      en: "Contact resolved. I'm marking that one 'resolved with enthusiasm.'",
      es: "Contacto resuelto. Lo voy a marcar como “resuelto con entusiasmo”.",
      zh: "接触已处理。我把这一条标记为“热情地处理”。",
    },
    {
      id: "bank.kill.5",
      vo: false,
      en: "Target down! Remember to hydrate between successes.",
      es: "¡Objetivo abatido! Recuerda hidratarte entre éxito y éxito.",
      zh: "目标击落！记得在两次成功之间喝点水。",
    },
    {
      id: "bank.kill.6",
      vo: false,
      en:
        "Good! The Authority thanks you. I also thank you, separately, as a person.",
      es:
        "¡Bien! La Autoridad te lo agradece. Yo también, por separado, como persona.",
      zh: "很好！管理局感谢你。我也单独地、以个人身份感谢你。",
    },
  ],
};

export const disarm: Bank = {
  id: "disarm",
  note:
    "An enemy disarmed (not the first, which is scripted). Polite confusion: there is no form for mercy.",
  triggers: [{ on: "event", type: "disarm", where: { first: false } }],
  conditions: { chance: 0.4 },
  speaker: "tutorial_ai",
  cooldownMs: 12000,
  priority: 60,
  variants: [
    {
      id: "var_disarm_001",
      vo: true,
      direction: "Hesitant, reaching for supportive language.",
      en:
        "Weapons removed, ship intact. That's, um, a choice. A valid one! Probably.",
      es:
        "Armas retiradas, nave intacta. Eso es, este, una decisión. ¡Una válida! Probablemente.",
      zh:
        "武器已拆除，飞船完好。这算是，呃，一种选择。一种合理的选择！大概吧。",
    },
    {
      id: "var_disarm_002",
      vo: true,
      direction: "Puzzled, flipping through a binder.",
      en: "You disarmed it. It's still flying. I'll need a form for that.",
      es:
        "Lo desarmaste. Sigue volando. Voy a necesitar un formulario para eso.",
      zh: "你解除了它的武装。它还在飞。这个我得找张表格来填。",
    },
    {
      id: "var_disarm_003",
      vo: true,
      direction: "Genuinely impressed, not sure why.",
      en:
        "No guns, no damage, no fuss. I'm not sure how to bill it, but it was very neat.",
      es:
        "Sin armas, sin daños, sin alboroto. No sé cómo cobrarlo, pero quedó muy limpio.",
      zh: "没有枪，没有损伤，没有麻烦。我不知道该怎么计费，但真的很利落。",
    },
    {
      id: "var_disarm_004",
      vo: true,
      direction: "Kind, with the lower rate tucked in.",
      en:
        "Disarmed! The rate for that is lower, but your manners are excellent.",
      es: "¡Desarmado! La tarifa es más baja, pero tus modales son excelentes.",
      zh: "已解除武装！这个费率低一些，但你的礼貌无可挑剔。",
    },
    {
      id: "bank.disarm.1",
      vo: false,
      en:
        "Disarm logged. Partial credit applies. I love partial credit. It's still credit.",
      es:
        "Desarme registrado. Aplica crédito parcial. Me encanta el crédito parcial. Sigue siendo crédito.",
      zh: "解除武装已记录。按部分计酬。我很喜欢部分计酬。它也是钱。",
    },
    {
      id: "bank.disarm.2",
      vo: false,
      en: "That ship is now harmless and, I think, slightly embarrassed.",
      es: "Esa nave ya es inofensiva y, creo, un poco avergonzada.",
      zh: "那艘飞船现在无害了，而且我觉得，有点不好意思。",
    },
    {
      id: "bank.disarm.3",
      vo: false,
      en:
        "Another disarm. You're very gentle with the hardware. Is everything okay?",
      es: "Otro desarme. Eres muy delicado con el equipo. ¿Todo bien?",
      zh: "又一次解除武装。你对硬件真温柔。一切都还好吗？",
    },
    {
      id: "bank.disarm.4",
      vo: false,
      en:
        "Clean disarm. The scouts call that a handshake. We call it non-standard.",
      es:
        "Desarme limpio. Los exploradores le dicen apretón de manos. Nosotros le decimos fuera de norma.",
      zh: "漂亮的解除武装。侦察机管这叫握手。我们管这叫不合规范。",
    },
    {
      id: "bank.disarm.5",
      vo: false,
      en: "It flew off without its guns. I hope it has somewhere to be.",
      es: "Se fue volando sin sus armas. Espero que tenga a dónde ir.",
      zh: "它没带枪就飞走了。希望它有地方可去。",
    },
    {
      id: "bank.disarm.6",
      vo: false,
      en:
        "Weapon parts recovered. Not the whole ship, but I'll take what I can bill.",
      es:
        "Piezas de armamento recuperadas. No es la nave entera, pero cobro lo que se pueda.",
      zh: "武器部件已回收。不是整艘飞船，但能计费的我都要。",
    },
  ],
};

export const graze: Bank = {
  id: "graze",
  note:
    "A graze after the first (graze_ai_001 is scripted). Proximity is billable, and it frightens her.",
  triggers: [{ on: "event", type: "graze", where: { first: false } }],
  conditions: { chance: 0.15 },
  speaker: "tutorial_ai",
  cooldownMs: 15000,
  priority: 55,
  variants: [
    {
      id: "var_graze_001",
      vo: true,
      direction: "Sharp intake of breath, then delighted.",
      en: "Close! Billable proximity, again. You really commit.",
      es: "¡Cerca! Cercanía facturable, otra vez. Tú sí que te comprometes.",
      zh: "好险！又是可计费的近距离。你是真投入啊。",
    },
    {
      id: "var_graze_002",
      vo: true,
      direction: "Hand on heart, a little breathless.",
      en: "Graze logged. My heart rate is not billable, but it did go up.",
      es: "Roce registrado. Mi ritmo cardiaco no es facturable, pero sí subió.",
      zh: "擦弹已记录。我的心率不能计费，但它确实上去了。",
    },
    {
      id: "var_graze_003",
      vo: true,
      direction: "Office humor, pleased with herself.",
      en:
        "Another graze. You and danger are on a first-name basis, and I'm copied on every message.",
      es:
        "Otro roce. Tú y el peligro ya se tutean, y a mí me ponen en copia de todo.",
      zh: "又一次擦弹。你和危险已经很熟了，而且每封邮件都抄送给了我。",
    },
    {
      id: "bank.graze.1",
      vo: false,
      en: "That bullet and you nearly met. Please don't make introductions.",
      es: "Esa bala y tú casi se conocen. Por favor, no los presentes.",
      zh: "那颗子弹差点和你见面。请不要介绍你们认识。",
    },
    {
      id: "bank.graze.2",
      vo: false,
      en: "Close is good. Closer is a claim form.",
      es: "Cerca está bien. Más cerca es un formulario de reclamo.",
      zh: "近一点挺好。再近一点就要填理赔表了。",
    },
    {
      id: "bank.graze.3",
      vo: false,
      en: "You're cutting it fine. The ship's paint would like a word.",
      es: "Te la estás jugando. La pintura de la nave quiere hablar contigo.",
      zh: "你贴得太近了。飞船的漆想跟你谈谈。",
    },
    {
      id: "bank.graze.4",
      vo: false,
      en: "That was a whisker. A paid whisker!",
      es: "Fue por un pelo. ¡Un pelo pagado!",
      zh: "就差一根头发。一根有偿的头发！",
    },
    {
      id: "bank.graze.5",
      vo: false,
      en: "Proximity bonus! Please stop finding new ways to earn it.",
      es:
        "¡Bono de cercanía! Por favor, deja de inventar formas nuevas de ganarlo.",
      zh: "近距离奖金！请别再想新办法去赚它了。",
    },
  ],
};

export const pickup: Bank = {
  id: "pickup",
  note:
    "Spread or shield pickup, except the first powerup (it starts the flashback). Sub-case by kind.",
  triggers: [
    { on: "event", type: "pickup", where: { pickup: "spread", first: false } },
    { on: "event", type: "pickup", where: { pickup: "shield", first: false } },
  ],
  speaker: "tutorial_ai",
  cooldownMs: 8000,
  priority: 65,
  variants: [
    {
      id: "var_pickup_001",
      vo: true,
      when: "spread",
      direction: "Excited product demo, then a request.",
      en:
        "Spread shot! More bullets, same budget. Please aim them all at something.",
      es:
        "¡Disparo abierto! Más balas, el mismo presupuesto. Por favor, apúntalas todas a algo.",
      zh: "散射！子弹更多，预算不变。请让每一颗都朝着目标打。",
    },
    {
      id: "bank.pickup.1",
      vo: false,
      when: "spread",
      en: "Spread online. Wider coverage, wider invoice.",
      es: "Disparo abierto activo. Más cobertura, más factura.",
      zh: "散射已上线。覆盖更广，账单也更长。",
    },
    {
      id: "bank.pickup.2",
      vo: false,
      when: "spread",
      en: "Oh, the fan! Very festive. Very expensive.",
      es: "¡Ay, el abanico! Muy festivo. Muy caro.",
      zh: "哦，扇形弹！很喜庆。也很贵。",
    },
    {
      id: "bank.pickup.3",
      vo: false,
      when: "spread",
      en: "Spread equipped. Statistically, one of those has to hit.",
      es: "Disparo abierto equipado. Estadísticamente, alguna tiene que pegar.",
      zh: "散射已装备。从统计上说，总有一颗会打中。",
    },
    {
      id: "bark_shield_001",
      vo: true,
      when: "shield",
      en:
        "Shield online! It is Authority property, so please get hit as little as possible.",
      es:
        "¡Escudo activo! Es propiedad de la Autoridad, así que, por favor, recibe la menor cantidad de impactos posible.",
      zh: "护盾已上线！它归管理局所有，所以请尽量少挨打。",
    },
    {
      id: "var_pickup_002",
      vo: true,
      when: "shield",
      direction: "Affectionate, then the deductible at speed.",
      en: "Shield up! It's like a hug, if a hug had a deductible.",
      es:
        "¡Escudo arriba! Es como un abrazo, si los abrazos tuvieran deducible.",
      zh: "护盾升起！就像一个拥抱，只不过这个拥抱有免赔额。",
    },
    {
      id: "bank.pickup.4",
      vo: false,
      when: "shield",
      en: "Shield restored. Please return it in the condition you found it.",
      es:
        "Escudo restaurado. Por favor, devuélvelo en las condiciones en que lo encontraste.",
      zh: "护盾已恢复。请按原样归还。",
    },
    {
      id: "bank.pickup.5",
      vo: false,
      when: "shield",
      en: "New shield. It loves you unconditionally until about the third hit.",
      es:
        "Escudo nuevo. Te quiere incondicionalmente hasta como el tercer impacto.",
      zh: "新护盾。它会无条件地爱你，大概到第三次被击中为止。",
    },
  ],
};

export const sectorStart: Bank = {
  id: "sectorStart",
  note:
    "Plays after the sector's scripted intro has finished, or alone when a sector restarts. Never over the intro.",
  triggers: [{ on: "event", type: "sectorStarted" }],
  conditions: { sectors: [1, 2, 3, 4, 5], chance: 0.6 },
  speaker: "tutorial_ai",
  cooldownMs: 30000,
  priority: 30,
  variants: [
    {
      id: "var_secstart_001",
      vo: true,
      direction: "Encouraging, a coach before a match, then honest.",
      en:
        "New sector, fresh start. Your accuracy resets in my heart, not in the ledger.",
      es:
        "Sector nuevo, borrón y cuenta nueva. Tu puntería se reinicia en mi corazón, no en el libro de cuentas.",
      zh: "新扇区，新开始。你的命中率在我心里清零了，在账本上没有。",
    },
    {
      id: "var_secstart_002",
      vo: true,
      direction: "Cheerful, already holding a clipboard.",
      en: "Here we go again! I've pre-filled your forms. Optimistically.",
      es: "¡Aquí vamos otra vez! Ya llené tus formularios. Con optimismo.",
      zh: "又出发了！我已经帮你预填好了表格。很乐观地填的。",
    },
    {
      id: "var_secstart_003",
      vo: true,
      direction:
        "Wellness-seminar calm, a made-up statistic delivered sincerely.",
      en:
        "Deep breath. Pilots who breathe have a fourteen percent better pay rate.",
      es:
        "Respira hondo. Los pilotos que respiran tienen una tarifa catorce por ciento mejor.",
      zh: "深呼吸。会呼吸的飞行员，薪酬率高出百分之十四。",
    },
    {
      id: "bank.sectorStart.1",
      vo: false,
      en:
        "Sector loaded. Same rules: fly, clear, get paid. That order is ideal.",
      es:
        "Sector cargado. Las mismas reglas: vuela, despeja, cobra. Ese orden es el ideal.",
      zh: "扇区已加载。规则不变：飞、清、拿钱。这个顺序最理想。",
    },
    {
      id: "bank.sectorStart.2",
      vo: false,
      en: "Hazards ahead. Opportunities, also ahead. Mostly hazards.",
      es:
        "Peligros adelante. Oportunidades, también adelante. Más que nada peligros.",
      zh: "前方有危险。前方也有机会。主要是危险。",
    },
    {
      id: "bank.sectorStart.3",
      vo: false,
      en: "Fresh sector! Fresh you! Same contract.",
      es: "¡Sector nuevo! ¡Tú, renovado! El mismo contrato.",
      zh: "新扇区！焕然一新的你！合同还是那份。",
    },
    {
      id: "bank.sectorStart.4",
      vo: false,
      en: "I believe in you. I've also attached the terms of that belief.",
      es: "Creo en ti. También adjunté los términos de esa confianza.",
      zh: "我相信你。我还附上了这份信任的条款。",
    },
    {
      id: "bank.sectorStart.5",
      vo: false,
      en:
        "Sector entry logged. Every lane you open is a lane we can finally manage properly.",
      es:
        "Entrada al sector registrada. Cada ruta que abres es una ruta que por fin podemos administrar como se debe.",
      zh: "进入扇区已记录。你打通的每一条航道，我们终于都能好好管理了。",
    },
  ],
};

export const sectorClear: Bank = {
  id: "sectorClear",
  note:
    "Sector cleared, when no perfectSector line claims the slot (perfect wins).",
  triggers: [{ on: "event", type: "sectorCleared" }],
  conditions: { sectors: [1, 2, 3, 4, 5], chance: 0.7 },
  speaker: "tutorial_ai",
  cooldownMs: 30000,
  priority: 45,
  variants: [
    {
      id: "var_secclear_001",
      vo: true,
      direction: "Delighted, reporting upward.",
      en:
        "Sector clear! Lovely work. Payroll has been notified and is cautiously excited.",
      es:
        "¡Sector despejado! Qué buen trabajo. Ya avisé a nómina y está emocionada, con cautela.",
      zh: "扇区已肃清！干得漂亮。薪资部已收到通知，正在谨慎地兴奋着。",
    },
    {
      id: "var_secclear_002",
      vo: true,
      direction: "Warm, then reading the statement.",
      en:
        "Sector cleared. One more lane open, and one more line on your statement.",
      es:
        "Sector despejado. Una ruta más abierta, y un renglón más en tu estado de cuenta.",
      zh: "扇区已肃清。又多一条航道畅通，你的账单上也多了一行。",
    },
    {
      id: "bank.sectorClear.1",
      vo: false,
      en: "All clear. Take a breath. A short one; the clock is still running.",
      es: "Todo despejado. Respira. Pero rápido: el reloj sigue corriendo.",
      zh: "全部肃清。喘口气吧。短一点，计时还在继续。",
    },
    {
      id: "bank.sectorClear.2",
      vo: false,
      en: "Done! I'm marking that sector resolved. It's my favorite word.",
      es: "¡Listo! Marco ese sector como resuelto. Es mi palabra favorita.",
      zh: "完成！我把这个扇区标记为已处理。这是我最喜欢的词。",
    },
    {
      id: "bank.sectorClear.3",
      vo: false,
      en:
        "Clear. If you'd like to celebrate, please do it while moving forward.",
      es: "Despejado. Si quieres celebrar, por favor hazlo mientras avanzas.",
      zh: "肃清。如果你想庆祝，请边往前飞边庆祝。",
    },
    {
      id: "bank.sectorClear.4",
      vo: false,
      en:
        "Sector complete. You're the best Pilot I have on this channel. Currently.",
      es:
        "Sector completo. Eres el mejor piloto que tengo en este canal. Por ahora.",
      zh: "扇区完成。你是我这个频道上最好的飞行员。目前是。",
    },
  ],
};

export const pause: Bank = {
  id: "pause",
  note:
    "The pause menu opens during gameplay. Shown on the pause screen; voice ducked under the menu music.",
  triggers: [{ on: "app", moment: "pause" }],
  conditions: { chance: 0.5 },
  speaker: "tutorial_ai",
  cooldownMs: 45000,
  priority: 20,
  variants: [
    {
      id: "var_pause_001",
      vo: true,
      direction: "Gentle, then the qualifier.",
      en:
        "Paused. Take your time. The contract clock respects your break. Mostly.",
      es:
        "En pausa. Tómate tu tiempo. El reloj del contrato respeta tu descanso. Casi siempre.",
      zh: "已暂停。慢慢来。合同时钟会尊重你的休息。大多数时候。",
    },
    {
      id: "var_pause_002",
      vo: true,
      direction: "Sweet, and just slightly too literal.",
      en: "I'll wait right here. I'm always right here.",
      es: "Aquí te espero. Siempre estoy aquí.",
      zh: "我就在这儿等你。我一直都在这儿。",
    },
    {
      id: "bank.pause.1",
      vo: false,
      en: "Break time. Stretch, hydrate, reflect on your accuracy.",
      es:
        "Hora del descanso. Estírate, hidrátate, reflexiona sobre tu puntería.",
      zh: "休息时间。伸伸腰，喝点水，反思一下命中率。",
    },
    {
      id: "bank.pause.2",
      vo: false,
      en: "The lanes will hold still for you. That's a courtesy, not a policy.",
      es:
        "Las rutas se quedarán quietas por ti. Es una cortesía, no una política.",
      zh: "航道会为你停下来。这是礼遇，不是政策。",
    },
    {
      id: "bank.pause.3",
      vo: false,
      en:
        "Of course! Everyone needs a moment. Moments are unpaid, but everyone needs one.",
      es:
        "¡Claro! Todos necesitamos un momento. Los momentos no se pagan, pero todos necesitamos uno.",
      zh: "当然！每个人都需要一点时间。这点时间不计薪，但每个人都需要。",
    },
    {
      id: "bank.pause.4",
      vo: false,
      en: "Paused. I'll use the time to tidy your file. It's very thick.",
      es:
        "En pausa. Voy a aprovechar para ordenar tu expediente. Está muy gordo.",
      zh: "已暂停。我趁这时间整理一下你的档案。它非常厚。",
    },
  ],
};

export const resume: Bank = {
  id: "resume",
  note: "Play resumes from the pause menu.",
  triggers: [{ on: "app", moment: "resume" }],
  conditions: { chance: 0.5 },
  speaker: "tutorial_ai",
  cooldownMs: 45000,
  priority: 20,
  variants: [
    {
      id: "var_resume_001",
      vo: true,
      direction: "Happy, then a tiny matter-of-fact admission.",
      en: "Welcome back! I didn't go anywhere. I can't, actually.",
      es:
        "¡Bienvenido de vuelta! Yo no me fui a ningún lado. De hecho, no puedo.",
      zh: "欢迎回来！我哪儿也没去。其实我也去不了。",
    },
    {
      id: "var_resume_002",
      vo: true,
      direction: "Checklist voice, answering for him.",
      en: "Resuming. Did you hydrate? I'm logging that you hydrated.",
      es: "Reanudando. ¿Te hidrataste? Voy a registrar que te hidrataste.",
      zh: "继续。你喝水了吗？我就记你喝过了。",
    },
    {
      id: "bank.resume.1",
      vo: false,
      en: "And we're back. Ship's warm, guns are warm, I'm warm.",
      es:
        "Y volvimos. La nave está tibia, las armas están tibias, yo estoy tibia.",
      zh: "我们回来了。飞船是热的，炮是热的，我也是热乎的。",
    },
    {
      id: "bank.resume.2",
      vo: false,
      en: "Back to it! The lanes missed you. I missed you more.",
      es: "¡A darle! Las rutas te extrañaron. Yo te extrañé más.",
      zh: "继续干活！航道想你了。我更想你。",
    },
    {
      id: "bank.resume.3",
      vo: false,
      en: "Resumed. Your break was a very reasonable length. I've noted it.",
      es: "Reanudado. Tu descanso duró algo muy razonable. Ya lo anoté.",
      zh: "已继续。你的休息时长非常合理。我记下了。",
    },
    {
      id: "bank.resume.4",
      vo: false,
      en:
        "Hello again! Everything is exactly as you left it, including the danger.",
      es: "¡Hola otra vez! Todo está tal como lo dejaste, incluido el peligro.",
      zh: "又见面了！一切都和你离开时一样，包括危险。",
    },
  ],
};
