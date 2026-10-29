/**
 * Stats commentary: the onboarding assistant noticing how the run is going
 * (accuracy, shots "into the mist", streaks, perfect sectors, grazes, disarm
 * ratio, repeated deaths, long rests, Writ charge), with the Warden and the
 * scouts chiming in now and then. Detection is agent P's (`STATS_MOMENTS` in
 * `types.ts` has suggested thresholds).
 *
 * Register: sincere institutional warmth that turns faintly
 * passive-aggressive about efficiency and pay, never mean. She always
 * reassures first; the dig is in the second clause, and it is about the
 * ledger, not the person. Young players will hear these, so no line makes
 * the player feel bad at the game; the joke is always on the paperwork.
 */

import type { Bank } from "./types.ts";

export const accuracyDrop: Bank = {
  id: "accuracyDrop",
  note: "Rolling accuracy has fallen well below the run average.",
  triggers: [{ on: "stats", moment: "accuracyDrop" }],
  conditions: { run: "hasFired", maxPerRun: 3 },
  speaker: "tutorial_ai",
  cooldownMs: 60000,
  priority: 40,
  variants: [
    {
      id: "stat_accuracy_001",
      vo: true,
      direction: "Kind, measured, a teacher's aside.",
      en:
        "Quick note on accuracy: it's dropping. I'm not upset. The spreadsheet is a little upset.",
      es:
        "Una nota rápida sobre la puntería: está bajando. Yo no estoy molesta. La hoja de cálculo, un poquito.",
      zh: "简单提一下命中率：在下降。我没生气。表格有点生气。",
    },
    {
      id: "stat_accuracy_002",
      vo: true,
      direction: "Upbeat reframe, believing every word.",
      en:
        "Your hit rate is trending down. That's okay! Trends are just feelings with graphs.",
      es:
        "Tu tasa de aciertos va a la baja. ¡No pasa nada! Las tendencias son solo sentimientos con gráficas.",
      zh: "你的命中率在走低。没关系！趋势不过是带图表的情绪而已。",
    },
    {
      id: "bank.accuracyDrop.1",
      vo: false,
      en: "Gentle reminder: the enemies are the glowing ones.",
      es: "Un recordatorio amable: los enemigos son los que brillan.",
      zh: "温馨提示：敌人是会发光的那些。",
    },
    {
      id: "bank.accuracyDrop.2",
      vo: false,
      en:
        "Accuracy is down. Pay is tied to accuracy. I'm tied to you. We're all tied together, really.",
      es:
        "La puntería bajó. El pago depende de la puntería. Yo dependo de ti. En realidad, todos dependemos de todos.",
      zh:
        "命中率下降了。薪酬和命中率挂钩。我和你挂钩。说到底，大家都挂在一起。",
    },
    {
      id: "bank.accuracyDrop.3",
      vo: false,
      en:
        "You're doing great. Your bullets are doing less great. Let's support them.",
      es: "Tú vas muy bien. Tus balas, no tanto. Vamos a apoyarlas.",
      zh: "你做得很好。你的子弹做得没那么好。我们一起支持一下它们。",
    },
    {
      id: "bank.accuracyDrop.4",
      vo: false,
      en:
        "I've noticed a dip in accuracy. No pressure. Some pressure. Billable pressure.",
      es:
        "Noté una baja en la puntería. Sin presión. Un poco de presión. Presión facturable.",
      zh: "我注意到命中率下滑了。没有压力。有一点压力。可计费的压力。",
    },
  ],
};

