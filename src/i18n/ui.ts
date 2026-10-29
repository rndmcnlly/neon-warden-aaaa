/**
 * Unspoken UI strings: menus, settings, HUD, stubs, credits, tips.
 *
 * Ids are `ui.<area>.<item>`. `{name}` marks a parameter that `t()` fills in
 * (key glyphs, numbers, serials). Serials are passed already padded, for
 * example `{serial}` = "0122", and the "#" belongs to the string, so each
 * language can place it. Key and button names are never translated here: the
 * input layer supplies them as parameters (`{key}`, `{input}`).
 *
 * The front end (`src/ui/`) reads these through `UiContext.t`, which binds the
 * current text language, so a language change rebuilds every open screen.
 *
 * Stub copy follows research/2026-10-28-vertical-slice-checklist: say what the
 * feature would be, then why it is absent; joke about the studio, never about
 * players; accessibility stubs drop the joke and name the guideline.
 *
 * Spanish is Latin American (tú, ustedes). Chinese is Simplified. See
 * docs/narrative/BIBLE.md for the glossary.
 */

import type { LocalizedText } from "./types.ts";

export const UI_STRINGS = {
  // -- common controls
  "ui.common.back": { en: "Back", es: "Volver", zh: "返回" },
  "ui.common.select": { en: "Select", es: "Seleccionar", zh: "选择" },
  "ui.common.adjust": { en: "Adjust", es: "Ajustar", zh: "调整" },
  "ui.common.tab": { en: "Tab", es: "Pestaña", zh: "标签页" },
  "ui.common.confirm": { en: "Confirm", es: "Confirmar", zh: "确认" },
  "ui.common.cancel": { en: "Cancel", es: "Cancelar", zh: "取消" },
  "ui.common.yes": { en: "Yes", es: "Sí", zh: "是" },
  "ui.common.no": { en: "No", es: "No", zh: "否" },
  "ui.common.on": { en: "On", es: "Activado", zh: "开" },
  "ui.common.off": { en: "Off", es: "Desactivado", zh: "关" },
  "ui.common.apply": { en: "Apply", es: "Aplicar", zh: "应用" },
  "ui.common.close": { en: "Close", es: "Cerrar", zh: "关闭" },
  "ui.common.skip": { en: "Skip", es: "Saltar", zh: "跳过" },
  "ui.common.holdToSkip": {
    en: "Hold {key} to skip",
    es: "Mantén {key} para saltar",
    zh: "按住 {key} 跳过",
  },
  "ui.common.percent": { en: "{value}%", es: "{value} %", zh: "{value}%" },

  // -- build stamp, first-interaction gate, photosensitivity notice
  "ui.build.label": {
    en: "Vertical slice build",
    es: "Versión de corte vertical",
    zh: "垂直切片版本",
  },
  "ui.build.detail": {
    en: "Not final. Build f26.1, October 2026.",
    es: "No es definitiva. Compilación f26.1, octubre de 2026.",
    zh: "非最终版。构建 f26.1，2026年10月。",
  },
  "ui.boot.loading": {
    en: "Loading {percent}%",
    es: "Cargando {percent} %",
    zh: "加载中 {percent}%",
  },
  "ui.gate.prompt": {
    en: "Press any key, button, or click to begin",
    es: "Presiona cualquier tecla o botón, o haz clic, para comenzar",
    zh: "按任意键或按钮，或点击鼠标开始",
  },
  "ui.gate.note": {
    en:
      "Sound starts after this. Browsers wait for a first interaction before playing audio.",
    es:
      "El sonido empieza después de esto. Los navegadores esperan una primera interacción antes de reproducir audio.",
    zh: "之后才会播放声音。浏览器要等到你第一次操作后才会播放音频。",
  },
  "ui.notice.title": {
    en: "Photosensitivity notice",
    es: "Aviso de fotosensibilidad",
    zh: "光敏性提示",
  },
  "ui.notice.body": {
    en:
      "A small number of people may have seizures triggered by flashing lights or patterns. This game is designed to stay under common flash thresholds, and Reduce flashing goes further. If you feel unwell, stop and rest.",
    es:
      "Un pequeño número de personas puede sufrir convulsiones provocadas por luces o patrones intermitentes. Este juego está diseñado para mantenerse por debajo de los umbrales de destellos habituales, y Reducir destellos va más allá. Si te sientes mal, detente y descansa.",
    zh:
      "极少数人可能会因闪烁的灯光或图案诱发癫痫。本游戏按常见闪烁阈值设计，开启“减少闪烁”可进一步降低刺激。如感到不适，请停止游戏并休息。",
  },
  "ui.notice.firstSound": {
    en: "Before any sound plays",
    es: "Antes de que suene nada",
    zh: "在播放任何声音之前",
  },
  "ui.notice.changeLater": {
    en: "All of these can be changed any time in Settings.",
    es: "Puedes cambiar todo esto en cualquier momento en Ajustes.",
    zh: "以上各项可随时在“设置”中更改。",
  },
  "ui.notice.continue": { en: "Continue", es: "Continuar", zh: "继续" },

  // -- logos (studio and publisher names stay in Latin script everywhere)
  "ui.logo.studio": {
    en: "adamsmith.systems",
    es: "adamsmith.systems",
    zh: "adamsmith.systems",
  },
  "ui.logo.studioTag": {
    en: "a studio of one, plus agents",
    es: "un estudio de una persona, más agentes",
    zh: "一人工作室，外加智能体",
  },
  "ui.logo.publisher": { en: "CM121", es: "CM121", zh: "CM121" },
  "ui.logo.publisherTag": {
    en: "incubator, cohort f26",
    es: "incubadora, generación f26",
    zh: "孵化器，f26 届",
  },
  "ui.logo.skip": { en: "Skip", es: "Saltar", zh: "跳过" },

  // -- title and main menu
  "ui.title.name": { en: "Neon Warden", es: "Neon Warden", zh: "霓虹守望者" },
  // "Enclosure" is the narrative spine: the enclosure of a commons. Spanish
  // and Chinese use the historical terms (cercamiento, 圈地).
  "ui.title.chapter": {
    en: "Chapter 1: Enclosure",
    es: "Capítulo 1: Cercamiento",
    zh: "第一章：圈地",
  },
  "ui.title.press": {
    en: "Press to start",
    es: "Presiona para empezar",
    zh: "按下以开始",
  },
  "ui.title.launch": {
    en: "Press {key} to launch",
    es: "Presiona {key} para despegar",
    zh: "按 {key} 出发",
  },
  "ui.title.attract": {
    en: "Self-play demo in {seconds}",
    es: "Demostración automática en {seconds}",
    zh: "{seconds} 秒后播放自动演示",
  },
  "ui.title.attractCaption": {
    en: "Archive footage: Pilot #0121, recorded runs",
    es: "Material de archivo: piloto #0121, vuelos grabados",
    zh: "档案影像：0121号飞行员的飞行记录",
  },
  "ui.menu.newGame": { en: "New Game", es: "Nueva partida", zh: "新游戏" },
  "ui.menu.continue": { en: "Continue", es: "Continuar", zh: "继续游戏" },
  "ui.menu.continueNone": {
    en:
      "No checkpoint yet. Checkpoints save after the tutorial, the flashback, and the Warden.",
    es:
      "Todavía no hay punto de control. Se guarda después del tutorial, el recuerdo y el Guardián.",
    zh: "尚无存档。教程、闪回和守望者之战结束后会自动存档。",
  },
  "ui.menu.continueFrom": {
    en: "Checkpoint: {where}, {date}",
    es: "Punto de control: {where}, {date}",
    zh: "存档点：{where}，{date}",
  },
  "ui.menu.flyAgain": {
    en: "Fly again (Pilot #{serial})",
    es: "Volar otra vez (piloto #{serial})",
    zh: "再次出航（{serial}号飞行员）",
  },
  "ui.menu.chapters": {
    en: "Chapter Select",
    es: "Seleccionar capítulo",
    zh: "章节选择",
  },
  "ui.menu.settings": { en: "Settings", es: "Ajustes", zh: "设置" },
  "ui.menu.extras": { en: "Extras", es: "Extras", zh: "附加内容" },
  "ui.menu.credits": { en: "Credits", es: "Créditos", zh: "制作人员" },
  "ui.menu.news": { en: "News", es: "Noticias", zh: "新闻" },
  "ui.menu.quit": { en: "Quit", es: "Salir", zh: "退出" },

  // -- new game
  "ui.newGame.title": { en: "New Game", es: "Nueva partida", zh: "新游戏" },
  "ui.newGame.difficulty": { en: "Difficulty", es: "Dificultad", zh: "难度" },
  "ui.newGame.changeLater": {
    en: "Difficulty can be changed at any time in Settings, Accessibility.",
    es:
      "Puedes cambiar la dificultad en cualquier momento en Ajustes, Accesibilidad.",
    zh: "难度可随时在“设置 > 无障碍”中更改。",
  },
  "ui.newGame.start": {
    en: "Begin onboarding",
    es: "Comenzar la inducción",
    zh: "开始入职培训",
  },
  "ui.newGame.callsign": { en: "Callsign", es: "Indicativo", zh: "呼号" },
  "ui.newGame.callsignValue": { en: "PILOT", es: "PILOTO", zh: "飞行员" },
  "ui.newGame.callsignLocked": {
    en: "Callsign assigned by Lane Authority.",
    es: "Indicativo asignado por la Autoridad de Rutas.",
    zh: "呼号由航道管理局指定。",
  },
  "ui.difficulty.story": { en: "Story", es: "Historia", zh: "剧情" },
  "ui.difficulty.normal": { en: "Normal", es: "Normal", zh: "普通" },
  "ui.difficulty.hard": { en: "Hard", es: "Difícil", zh: "困难" },
  "ui.difficulty.storyHint": {
    en: "Gentler fire and more room to follow the plot.",
    es: "Fuego más suave y más margen para seguir la historia.",
    zh: "火力更温和，更有余裕跟上剧情。",
  },
  "ui.difficulty.normalHint": {
    en: "The intended balance.",
    es: "El equilibrio previsto.",
    zh: "设计中的标准平衡。",
  },
  "ui.difficulty.hardHint": {
    en: "Denser fire, for veterans of the original.",
    es: "Fuego más denso, para veteranos del original.",
    zh: "火力更密集，献给原版的老玩家。",
  },

  // -- chapter select
  "ui.chapters.title": {
    en: "Chapter Select",
    es: "Seleccionar capítulo",
    zh: "章节选择",
  },
  "ui.chapters.ch1": {
    en: "Chapter 1: Enclosure",
    es: "Capítulo 1: Cercamiento",
    zh: "第一章：圈地",
  },
  "ui.chapters.ch1Desc": {
    en: "The vertical slice: onboarding, five sectors, the Warden.",
    es: "El corte vertical: la inducción, cinco sectores y el Guardián.",
    zh: "垂直切片：入职培训、五个星区、守望者。",
  },
  "ui.chapters.locked": {
    en: "Chapters 2–9",
    es: "Capítulos 2–9",
    zh: "第二至九章",
  },
  "ui.chapters.lockedBody": {
    en:
      "Chapters 2–9 exist in a design document and nowhere else. This vertical slice is Chapter 1.",
    es:
      "Los capítulos 2–9 existen en un documento de diseño y en ningún otro lugar. Este corte vertical es el capítulo 1.",
    zh: "第二至九章只存在于设计文档里。本垂直切片即为第一章。",
  },
  "ui.chapters.beat.tutorial": {
    en: "Onboarding",
    es: "Inducción",
    zh: "入职培训",
  },
  "ui.chapters.beat.sector1": { en: "Sector 1", es: "Sector 1", zh: "第1星区" },
  "ui.chapters.beat.sector3": { en: "Sector 3", es: "Sector 3", zh: "第3星区" },
  "ui.chapters.beat.flashback": {
    en: "The flight recorder",
    es: "La grabadora de vuelo",
    zh: "飞行记录仪",
  },
  "ui.chapters.beat.boss": {
    en: "The Warden",
    es: "El Guardián",
    zh: "守望者",
  },
  "ui.chapter.endingKill": {
    en: "Lanes Open",
    es: "Rutas abiertas",
    zh: "航道开放",
  },
  "ui.chapter.endingPacifist": {
    en: "Lanes Kept",
    es: "Rutas protegidas",
    zh: "航道守护",
  },
  "ui.chapter.endingLocked": {
    en: "Reach this ending once to unlock it here.",
    es: "Alcanza este final una vez para desbloquearlo aquí.",
    zh: "达成一次此结局后即可在此解锁。",
  },

  // -- extras
  "ui.extras.title": { en: "Extras", es: "Extras", zh: "附加内容" },
  "ui.extras.multiplayer": {
    en: "Online Multiplayer",
    es: "Multijugador en línea",
    zh: "在线多人游戏",
  },
  "ui.extras.leaderboards": {
    en: "Leaderboards",
    es: "Clasificaciones",
    zh: "排行榜",
  },
  "ui.extras.store": { en: "Store", es: "Tienda", zh: "商店" },
  "ui.extras.signIn": {
    en: "Sign-in and Cloud Saves",
    es: "Inicio de sesión y guardado en la nube",
    zh: "登录与云存档",
  },
  "ui.extras.photo": { en: "Photo Mode", es: "Modo foto", zh: "拍照模式" },
  "ui.extras.eula": {
    en: "End User License Agreement",
    es: "Contrato de licencia de usuario final",
    zh: "最终用户许可协议",
  },
  "ui.extras.privacy": {
    en: "Data and Privacy",
    es: "Datos y privacidad",
    zh: "数据与隐私",
  },
  "ui.extras.licenses": {
    en: "Third-Party Licenses",
    es: "Licencias de terceros",
    zh: "第三方许可证",
  },

  // -- honest stubs (title comes from the menu row; body here)
  "ui.stub.badge": {
    en: "Not included in this vertical slice",
    es: "No incluido en este corte vertical",
    zh: "本垂直切片未包含",
  },
  "ui.stub.ok": { en: "Understood", es: "Entendido", zh: "明白了" },
  "ui.stub.multiplayer": {
    en:
      "No servers were provisioned, so none can go down. The Warden will have to disappoint you one pilot at a time.",
    es:
      "No se contrató ningún servidor, así que ninguno puede caerse. El Guardián tendrá que decepcionarlos de a un piloto a la vez.",
    zh: "我们没有部署服务器，所以也不会宕机。守望者只能一次让一位飞行员失望。",
  },
  "ui.stub.leaderboards": {
    en:
      "Your best score is saved on this device, where it is safe from everyone but you.",
    es:
      "Tu mejor puntuación se guarda en este dispositivo, a salvo de todos menos de ti.",
    zh: "你的最高分保存在这台设备上，除了你谁也碰不到。",
  },
  "ui.stub.store": {
    en: "There is nothing to buy. We checked twice.",
    es: "No hay nada que comprar. Lo revisamos dos veces.",
    zh: "没有任何东西可买。我们检查了两遍。",
  },
  "ui.stub.signIn": {
    en: "You are anonymous, which in 2027 is a premium feature.",
    es: "Eres anónimo, y en 2027 eso es una función premium.",
    zh: "你是匿名的，这在2027年可是高级功能。",
  },
  "ui.stub.photo": {
    en: "Please admire the neon manually.",
    es: "Por favor, admira el neón manualmente.",
    zh: "请手动欣赏霓虹。",
  },
  "ui.stub.eula": {
    en: "You may play this. That is the whole agreement.",
    es: "Puedes jugar esto. Ese es todo el contrato.",
    zh: "你可以玩这个游戏。协议到此为止。",
  },
  "ui.stub.news": {
    en: "The only update is this build.",
    es: "La única novedad es esta versión.",
    zh: "唯一的更新就是这个版本。",
  },
  "ui.stub.achievementSync": {
    en:
      "Achievements are tracked on this device only. No platform is watching, which is either freeing or lonely.",
    es:
      "Los logros se registran solo en este dispositivo. Ninguna plataforma está mirando, lo cual es liberador o solitario.",
    zh:
      "成就只记录在本设备上。没有任何平台在看着你，这或许是自由，或许是孤独。",
  },
  "ui.stub.moreLangs": {
    en: "Translators are people, and we have not hired any yet.",
    es: "Los traductores son personas, y todavía no contratamos a ninguna.",
    zh: "译者是真实的人，而我们还没有聘请任何一位。",
  },
  // Accessibility stub: no joke, and the guideline citations stay exact.
  "ui.stub.narration": {
    en:
      "Spoken menus and screen reader support matter (Xbox Accessibility Guideline 106; Game Accessibility Guidelines, advanced). We have not built them yet. This row exists so the gap is visible.",
    es:
      "Los menús narrados y la compatibilidad con lectores de pantalla son importantes (Xbox Accessibility Guideline 106; Game Accessibility Guidelines, nivel avanzado). Todavía no los hemos construido. Esta fila existe para que la carencia sea visible.",
    zh:
      "菜单语音朗读和屏幕阅读器支持很重要（Xbox Accessibility Guideline 106；Game Accessibility Guidelines 高级级别）。我们还没有实现它们。保留这一行，是为了让这项缺失清晰可见。",
  },

  // -- quit, privacy, licenses
  "ui.quit.title": { en: "Quit", es: "Salir", zh: "退出" },
  "ui.quit.body": {
    en:
      "This is a browser tab. You were always free to leave. Scripts cannot close a tab they did not open, so closing it is up to you.",
    es:
      "Esto es una pestaña del navegador. Siempre fuiste libre de irte. Un script no puede cerrar una pestaña que no abrió, así que cerrarla depende de ti.",
    zh:
      "这是一个浏览器标签页。你一直都可以自由离开。脚本无法关闭不是由它打开的标签页，所以要不要关闭由你决定。",
  },
  "ui.privacy.title": {
    en: "Data and Privacy",
    es: "Datos y privacidad",
    zh: "数据与隐私",
  },
  "ui.privacy.body": {
    en:
      "This build collects no data. There is nothing to opt into. Settings and your checkpoint stay in this browser's local storage, on this device only. This screen exists so you do not have to wonder.",
    es:
      "Esta versión no recopila datos. No hay nada que aceptar. Los ajustes y tu punto de control se quedan en el almacenamiento local de este navegador, solo en este dispositivo. Esta pantalla existe para que no tengas que preguntártelo.",
    zh:
      "本版本不收集任何数据，也没有需要你同意的条款。设置和存档点只保存在本浏览器的本地存储中，仅限这台设备。这个页面的存在，是为了让你不必猜测。",
  },
  "ui.licenses.title": {
    en: "Third-Party Licenses",
    es: "Licencias de terceros",
    zh: "第三方许可证",
  },
  "ui.licenses.intro": {
    en:
      "This build is made with open-source software. Their licenses require these notices.",
    es:
      "Esta versión está hecha con software de código abierto. Sus licencias exigen estos avisos, que se muestran en su inglés original.",
    zh:
      "本版本使用开源软件制作。其许可证要求附上以下声明，声明以英文原文呈现。",
  },
  // Notices and license text stay in English: the original text is the
  // binding one, and a translation would not satisfy the license.
  "ui.licenses.three": {
    en: "three.js: Copyright 2010–2026 three.js authors. MIT License.",
    es: "three.js: Copyright 2010–2026 three.js authors. MIT License.",
    zh: "three.js: Copyright 2010–2026 three.js authors. MIT License.",
  },
  "ui.licenses.vite": {
    en:
      "Vite: Copyright 2019–present VoidZero Inc. and contributors. MIT License.",
    es:
      "Vite: Copyright 2019–present VoidZero Inc. and contributors. MIT License.",
    zh:
      "Vite: Copyright 2019–present VoidZero Inc. and contributors. MIT License.",
  },
  "ui.licenses.deno": {
    en: "Deno: Copyright 2018–2026 the Deno authors. MIT License.",
    es: "Deno: Copyright 2018–2026 the Deno authors. MIT License.",
    zh: "Deno: Copyright 2018–2026 the Deno authors. MIT License.",
  },
  "ui.licenses.mitText": {
    en: MIT_TEXT(),
    es: MIT_TEXT(),
    zh: MIT_TEXT(),
  },

  // -- credits
  "ui.credits.title": { en: "Credits", es: "Créditos", zh: "制作人员" },
  "ui.credits.direction": {
    en: "Direction and design",
    es: "Dirección y diseño",
    zh: "导演与设计",
  },
  "ui.credits.directionBody": {
    en: "Adam Smith",
    es: "Adam Smith",
    zh: "Adam Smith",
  },
  "ui.credits.agents": {
    en: "Implementation",
    es: "Implementación",
    zh: "实现",
  },
  "ui.credits.agentsBody": {
    en:
      "Code, 3D models, voice and sound drafted by AI agents working in file-scoped workstreams, under human direction and review.",
    es:
      "Código, modelos 3D, voces y sonido elaborados por agentes de IA que trabajan en líneas de trabajo acotadas por archivo, bajo dirección y revisión humanas.",
    zh:
      "代码、3D 模型、配音与音效由 AI 智能体按文件划分的工作流起草，并经人类指导和审阅。",
  },
  "ui.credits.tools": { en: "Tools", es: "Herramientas", zh: "工具" },
  "ui.credits.toolsBody": {
    en:
      "three.js, Vite, Deno, Blender, the Orbitron font (OFL), Stable Audio 3 for music and sound, Qwen3-TTS and Qwen3-ASR for voices",
    es:
      "three.js, Vite, Deno, Blender, la tipografía Orbitron (OFL), Stable Audio 3 para música y sonido, Qwen3-TTS y Qwen3-ASR para las voces",
    zh:
      "three.js、Vite、Deno、Blender、Orbitron 字体（OFL）、用于音乐和音效的 Stable Audio 3、用于配音的 Qwen3-TTS 与 Qwen3-ASR",
  },
  "ui.credits.studio": {
    en: "adamsmith.systems, for CM121 cohort f26",
    es: "adamsmith.systems, para CM121 generación f26",
    zh: "adamsmith.systems，为 CM121 f26 届出品",
  },
  "ui.credits.stubNote": {
    en:
      "These credits are provisional until the slice is complete; every person, model and tool will be listed in full.",
    es:
      "Estos créditos son provisionales hasta que el corte esté completo; cada persona, modelo y herramienta aparecerá en la lista completa.",
    zh:
      "在切片完成之前，这份名单只是暂定；届时每一位参与者、每个模型和工具都会完整列出。",
  },
  "ui.credits.voices": {
    en: "Voices: synthesized locally with Qwen3-TTS",
    es: "Voces: sintetizadas localmente con Qwen3-TTS",
    zh: "配音：使用 Qwen3-TTS 本地合成",
  },
  "ui.credits.original": {
    en: "Based on Neon Warden, the CMPM 121 starter project",
    es: "Basado en Neon Warden, el proyecto inicial de CMPM 121",
    zh: "改编自 CMPM 121 入门项目《霓虹守望者》",
  },
  "ui.credits.stuntPilots": {
    en: "Stunt pilots: Pilot #0001 – #0121",
    es: "Pilotos de riesgo: piloto #0001 – #0121",
    zh: "特技飞行员：0001号 – 0121号",
  },
  "ui.credits.stuntPilotKept": {
    en: "Pilot #0122 (still flying)",
    es: "Piloto #0122 (sigue volando)",
    zh: "0122号飞行员（仍在飞行）",
  },

  // -- confirmations
  "ui.confirm.restartTitle": {
    en: "Restart from checkpoint?",
    es: "¿Reiniciar desde el punto de control?",
    zh: "要从存档点重新开始吗？",
  },
  "ui.confirm.restartBody": {
    en: "Progress since the last checkpoint will be lost.",
    es: "Se perderá el progreso desde el último punto de control.",
    zh: "上一个存档点之后的进度将会丢失。",
  },
  "ui.confirm.restartYes": { en: "Restart", es: "Reiniciar", zh: "重新开始" },
  "ui.confirm.quitTitle": {
    en: "Quit to title?",
    es: "¿Volver al título?",
    zh: "要返回标题画面吗？",
  },
  "ui.confirm.quitBody": {
    en: "Progress since the last checkpoint will be lost.",
    es: "Se perderá el progreso desde el último punto de control.",
    zh: "上一个存档点之后的进度将会丢失。",
  },
  "ui.confirm.quitYes": {
    en: "Quit to title",
    es: "Volver al título",
    zh: "返回标题画面",
  },
  "ui.confirm.resetTitle": {
    en: "Reset all settings?",
    es: "¿Restablecer todos los ajustes?",
    zh: "要重置所有设置吗？",
  },
  "ui.confirm.resetBody": {
    en: "Every option, including control bindings, returns to its default.",
    es:
      "Todas las opciones, incluidas las asignaciones de controles, vuelven a sus valores predeterminados.",
    zh: "所有选项（包括按键绑定）都将恢复为默认值。",
  },
  "ui.confirm.resetYes": { en: "Reset", es: "Restablecer", zh: "重置" },
  "ui.confirm.resetControlsTitle": {
    en: "Reset controls?",
    es: "¿Restablecer los controles?",
    zh: "要重置操作设置吗？",
  },
  "ui.confirm.resetControlsBody": {
    en: "All bindings return to their defaults.",
    es: "Todas las asignaciones vuelven a sus valores predeterminados.",
    zh: "所有按键绑定都将恢复为默认值。",
  },
  "ui.confirm.keep": {
    en: "Keep playing",
    es: "Seguir jugando",
    zh: "继续游戏",
  },

  // -- pause
  "ui.pause.title": { en: "Paused", es: "Pausa", zh: "已暂停" },
  "ui.pause.resume": { en: "Resume", es: "Reanudar", zh: "继续" },
  "ui.pause.restart": {
    en: "Restart checkpoint",
    es: "Reiniciar punto de control",
    zh: "从存档点重来",
  },
  "ui.pause.settings": { en: "Settings", es: "Ajustes", zh: "设置" },
  "ui.pause.controls": { en: "Controls", es: "Controles", zh: "操作说明" },
  "ui.pause.quit": {
    en: "Quit to title",
    es: "Volver al título",
    zh: "返回标题画面",
  },
  "ui.pause.objective": {
    en: "Objective: reach the Warden.",
    es: "Objetivo: llegar hasta el Guardián.",
    zh: "目标：抵达守望者。",
  },
  "ui.pause.reasonBlur": {
    en: "Paused because the window lost focus.",
    es: "Pausado porque la ventana perdió el foco.",
    zh: "窗口失去焦点，游戏已暂停。",
  },
  "ui.pause.reasonPad": {
    en: "Controller disconnected. Reconnect it, or continue with the keyboard.",
    es: "Control desconectado. Vuelve a conectarlo o sigue con el teclado.",
    zh: "手柄已断开。请重新连接，或改用键盘继续。",
  },
  "ui.pause.reasonFullscreen": {
    en: "Paused because fullscreen ended.",
    es: "Pausado porque se salió de pantalla completa.",
    zh: "已退出全屏，游戏已暂停。",
  },
  "ui.objective.tutorial": {
    en: "Complete onboarding.",
    es: "Completa la inducción.",
    zh: "完成入职培训。",
  },
  "ui.objective.sectors": {
    en: "Fly the route to the Warden.",
    es: "Recorre la ruta hasta el Guardián.",
    zh: "沿航线飞向守望者。",
  },
  "ui.objective.boss": {
    en: "Face the Warden.",
    es: "Enfréntate al Guardián.",
    zh: "直面守望者。",
  },

  // -- actions (names only; key and button glyphs come from the input layer)
  "ui.action.moveUp": { en: "Move up", es: "Mover arriba", zh: "向上移动" },
  "ui.action.moveDown": { en: "Move down", es: "Mover abajo", zh: "向下移动" },
  "ui.action.moveLeft": {
    en: "Move left",
    es: "Mover a la izquierda",
    zh: "向左移动",
  },
  "ui.action.moveRight": {
    en: "Move right",
    es: "Mover a la derecha",
    zh: "向右移动",
  },
  "ui.action.fire": { en: "Fire", es: "Disparar", zh: "射击" },
  "ui.action.focus": {
    en: "Focus (slow, precise movement)",
    es: "Enfoque (movimiento lento y preciso)",
    zh: "专注（缓慢精确移动）",
  },
  "ui.action.pause": { en: "Pause", es: "Pausa", zh: "暂停" },
  "ui.action.confirm": {
    en: "Menu confirm",
    es: "Confirmar en menús",
    zh: "菜单确认",
  },
  "ui.action.back": { en: "Menu back", es: "Volver en menús", zh: "菜单返回" },

  // -- settings
  "ui.settings.title": { en: "Settings", es: "Ajustes", zh: "设置" },
  "ui.settings.tab.display": { en: "Display", es: "Pantalla", zh: "显示" },
  "ui.settings.tab.audio": { en: "Audio", es: "Audio", zh: "音频" },
  "ui.settings.tab.language": { en: "Language", es: "Idioma", zh: "语言" },
  "ui.settings.tab.subtitles": {
    en: "Subtitles",
    es: "Subtítulos",
    zh: "字幕",
  },
  "ui.settings.tab.accessibility": {
    en: "Accessibility",
    es: "Accesibilidad",
    zh: "无障碍",
  },
  "ui.settings.tab.controls": { en: "Controls", es: "Controles", zh: "操作" },
  "ui.settings.resetAll": {
    en: "Reset all settings",
    es: "Restablecer todos los ajustes",
    zh: "重置所有设置",
  },
  "ui.settings.saved": {
    en: "Settings saved",
    es: "Ajustes guardados",
    zh: "设置已保存",
  },

  "ui.settings.preset": {
    en: "Graphics preset",
    es: "Calidad gráfica",
    zh: "画质预设",
  },
  "ui.settings.preset.low": { en: "Low", es: "Baja", zh: "低" },
  "ui.settings.preset.medium": { en: "Medium", es: "Media", zh: "中" },
  "ui.settings.preset.high": { en: "High", es: "Alta", zh: "高" },
  "ui.settings.preset.ultra": { en: "Ultra", es: "Ultra", zh: "极高" },
  "ui.settings.preset.custom": {
    en: "Custom",
    es: "Personalizada",
    zh: "自定义",
  },
  "ui.settings.renderScale": {
    en: "Render scale",
    es: "Escala de renderizado",
    zh: "渲染比例",
  },
  "ui.settings.renderScaleHint": {
    en: "Renders at {w} x {h}",
    es: "Renderiza a {w} x {h}",
    zh: "渲染分辨率 {w} x {h}",
  },
  "ui.settings.fullscreen": {
    en: "Fullscreen",
    es: "Pantalla completa",
    zh: "全屏",
  },
  "ui.settings.vsync": {
    en: "V-Sync",
    es: "V-Sync",
    zh: "垂直同步",
  },
  "ui.settings.vsyncBody": {
    en: "Handled by your browser, which did not ask our opinion.",
    es: "La maneja tu navegador, que no nos pidió opinión.",
    zh: "由你的浏览器处理，它没有征求我们的意见。",
  },

  "ui.settings.master": {
    en: "Master volume",
    es: "Volumen general",
    zh: "主音量",
  },
  "ui.settings.music": { en: "Music", es: "Música", zh: "音乐" },
  "ui.settings.sfx": {
    en: "Sound effects",
    es: "Efectos de sonido",
    zh: "音效",
  },
  "ui.settings.voice": { en: "Voice", es: "Voces", zh: "语音" },
  "ui.settings.uiVolume": {
    en: "Interface sounds",
    es: "Sonidos de interfaz",
    zh: "界面音效",
  },

  "ui.settings.textLang": {
    en: "Text language",
    es: "Idioma del texto",
    zh: "文字语言",
  },
  "ui.settings.voiceLang": {
    en: "Voice language",
    es: "Idioma de las voces",
    zh: "语音语言",
  },
  "ui.settings.langHint": {
    en:
      "Text and voice languages are separate, so you can hear one and read another.",
    es:
      "Los idiomas del texto y de las voces son independientes: puedes escuchar uno y leer otro.",
    zh: "文字语言和语音语言相互独立，你可以听一种语言、读另一种语言。",
  },
  "ui.settings.moreLangs": {
    en: "More languages",
    es: "Más idiomas",
    zh: "更多语言",
  },
  // Language names are written in their own language in every locale.
  "ui.lang.en": { en: "English", es: "English", zh: "English" },
  "ui.lang.es": { en: "Español", es: "Español", zh: "Español" },
  "ui.lang.zh": { en: "中文（简体）", es: "中文（简体）", zh: "中文（简体）" },

  "ui.settings.subtitles": { en: "Subtitles", es: "Subtítulos", zh: "字幕" },
  "ui.settings.subtitleScale": {
    en: "Subtitle size",
    es: "Tamaño de subtítulos",
    zh: "字幕大小",
  },
  "ui.settings.subtitleBg": {
    en: "Background opacity",
    es: "Opacidad del fondo",
    zh: "背景不透明度",
  },
  "ui.settings.speakerNames": {
    en: "Speaker names",
    es: "Nombres de quien habla",
    zh: "显示说话者",
  },
  "ui.settings.maxLines": {
    en: "Lines on screen",
    es: "Líneas en pantalla",
    zh: "同屏行数",
  },
  "ui.settings.maxLines1": { en: "1 line", es: "1 línea", zh: "1 行" },
  "ui.settings.maxLines2": { en: "2 lines", es: "2 líneas", zh: "2 行" },
  "ui.settings.preview": { en: "Preview", es: "Vista previa", zh: "预览" },
  "ui.settings.previewSpeaker": {
    en: "The Warden",
    es: "El Guardián",
    zh: "守望者",
  },
  "ui.settings.previewLine": {
    en: "Turn back, contractor.\nThis lane is closed.",
    es: "¡Date la vuelta, contratista!\nEsta ruta está cerrada.",
    zh: "回去，雇佣兵！\n这条航道已经封闭。",
  },

  "ui.settings.autoFire": {
    en: "Auto-fire",
    es: "Disparo automático",
    zh: "自动射击",
  },
  "ui.settings.autoFireHint": {
    en: "Fires constantly. Hold fire to stop firing.",
    es: "Dispara sin parar. Mantén Disparar para dejar de disparar.",
    zh: "持续射击。按住射击键即可停火。",
  },
  "ui.settings.holdToggle": {
    en: "Fire and focus buttons",
    es: "Botones de disparo y enfoque",
    zh: "射击与专注按键",
  },
  "ui.settings.hold": { en: "Hold", es: "Mantener", zh: "按住" },
  "ui.settings.toggle": { en: "Toggle", es: "Alternar", zh: "切换" },
  "ui.settings.shake": {
    en: "Screen shake",
    es: "Vibración de pantalla",
    zh: "屏幕震动",
  },
  "ui.settings.reducedFlashing": {
    en: "Reduce flashing",
    es: "Reducir destellos",
    zh: "减少闪烁",
  },
  "ui.settings.gameSpeed": {
    en: "Game speed",
    es: "Velocidad del juego",
    zh: "游戏速度",
  },
  "ui.settings.difficulty": { en: "Difficulty", es: "Dificultad", zh: "难度" },
  "ui.settings.colorCues": {
    en: "Shape cues alongside color",
    es: "Formas junto a los colores",
    zh: "颜色搭配形状提示",
  },
  "ui.settings.narration": {
    en: "Menu narration",
    es: "Narración de menús",
    zh: "菜单朗读",
  },

  // -- controls
  "ui.controls.action": { en: "Action", es: "Acción", zh: "动作" },
  "ui.controls.keyboard": { en: "Keyboard", es: "Teclado", zh: "键盘" },
  "ui.controls.alternate": { en: "Alternate", es: "Alternativa", zh: "备用" },
  "ui.controls.gamepad": { en: "Gamepad", es: "Control", zh: "手柄" },
  "ui.controls.pressKey": {
    en: "Press a key…",
    es: "Presiona una tecla…",
    zh: "请按下按键……",
  },
  "ui.controls.pressButton": {
    en: "Press a button…",
    es: "Presiona un botón…",
    zh: "请按下按钮……",
  },
  "ui.controls.unbound": { en: "Unbound", es: "Sin asignar", zh: "未绑定" },
  "ui.controls.moved": {
    en: "{input} moved from {from}.",
    es: "{input} se movió desde {from}.",
    zh: "{input} 已从“{from}”移出。",
  },
  "ui.controls.swapped": {
    en: "{input} moved from {from}, which now uses {swapped}.",
    es: "{input} se movió desde {from}, que ahora usa {swapped}.",
    zh: "{input} 已从“{from}”移出，“{from}”现在使用 {swapped}。",
  },
  "ui.controls.reset": {
    en: "Reset controls to defaults",
    es: "Restablecer controles",
    zh: "将操作恢复为默认",
  },
  "ui.controls.fallbackNote": {
    en:
      "Arrow keys, Enter and Esc always work in menus, so no remap can lock you out.",
    es:
      "Las flechas, Enter y Esc siempre funcionan en los menús, así que ninguna reasignación puede dejarte afuera.",
    zh:
      "方向键、Enter 和 Esc 在菜单中始终有效，所以任何改键都不会把你锁在外面。",
  },
  "ui.controls.captureNote": {
    en: "Any key binds, including Esc. Wait 6 seconds to cancel.",
    es: "Cualquier tecla sirve, incluida Esc. Espera 6 segundos para cancelar.",
    zh: "任何按键都可绑定，包括 Esc。等待 6 秒即可取消。",
  },

  "ui.save.saved": {
    en: "Checkpoint saved",
    es: "Punto de control guardado",
    zh: "已存档",
  },

  // -- HUD and banners (sector names and subtitles are from the original)
  "ui.hud.score": { en: "Score", es: "Puntos", zh: "得分" },
  "ui.hud.best": { en: "Best", es: "Récord", zh: "最高分" },
  "ui.hud.hull": { en: "Hull", es: "Casco", zh: "船体" },
  "ui.hud.cannon": { en: "Cannon", es: "Cañón", zh: "主炮" },
  "ui.hud.route": { en: "Route", es: "Ruta", zh: "航线" },
  "ui.hud.serial": {
    en: "Pilot #{serial}",
    es: "Piloto #{serial}",
    zh: "{serial}号飞行员",
  },
  "ui.hud.wardenMeter": { en: "WARDEN", es: "GUARDIÁN", zh: "守望者" },
  "ui.hud.checkpoint": {
    en: "Checkpoint saved",
    es: "Punto de control guardado",
    zh: "已存档",
  },
  "ui.sector.1.name": {
    en: "Outer Drift",
    es: "Deriva Exterior",
    zh: "外缘漂流带",
  },
  "ui.sector.1.subtitle": {
    en: "Scouts ahead",
    es: "Exploradores al frente",
    zh: "前方有侦察机",
  },
  "ui.sector.2.name": {
    en: "Shatter Belt",
    es: "Cinturón Quebrado",
    zh: "碎裂带",
  },
  "ui.sector.2.subtitle": {
    en: "Divers incoming",
    es: "Se acercan los picadores",
    zh: "俯冲机来袭",
  },
  "ui.sector.3.name": {
    en: "Gun Lanes",
    es: "Rutas de Artillería",
    zh: "炮火航道",
  },
  "ui.sector.3.subtitle": {
    en: "Turrets online",
    es: "Torretas activas",
    zh: "炮塔已上线",
  },
  "ui.sector.4.name": {
    en: "Lancer Gate",
    es: "Puerta de los Lanceros",
    zh: "枪骑之门",
  },
  "ui.sector.4.subtitle": {
    en: "Crossfire",
    es: "Fuego cruzado",
    zh: "交叉火力",
  },
  "ui.sector.5.name": {
    en: "Last Approach",
    es: "Aproximación Final",
    zh: "最终进近",
  },
  "ui.sector.5.subtitle": {
    en: "Everything they have",
    es: "Todo lo que tienen",
    zh: "倾巢而出",
  },
  "ui.sector.6.name": { en: "The Warden", es: "El Guardián", zh: "守望者" },
  "ui.banner.warning": { en: "WARNING", es: "ADVERTENCIA", zh: "警告" },
  "ui.banner.wardenApproaches": {
    en: "The Warden approaches",
    es: "Se acerca el Guardián",
    zh: "守望者正在接近",
  },
  "ui.banner.gameOver": {
    en: "GAME OVER",
    es: "FIN DEL JUEGO",
    zh: "游戏结束",
  },
  "ui.banner.lanesClosed": {
    en: "The lanes stay closed",
    es: "Las rutas siguen cerradas",
    zh: "航道依旧封闭",
  },
  "ui.banner.wardenDown": {
    en: "WARDEN DOWN",
    es: "GUARDIÁN DERRIBADO",
    zh: "守望者已击落",
  },
  "ui.banner.lanesOpen": {
    en: "The lanes are open",
    es: "Las rutas están abiertas",
    zh: "航道已开放",
  },
  "ui.banner.lanesKept": {
    en: "LANES KEPT",
    es: "RUTAS PROTEGIDAS",
    zh: "航道守护",
  },
  "ui.banner.requisition": {
    en: "Requisitioning Pilot #{serial}",
    es: "Requisando al piloto #{serial}",
    zh: "正在调拨{serial}号飞行员",
  },

  // -- tutorial prompts (key glyphs come from live bindings)
  "ui.tut.moveLeft": {
    en: "Fly left: {key}",
    es: "Vuela a la izquierda: {key}",
    zh: "向左飞：{key}",
  },
  "ui.tut.moveRight": {
    en: "Fly right: {key}",
    es: "Vuela a la derecha: {key}",
    zh: "向右飞：{key}",
  },
  "ui.tut.moveVertical": {
    en: "Fly up and down: {up} {down}",
    es: "Vuela arriba y abajo: {up} {down}",
    zh: "上下飞行：{up} {down}",
  },
  "ui.tut.focus": {
    en: "Hold {key} to focus",
    es: "Mantén {key} para enfocar",
    zh: "按住 {key} 专注",
  },
  "ui.tut.fire": {
    en: "Hold {key} to fire",
    es: "Mantén {key} para disparar",
    zh: "按住 {key} 射击",
  },
  "ui.tut.target": {
    en: "Destroy the practice target",
    es: "Destruye el blanco de práctica",
    zh: "摧毁练习靶",
  },
  "ui.tut.progress": {
    en: "Onboarding module {current} of {total}",
    es: "Módulo de inducción {current} de {total}",
    zh: "入职培训模块 {current} / {total}",
  },
  "ui.tut.skip": { en: "Skip tutorial", es: "Saltar tutorial", zh: "跳过教程" },
  "ui.tut.skipConfirm1": {
    en: "Skip onboarding?",
    es: "¿Saltar la inducción?",
    zh: "要跳过入职培训吗？",
  },
  "ui.tut.skipConfirm2": {
    en: "Your onboarding assistant will be notified. Skip anyway?",
    es: "Se le avisará a tu asistente de inducción. ¿Saltar de todos modos?",
    zh: "系统会通知你的入职助手。仍然跳过吗？",
  },

  // -- endings: shown, not scolded
  "ui.ending.tally.scoutsLost": {
    en: "Scouts lost: {count}",
    es: "Exploradores perdidos: {count}",
    zh: "损失的侦察机：{count}",
  },
  "ui.ending.tally.pilotsSpent": {
    en: "Pilots spent: {count}",
    es: "Pilotos gastados: {count}",
    zh: "消耗的飞行员：{count}",
  },
  "ui.ending.tally.pilotsKept": {
    en: "Pilots kept: {count}",
    es: "Pilotos conservados: {count}",
    zh: "留下的飞行员：{count}",
  },
  "ui.ending.tally.lanesKill": {
    en: "Lanes: open (subscription required)",
    es: "Rutas: abiertas (requiere suscripción)",
    zh: "航道：已开放（需订阅）",
  },
  "ui.ending.tally.lanesPacifist": {
    en: "Lanes: free",
    es: "Rutas: libres",
    zh: "航道：自由通行",
  },
  "ui.ending.thankYou": {
    en: "THANK YOU FOR PLAYING",
    es: "GRACIAS POR JUGAR",
    zh: "感谢游玩",
  },
  "ui.ending.finalScore": {
    en: "Final score {score}",
    es: "Puntuación final {score}",
    zh: "最终得分 {score}",
  },
  "ui.ending.selfPlay": {
    en: "Self-play: continues {count}",
    es: "Juego automático: continuaciones {count}",
    zh: "自动演示：续关 {count} 次",
  },

  // -- speaker names for subtitles
  "ui.speaker.tutorial_ai": {
    en: "Onboarding Assistant",
    es: "Asistente de inducción",
    zh: "入职助手",
  },
  "ui.speaker.narrator": {
    en: "Lane Authority Briefing",
    es: "Informe de la Autoridad de Rutas",
    zh: "航道管理局简报",
  },
  "ui.speaker.warden": { en: "The Warden", es: "El Guardián", zh: "守望者" },
  "ui.speaker.pilot": {
    en: "Pilot #0122",
    es: "Piloto #0122",
    zh: "0122号飞行员",
  },
  "ui.speaker.recording": {
    en: "{speaker} (recording)",
    es: "{speaker} (grabación)",
    zh: "{speaker}（录音）",
  },

  // -- loading and pause tips: advice that drifts into lore
  "ui.tip.1": {
    en: "Tip: Only the glowing gem at the center of your ship can be hit.",
    es:
      "Consejo: Solo la gema brillante del centro de tu nave puede recibir impactos.",
    zh: "提示：只有飞船中央发光的宝石会被击中。",
  },
  "ui.tip.2": {
    en: "Tip: Hold focus to slow down and thread tight gaps.",
    es:
      "Consejo: Mantén el enfoque para ir más lento y pasar por huecos estrechos.",
    zh: "提示：按住专注键可以减速，穿过狭窄的空隙。",
  },
  "ui.tip.3": {
    en:
      "Tip: Auto-fire, game speed and screen shake are in Settings, Accessibility.",
    es:
      "Consejo: El disparo automático, la velocidad del juego y la vibración están en Ajustes, Accesibilidad.",
    zh: "提示：自动射击、游戏速度和屏幕震动位于“设置 > 无障碍”。",
  },
  "ui.tip.4": {
    en:
      "Tip: Turrets drop most of the pickups. Pickups remain Lane Authority property.",
    es:
      "Consejo: Las torretas sueltan la mayoría de los objetos. Los objetos siguen siendo propiedad de la Autoridad de Rutas.",
    zh: "提示：大部分道具由炮塔掉落。道具仍归航道管理局所有。",
  },
  "ui.tip.5": {
    en: "Tip: Lancers fire across the lane, never along it.",
    es: "Consejo: Los lanceros disparan a través de la ruta, nunca a lo largo.",
    zh: "提示：枪骑机总是横穿航道开火，从不沿着航道。",
  },
  "ui.tip.6": {
    en:
      "Tip: The Warden's scouts do not fire on ships that have not fired. This is not a tip.",
    es:
      "Consejo: Los exploradores del Guardián no disparan a naves que no han disparado. Esto no es un consejo.",
    zh: "提示：守望者的侦察机不会攻击没有开过火的船。这不是提示。",
  },

  // -- settings: reduce motion (contract key accessibility.reduceMotion)
  "ui.settings.reduceMotion": {
    en: "Reduce motion",
    es: "Reducir movimiento",
    zh: "减少动态效果",
  },
  "ui.settings.reduceMotionHint": {
    en: "Calmer camera and menus. Your system setting also counts.",
    es:
      "Cámara y menús más tranquilos. También cuenta el ajuste de tu sistema.",
    zh: "镜头和菜单更平稳。系统的减少动态效果设置同样生效。",
  },

  // -- third-party licenses, one note per src/data/thirdParty.ts entry
  "ui.licenses.note.three": {
    en: "3D rendering.",
    es: "Renderizado 3D.",
    zh: "3D 渲染。",
  },
  "ui.licenses.note.orbitron": {
    en: "Logo lettering, baked into the 3D logos.",
    es: "Tipografía de los logotipos, integrada en los logotipos 3D.",
    zh: "标志字体，已烘焙进 3D 标志。",
  },
  "ui.licenses.note.vite": {
    en: "Build tool; not shipped.",
    es: "Herramienta de compilación; no se incluye en el juego.",
    zh: "构建工具；不随游戏发布。",
  },
  "ui.licenses.note.deno": {
    en: "Runtime for tasks and tests; not shipped.",
    es: "Entorno para tareas y pruebas; no se incluye en el juego.",
    zh: "用于任务与测试的运行时；不随游戏发布。",
  },
  "ui.licenses.note.stableAudio": {
    en:
      "Generated the music and sound effects. Outputs are used under the model license.",
    es:
      "Generó la música y los efectos de sonido. Los resultados se usan conforme a la licencia del modelo.",
    zh: "生成了音乐与音效。生成结果依照该模型的许可证使用。",
  },
  "ui.licenses.note.qwenTts": {
    en: "Rendered every voice line locally.",
    es: "Generó localmente cada línea de voz.",
    zh: "在本地合成了每一句配音。",
  },
  "ui.licenses.note.qwenAsr": {
    en: "Checked rendered voice lines against the script; not shipped.",
    es: "Comparó las voces generadas con el guion; no se incluye en el juego.",
    zh: "将合成的配音与剧本逐句核对；不随游戏发布。",
  },
  "ui.licenses.role.runtime": {
    en: "Runtime",
    es: "Tiempo de ejecución",
    zh: "运行时",
  },
  "ui.licenses.role.toolchain": {
    en: "Toolchain",
    es: "Herramientas",
    zh: "工具链",
  },
  "ui.licenses.role.font": { en: "Font", es: "Tipografía", zh: "字体" },
  "ui.licenses.role.model": {
    en: "Generative model",
    es: "Modelo generativo",
    zh: "生成模型",
  },
  "ui.licenses.license": {
    en: "License: {license}",
    es: "Licencia: {license}",
    zh: "许可证：{license}",
  },

  // -- in-game HUD
  "ui.hud.shield": { en: "Shield", es: "Escudo", zh: "护盾" },
  "ui.hud.sector": { en: "Sector {n}", es: "Sector {n}", zh: "第 {n} 区" },
  "ui.hud.pacifist": {
    en: "Hands clean",
    es: "Manos limpias",
    zh: "未开杀戒",
  },
  "ui.hud.spared": {
    en: "Spared {count}",
    es: "Perdonados: {count}",
    zh: "放过 {count}",
  },
  "ui.hud.wardenShielded": {
    en: "Untouchable",
    es: "Intocable",
    zh: "无法伤害",
  },
  "ui.hud.phase": {
    en: "Phase {n} of 3",
    es: "Fase {n} de 3",
    zh: "第 {n}/3 阶段",
  },
  "ui.hud.livesLeft": {
    en: "{count} left",
    es: "Quedan {count}",
    zh: "剩余 {count}",
  },
  "ui.hud.powerLevel": {
    en: "Level {n} of 3",
    es: "Nivel {n} de 3",
    zh: "{n}/3 级",
  },

  // -- banners
  "ui.banner.sector": {
    en: "SECTOR {n}",
    es: "SECTOR {n}",
    zh: "第 {n} 区",
  },
  "ui.banner.lanesKeptSub": {
    en: "The Warden stands down",
    es: "El Guardián se retira",
    zh: "守望者收起了武器",
  },

  // -- continue screen (after gameOver)
  "ui.continue.prompt": {
    en: "Continue?",
    es: "¿Continuar?",
    zh: "继续吗？",
  },
  "ui.continue.left": {
    en: "Continues left: {count}",
    es: "Continuaciones restantes: {count}",
    zh: "剩余续关次数：{count}",
  },
  "ui.continue.yes": { en: "Continue", es: "Continuar", zh: "继续" },
  "ui.continue.no": {
    en: "Return to title",
    es: "Volver al título",
    zh: "返回标题画面",
  },
  "ui.continue.none": {
    en: "No continues left. The Lane Authority thanks you for your service.",
    es: "No quedan continuaciones. La Autoridad de Rutas agradece tu servicio.",
    zh: "已没有续关次数。航道管理局感谢你的服务。",
  },
  "ui.continue.score": {
    en: "Score {score}",
    es: "Puntos: {score}",
    zh: "得分 {score}",
  },

  // -- tutorial skip (at most three inputs from anywhere in the tutorial)
  "ui.tut.skipPrompt": {
    en: "Skip onboarding",
    es: "Saltar la inducción",
    zh: "跳过入职培训",
  },
  "ui.tut.skipNote": {
    en: "The Lane Authority will note this.",
    es: "La Autoridad de Rutas tomará nota.",
    zh: "航道管理局会记录此事。",
  },
  "ui.tut.skipNo": {
    en: "Keep training",
    es: "Seguir entrenando",
    zh: "继续培训",
  },

  // -- end credits crawl: departments
  "ui.crawl.skip": {
    en: "Skip credits",
    es: "Saltar créditos",
    zh: "跳过制作人员名单",
  },
  "ui.crawl.presents": {
    en: "{studio} presents",
    es: "{studio} presenta",
    zh: "{studio} 出品",
  },
  "ui.crawl.incubated": {
    en: "Incubated by CM121, cohort f26",
    es: "Incubado por CM121, generación f26",
    zh: "由 CM121 孵化，f26 届",
  },
  "ui.crawl.agent": {
    en: "{model}, agent",
    es: "{model}, agente",
    zh: "{model}（智能体）",
  },
  "ui.crawl.agentNote": {
    en:
      "Agent credits name a role, not a person. Agents drafted the work; a human directed it, reviewed it and chose what shipped.",
    es:
      "Los créditos de agentes nombran un rol, no una persona. Los agentes redactaron el trabajo; una persona lo dirigió, lo revisó y eligió qué se publicaba.",
    zh:
      "智能体署名代表的是职能，而不是某个人。智能体负责起草，由一位人类进行指导、审阅，并决定最终发布的内容。",
  },
  "ui.crawl.dept.leadership": {
    en: "Studio Leadership",
    es: "Dirección del estudio",
    zh: "工作室管理层",
  },
  "ui.crawl.dept.design": {
    en: "Game Design",
    es: "Diseño de juego",
    zh: "游戏设计",
  },
  "ui.crawl.dept.narrative": {
    en: "Narrative",
    es: "Narrativa",
    zh: "叙事",
  },
  "ui.crawl.dept.engineering": {
    en: "Engineering",
    es: "Ingeniería",
    zh: "工程",
  },
  "ui.crawl.dept.art": { en: "Art", es: "Arte", zh: "美术" },
  "ui.crawl.dept.audio": { en: "Audio", es: "Audio", zh: "音频" },
  "ui.crawl.dept.voice": {
    en: "Voice Cast",
    es: "Reparto de voces",
    zh: "配音演员",
  },
  "ui.crawl.dept.localization": {
    en: "Localization",
    es: "Localización",
    zh: "本地化",
  },
  "ui.crawl.dept.qa": {
    en: "Quality Assurance",
    es: "Control de calidad",
    zh: "质量保证",
  },
  "ui.crawl.dept.accessibility": {
    en: "Accessibility",
    es: "Accesibilidad",
    zh: "无障碍",
  },
  "ui.crawl.dept.production": {
    en: "Production",
    es: "Producción",
    zh: "制作管理",
  },
  "ui.crawl.dept.publishing": {
    en: "Publishing",
    es: "Publicación",
    zh: "发行",
  },
  "ui.crawl.dept.tools": {
    en: "Tools and Models",
    es: "Herramientas y modelos",
    zh: "工具与模型",
  },
  "ui.crawl.dept.licenses": {
    en: "Third-Party Licenses",
    es: "Licencias de terceros",
    zh: "第三方许可证",
  },
  "ui.crawl.dept.thanks": {
    en: "Special Thanks",
    es: "Agradecimientos especiales",
    zh: "特别鸣谢",
  },
  "ui.crawl.dept.memoriam": {
    en: "In Memoriam",
    es: "In memoriam",
    zh: "谨此纪念",
  },

  // -- end credits crawl: roles
  "ui.crawl.role.execProducer": {
    en: "Executive Producer",
    es: "Productor ejecutivo",
    zh: "执行制作人",
  },
  "ui.crawl.role.creativeDirector": {
    en: "Creative Director",
    es: "Director creativo",
    zh: "创意总监",
  },
  "ui.crawl.role.gameDirector": {
    en: "Game Director",
    es: "Director del juego",
    zh: "游戏总监",
  },
  "ui.crawl.role.systemsDesign": {
    en: "Systems Design (simulation port)",
    es: "Diseño de sistemas (adaptación de la simulación)",
    zh: "系统设计（模拟移植）",
  },
  "ui.crawl.role.originalDesign": {
    en: "Original Game Design (Neon Warden, CMPM 121 E4 starter)",
    es:
      "Diseño del juego original (Neon Warden, proyecto inicial E4 de CMPM 121)",
    zh: "原版游戏设计（《霓虹守望者》，CMPM 121 E4 入门项目）",
  },
  "ui.crawl.role.narrativeDesign": {
    en: "Narrative Design and Script",
    es: "Diseño narrativo y guion",
    zh: "叙事设计与剧本",
  },
  "ui.crawl.role.storyDirection": {
    en: "Story Direction",
    es: "Dirección de la historia",
    zh: "剧情指导",
  },
  "ui.crawl.role.simEngineering": {
    en: "Simulation Engineering",
    es: "Ingeniería de simulación",
    zh: "模拟工程",
  },
  "ui.crawl.role.renderEngineering": {
    en: "Rendering Engineering",
    es: "Ingeniería de renderizado",
    zh: "渲染工程",
  },
  "ui.crawl.role.uiEngineering": {
    en: "Front End and UI Engineering",
    es: "Ingeniería de interfaz",
    zh: "前端与界面工程",
  },
  "ui.crawl.role.audioEngineering": {
    en: "Audio Engine and Scene Director",
    es: "Motor de audio y director de escenas",
    zh: "音频引擎与场景调度",
  },
  "ui.crawl.role.integration": {
    en: "Integration and Build",
    es: "Integración y compilación",
    zh: "集成与构建",
  },
  "ui.crawl.role.modeling": {
    en: "3D Modeling (scripted Blender)",
    es: "Modelado 3D (Blender por script)",
    zh: "3D 建模（脚本驱动 Blender）",
  },
  "ui.crawl.role.artDirection": {
    en: "Art Direction and Review",
    es: "Dirección y revisión de arte",
    zh: "美术指导与审阅",
  },
  "ui.crawl.role.music": { en: "Music", es: "Música", zh: "音乐" },
  "ui.crawl.role.sfx": {
    en: "UI Sound Design",
    es: "Diseño de sonido de interfaz",
    zh: "界面音效设计",
  },
  "ui.crawl.role.curation": {
    en: "Auditions and Picks",
    es: "Audiciones y selección",
    zh: "试听与选定",
  },
  "ui.crawl.role.voiceRendering": {
    en: "Voices, designed and rendered locally",
    es: "Voces, diseñadas y generadas localmente",
    zh: "配音，本地设计与合成",
  },
  "ui.crawl.role.languages": {
    en:
      "Spanish (Latin America) and Simplified Chinese, agent drafts; native review pending",
    es:
      "Español (Latinoamérica) y chino simplificado, borradores de agentes; revisión nativa pendiente",
    zh: "拉美西班牙语与简体中文，由智能体起草；母语审校待进行",
  },
  "ui.crawl.role.qaTooling": {
    en: "QA Tooling and Reels",
    es: "Herramientas de control de calidad y videos",
    zh: "质量保证工具与录像",
  },
  "ui.crawl.role.playtest": {
    en: "Integration Playtest",
    es: "Prueba de juego de integración",
    zh: "集成试玩",
  },
  "ui.crawl.role.accessibility": {
    en: "Accessibility Options and Review",
    es: "Opciones y revisión de accesibilidad",
    zh: "无障碍选项与审阅",
  },
  "ui.crawl.role.orchestration": {
    en: "Orchestration of Workstreams",
    es: "Coordinación de líneas de trabajo",
    zh: "工作流统筹",
  },
  "ui.crawl.role.research": {
    en: "Research (tropes, teardowns, checklists)",
    es: "Investigación (tropos, análisis, listas de control)",
    zh: "调研（叙事套路、拆解分析、检查清单）",
  },
  "ui.crawl.role.incubator": {
    en: "Incubator",
    es: "Incubadora",
    zh: "孵化器",
  },
  "ui.crawl.role.catering": {
    en: "Catering",
    es: "Catering",
    zh: "餐饮",
  },
  "ui.crawl.role.software": {
    en: "Software",
    es: "Software",
    zh: "软件",
  },
  "ui.crawl.role.models": {
    en: "Models",
    es: "Modelos",
    zh: "模型",
  },
  "ui.crawl.role.students": {
    en: "Every CMPM 121 student who will read this source",
    es: "Cada estudiante de CMPM 121 que leerá este código",
    zh: "每一位将阅读这份源码的 CMPM 121 学生",
  },
  "ui.crawl.role.lastLine": {
    en: "No Warden was harmed in a pacifist run.",
    es: "Ningún Guardián sufrió daños en una partida pacifista.",
    zh: "在和平通关中，没有任何守望者受到伤害。",
  },
} as const satisfies Record<string, LocalizedText>;

/** The MIT license text, verbatim; hoisted so the table stays readable. */
function MIT_TEXT(): string {
  return 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';
}
