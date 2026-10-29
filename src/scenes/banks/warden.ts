/**
 * The Warden's taunts during the fight, one bank per phase plus one for a
 * Pilot who has never fired. They fill the lulls between scripted phase
 * lines and answer hits, in the established register: shrill, indignant,
 * loud, sincere, and always true (BIBLE.md, Tone rule 4). Phase 1 is
 * outrage, phase 2 is fraying, phase 3 is the turn showing through. The
 * Warden never insults the player's worth; it complains about its rings,
 * its scouts and its century.
 */

import type { Bank, BankTrigger } from "./types.ts";

const fightTriggers: readonly BankTrigger[] = [
  { on: "stats", moment: "bossLull" },
  { on: "event", type: "hit", where: { target: "boss" } },
  { on: "event", type: "hit", where: { target: "player" } },
];

export const wardenPhase1: Bank = {
  id: "wardenPhase1",
  note: "Kill route, phase 1: outrage and scout husbandry.",
  triggers: fightTriggers,
  conditions: { bossPhases: [1], run: "hasFired", chance: 0.5 },
  speaker: "warden",
  cooldownMs: 9000,
  priority: 55,
  variants: [
    {
      id: "var_warden1_001",
      vo: true,
      direction: "Shrill, outraged, then cracking on the last word.",
      en:
        "Do you know what a scout costs?! Nothing! I GROW them! That makes it WORSE!",
      es:
        "¿¡Sabes cuánto cuesta un explorador!? ¡Nada! ¡Yo los CULTIVO! ¡Eso lo hace PEOR!",
      zh: "你知道一架侦察机值多少钱吗？！一分不值！是我亲手养大的！这才更糟！",
    },
    {
      id: "var_warden1_002",
      vo: true,
      direction: "Furious roll call, running out of breath.",
      en:
        "Zero one two two! I learn every pilot's number! I have learned one hundred twenty-two! STOP ADDING TO THE LIST!",
      es:
        "¡Cero uno dos dos! ¡Me aprendo el número de cada piloto! ¡Ya van ciento veintidós! ¡DEJA DE ALARGAR LA LISTA!",
      zh:
        "零一二二号！每个飞行员的编号我都记得！我已经记了一百二十二个了！别再往名单上加了！",
    },
    {
      id: "var_warden1_003",
      vo: true,
      direction: "Sarcastic, then sincerely wounded.",
      en: "Hit me again! Go on! It's not like I have FEELINGS! I have SEVERAL!",
      es:
        "¡Pégame otra vez! ¡Ándale! ¡Como si yo tuviera SENTIMIENTOS! ¡Tengo VARIOS!",
      zh: "再打我啊！来啊！反正我又没有感情！我有好几种！",
    },
    {
      id: "var_warden1_004",
      vo: true,
      direction: "Indignant, protective of the rings.",
      en: "Stop shooting my RINGS! They are load-bearing! Emotionally!",
      es:
        "¡Deja de dispararle a mis ANILLOS! ¡Sostienen todo! ¡Emocionalmente!",
      zh: "别打我的光环！那是承重结构！情感上的承重结构！",
    },
    {
      id: "bank.wardenPhase1.1",
      vo: false,
      en: "I was having a perfectly quiet century until you showed up!",
      es:
        "¡Yo estaba teniendo un siglo perfectamente tranquilo hasta que llegaste!",
      zh: "在你出现之前，我这一百年过得好好的，安安静静的！",
    },
    {
      id: "bank.wardenPhase1.2",
      vo: false,
      en: "You missed! HA! No, wait, don't try again!",
      es: "¡Fallaste! ¡JA! ¡No, espera, no lo vuelvas a intentar!",
      zh: "你没打中！哈！不，等等，别再试了！",
    },
    {
      id: "bank.wardenPhase1.3",
      vo: false,
      en: "Is the Authority paying you by the hole?! IS IT?!",
      es: "¿¡La Autoridad te paga por cada agujero!? ¿¡SÍ O NO!?",
      zh: "管理局是按窟窿给你算钱的吗？！是不是？！",
    },
  ],
};