export const intoTheMist: Bank = {
  id: "intoTheMist",
  note:
    "A run of shots into empty sky. Adam's phrase from the playtest: 'into the mist'.",
  triggers: [{ on: "stats", moment: "intoTheMist" }],
  conditions: { run: "hasFired", maxPerRun: 4 },
  speaker: "tutorial_ai",
  cooldownMs: 45000,
  priority: 40,
  variants: [
    {
      id: "stat_mist_001",
      vo: true,
      direction: "Polite, as if pointing out a typo.",
      en: "Those shots are going into the mist. The mist has not hired us.",
      es: "Esos tiros se están yendo a la neblina. La neblina no nos contrató.",
      zh: "那些子弹都打进雾里了。雾可没有雇我们。",
    },
    {
      id: "stat_mist_002",
      vo: true,
      direction: "Encouraging, then gently factual.",
      en:
        "Lovely enthusiasm! There's nothing up there, though. Just the mist, and it's very far away.",
      es:
        "¡Qué entusiasmo tan bonito! Pero allá arriba no hay nada. Solo la neblina, y está muy lejos.",
      zh: "热情可嘉！不过上面什么都没有。只有雾，而且很远很远。",
    },
    {
      id: "stat_mist_003",
      vo: true,
      direction: "HR-soft, the care sincere, the rounds also sincere.",
      en:
        "Every round into the mist is a round we can't bill. I only mention it because I care. About you. And about rounds.",
      es:
        "Cada bala que va a la neblina es una bala que no podemos cobrar. Solo lo menciono porque me importa. Tú. Y las balas.",
      zh:
        "每一发打进雾里的子弹，都是没法计费的子弹。我提这个只是因为我在乎。在乎你。也在乎子弹。",
    },
    {
      id: "bank.intoTheMist.1",
      vo: false,
      en:
        "Into the mist again. If you're aiming for the mist, you're very accurate.",
      es:
        "Otra vez a la neblina. Si le estás apuntando a la neblina, tienes una puntería excelente.",
      zh: "又打进雾里了。如果你瞄的是雾，那你打得非常准。",
    },
    {
      id: "bank.intoTheMist.2",
      vo: false,
      en: "Who are we shooting at? Just checking. For the form.",
      es:
        "¿A quién le estamos disparando? Nada más pregunto. Para el formulario.",
      zh: "我们在朝谁开火？我就问问。填表要用。",
    },
    {
      id: "bank.intoTheMist.3",
      vo: false,
      en: "The mist thanks you for your attention. The mist does not pay.",
      es: "La neblina te agradece tu atención. La neblina no paga.",
      zh: "雾感谢你的关注。雾不付钱。",
    },
    {
      id: "bank.intoTheMist.4",
      vo: false,
      en:
        "Firing at empty sky is a recognized form of self-expression. It is not a recognized form of income.",
      es:
        "Dispararle al cielo vacío es una forma reconocida de expresión personal. No es una forma reconocida de ingreso.",
      zh:
        "朝空无一物的天空开火，是一种公认的自我表达方式。但不是一种公认的收入来源。",
    },
    {
      id: "bank.intoTheMist.5",
      vo: false,
      en: "I count a lot of shots and very few targets. Maybe wait for one?",
      es:
        "Cuento muchos tiros y muy pocos objetivos. ¿Y si esperas a que aparezca uno?",
      zh: "我数到很多发子弹，却没几个目标。要不等一个出来？",
    },
  ],
};

