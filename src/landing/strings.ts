/**
 * Player-facing landing-page text in the game's three languages. English is
 * also written inline in `index.html`, so the page reads correctly before (or
 * without) this script; a test keeps the two from drifting apart.
 * The deeper "How it was made" sections are English only, and say so.
 */
export const LANGS = ["en", "es", "zh"] as const;
export type Lang = typeof LANGS[number];

type Entry = Record<Lang, string>;

export const STRINGS = {
  title: {
    en: "Neon Warden: play free in your browser",
    es: "Neon Warden: juega gratis en tu navegador",
    zh: "Neon Warden：在浏览器中免费游玩",
  },
  skip: { en: "Skip to Play", es: "Ir a Jugar", zh: "跳到开始游戏" },
  eyebrow: {
    en: "A vertical slice from adamsmith.systems",
    es: "Un corte vertical de adamsmith.systems",
    zh: "adamsmith.systems 出品的垂直切片",
  },
  pitch: {
    en:
      "A short vertical shoot-'em-up. Fly a contractor's ship up the lanes for pay. The Warden waits at the end. Do you have to fight it?",
    es:
      "Un shoot-'em-up vertical y breve. Pilota la nave de un contratista por las rutas a cambio de una paga. Al final espera el Guardián. ¿Tienes que luchar contra él?",
    zh:
      "一款简短的纵向射击游戏。驾驶承包商的飞船沿航道向上，为报酬而飞。守望者在尽头等候。你一定要和它战斗吗？",
  },
  play: {
    en: "Play in your browser",
    es: "Jugar en el navegador",
    zh: "在浏览器中游玩",
  },
  next: {
    en:
      "Opens the game on its own page: press any key or tap, two short logos, then the main menu. Sound is on (adjustable). Loads up to about 25 MB as you play; nothing to install.",
    es:
      "Abre el juego en su propia página: pulsa una tecla o toca la pantalla, dos logotipos breves y el menú principal. Con sonido (ajustable). Descarga hasta unos 25 MB mientras juegas; no hay nada que instalar.",
    zh:
      "游戏会在单独的页面打开：按任意键或轻触屏幕，两段简短的标志动画，然后是主菜单。默认有声音（可调节）。游玩时最多加载约 25 MB，无需安装。",
  },
  "fact.free": { en: "Free", es: "Gratis", zh: "免费" },
  "fact.private": {
    en: "No account, ads or tracking",
    es: "Sin cuenta, anuncios ni rastreo",
    zh: "无需账号，无广告，无追踪",
  },
  "fact.input": {
    en: "Keyboard, mouse or touch",
    es: "Teclado, ratón o pantalla táctil",
    zh: "键盘、鼠标或触屏",
  },
  note: {
    en:
      "Content note: ship combat, deaths and a morally gray ending. The story is the same on every device.",
    es:
      "Aviso de contenido: combate entre naves, muertes y un final moralmente ambiguo. La historia es la misma en todos los dispositivos.",
    zh:
      "内容提示：飞船战斗、死亡，以及一个道德上模棱两可的结局。所有设备上的故事都相同。",
  },
  more: {
    en: "How it was made",
    es: "Cómo se hizo",
    zh: "制作过程",
  },
  "teaser.title": {
    en: "Teaser, draft cut",
    es: "Avance, versión preliminar",
    zh: "预告片（草剪版）",
  },
  "teaser.meta": {
    en: "30 seconds, 1.8 MB, with sound. Loads only when you press play.",
    es:
      "30 segundos, 1,8 MB, con sonido. Solo se descarga al pulsar reproducir.",
    zh: "30 秒，1.8 MB，有声音。只有在你按下播放后才会加载。",
  },
  "teaser.how": {
    en:
      "Captured from the game by a script; English voices with burned-in English subtitles.",
    es:
      "Capturado del juego mediante un script; voces en inglés con subtítulos en inglés incrustados.",
    zh: "由脚本从游戏中录制；英语配音，并带有内嵌英文字幕。",
  },
  "about.h": { en: "What it is", es: "Qué es", zh: "这是什么" },
  "about.slice.k": {
    en: "A vertical slice",
    es: "Un corte vertical",
    zh: "一个垂直切片",
  },
  "about.slice.v": {
    en:
      'One complete, polished stretch of a larger game that does not exist. Menus for the missing parts say "not included in this vertical slice" instead of hiding them.',
    es:
      "Un tramo completo y pulido de un juego más grande que no existe. Los menús de las partes que faltan dicen «No incluido en este corte vertical» en lugar de ocultarlas.",
    zh:
      "一个并不存在的大型游戏中完整、精致的一段。缺失部分的菜单会直接写明“本垂直切片未包含”，而不是把它们藏起来。",
  },
  "about.end.k": { en: "Two endings", es: "Dos finales", zh: "两个结局" },
  "about.end.v": {
    en:
      "You can defeat the Warden, or get through without destroying it. The ending you see depends on what you choose.",
    es:
      "Puedes derrotar al Guardián o salir adelante sin destruirlo. El final que veas depende de lo que elijas.",
    zh:
      "你可以击败守望者，也可以不摧毁它而通过。你看到哪个结局，取决于你的选择。",
  },
  "about.where.k": {
    en: "Where it runs",
    es: "Dónde funciona",
    zh: "运行平台",
  },
  "about.where.v": {
    en:
      "Desktop and phone browsers, designed for school Chromebooks too. It can be installed, and plays offline after you download it from the game's own settings.",
    es:
      "Navegadores de escritorio y de móvil, y pensado también para los Chromebooks escolares. Se puede instalar y funciona sin conexión después de descargarlo desde los ajustes del propio juego.",
    zh:
      "桌面和手机浏览器，也为学校的 Chromebook 做了设计。可以安装；在游戏自身的设置中下载后即可离线游玩。",
  },
  "about.who.k": { en: "Who made it", es: "Quién lo hizo", zh: "制作者" },
  "about.who.v": {
    en:
      "Adam Smith (UC Santa Cruz), directing a team of AI agents, in October 2026. The studio and the incubator in the logos are fiction.",
    es:
      "Adam Smith (UC Santa Cruz), dirigiendo un equipo de agentes de IA, en octubre de 2026. El estudio y la incubadora de los logotipos son ficticios.",
    zh:
      "Adam Smith（加州大学圣克鲁兹分校）于 2026 年 10 月指挥一组 AI 智能体制作。标志中的工作室和孵化器都是虚构的。",
  },
  "made.h": { en: "How it was made", es: "Cómo se hizo", zh: "制作过程" },
  "made.intro": {
    en:
      "This page is also a worked example for game-development students. Each card opens a short account with links to the source.",
    es:
      "Esta página es también un ejemplo práctico para estudiantes de desarrollo de videojuegos. Cada tarjeta abre un breve relato con enlaces al código fuente.",
    zh:
      "本页面也是给游戏开发学生的一个完整示例。每张卡片都链接到一段简短说明，并附有源代码链接。",
  },
  "made.enOnly": {
    en: "",
    es: "Los relatos detallados de abajo están en inglés.",
    zh: "下方的详细说明为英文。",
  },
  "c1.t": {
    en: "A slice is an argument",
    es: "Un corte vertical es un argumento",
    zh: "切片是一种论证",
  },
  "c1.s": {
    en: "What is built, what is honestly stubbed, and what was cut.",
    es:
      "Qué está construido, qué se deja como marcador honesto y qué se recortó.",
    zh: "哪些已经做好，哪些坦白地留作占位，哪些被砍掉了。",
  },
  "c2.t": {
    en: "Assets are programs",
    es: "Los recursos son programas",
    zh: "素材即程序",
  },
  "c2.s": {
    en: "Blender scripts, a voice script as data, auditioned music and sound.",
    es:
      "Scripts de Blender, un guion de voces como datos, música y sonido elegidos por audición.",
    zh: "Blender 脚本、作为数据的配音台本、经过试听挑选的音乐和音效。",
  },
  "c3.t": {
    en: "Engine and platform",
    es: "Motor y plataforma",
    zh: "引擎与平台",
  },
  "c3.s": {
    en:
      "three.js, TypeScript, Deno, Vite: a static site, installable, for phones and Chromebooks.",
    es:
      "three.js, TypeScript, Deno, Vite: un sitio estático, instalable, para móviles y Chromebooks.",
    zh:
      "three.js、TypeScript、Deno、Vite：可安装的静态网站，面向手机和 Chromebook。",
  },
  "c4.t": {
    en: "Two kinds of AI",
    es: "Dos tipos de IA",
    zh: "两种 AI",
  },
  "c4.s": {
    en:
      "Cloud agents that plan and write code; mostly local models that make the sounds and voices.",
    es:
      "Agentes en la nube que planifican y escriben código; modelos casi siempre locales que crean los sonidos y las voces.",
    zh:
      "云端智能体负责规划和编写代码；主要在本地运行的模型负责生成声音和配音。",
  },
  "c5.t": {
    en: "QA at many levels",
    es: "QA en muchos niveles",
    zh: "多层级的质量保证",
  },
  "c5.s": {
    en:
      "Unit tests, a deterministic simulation, autopilots and human playtests.",
    es:
      "Pruebas unitarias, una simulación determinista, pilotos automáticos y pruebas con personas.",
    zh: "单元测试、确定性模拟、自动驾驶以及真人试玩。",
  },
  "c6.t": {
    en: "Dailies and blind judges",
    es: "Diarios de rodaje y jueces a ciegas",
    zh: "每日样片与盲评",
  },
  "c6.s": {
    en:
      "Recorded reels with real audio, reviewed blind, and the claims we rejected.",
    es:
      "Grabaciones con audio real, revisadas a ciegas, y las afirmaciones que rechazamos.",
    zh: "带真实音频的录像、盲评审阅，以及我们驳回的结论。",
  },
  "c7.t": {
    en: "Choosing in context",
    es: "Elegir en contexto",
    zh: "在情境中选择",
  },
  "c7.s": {
    en:
      "A/B tests inside the running game, decisions that never destroy the alternative.",
    es:
      "Pruebas A/B dentro del juego en marcha; decisiones que nunca destruyen la alternativa.",
    zh: "在运行中的游戏里做 A/B 测试，做决定时从不删除备选方案。",
  },
  "c8.t": {
    en: "Read the source",
    es: "Lee el código",
    zh: "阅读源代码",
  },
  "c8.s": {
    en: "Where everything lives, and what you can regenerate yourself.",
    es: "Dónde está cada cosa y qué puedes regenerar por tu cuenta.",
    zh: "所有内容的位置，以及哪些可以由你自己重新生成。",
  },
  "foot.credit": {
    en:
      "Neon Warden by Adam Smith, and his coupled agents. adamsmith.systems and CM121 are fictional.",
    es:
      "Neon Warden, de Adam Smith y sus agentes acoplados. adamsmith.systems y CM121 son ficticios.",
    zh:
      "Neon Warden，由 Adam Smith 及其耦合的智能体制作。adamsmith.systems 与 CM121 均为虚构。",
  },
  "foot.privacy": {
    en:
      "This site sets no cookies, loads nothing from other sites and collects no data. Your language choice stays in this browser tab.",
    es:
      "Este sitio no usa cookies, no carga nada de otros sitios y no recoge datos. Tu elección de idioma se queda en esta pestaña del navegador.",
    zh:
      "本网站不设置 Cookie，不从其他网站加载任何内容，也不收集任何数据。你的语言选择只保存在当前浏览器标签页中。",
  },
} as const satisfies Record<string, Entry>;

export type Key = keyof typeof STRINGS;

/** `?lang=` first, then this tab's earlier choice, then the browser's list. */
export function pickLang(
  query: string,
  stored: string | null,
  preferred: readonly string[],
): Lang {
  const isLang = (v: string | null | undefined): v is Lang =>
    (LANGS as readonly string[]).includes(v ?? "");
  const asked = new URLSearchParams(query).get("lang");
  if (isLang(asked)) return asked;
  if (isLang(stored)) return stored;
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}