export const wardenPhase2: Bank = {
  id: "wardenPhase2",
  note: "Kill route, phase 2: fraying, protecting convoys, not tired (tired).",
  triggers: fightTriggers,
  conditions: { bossPhases: [2], run: "hasFired", chance: 0.5 },
  speaker: "warden",
  cooldownMs: 9000,
  priority: 55,
  variants: [
    {
      id: "var_warden2_001",
      vo: true,
      direction: "Shouting orders, more worried than angry.",
      en: "Scouts, wide! WIDER! Keep the convoys clear, not in front of it!",
      es:
        "¡Exploradores, abiertos! ¡MÁS ABIERTOS! ¡Cuiden a los convoyes, no se le pongan enfrente!",
      zh: "侦察机，散开！再散开！护住车队，别挡在它前面！",
    },
    {
      id: "var_warden2_002",
      vo: true,
      direction: "Out of breath, insisting.",
      en:
        "I am NOT tired! I am pacing myself for the next three hundred years!",
      es:
        "¡NO estoy cansado! ¡Me estoy dosificando para los próximos trescientos años!",
      zh: "我才不累！我是在为接下来的三百年保存体力！",
    },
    {
      id: "var_warden2_003",
      vo: true,
      direction: "Furious, the facts landing harder than the volume.",
      en:
        "Every ring you break, a hauler flies dark tonight! Did they mention THAT in onboarding?!",
      es:
        "¡Por cada anillo que rompes, un transportista vuela a oscuras esta noche! ¿¡Eso te lo dijeron en la inducción!?",
      zh:
        "你每打碎一个光环，今晚就有一艘货船要摸黑飞！入职培训里讲过这个吗？！",
    },
    {
      id: "bank.wardenPhase2.1",
      vo: false,
      en: "You hit the left emitter! That was my GOOD emitter!",
      es: "¡Le diste al emisor izquierdo! ¡Ese era mi emisor BUENO!",
      zh: "你打中了左边的发射器！那可是我最好的发射器！",
    },
    {
      id: "bank.wardenPhase2.2",
      vo: false,
      en: "Stop dodging so smugly! I can SEE you being smug!",
      es: "¡Deja de esquivar tan presumido! ¡Te VEO presumiendo!",
      zh: "别躲得那么得意！我看得见你在得意！",
    },
    {
      id: "bank.wardenPhase2.3",
      vo: false,
      en: "I warned the last one too! Try listening! It's FREE!",
      es: "¡Al anterior también le advertí! ¡Intenta escuchar! ¡Es GRATIS!",
      zh: "上一个我也警告过！试着听一听！又不要钱！",
    },
  ],
};

export const wardenPhase3: Bank = {
  id: "wardenPhase3",
  note:
    "Kill route, phase 3: out of reserves, the turn showing through the anger.",
  triggers: fightTriggers,
  conditions: { bossPhases: [3], run: "hasFired", chance: 0.5 },
  speaker: "warden",
  cooldownMs: 10000,
  priority: 55,
  variants: [
    {
      id: "var_warden3_001",
      vo: true,
      direction: "Shouting, grief under it.",
      en:
        "Take it, then! Take the last ring! And when they put a tollgate on it, think of ME!",
      es:
        "¡Pues llévatelo! ¡Llévate el último anillo! ¡Y cuando le pongan una caseta de peaje, acuérdate de MÍ!",
      zh:
        "那就拿去！把最后一个光环也拿去！等他们在上面建起收费站的时候，想想我！",
    },
    {
      id: "var_warden3_002",
      vo: true,
      direction: "Defensive, voice cracking.",
      en: "I'm not losing! I'm running OUT! There is a DIFFERENCE!",
      es:
        "¡No estoy perdiendo! ¡Me estoy QUEDANDO SIN NADA! ¡Hay una DIFERENCIA!",
      zh: "我不是在输！我是快用完了！这是有区别的！",
    },
    {
      id: "var_warden3_003",
      vo: true,
      direction: "Almost pleading, still loud.",
      en:
        "Free sky! FREE! You might be the last pilot who ever flies it without a toll!",
      es:
        "¡Cielo libre! ¡LIBRE! ¡Puede que seas el último piloto que lo vuele sin pagar peaje!",
      zh: "自由的天空！自由！你可能是最后一个不用交过路费就能飞的飞行员了！",
    },
    {
      id: "bank.wardenPhase3.1",
      vo: false,
      en: "Scouts, go home. Go HOME. This one is mine to finish.",
      es: "Exploradores, a casa. A CASA. Esto lo termino yo.",
      zh: "侦察机，回家去。回家！这一仗我自己打完。",
    },
    {
      id: "bank.wardenPhase3.2",
      vo: false,
      en: "You're very good at this! I HATE that you're very good at this!",
      es: "¡Eres muy bueno en esto! ¡ODIO que seas tan bueno en esto!",
      zh: "你很擅长这个！我恨死你这么擅长这个了！",
    },
    {
      id: "bank.wardenPhase3.3",
      vo: false,
      en: "Count the rings, zero one two two! Count what's LEFT!",
      es: "¡Cuenta los anillos, cero uno dos dos! ¡Cuenta los que QUEDAN!",
      zh: "数数光环，零一二二号！数数还剩几个！",
    },
  ],
};