export const hotStreak: Bank = {
  id: "hotStreak",
  note: "Several kills or disarms quickly with no damage taken.",
  triggers: [{ on: "stats", moment: "hotStreak" }],
  conditions: { maxPerRun: 4 },
  speaker: "tutorial_ai",
  cooldownMs: 40000,
  priority: 45,
  variants: [
    {
      id: "stat_streak_001",
      vo: true,
      direction: "Whispered excitement, like not wanting to jinx it.",
      en:
        "Oh, you're on a streak! Don't think about it. I'll think about it. I'm thinking about your bonus.",
      es:
        "¡Ay, vas en racha! No lo pienses. Yo lo pienso por ti. Estoy pensando en tu bono.",
      zh: "哦，你手感正热！别多想。我替你想。我在想你的奖金。",
    },
    {
      id: "stat_streak_002",
      vo: true,
      direction: "Proud manager, reaching for the reply-all button.",
      en:
        "That is excellent work. I'd like to forward it to someone. Everyone, ideally.",
      es:
        "Qué trabajo tan excelente. Quisiera reenviárselo a alguien. A todos, de preferencia.",
      zh: "干得太棒了。我想把这个转发给别人。最好是转发给所有人。",
    },
    {
      id: "bank.hotStreak.1",
      vo: false,
      en:
        "Streak! Your pay rate is climbing. So is my opinion of you. It was already high.",
      es:
        "¡Racha! Tu tarifa va subiendo. Y mi opinión de ti también. Ya estaba alta.",
      zh: "连胜！你的费率在上升。我对你的评价也在上升。本来就很高了。",
    },
    {
      id: "bank.hotStreak.2",
      vo: false,
      en:
        "Look at you! I've stopped writing notes and started writing compliments.",
      es:
        "¡Mírate nada más! Dejé de escribir observaciones y empecé a escribir halagos.",
      zh: "看看你！我不写备注了，开始写夸奖了。",
    },
    {
      id: "bank.hotStreak.3",
      vo: false,
      en:
        "Hot streak. Please keep going exactly like this. Exactly. Do not innovate.",
      es:
        "Racha caliente. Por favor, sigue exactamente así. Exactamente. No innoves.",
      zh: "手感火热。请就这样继续。一模一样。不要创新。",
    },
    {
      id: "bank.hotStreak.4",
      vo: false,
      en:
        "Wonderful. If you could do that all the time, that would be ideal. And also expected.",
      es:
        "Maravilloso. Si pudieras hacer eso siempre, sería lo ideal. Y también lo esperado.",
      zh: "太好了。如果你能一直这样，那就最理想了。而且也是理所应当的。",
    },
  ],
};

export const perfectSector: Bank = {
  id: "perfectSector",
  note: "A sector cleared with no hits taken. Wins the slot over sectorClear.",
  triggers: [{ on: "stats", moment: "perfectSector" }],
  speaker: "tutorial_ai",
  cooldownMs: 30000,
  priority: 50,
  variants: [
    {
      id: "stat_perfect_001",
      vo: true,
      direction: "Delighted, a little misty.",
      en:
        "A whole sector without a scratch! The hull says thank you. The hull rarely says anything.",
      es:
        "¡Un sector entero sin un rasguño! El casco te da las gracias. El casco casi nunca dice nada.",
      zh: "整整一个扇区毫发无伤！船体向你道谢。船体平时很少说话的。",
    },
    {
      id: "stat_perfect_002",
      vo: true,
      direction: "Giddy, planning a bulletin board.",
      en:
        "Perfect sector. I'm going to put that on the wall. We don't have a wall. I'm requesting a wall.",
      es:
        "Sector perfecto. Lo voy a poner en la pared. No tenemos pared. Voy a solicitar una pared.",
      zh: "完美扇区。我要把它贴到墙上。我们没有墙。我去申请一面墙。",
    },
    {
      id: "bank.perfectSector.1",
      vo: false,
      en:
        "Zero hits taken. You've given the repair crew the afternoon off. Unpaid, sadly.",
      es:
        "Cero impactos. Le diste la tarde libre al equipo de reparación. Sin goce de sueldo, por desgracia.",
      zh: "零受击。你让维修组放了一下午假。可惜是无薪的。",
    },
    {
      id: "bank.perfectSector.2",
      vo: false,
      en:
        "Flawless. I didn't have to say you're fine even once. I missed it a little.",
      es:
        "Impecable. Ni una vez tuve que decirte que estás bien. Lo extrañé un poquito.",
      zh: "完美无瑕。我一次都不用说你没事。我还有点想念说这句话。",
    },
    {
      id: "bank.perfectSector.3",
      vo: false,
      en: "Clean sector! That's the kind of number I like to show people.",
      es:
        "¡Sector limpio! Ese es el tipo de número que me gusta enseñarle a la gente.",
      zh: "干净的扇区！这就是我喜欢拿给别人看的那种数字。",
    },
  ],
};

export const grazeStreak: Bank = {
  id: "grazeStreak",
  note: "Several grazes in a few seconds.",
  triggers: [{ on: "stats", moment: "grazeStreak" }],
  conditions: { maxPerRun: 3 },
  speaker: "tutorial_ai",
  cooldownMs: 45000,
  priority: 45,
  variants: [
    {
      id: "stat_grazes_001",
      vo: true,
      direction: "Suspicious, then certain, then resigned.",
      en:
        "That's a lot of grazing. Are you doing that on purpose? You're doing that on purpose.",
      es:
        "Eso es mucho roce. ¿Lo estás haciendo a propósito? Lo estás haciendo a propósito.",
      zh: "擦弹也太多了吧。你是故意的吗？你就是故意的。",
    },
    {
      id: "stat_grazes_002",
      vo: true,
      direction: "Reading an invoice in mild disbelief.",
      en:
        "Graze streak! The proximity line on your invoice is now longer than the rest of it.",
      es:
        "¡Racha de roces! El renglón de cercanía en tu factura ya es más largo que todo lo demás.",
      zh: "连续擦弹！你账单上的近距离那一行，现在比其他所有项加起来还长。",
    },
    {
      id: "bank.grazeStreak.1",
      vo: false,
      en:
        "Please stop threading bullets. I can't look. I'm looking. It's billable.",
      es:
        "Por favor, deja de colarte entre las balas. No puedo ver. Estoy viendo. Es facturable.",
      zh: "请别再在子弹缝里穿来穿去了。我不敢看。我在看。可以计费。",
    },
    {
      id: "bank.grazeStreak.2",
      vo: false,
      en: "Graze, graze, graze. You make danger look like a hobby.",
      es: "Roce, roce, roce. Haces que el peligro parezca un pasatiempo.",
      zh: "擦弹，擦弹，擦弹。你把危险玩成了业余爱好。",
    },
    {
      id: "bank.grazeStreak.3",
      vo: false,
      en:
        "That streak was beautiful. Please never do it again. Please do it again.",
      es:
        "Esa racha fue hermosa. Por favor, no lo vuelvas a hacer. Por favor, hazlo otra vez.",
      zh: "那串擦弹真漂亮。请别再这样了。请再来一次。",
    },
  ],
};

export const disarmRatioHigh: Bank = {
  id: "disarmRatioHigh",
  note:
    "Most resolved enemies were disarmed. Confusion about columns, never disapproval of mercy.",
  triggers: [{ on: "stats", moment: "disarmRatioHigh" }],
  conditions: { maxPerRun: 2 },
  speaker: "tutorial_ai",
  cooldownMs: 90000,
  priority: 40,
  variants: [
    {
      id: "stat_disarmhi_001",
      vo: true,
      direction: "Careful, curious, then the pay note very quickly.",
      en:
        "Quick observation: most of your targets are leaving with their ships. Is that a strategy? It's a lower-paying strategy.",
      es:
        "Una observación rápida: la mayoría de tus objetivos se van con su nave. ¿Es una estrategia? Es una estrategia que paga menos.",
      zh:
        "简单观察一下：你的大多数目标都开着自己的飞船走了。这是一种策略吗？这是一种收入更低的策略。",
    },
    {
      id: "stat_disarmhi_002",
      vo: true,
      direction: "Reassuring, a bit lost in a form.",
      en:
        "Your disarm ratio is very high. That's not a criticism. There just isn't a column for it.",
      es:
        "Tu proporción de desarmes es muy alta. No es una crítica. Es que no hay una columna para eso.",
      zh: "你的解除武装比例非常高。这不是批评。只是表格里没有这一栏。",
    },
    {
      id: "bank.disarmRatioHigh.1",
      vo: false,
      en:
        "You're returning a lot of ships to their owners. Very considerate. Not very billable.",
      es:
        "Estás devolviendo muchas naves a sus dueños. Muy considerado. No muy facturable.",
      zh: "你把很多飞船都还给了它们的主人。很体贴。不太好计费。",
    },
    {
      id: "bank.disarmRatioHigh.2",
      vo: false,
      en:
        "More disarms than kills. I'm sure there's a reason. I'm sure it's in your file somewhere.",
      es:
        "Más desarmes que derribos. Seguro hay una razón. Seguro está en tu expediente, en algún lado.",
      zh: "解除武装比击毁还多。肯定有原因。肯定写在你档案的某个地方。",
    },
    {
      id: "bank.disarmRatioHigh.3",
      vo: false,
      en:
        "Disarming is allowed! It's just, um, slower money. I'm only flagging it.",
      es:
        "¡Desarmar está permitido! Nada más que es, este, dinero más lento. Solo lo señalo.",
      zh: "解除武装是允许的！只是，呃，来钱慢一点。我只是标注一下。",
    },
  ],
};