export const wardenPacifist: Bank = {
  id: "wardenPacifist",
  note:
    "A Pilot who has never fired, any phase: the Warden is bewildered and keeps yelling while it works out what that means.",
  triggers: [
    { on: "stats", moment: "bossLull" },
    { on: "event", type: "graze" },
  ],
  conditions: { bossPhases: [1, 2, 3], run: "neverFired", chance: 0.5 },
  speaker: "warden",
  cooldownMs: 10000,
  priority: 55,
  variants: [
    {
      id: "var_wardenpac_001",
      vo: true,
      direction: "Indignant confusion, a performer robbed of a cue.",
      en: "Why aren't you shooting?! Everyone shoots! I had a whole SPEECH!",
      es:
        "¿¡Por qué no disparas!? ¡Todos disparan! ¡Yo tenía todo un DISCURSO!",
      zh: "你怎么不开枪？！人人都开枪！我准备了一整篇演讲！",
    },
    {
      id: "var_wardenpac_002",
      vo: true,
      direction: "Flustered, almost embarrassed.",
      en: "Stop being polite at me! It's very confusing!",
      es: "¡Deja de ser tan amable conmigo! ¡Me confunde mucho!",
      zh: "别对我这么客气！我很困惑！",
    },
    {
      id: "var_wardenpac_003",
      vo: true,
      direction: "Shouted, then the second half almost tender.",
      en:
        "If this is a trick, it is a very RUDE trick! If it isn't, it's the nicest thing in a hundred years!",
      es:
        "¡Si esto es un truco, es un truco muy GROSERO! ¡Y si no, es lo más bonito en cien años!",
      zh:
        "如果这是个把戏，那可是个非常没礼貌的把戏！如果不是，这就是一百年来最好的事！",
    },
    {
      id: "bank.wardenPacifist.1",
      vo: false,
      en:
        "Is your trigger broken? Do you need a scout to look at it? They're very good with their hands!",
      es:
        "¿Se te descompuso el gatillo? ¿Quieres que un explorador lo revise? ¡Son muy hábiles!",
      zh: "你的扳机坏了吗？要不要让侦察机帮你看看？它们手可巧了！",
    },
    {
      id: "bank.wardenPacifist.2",
      vo: false,
      en: "Fine! Don't shoot! See if I care! I care a LOT, actually!",
      es:
        "¡Bien! ¡No dispares! ¡A ver si me importa! ¡Me importa MUCHO, la verdad!",
      zh: "好啊！别开枪！看我在不在乎！其实我非常在乎！",
    },
    {
      id: "bank.wardenPacifist.3",
      vo: false,
      en:
        "I'm going to keep yelling until I understand you! It might take a while!",
      es: "¡Voy a seguir gritando hasta entenderte! ¡Puede tardar un rato!",
      zh: "我会一直喊，直到弄明白你为止！可能要喊一阵子！",
    },
  ],
};