export const disarmRatioLow: Bank = {
  id: "disarmRatioLow",
  note:
    "Many resolved enemies, no disarms, on a run that has fired. A required notice: the quiet pacifist hint.",
  triggers: [{ on: "stats", moment: "disarmRatioLow" }],
  conditions: { run: "hasFired", maxPerRun: 1 },
  speaker: "tutorial_ai",
  cooldownMs: 120000,
  priority: 35,
  variants: [
    {
      id: "stat_disarmlo_001",
      vo: true,
      direction: "Compliance notice, read a bit too fast, then sincere.",
      en:
        "Tip: shooting the weapon parts makes a ship harmless. It pays less. I'm required to mention it.",
      es:
        "Consejo: si le disparas a las piezas de armamento, la nave queda inofensiva. Paga menos. Estoy obligada a mencionarlo.",
      zh:
        "小提示：打掉武器部件，飞船就无害了。报酬会少一些。按规定我必须提一下。",
    },
    {
      id: "bank.disarmRatioLow.1",
      vo: false,
      en:
        "Reminder that disarming exists. It's in the manual. Page four hundred.",
      es:
        "Te recuerdo que existe el desarme. Está en el manual. Página cuatrocientos.",
      zh: "提醒一下，解除武装这个选项是存在的。在手册里。第四百页。",
    },
    {
      id: "bank.disarmRatioLow.2",
      vo: false,
      en:
        "You're very thorough. If you ever want a lighter touch, aim for the guns, not the ship.",
      es:
        "Eres muy minucioso. Si alguna vez quieres algo más suave, apúntale a las armas, no a la nave.",
      zh: "你非常彻底。如果你哪天想下手轻一点，就瞄准武器，而不是飞船。",
    },
    {
      id: "bank.disarmRatioLow.3",
      vo: false,
      en:
        "No disarms so far. Totally fine! The option is there, quietly, like a fire exit.",
      es:
        "Ningún desarme hasta ahora. ¡Está perfecto! La opción ahí está, calladita, como una salida de emergencia.",
      zh:
        "到目前为止没有解除武装。完全没问题！这个选项一直都在，静静地，像安全出口一样。",
    },
  ],
};

export const repeatedDeaths: Bank = {
  id: "repeatedDeaths",
  note:
    "A second life lost soon after the last. Supersedes shipFine for that slot; still reassuring first.",
  triggers: [{ on: "stats", moment: "repeatedDeaths" }],
  speaker: "tutorial_ai",
  cooldownMs: 30000,
  priority: 85,
  variants: [
    {
      id: "stat_deaths_001",
      vo: true,
      direction: "Reassuring on reflex, then noticing herself.",
      en:
        "Two hulls in a minute. You're fine! I'm starting to notice I say that a lot.",
      es:
        "Dos cascos en un minuto. ¡Estás bien! Empiezo a notar que lo digo mucho.",
      zh: "一分钟两艘船体。你没事！我开始发现这句话我说得有点多了。",
    },
    {
      id: "stat_deaths_002",
      vo: true,
      direction: "Brisk admin, a hint of fatigue, still fond.",
      en:
        "Another replacement ship. I've stopped filling out the form and started photocopying it.",
      es:
        "Otra nave de reemplazo. Ya dejé de llenar el formulario y empecé a sacarle copias.",
      zh: "又一艘替换飞船。我已经不填表了，直接开始复印。",
    },
    {
      id: "bank.repeatedDeaths.1",
      vo: false,
      en:
        "You keep coming back. I admire that. The fleet budget is learning to admire it.",
      es:
        "Sigues regresando. Eso lo admiro. El presupuesto de la flota está aprendiendo a admirarlo.",
      zh: "你一次次地回来。我很佩服。舰队预算正在学着佩服。",
    },
    {
      id: "bank.repeatedDeaths.2",
      vo: false,
      en:
        "Don't worry about the hulls. Worry a little. A small, healthy, productive amount.",
      es:
        "No te preocupes por los cascos. Preocúpate un poquito. Una cantidad pequeña, sana y productiva.",
      zh: "别担心船体。稍微担心一点。一点点健康的、有成效的担心。",
    },
    {
      id: "bank.repeatedDeaths.3",
      vo: false,
      en:
        "It's okay. Everyone has a sector like this. Most people have it once.",
      es:
        "Está bien. Todos tienen un sector así. La mayoría lo tiene una sola vez.",
      zh: "没关系。每个人都会遇到这样的扇区。大多数人只遇到一次。",
    },
    {
      id: "bank.repeatedDeaths.4",
      vo: false,
      en:
        "New hull! Please keep this one a little longer. We're getting attached to them. Financially.",
      es:
        "¡Casco nuevo! Por favor, consérvalo un poquito más. Nos estamos encariñando con ellos. Económicamente.",
      zh: "新船体！这艘请多留一会儿。我们开始对它们有感情了。经济上的感情。",
    },
  ],
};

export const longIdle: Bank = {
  id: "longIdle",
  note:
    "No fire and little movement for a while. Resting charges the Writ, so she is kind about it.",
  triggers: [{ on: "stats", moment: "longIdle" }],
  conditions: { maxPerRun: 3 },
  speaker: "tutorial_ai",
  cooldownMs: 60000,
  priority: 20,
  variants: [
    {
      id: "stat_idle_001",
      vo: true,
      direction: "Approving, then fair, then the footnote.",
      en:
        "Resting to charge? Smart. Resting just to rest? Also fine. Unpaid, but fine.",
      es:
        "¿Descansando para cargar? Muy listo. ¿Descansando nada más por descansar? También está bien. Sin paga, pero bien.",
      zh: "在休息蓄力吗？聪明。只是为了休息而休息？也行。不计薪，但也行。",
    },
    {
      id: "stat_idle_002",
      vo: true,
      direction: "Soft, checking in, with one practical clause.",
      en:
        "It's very quiet. Are you charging, thinking, or having a moment? All three are valid. One is billable.",
      es:
        "Está muy tranquilo. ¿Estás cargando, pensando o tomándote un momento? Las tres opciones son válidas. Una es facturable.",
      zh:
        "好安静啊。你是在蓄力、在思考，还是在发呆？三种都可以。其中一种可以计费。",
    },
    {
      id: "bank.longIdle.1",
      vo: false,
      en:
        "Still with me? Just checking. I check on everyone. It's in my job description and my heart.",
      es:
        "¿Sigues conmigo? Nada más reviso. Reviso a todos. Está en mi descripción de puesto y en mi corazón.",
      zh:
        "还在吗？我就问一下。我会关心每一个人。这写在我的岗位职责里，也写在我心里。",
    },
    {
      id: "bank.longIdle.2",
      vo: false,
      en: "Nice and calm. The Writ is charging, and so am I. Emotionally.",
      es:
        "Tranquilo y sereno. El Mandato se está cargando, y yo también. Emocionalmente.",
      zh: "平静又安稳。令状在蓄力，我也在蓄力。情感上的。",
    },
    {
      id: "bank.longIdle.3",
      vo: false,
      en:
        "You've gone very still. If this is strategy, it's a very mysterious strategy.",
      es:
        "Te quedaste muy quieto. Si es una estrategia, es una estrategia muy misteriosa.",
      zh: "你一动不动了。如果这是策略，那可真是个很神秘的策略。",
    },
    {
      id: "bank.longIdle.4",
      vo: false,
      en:
        "Take your time. The lanes will wait. The convoy schedule won't, but the lanes will.",
      es:
        "Tómate tu tiempo. Las rutas esperan. El horario de los convoyes no, pero las rutas sí.",
      zh: "慢慢来。航道会等你。车队时刻表不会等，但航道会。",
    },
  ],
};

export const writHoarding: Bank = {
  id: "writHoarding",
  note: "A full Writ held too long, or full charges released into nothing.",
  triggers: [{ on: "stats", moment: "writHoarding" }],
  conditions: { maxPerRun: 2 },
  speaker: "tutorial_ai",
  cooldownMs: 60000,
  priority: 35,
  variants: [
    {
      id: "stat_writ_001",
      vo: true,
      direction: "Patient technical support.",
      en:
        "That Writ is fully charged. Holding it longer won't make it more charged. I've checked.",
      es:
        "Ese Mandato ya está cargado al máximo. Sostenerlo más no lo va a cargar más. Ya lo revisé.",
      zh: "那道令状已经充满了。再攥着也不会更满。我查过了。",
    },
    {
      id: "bank.writHoarding.1",
      vo: false,
      en: "Full charge in hand. Please spend it on something with a hull.",
      es: "Carga completa en mano. Por favor, gástala en algo que tenga casco.",
      zh: "满能量在手。请把它用在有船体的东西上。",
    },
    {
      id: "bank.writHoarding.2",
      vo: false,
      en:
        "Another Writ into empty space. That was a whole charge. A whole, beautiful charge.",
      es:
        "Otro Mandato al espacio vacío. Era una carga entera. Una carga entera y hermosa.",
      zh: "又一道令状射向了虚空。那是一整格能量。一整格美丽的能量。",
    },
    {
      id: "bank.writHoarding.3",
      vo: false,
      en:
        "Energy note: you're very good at charging. Now let's work on aiming.",
      es:
        "Nota de energía: eres muy bueno para cargar. Ahora trabajemos en apuntar.",
      zh: "能量备注：你非常擅长蓄力。现在我们来练练瞄准。",
    },
  ],
};

export const wardenStats: Bank = {
  id: "wardenStats",
  note:
    "The Warden noticing misses during its fight. Loud, delighted, a bit petty, never cruel.",
  triggers: [
    { on: "stats", moment: "intoTheMist" },
    { on: "stats", moment: "accuracyDrop" },
  ],
  conditions: { bossPhases: [1, 2, 3], run: "hasFired", maxPerRun: 2 },
  speaker: "warden",
  cooldownMs: 30000,
  priority: 50,
  variants: [
    {
      id: "stat_warden_001",
      vo: true,
      direction: "Shrieking, genuinely unable to tell.",
      en:
        "You're missing me! On PURPOSE?! Or by ACCIDENT?! I can't tell and it's driving me UP THE WALL!",
      es:
        "¡Me estás fallando! ¿¡A PROPÓSITO!? ¿¡O SIN QUERER!? ¡No lo sé y me está VOLVIENDO LOCO!",
      zh: "你老打不中我！是故意的？！还是不小心？！我分不清，快把我逼疯了！",
    },
    {
      id: "bank.wardenStats.1",
      vo: false,
      en: "Are you shooting at ME or at the SKY?! The sky did nothing to you!",
      es: "¿¡Le estás disparando a MÍ o al CIELO!? ¡El cielo no te hizo nada!",
      zh: "你是在打我还是在打天？！天又没惹你！",
    },
    {
      id: "bank.wardenStats.2",
      vo: false,
      en:
        "Every shot that misses me lands in SOMEONE'S lane! Watch where you point that!",
      es:
        "¡Cada tiro que me fallas cae en la ruta de ALGUIEN! ¡Fíjate a dónde apuntas!",
      zh: "每一发打偏的子弹都会落进别人的航道！看清楚你往哪儿指！",
    },
    {
      id: "bank.wardenStats.3",
      vo: false,
      en: "HA! Missed! You're having a terrible day! GOOD!",
      es: "¡JA! ¡Fallaste! ¡Estás teniendo un día terrible! ¡QUÉ BUENO!",
      zh: "哈！没打中！你今天真倒霉！太好了！",
    },
  ],
};

export const scoutStats: Bank = {
  id: "scoutStats",
  note:
    "Scouts on their own channel remarking on the Pilot's habits. They report, they do not judge (BIBLE.md, Cast). Shown in the radio box.",
  triggers: [
    { on: "stats", moment: "disarmRatioHigh" },
    { on: "stats", moment: "intoTheMist" },
    { on: "stats", moment: "grazeStreak" },
    { on: "stats", moment: "accuracyDrop" },
  ],
  conditions: { sectors: [1, 2, 3, 4, 5], chance: 0.5, maxPerRun: 3 },
  speaker: "scout",
  cooldownMs: 60000,
  priority: 30,
  variants: [
    {
      id: "stat_scout_001",
      vo: true,
      when: "disarmRatioHigh",
      direction: "Low, quick, passing it along.",
      en:
        "Drift Six, the new one is disarming, not breaking. Pass it along. Keep the lanes wide.",
      es:
        "Deriva Seis, el nuevo está desarmando, no rompiendo. Pásalo. Mantengan las rutas amplias.",
      zh: "漂流六号，新来的只拆武器，不打碎飞船。传下去。保持航道宽敞。",
    },
    {
      id: "bank.scoutStats.1",
      vo: false,
      when: "disarmRatioHigh",
      en: "Ships coming home without their guns. Nobody hurt. Tell the Warden.",
      es:
        "Naves volviendo a casa sin sus armas. Nadie herido. Avísenle al Guardián.",
      zh: "飞船没带武器回来了。没人受伤。告诉守望者。",
    },
    {
      id: "bank.scoutStats.2",
      vo: false,
      when: "intoTheMist",
      en: "New pilot is shooting at fog again. Let it. Fog's fine.",
      es:
        "El piloto nuevo le está disparando a la neblina otra vez. Déjenlo. La neblina está bien.",
      zh: "新来的又在朝雾开火了。随它去。雾没事。",
    },
    {
      id: "bank.scoutStats.3",
      vo: false,
      when: "grazeStreak",
      en:
        "That one threads bullets like a hauler threads the Shatter Belt. Noted.",
      es:
        "Ese se cuela entre las balas como un transportista por el Cinturón Quebrado. Anotado.",
      zh: "那家伙穿弹幕，就像货船穿过碎裂带一样。记下了。",
    },
    {
      id: "bank.scoutStats.4",
      vo: false,
      when: "accuracyDrop",
      en: "It hasn't hit anything in a while. Hold fire. Maybe it's thinking.",
      es:
        "Hace rato que no le atina a nada. No disparen. A lo mejor está pensando.",
      zh: "它好一阵子没打中东西了。别开火。也许它在想事情。",
    },
  ],
};
