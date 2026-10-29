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
  "ui.settings.offline": {
    en: "Offline downloads",
    es: "Descargas sin conexión",
    zh: "离线下载",
  },
  // -- common controls
  "ui.common.back": { en: "Back", es: "Volver", zh: "返回" },
  // -- touch and mobile (src/ui/touchDeck.ts, research/2026-10-28-mobile-touch)
  "ui.touch.pause": { en: "Pause", es: "Pausa", zh: "暂停" },
  "ui.touch.fire": { en: "FIRE", es: "DISPARAR", zh: "开火" },
  "ui.touch.focus": { en: "FOCUS", es: "PRECISIÓN", zh: "精准" },
  "ui.touch.drag": {
    en: "Drag anywhere to fly",
    es: "Arrastra en cualquier parte para volar",
    zh: "在任意位置拖动即可飞行",
  },
  "ui.touch.latched": { en: "STREAM ON", es: "RÁFAGA ACTIVA", zh: "连射中" },
  "ui.settings.preset.school": { en: "School", es: "Escolar", zh: "校园" },
  "ui.settings.autoFullscreen": {
    en: "Auto fullscreen on mobile",
    es: "Pantalla completa automática en móvil",
    zh: "移动设备自动全屏",
  },
  "ui.settings.desc.autoFullscreen": {
    en:
      "On a phone or tablet, the first tap in a menu fills the screen. Never during play, and never in the installed app. Leaving fullscreen with the toggle above stops it until you reload.",
    es:
      "En un teléfono o tableta, el primer toque en un menú ocupa toda la pantalla. Nunca durante el juego, y nunca en la app instalada. Salir de pantalla completa con la opción de arriba lo detiene hasta que recargues.",
    zh:
      "在手机或平板上，在菜单中第一次点击即会全屏。游戏进行中不会触发，已安装的应用中也不会。用上方的开关退出全屏后，在重新加载前不会再自动全屏。",
  },
  "ui.fullscreen.iosHint": {
    en:
      "This browser cannot go fullscreen. On iPhone, tap Share, then Add to Home Screen, and open the game from there: it runs without browser bars.",
    es:
      "Este navegador no puede usar pantalla completa. En iPhone, toca Compartir y luego Agregar a inicio, y abre el juego desde ahí: se ejecuta sin las barras del navegador.",
    zh:
      "此浏览器无法全屏。在 iPhone 上，请点按“分享”，再选“添加到主屏幕”，然后从主屏幕打开游戏：这样就没有浏览器栏了。",
  },
  "ui.fullscreen.denied": {
    en: "The browser declined fullscreen. You can try again from Settings.",
    es:
      "El navegador rechazó la pantalla completa. Puedes intentarlo de nuevo desde Ajustes.",
    zh: "浏览器拒绝了全屏。可在“设置”中重试。",
  },
  "ui.settings.redetect": {
    en: "Detect graphics again",
    es: "Detectar gráficos de nuevo",
    zh: "重新检测画质",
  },
  "ui.settings.redetectHint": {
    en: "Takes two seconds",
    es: "Tarda dos segundos",
    zh: "需要两秒",
  },
  "ui.settings.desc.redetect": {
    en:
      "Times this device for two seconds and picks a preset. Picking a preset yourself turns detection off.",
    es:
      "Mide este dispositivo durante dos segundos y elige un ajuste. Si eliges uno tú, la detección se apaga.",
    zh: "用两秒测量本设备并选择画质预设。你自己选择预设后，自动检测会关闭。",
  },
  "ui.settings.tierChosen": {
    en:
      "Graphics set to {preset} for this device. Change it any time in Settings.",
    es:
      "Gráficos en {preset} para este dispositivo. Cámbialo cuando quieras en Ajustes.",
    zh: "已为本设备设为{preset}画质。可随时在设置中更改。",
  },
  "ui.settings.touchScheme": {
    en: "Touch controls",
    es: "Controles táctiles",
    zh: "触屏操作",
  },
  "ui.settings.touch.thumbs": { en: "Thumbs", es: "Pulgares", zh: "双拇指" },
  "ui.settings.touch.oneFinger": {
    en: "One finger",
    es: "Un dedo",
    zh: "单指",
  },
  "ui.settings.touch.arcade": { en: "Arcade", es: "Arcade", zh: "街机" },
  "ui.settings.desc.touchScheme": {
    en:
      "Thumbs: drag to fly, FIRE to tap, hold or release a Writ. One finger: never two touches; tap FIRE for one shot, long-press it to keep firing, tap again to stop. Arcade: your flying finger fires; lift it to rest and charge.",
    es:
      "Pulgares: arrastra para volar, DISPARAR para tocar, mantener o soltar un Writ. Un dedo: nunca dos toques; toca DISPARAR para un tiro, mantenlo para seguir disparando y toca otra vez para parar. Arcade: el dedo que vuela dispara; levántalo para descansar y cargar.",
    zh:
      "双拇指：拖动飞行，开火键可点按、按住或释放令状。单指：从不需要两指同时操作；点开火键射一发，长按持续射击，再点一次停止。街机：飞行的手指即开火，抬起即休息蓄力。",
  },
  "ui.settings.touchSensitivity": {
    en: "Touch sensitivity",
    es: "Sensibilidad táctil",
    zh: "触屏灵敏度",
  },
  "ui.settings.desc.touchSensitivity": {
    en:
      "How far the ship moves for each finger movement. Slow drags are always finer than fast ones.",
    es:
      "Cuánto se mueve la nave con cada movimiento del dedo. Arrastrar despacio siempre es más preciso.",
    zh: "手指每移动一段距离飞船移动多远。慢速拖动总比快速拖动更精细。",
  },
  "ui.settings.fireSide": {
    en: "FIRE button side",
    es: "Lado del botón DISPARAR",
    zh: "开火键位置",
  },
  "ui.settings.side.left": { en: "Left", es: "Izquierda", zh: "左侧" },
  "ui.settings.side.right": { en: "Right", es: "Derecha", zh: "右侧" },
  "ui.settings.desc.fireSide": {
    en: "Puts FIRE under the left or the right thumb.",
    es: "Pone DISPARAR bajo el pulgar izquierdo o el derecho.",
    zh: "把开火键放在左手或右手拇指下。",
  },
  "ui.settings.aimAssist": {
    en: "Writ aim assist",
    es: "Asistencia de puntería del Writ",
    zh: "令状瞄准辅助",
  },
  "ui.settings.aimAssist.touch": {
    en: "Touch only",
    es: "Solo táctil",
    zh: "仅触屏",
  },
  "ui.settings.desc.aimAssist": {
    en:
      "A locked Writ picks the weapon part or weak point you are closest to from further away. Choosing to disarm or to kill stays yours. Applies from the next run.",
    es:
      "Un Writ fijado elige la pieza de arma o el punto débil más cercano desde más lejos. Desarmar o matar sigue siendo tu decisión. Se aplica desde la siguiente partida.",
    zh:
      "锁定的令状能从更远处选中离你最近的武器部件或弱点。缴械还是击杀仍由你决定。从下一局开始生效。",
  },

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
  "ui.controls.langCycle": {
    en:
      "Cycle language (in play): {prevKey} and {nextKey}, or {prevPad} and {nextPad}",
    es:
      "Cambiar idioma (en juego): {prevKey} y {nextKey}, o {prevPad} y {nextPad}",
    zh: "切换语言（游戏中）：{prevKey} 和 {nextKey}，或 {prevPad} 和 {nextPad}",
  },
  "ui.controls.langCycleNote": {
    en:
      "Steps English, Español, 中文 for voice and text together. The line playing finishes first; menus keep the shoulders for tabs.",
    es:
      "Recorre English, Español, 中文 para voz y texto a la vez. La frase en curso termina primero; en los menús los gatillos superiores cambian de pestaña.",
    zh:
      "依次切换 English、Español、中文，语音和文字同时改变。正在播放的台词会先说完；菜单中肩键仍用于切换标签。",
  },
  "ui.langCycle.nextLine": {
    en: "Voice and text, from the next line",
    es: "Voz y texto, desde la próxima frase",
    zh: "语音和文字，从下一句开始",
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
      "Generated the music and the interface sound effects. Outputs are used under the model license.",
    es:
      "Generó la música y los efectos de sonido de la interfaz. Los resultados se usan conforme a la licencia del modelo.",
    zh: "生成了音乐与界面音效。生成结果依照该模型的许可证使用。",
  },
  "ui.licenses.note.elevenLabs": {
    en:
      "Generated the gameplay impact and weapon sounds in the cloud (paid). Outputs are used under its paid terms; they cannot be regenerated.",
    es:
      "Generó en la nube (de pago) los sonidos de impactos y armas del juego. Los resultados se usan conforme a sus condiciones de pago; no se pueden regenerar.",
    zh:
      "在云端（付费）生成了游戏中的撞击与武器音效。生成结果依照其付费条款使用，无法重新生成。",
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
  "ui.crawl.role.agentSkills": {
    en: "Agent Skill Compression",
    es: "Compresión de habilidades de agentes",
    zh: "智能体技能精简",
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

  // -- wave 3: settings descriptions (one per row, shown in the side panel)
  "ui.settings.monoAudio": {
    en: "Mono audio",
    es: "Audio mono",
    zh: "单声道音频",
  },
  "ui.settings.desc.preset": {
    en:
      "A bundle of graphics options. Lower presets trade bloom, particles and shadow detail for a steadier frame rate. Changing any single option switches this to Custom.",
    es:
      "Un conjunto de opciones gráficas. Los preajustes bajos cambian resplandor, partículas y sombras por una tasa de cuadros más estable. Cambiar cualquier opción lo pasa a Personalizado.",
    zh:
      "一组图形选项。较低的预设以泛光、粒子和阴影细节换取更稳定的帧率。单独修改任一选项后会切换为“自定义”。",
  },
  "ui.settings.desc.renderScale": {
    en:
      "How many pixels the 3D scene draws, relative to your screen. Above 100% sharpens edges at a cost; below 100% helps slower machines. Menus and text always draw at full resolution.",
    es:
      "Cuántos píxeles dibuja la escena 3D respecto a tu pantalla. Más de 100% afila los bordes con un costo; menos de 100% ayuda a equipos lentos. Menús y texto siempre se dibujan a resolución completa.",
    zh:
      "3D 场景相对于屏幕绘制的像素数量。高于 100% 边缘更锐利但更耗性能；低于 100% 有助于较慢的设备。菜单和文字始终以完整分辨率绘制。",
  },
  "ui.settings.desc.fullscreen": {
    en:
      "Fills the screen and hides the browser. Your browser may ask for permission; pressing Esc twice also leaves fullscreen.",
    es:
      "Ocupa toda la pantalla y oculta el navegador. Tu navegador puede pedir permiso; presionar Esc dos veces también sale de pantalla completa.",
    zh:
      "填满屏幕并隐藏浏览器界面。浏览器可能会请求许可；连按两次 Esc 也可退出全屏。",
  },
  "ui.settings.desc.master": {
    en:
      "Scales every sound in the game at once. The other sliders set each part of the mix relative to this one.",
    es:
      "Escala todos los sonidos del juego a la vez. Los demás controles ajustan cada parte de la mezcla en relación con este.",
    zh:
      "同时调整游戏中所有声音的音量。其他滑块在此基础上分别设定混音中的各部分。",
  },
  "ui.settings.desc.music": {
    en:
      "The score: logos, tutorial, sectors, flashback, the Warden and the ending each have their own cue.",
    es:
      "La banda sonora: logos, tutorial, sectores, recuerdo, el Guardián y el final tienen cada uno su propia pieza.",
    zh: "配乐：标志、教程、各区、闪回、守望者和结局各有专属曲目。",
  },
  "ui.settings.desc.sfx": {
    en:
      "Ship, weapons, impacts, grazes and enemy fire. Musical hits snap to the beat; enemy fire deliberately does not.",
    es:
      "Nave, armas, impactos, roces y fuego enemigo. Los golpes musicales siguen el ritmo; el fuego enemigo, a propósito, no.",
    zh:
      "飞船、武器、命中、擦弹和敌方火力。音乐化的音效会对齐节拍；敌方火力刻意不对齐。",
  },
  "ui.settings.desc.voice": {
    en:
      "Dialogue, radio chatter and the Warden. Music and effects duck automatically under speech so lines stay clear.",
    es:
      "Diálogo, charla de radio y el Guardián. La música y los efectos bajan solos bajo la voz para que se entienda.",
    zh:
      "对白、无线电通话和守望者的声音。说话时音乐和音效会自动压低，保证台词清晰。",
  },
  "ui.settings.desc.uiVolume": {
    en:
      "Menu ticks, confirms and tab switches. Turn it down if you navigate menus quickly and the clicks pile up.",
    es:
      "Clics de menú, confirmaciones y cambios de pestaña. Bájalo si navegas rápido y los clics se amontonan.",
    zh:
      "菜单的滴答、确认和切换标签页的声音。如果你操作很快、提示音叠在一起，可以调低。",
  },
  "ui.settings.desc.monoAudio": {
    en:
      "Folds the mix into one channel, so no sound depends on which ear hears it. Radio chatter and enemy fire keep their side indicators on screen.",
    es:
      "Junta la mezcla en un solo canal, para que ningún sonido dependa de qué oído lo escucha. La radio y el fuego enemigo conservan sus indicadores de lado en pantalla.",
    zh:
      "将混音合并为单声道，任何声音都不再依赖于哪只耳朵听到。无线电通话和敌方火力仍会在屏幕上显示方位提示。",
  },
  "ui.settings.desc.textLang": {
    en:
      "Menus, subtitles, radio text and the HUD. Menus and HUD change at once; a subtitle already showing finishes in its language. In play, [ and ] (or LB and RB) cycle voice and text together.",
    es:
      "Menús, subtítulos, texto de radio y HUD. Menús y HUD cambian al instante; un subtítulo en pantalla termina en su idioma. En juego, [ y ] (o LB y RB) cambian voz y texto a la vez.",
    zh:
      "菜单、字幕、无线电文字和 HUD。菜单和 HUD 立即切换；正在显示的字幕以原语言显示完。游戏中按 [ 和 ]（或 LB 和 RB）可同时切换语音和文字。",
  },
  "ui.settings.desc.voiceLang": {
    en:
      "The spoken language. It can differ from the text language: watch in one, read in another. In play, [ and ] (or LB and RB) set both to the next language, from the next line.",
    es:
      "El idioma hablado. Puede ser distinto del idioma del texto: escucha en uno y lee en otro. En juego, [ y ] (o LB y RB) ponen ambos en el siguiente idioma, desde la próxima frase.",
    zh:
      "语音所用的语言。可以与文字语言不同：听一种，读另一种。游戏中按 [ 和 ]（或 LB 和 RB）会把两者都切换到下一种语言，从下一句开始。",
  },
  "ui.settings.desc.subtitles": {
    en:
      "Captions for every spoken line, shown before the first word is heard. Radio chatter has its own text channel and follows this setting too.",
    es:
      "Subtítulos para cada línea hablada, visibles antes de la primera palabra. La radio tiene su propio canal de texto y también sigue este ajuste.",
    zh:
      "为每句台词显示字幕，并在第一个字出口之前出现。无线电通话有独立的文字频道，同样遵循此设置。",
  },
  "ui.settings.desc.subtitleScale": {
    en:
      "Caption size, from 100% to 200%. The HUD grows at half this rate, so large text never covers the play area.",
    es:
      "Tamaño de los subtítulos, de 100% a 200%. El HUD crece a la mitad de ese ritmo, para que el texto grande nunca tape la zona de juego.",
    zh:
      "字幕大小，100% 至 200%。HUD 以一半的幅度随之放大，大字号也不会遮挡游戏区域。",
  },
  "ui.settings.desc.subtitleBg": {
    en:
      "How solid the box behind captions is. Higher values keep text readable over bright explosions.",
    es:
      "Qué tan sólido es el fondo de los subtítulos. Valores altos mantienen el texto legible sobre explosiones brillantes.",
    zh: "字幕背景框的不透明度。数值越高，在明亮爆炸前也越易阅读。",
  },
  "ui.settings.desc.speakerNames": {
    en: "Shows who is talking above each caption, in that character's color.",
    es:
      "Muestra quién habla sobre cada subtítulo, con el color de ese personaje.",
    zh: "在每条字幕上方以角色专属颜色显示说话者。",
  },
  "ui.settings.desc.maxLines": {
    en:
      "At most this many caption lines at once. Longer lines are split into timed pieces rather than shrunk.",
    es:
      "Como máximo, estas líneas de subtítulo a la vez. Las frases largas se dividen en partes con tiempo en lugar de achicarse.",
    zh:
      "同时最多显示的字幕行数。较长的台词会被拆分为按时显示的片段，而不是缩小字号。",
  },
  "ui.settings.desc.autoFire": {
    en:
      "Your ship fires continuously without holding a button. The Writ still charges whenever you stop firing, so turn this off to use rest-to-charge.",
    es:
      "Tu nave dispara sin mantener ningún botón. El Writ se carga cuando dejas de disparar, así que desactívalo para usar la carga en reposo.",
    zh:
      "飞船无需按住按键即可持续射击。只有停火时“令状”才会充能，因此若想使用静止充能，请关闭此项。",
  },
  "ui.settings.desc.holdToggle": {
    en:
      "Hold: fire and focus last while the button is down. Toggle: press once to start, again to stop. Toggle helps if holding a button is tiring or painful.",
    es:
      "Mantener: disparo y enfoque duran mientras presionas. Alternar: presiona una vez para empezar y otra para parar. Alternar ayuda si mantener un botón cansa o duele.",
    zh:
      "按住：按键按下期间持续射击和专注。切换：按一次开始，再按一次停止。若长时间按住按键让你疲劳或疼痛，请选择切换。",
  },
  "ui.settings.desc.shake": {
    en:
      "Camera and cabinet shake on hits and explosions. Zero turns it off completely without hiding any information.",
    es:
      "Sacudida de cámara y cabina con impactos y explosiones. En cero se apaga por completo sin ocultar información.",
    zh: "受击和爆炸时的镜头与机舱震动。设为零会完全关闭，不会隐藏任何信息。",
  },
  "ui.settings.desc.reducedFlashing": {
    en:
      "Replaces full-screen flashes and strobing with gentle fades, and caps bright bursts. Recommended for photosensitive players.",
    es:
      "Sustituye destellos de pantalla completa y estroboscopios por fundidos suaves y limita los brillos intensos. Recomendado para personas fotosensibles.",
    zh: "用柔和的渐变代替全屏闪光和频闪，并限制强光爆发。推荐光敏感玩家开启。",
  },
  "ui.settings.desc.reduceMotion": {
    en:
      "Calms camera drift, parallax and menu slides; subtitles mark the spoken word with color instead of movement. Your system setting also turns this on.",
    es:
      "Calma la deriva de cámara, el paralaje y los deslizamientos del menú; los subtítulos marcan la palabra hablada con color en lugar de movimiento. El ajuste de tu sistema también lo activa.",
    zh:
      "减弱镜头漂移、视差和菜单滑动；字幕改用颜色而非动效标示正在说的词。系统设置中开启也会生效。",
  },
  "ui.settings.desc.gameSpeed": {
    en:
      "Slows the whole game, enemies and bullets included, down to 50%. Music and voice keep their pitch.",
    es:
      "Ralentiza todo el juego, enemigos y balas incluidos, hasta un 50%. La música y las voces conservan su tono.",
    zh:
      "将整个游戏（包括敌人和子弹）减速，最低至 50%。音乐和语音保持原有音高。",
  },
  "ui.settings.desc.difficulty": {
    en:
      "Story gives more hull and slower bullets; Hard tightens patterns. Pay, endings and the pacifist run are available on every difficulty.",
    es:
      "Historia da más casco y balas más lentas; Difícil ajusta los patrones. La paga, los finales y la ruta pacifista están en todas las dificultades.",
    zh:
      "“故事”提供更多船体耐久和更慢的子弹；“困难”让弹幕更密集。报酬、结局与和平路线在所有难度下均可达成。",
  },
  "ui.settings.desc.colorCues": {
    en:
      "Pairs every color-coded signal with a shape or pattern: hostile bullets get outlines, scan locks get brackets, weak points get a cross.",
    es:
      "Acompaña cada señal de color con una forma o patrón: las balas hostiles llevan contorno, los fijados de escaneo llevan corchetes, los puntos débiles una cruz.",
    zh:
      "为每个以颜色区分的信号配上形状或图案：敌方子弹加轮廓，扫描锁定加括号，弱点加十字。",
  },
  "ui.settings.desc.resetControls": {
    en: "Restores every key and button binding to the defaults. Asks first.",
    es:
      "Restaura todas las asignaciones de teclas y botones a los valores predeterminados. Pregunta antes.",
    zh: "将所有按键和手柄绑定恢复为默认值。执行前会确认。",
  },
  "ui.settings.desc.resetAll": {
    en:
      "Restores every setting on every tab, including controls. Asks first; your loadout and progress are kept.",
    es:
      "Restaura todos los ajustes de todas las pestañas, incluidos los controles. Pregunta antes; tu equipamiento y tu progreso se conservan.",
    zh:
      "恢复所有标签页的全部设置，包括操作。执行前会确认；你的配装和进度会保留。",
  },
  "ui.settings.tabDesc.display": {
    en:
      "Resolution, quality and fullscreen. Changes apply live behind this menu.",
    es:
      "Resolución, calidad y pantalla completa. Los cambios se aplican en vivo detrás de este menú.",
    zh: "分辨率、画质和全屏。更改会在此菜单后方实时生效。",
  },
  "ui.settings.tabDesc.audio": {
    en:
      "The mix, bus by bus, plus mono output. Adjust while the music plays to hear the result.",
    es:
      "La mezcla, canal por canal, más la salida mono. Ajusta mientras suena la música para oír el resultado.",
    zh: "逐路调节混音，以及单声道输出。可在音乐播放时调整，直接听到效果。",
  },
  "ui.settings.tabDesc.language": {
    en: "Text and voice languages are separate choices.",
    es: "Los idiomas de texto y de voz se eligen por separado.",
    zh: "文字语言和语音语言可分别选择。",
  },
  "ui.settings.tabDesc.subtitles": {
    en:
      "Everything about captions, with a live preview of exactly what plays in game.",
    es:
      "Todo sobre los subtítulos, con una vista previa en vivo de lo que verás en el juego.",
    zh: "字幕的全部设置，并附有与游戏内完全一致的实时预览。",
  },
  "ui.settings.tabDesc.accessibility": {
    en:
      "Input, motion, flashing, speed and color options. None of them lock out any content or ending.",
    es:
      "Opciones de control, movimiento, destellos, velocidad y color. Ninguna bloquea contenido ni finales.",
    zh: "输入、动效、闪光、速度和颜色选项。任何选项都不会锁定内容或结局。",
  },
  "ui.settings.tabDesc.controls": {
    en:
      "Two keys and one button per action. Conflicts are resolved by swapping, and you will be told what moved.",
    es:
      "Dos teclas y un botón por acción. Los conflictos se resuelven intercambiando, y se te avisa qué cambió.",
    zh:
      "每个动作可绑定两个按键和一个手柄按钮。冲突时会自动交换，并告诉你哪些发生了变化。",
  },
  "ui.controls.desc.moveUp": {
    en: "Moves the ship up the lane. The ship never leaves the play area.",
    es: "Mueve la nave hacia arriba. La nave nunca sale de la zona de juego.",
    zh: "让飞船在航道中向上移动。飞船不会离开游戏区域。",
  },
  "ui.controls.desc.moveDown": {
    en: "Moves the ship down the lane.",
    es: "Mueve la nave hacia abajo.",
    zh: "让飞船在航道中向下移动。",
  },
  "ui.controls.desc.moveLeft": {
    en: "Moves the ship left. Also adjusts the focused setting in menus.",
    es:
      "Mueve la nave a la izquierda. En los menús también ajusta el valor enfocado.",
    zh: "让飞船向左移动。在菜单中也用于调整当前选项。",
  },
  "ui.controls.desc.moveRight": {
    en: "Moves the ship right. Also adjusts the focused setting in menus.",
    es:
      "Mueve la nave a la derecha. En los menús también ajusta el valor enfocado.",
    zh: "让飞船向右移动。在菜单中也用于调整当前选项。",
  },
  "ui.controls.desc.fire": {
    en:
      "Tap for one aimed round, hold to stream. Let go to rest: the scan beam sweeps ahead and the Writ charges, then fire to release it.",
    es:
      "Toca para un disparo preciso, mantén para ráfaga. Suelta para reposar: el haz de escaneo barre al frente y el Writ se carga; dispara para liberarlo.",
    zh:
      "轻按射出一发精确子弹，按住持续射击。松开即静止：扫描光束向前扫描，“令状”开始充能，再次射击即可释放。",
  },
  "ui.controls.desc.focus": {
    en:
      "Slows the ship for precise dodging and narrows the scan cone so locks land faster.",
    es:
      "Ralentiza la nave para esquivar con precisión y estrecha el cono de escaneo para fijar más rápido.",
    zh: "降低飞船速度以精确闪避，并收窄扫描锥，使锁定更快。",
  },
  "ui.controls.desc.pause": {
    en:
      "Opens the pause menu. The game also pauses itself when the window loses focus.",
    es:
      "Abre el menú de pausa. El juego también se pausa solo si la ventana pierde el foco.",
    zh: "打开暂停菜单。窗口失去焦点时游戏也会自动暂停。",
  },
  "ui.controls.desc.confirm": {
    en: "Selects in menus and advances dialogue.",
    es: "Selecciona en los menús y avanza el diálogo.",
    zh: "在菜单中选择，并推进对话。",
  },
  "ui.controls.desc.back": {
    en:
      "Returns to the previous screen. Held during the tutorial, offers to skip it.",
    es:
      "Vuelve a la pantalla anterior. Mantenido durante el tutorial, ofrece saltarlo.",
    zh: "返回上一界面。在教程中按住可选择跳过教程。",
  },

  // -- wave 3: HUD instruments, intel and radio
  "ui.hud.pay": { en: "Pay", es: "Paga", zh: "报酬" },
  "ui.hud.payMult": { en: "×{mult}", es: "×{mult}", zh: "×{mult}" },
  "ui.hud.writ": { en: "Writ", es: "Writ", zh: "令状" },
  "ui.hud.writLevel": {
    en: "Writ charge level {n} of 3",
    es: "Carga del Writ: nivel {n} de 3",
    zh: "令状充能：第 {n} 级（共 3 级）",
  },
  "ui.hud.graze": { en: "Graze", es: "Roce", zh: "擦弹" },
  "ui.hud.scanning": { en: "Scanning", es: "Escaneando", zh: "扫描中" },
  "ui.hud.scanLocked": { en: "Lock", es: "Fijado", zh: "已锁定" },
  "ui.hud.scanLockedState": {
    en: "Lock: {state}",
    es: "Fijado: {state}",
    zh: "已锁定：{state}",
  },
  "ui.intel.weakPoint": { en: "Weak point", es: "Punto débil", zh: "弱点" },
  "ui.intel.disarmed": { en: "Disarmed", es: "Desarmado", zh: "已缴械" },
  "ui.intel.state.patrol": { en: "Patrol", es: "Patrulla", zh: "巡逻" },
  "ui.intel.state.aim": { en: "Aiming", es: "Apuntando", zh: "瞄准" },
  "ui.intel.state.fire": { en: "Firing", es: "Disparando", zh: "开火" },
  "ui.intel.state.evade": { en: "Evading", es: "Evadiendo", zh: "闪避" },
  "ui.intel.state.retreat": { en: "Retreating", es: "Retirada", zh: "撤退" },
  "ui.intel.state.enter": { en: "Arriving", es: "Llegando", zh: "进场" },
  "ui.intel.state.dive": { en: "Diving", es: "En picada", zh: "俯冲" },
  "ui.intel.state.strafe": { en: "Strafing", es: "Ametrallando", zh: "扫射" },
  "ui.intel.state.idle": { en: "Holding", es: "En espera", zh: "待命" },
  "ui.intel.state.charge": { en: "Charging", es: "Cargando", zh: "蓄力" },
  "ui.intel.state.descend": {
    en: "Descending",
    es: "Descendiendo",
    zh: "降临",
  },
  "ui.intel.state.monologue": {
    en: "Monologuing",
    es: "Monologando",
    zh: "独白中",
  },
  "ui.radio.channel": { en: "Radio", es: "Radio", zh: "无线电" },

  // -- wave 3: hangar, mastery, codex, campaign
  "ui.menu.hangar": { en: "Hangar", es: "Hangar", zh: "机库" },
  "ui.newGame.toHangar": {
    en: "To the hangar",
    es: "Ir al hangar",
    zh: "前往机库",
  },
  "ui.hangar.title": { en: "Hangar", es: "Hangar", zh: "机库" },
  "ui.hangar.launch": {
    en: "Launch contract",
    es: "Iniciar contrato",
    zh: "开始执行合同",
  },
  "ui.hangar.tab.loadout": { en: "Loadout", es: "Equipamiento", zh: "配装" },
  "ui.hangar.tab.mastery": { en: "Mastery", es: "Maestría", zh: "精通" },
  "ui.hangar.tab.codex": { en: "Codex", es: "Códice", zh: "资料库" },
  "ui.hangar.tab.campaign": { en: "Campaign", es: "Campaña", zh: "战役" },
  "ui.hangar.tabDesc.loadout": {
    en:
      "Packages change how the one fire verb plays. Cosmetics change nothing but how you are seen, which is not nothing.",
    es:
      "Los paquetes cambian cómo se juega el único verbo de disparo. Los cosméticos no cambian nada salvo cómo te ven, que no es poco.",
    zh:
      "武器包会改变唯一射击动作的手感。外观什么也不改变，只改变别人如何看你，而这并非无关紧要。",
  },
  "ui.hangar.tabDesc.mastery": {
    en:
      "Career pay earns ranks. Each rank would issue something new; this slice reaches rank 3.",
    es:
      "La paga acumulada otorga rangos. Cada rango entregaría algo nuevo; este corte llega al rango 3.",
    zh: "累计报酬可提升等级。每一级都会发放新东西；本切片最高可达 3 级。",
  },
  "ui.hangar.tabDesc.codex": {
    en:
      "What your scanner has learned. Lock onto something new and the entry writes itself.",
    es:
      "Lo que tu escáner ha aprendido. Fija algo nuevo y la entrada se escribe sola.",
    zh: "扫描仪所了解到的一切。锁定新的目标，条目就会自动写入。",
  },
  "ui.hangar.tabDesc.campaign": {
    en:
      "Eight chapters across the Lane. This slice is chapter one, start to finish.",
    es:
      "Ocho capítulos a lo largo del Carril. Este corte es el capítulo uno, de principio a fin.",
    zh: "横跨航道的八个章节。本切片是完整的第一章。",
  },
  "ui.hangar.equipped": { en: "Equipped", es: "Equipado", zh: "已装备" },
  "ui.hangar.beyond": {
    en: "Beyond this slice",
    es: "Más allá de este corte",
    zh: "本切片之外",
  },
  "ui.hangar.slotBeyond": {
    en: "Slot beyond this slice",
    es: "Ranura fuera de este corte",
    zh: "本切片之外的槽位",
  },
  "ui.hangar.cosmetic": {
    en: "Cosmetic: no effect on play",
    es: "Cosmético: no afecta el juego",
    zh: "外观：不影响玩法",
  },
  "ui.hangar.slot.weapon": {
    en: "Weapon package",
    es: "Paquete de arma",
    zh: "武器包",
  },
  "ui.hangar.slot.sensor": {
    en: "Sensor package",
    es: "Paquete de sensor",
    zh: "传感器包",
  },
  "ui.hangar.slot.paint": { en: "Paint", es: "Pintura", zh: "涂装" },
  "ui.hangar.slot.trim": {
    en: "Trim light",
    es: "Luz de borde",
    zh: "饰边灯光",
  },
  "ui.hangar.slot.decal": { en: "Decal", es: "Calcomanía", zh: "贴花" },
  "ui.hangar.slot.trail": {
    en: "Engine trail",
    es: "Estela del motor",
    zh: "引擎尾迹",
  },
  "ui.hangar.desc.paint": {
    en:
      "Hull color. The Authority issues white; everything else is a statement.",
    es:
      "Color del casco. La Autoridad entrega blanco; todo lo demás es una declaración.",
    zh: "船体颜色。管理局只发白色；其他颜色都是一种表态。",
  },
  "ui.hangar.desc.trim": {
    en:
      "The emissive line along the hull. It also tints your shots, so pick something you can see.",
    es:
      "La línea luminosa del casco. También tiñe tus disparos, así que elige algo que puedas ver.",
    zh: "沿船体的发光线条。它也会给你的子弹染色，所以请选一个你看得清的颜色。",
  },
  "ui.hangar.desc.decal": {
    en:
      "Marking on the wings. Tally marks count something; nobody agrees on what.",
    es: "Marca en las alas. Las rayas de conteo cuentan algo; nadie sabe qué.",
    zh: "机翼上的标记。计数划痕记录着什么，但没人说得清。",
  },
  "ui.hangar.desc.trail": {
    en: "Exhaust style. Ghost is nearly invisible, which suits a pacifist.",
    es:
      "Estilo de escape. Fantasma es casi invisible, ideal para un pacifista.",
    zh: "尾焰样式。“幽灵”几乎看不见，很适合和平主义者。",
  },
  "ui.hangar.weapon.standard.name": {
    en: "Lane Authority Standard",
    es: "Estándar de la Autoridad",
    zh: "航道管理局标准型",
  },
  "ui.hangar.weapon.standard.blurb": {
    en:
      "Balanced issue: a steady stream, honest taps, a Writ that charges in two seconds. Every other package is measured against this one.",
    es:
      "Equipo equilibrado: ráfaga constante, toques honestos, un Writ que carga en dos segundos. Todos los demás paquetes se miden contra este.",
    zh:
      "均衡的标准配发：稳定的连射、可靠的点射，令状两秒充满。其他武器包都以它为基准。",
  },
  "ui.hangar.weapon.magistrate.name": {
    en: "Magistrate",
    es: "Magistrado",
    zh: "法官型",
  },
  "ui.hangar.weapon.magistrate.blurb": {
    en:
      "Heavy Writ. Charges slower and streams slower, but a full Writ hits for 40 and clears a wide radius. Built for players who rest more than they shoot.",
    es:
      "Writ pesado. Carga y dispara más lento, pero un Writ completo hace 40 de daño en un radio amplio. Para quien descansa más de lo que dispara.",
    zh:
      "重型令状。充能和连射都更慢，但满级令状造成 40 点伤害并覆盖大范围。适合休息多于射击的玩家。",
  },
  "ui.hangar.weapon.courier.name": {
    en: "Courier",
    es: "Mensajero",
    zh: "信使型",
  },
  "ui.hangar.weapon.courier.blurb": {
    en:
      "Rapid stream: 40% more rounds per second, with a thin Writ. Good for clearing drones, poor at breaking Warden pods.",
    es:
      "Ráfaga rápida: 40% más disparos por segundo, con un Writ delgado. Bueno contra drones, flojo contra las cápsulas del Guardián.",
    zh:
      "快速连射：每秒射速提高 40%，令状较弱。适合清理无人机，不擅长击破守望者的武器舱。",
  },
  "ui.hangar.weapon.notary.name": { en: "Notary", es: "Notario", zh: "公证型" },
  "ui.hangar.weapon.notary.blurb": {
    en:
      "Precision taps: aimed rounds hit harder and recover faster. The disarmer's package; parts break before hulls do.",
    es:
      "Toques de precisión: los disparos apuntados pegan más y se recuperan antes. El paquete de quien desarma; las piezas caen antes que los cascos.",
    zh:
      "精准点射：瞄准射击伤害更高、冷却更短。缴械者的武器包，先打坏部件，再考虑船体。",
  },
  "ui.hangar.weapon.injunction.name": {
    en: "Injunction",
    es: "Interdicto",
    zh: "禁令型",
  },
  "ui.hangar.weapon.injunction.blurb": {
    en:
      "A Writ that holds a target in place instead of harming it. Designed for chapter three's escort contracts, which are not included in this vertical slice.",
    es:
      "Un Writ que inmoviliza al objetivo en lugar de dañarlo. Diseñado para los contratos de escolta del capítulo tres, que no están incluidos en este corte vertical.",
    zh:
      "一种将目标定住而不伤害它的令状。为第三章的护送合同设计，这些内容不包含在本垂直切片中。",
  },
  "ui.hangar.sensor.standard.name": {
    en: "Lane Authority Standard",
    es: "Estándar de la Autoridad",
    zh: "航道管理局标准型",
  },
  "ui.hangar.sensor.standard.blurb": {
    en:
      "A 40° cone that locks in under a second. Sees what is in front of you, which is usually enough.",
    es:
      "Un cono de 40° que fija en menos de un segundo. Ve lo que tienes delante, que suele bastar.",
    zh: "40° 扫描锥，一秒内完成锁定。能看到你面前的东西，通常这就够了。",
  },
  "ui.hangar.sensor.surveyor.name": {
    en: "Surveyor",
    es: "Agrimensor",
    zh: "测绘型",
  },
  "ui.hangar.sensor.surveyor.blurb": {
    en:
      "Wide cone, patient lock: sees nearly everything on screen and commits slowly. Best for learning enemy behavior and filling the codex.",
    es:
      "Cono amplio, fijado paciente: ve casi todo en pantalla y se compromete despacio. Ideal para aprender conductas enemigas y llenar el códice.",
    zh:
      "宽锥、慢锁定：几乎能看到全屏，但锁定较慢。最适合研究敌人行为、填充资料库。",
  },
  "ui.hangar.sensor.auditor.name": {
    en: "Auditor",
    es: "Auditor",
    zh: "审计型",
  },
  "ui.hangar.sensor.auditor.blurb": {
    en:
      "Narrow cone, fast lock: a third of a second on target and you know its state. A sniper's sensor; pairs with Magistrate.",
    es:
      "Cono estrecho, fijado rápido: un tercio de segundo y conoces su estado. Un sensor de francotirador; combina con Magistrado.",
    zh:
      "窄锥、快锁定：对准三分之一秒即可读出状态。狙击手的传感器，与法官型搭配最佳。",
  },
  "ui.hangar.sensor.archivist.name": {
    en: "Archivist",
    es: "Archivista",
    zh: "档案型",
  },
  "ui.hangar.sensor.archivist.blurb": {
    en:
      "Long reach: locks the Warden from the bottom of the lane. Slower than standard, but nothing is out of range.",
    es:
      "Largo alcance: fija al Guardián desde el fondo del carril. Más lento que el estándar, pero nada queda fuera de alcance.",
    zh: "远距离：从航道底部就能锁定守望者。比标准型慢，但没有什么超出范围。",
  },
  "ui.hangar.sensor.witness.name": {
    en: "Witness",
    es: "Testigo",
    zh: "见证型",
  },
  "ui.hangar.sensor.witness.blurb": {
    en:
      "Records what it scans for later testimony. Built for the tribunal chapters, which are not included in this vertical slice.",
    es:
      "Graba lo que escanea para testimonios futuros. Hecho para los capítulos del tribunal, que no están incluidos en este corte vertical.",
    zh:
      "记录扫描到的一切，留作日后证词。为法庭章节而设计，这些内容不包含在本垂直切片中。",
  },
  "ui.hangar.stat.streamRate": {
    en: "Stream rate",
    es: "Cadencia de ráfaga",
    zh: "连射速率",
  },
  "ui.hangar.stat.aimedDamage": {
    en: "Aimed damage",
    es: "Daño apuntado",
    zh: "瞄准伤害",
  },
  "ui.hangar.stat.aimedCooldown": {
    en: "Aimed cooldown",
    es: "Recarga apuntada",
    zh: "瞄准冷却",
  },
  "ui.hangar.stat.writCharge": {
    en: "Writ full charge",
    es: "Carga completa del Writ",
    zh: "令状满充能",
  },
  "ui.hangar.stat.writDamage": {
    en: "Writ damage (level 3)",
    es: "Daño del Writ (nivel 3)",
    zh: "令状伤害（3 级）",
  },
  "ui.hangar.stat.writRadius": {
    en: "Writ radius (level 3)",
    es: "Radio del Writ (nivel 3)",
    zh: "令状半径（3 级）",
  },
  "ui.hangar.stat.cone": {
    en: "Scan cone",
    es: "Cono de escaneo",
    zh: "扫描锥",
  },
  "ui.hangar.stat.range": {
    en: "Scan range",
    es: "Alcance de escaneo",
    zh: "扫描距离",
  },
  "ui.hangar.stat.lockTime": {
    en: "Lock time",
    es: "Tiempo de fijado",
    zh: "锁定时间",
  },
  "ui.hangar.paint.authorityWhite": {
    en: "Authority white",
    es: "Blanco Autoridad",
    zh: "管理局白",
  },
  "ui.hangar.paint.contractorGrey": {
    en: "Contractor grey",
    es: "Gris contratista",
    zh: "承包商灰",
  },
  "ui.hangar.paint.matteBlack": {
    en: "Matte black",
    es: "Negro mate",
    zh: "哑光黑",
  },
  "ui.hangar.paint.rustRed": { en: "Rust red", es: "Rojo óxido", zh: "锈红" },
  "ui.hangar.paint.laneBlue": {
    en: "Lane blue",
    es: "Azul carril",
    zh: "航道蓝",
  },
  "ui.hangar.trim.cyan": { en: "Cyan", es: "Cian", zh: "青色" },
  "ui.hangar.trim.pink": { en: "Pink", es: "Rosa", zh: "粉色" },
  "ui.hangar.trim.violet": { en: "Violet", es: "Violeta", zh: "紫色" },
  "ui.hangar.trim.gold": { en: "Gold", es: "Dorado", zh: "金色" },
  "ui.hangar.trim.red": { en: "Red", es: "Rojo", zh: "红色" },
  "ui.hangar.trim.white": { en: "White", es: "Blanco", zh: "白色" },
  "ui.hangar.decal.none": { en: "None", es: "Ninguna", zh: "无" },
  "ui.hangar.decal.authorityNumber": {
    en: "Authority number",
    es: "Número de la Autoridad",
    zh: "管理局编号",
  },
  "ui.hangar.decal.tallyMarks": {
    en: "Tally marks",
    es: "Rayas de conteo",
    zh: "计数划痕",
  },
  "ui.hangar.decal.wardenCrest": {
    en: "Warden crest",
    es: "Emblema del Guardián",
    zh: "守望者徽记",
  },
  "ui.hangar.decal.payGrade": {
    en: "Pay grade",
    es: "Grado salarial",
    zh: "薪资等级",
  },
  "ui.hangar.trail.standard": { en: "Standard", es: "Estándar", zh: "标准" },
  "ui.hangar.trail.ion": { en: "Ion", es: "Iónica", zh: "离子" },
  "ui.hangar.trail.ember": { en: "Ember", es: "Brasa", zh: "余烬" },
  "ui.hangar.trail.ghost": { en: "Ghost", es: "Fantasma", zh: "幽灵" },
  "ui.hangar.wall.utility": {
    en: "Utility slot",
    es: "Ranura de utilidad",
    zh: "辅助槽",
  },
  "ui.hangar.wall.utilityBody": {
    en:
      "Countermeasures, tethers and the salvage claw. The full game opens this slot in chapter two; it is not included in this vertical slice.",
    es:
      "Contramedidas, amarres y la garra de rescate. El juego completo abre esta ranura en el capítulo dos; no está incluida en este corte vertical.",
    zh: "干扰装置、系缆和打捞爪。完整版在第二章开放此槽位；本垂直切片未包含。",
  },
  "ui.hangar.wall.reactor": {
    en: "Reactor mod",
    es: "Mod de reactor",
    zh: "反应堆模组",
  },
  "ui.hangar.wall.reactorBody": {
    en:
      "Trades hull for Writ charge speed, or the reverse. Tuned for the late chapters and not included in this vertical slice.",
    es:
      "Cambia casco por velocidad de carga del Writ, o al revés. Ajustado para los capítulos finales y no incluido en este corte vertical.",
    zh:
      "用船体耐久换取令状充能速度，反之亦然。为后期章节调校，本垂直切片未包含。",
  },
  "ui.hangar.wall.droneBay": {
    en: "Drone bay",
    es: "Bahía de drones",
    zh: "无人机舱",
  },
  "ui.hangar.wall.droneBayBody": {
    en:
      "A wingman drone that mirrors your fire verb. Its AI, its voice and its contract are not included in this vertical slice.",
    es:
      "Un dron escolta que imita tu disparo. Su IA, su voz y su contrato no están incluidos en este corte vertical.",
    zh:
      "一架模仿你射击动作的僚机无人机。它的 AI、语音和合同都不包含在本垂直切片中。",
  },
  "ui.hangar.wall.hullPlating": {
    en: "Hull plating",
    es: "Blindaje del casco",
    zh: "船体装甲",
  },
  "ui.hangar.wall.hullPlatingBody": {
    en:
      "Ablative, reflective or salvaged plates, each with its own weight. Not included in this vertical slice.",
    es:
      "Placas ablativas, reflectantes o rescatadas, cada una con su peso. No incluido en este corte vertical.",
    zh: "烧蚀、反射或打捞来的装甲板，各有其重量。本垂直切片未包含。",
  },
  "ui.hangar.wall.secondSensor": {
    en: "Second sensor mount",
    es: "Segundo soporte de sensor",
    zh: "第二传感器挂点",
  },
  "ui.hangar.wall.secondSensorBody": {
    en:
      "Two scan beams, two locks, one very busy pilot. Not included in this vertical slice.",
    es:
      "Dos haces de escaneo, dos fijados, un piloto muy ocupado. No incluido en este corte vertical.",
    zh: "两道扫描光束、两个锁定，一名非常忙碌的飞行员。本垂直切片未包含。",
  },
  "ui.hangar.mastery.rank": {
    en: "Mastery rank {n}",
    es: "Rango de maestría {n}",
    zh: "精通等级 {n}",
  },
  "ui.hangar.mastery.rankShort": {
    en: "Rank {n}",
    es: "Rango {n}",
    zh: "{n} 级",
  },
  "ui.hangar.mastery.career": {
    en: "Career pay: {pay}",
    es: "Paga acumulada: {pay}",
    zh: "累计报酬：{pay}",
  },
  "ui.hangar.mastery.earned": {
    en: "Earned. The Authority has noted it in your file.",
    es: "Obtenido. La Autoridad lo anotó en tu expediente.",
    zh: "已获得。管理局已记入你的档案。",
  },
  "ui.hangar.mastery.toEarn": {
    en: "Reach {pay} career pay to earn this rank.",
    es: "Alcanza {pay} de paga acumulada para obtener este rango.",
    zh: "累计报酬达到 {pay} 即可获得此等级。",
  },
  "ui.hangar.mastery.walledBody": {
    en:
      "Needs {pay} career pay, and contracts that are not included in this vertical slice.",
    es:
      "Requiere {pay} de paga acumulada y contratos que no están incluidos en este corte vertical.",
    zh: "需要累计报酬 {pay}，以及本垂直切片未包含的合同。",
  },
  "ui.hangar.reward.paint": {
    en: "Reward: a paint",
    es: "Recompensa: una pintura",
    zh: "奖励：一种涂装",
  },
  "ui.hangar.reward.decal": {
    en: "Reward: a decal",
    es: "Recompensa: una calcomanía",
    zh: "奖励：一种贴花",
  },
  "ui.hangar.reward.trail": {
    en: "Reward: an engine trail",
    es: "Recompensa: una estela",
    zh: "奖励：一种引擎尾迹",
  },
  "ui.hangar.reward.package": {
    en: "Reward: a package",
    es: "Recompensa: un paquete",
    zh: "奖励：一个武器或传感器包",
  },
  "ui.hangar.reward.slot": {
    en: "Reward: a slot",
    es: "Recompensa: una ranura",
    zh: "奖励：一个槽位",
  },
  "ui.hangar.reward.codex": {
    en: "Reward: a codex shelf",
    es: "Recompensa: un estante del códice",
    zh: "奖励：一个资料库分类",
  },
  "ui.codex.unknown": { en: "Unscanned", es: "Sin escanear", zh: "未扫描" },
  "ui.codex.entry": {
    en: "Codex entry",
    es: "Entrada del códice",
    zh: "资料库条目",
  },
  "ui.codex.sealed": {
    en: "Sealed entry",
    es: "Entrada sellada",
    zh: "封存条目",
  },
  "ui.codex.bodyPending": {
    en: "The entry text arrives with the narrative build.",
    es: "El texto de la entrada llega con la versión narrativa.",
    zh: "条目正文将随剧情版本一同加入。",
  },
  "ui.codex.count": {
    en: "{n} of {total} entries recovered",
    es: "{n} de {total} entradas recuperadas",
    zh: "已获得 {n}/{total} 个条目",
  },
  "ui.codex.unlocked": {
    en: "Codex: {title}",
    es: "Códice: {title}",
    zh: "资料库：{title}",
  },
  "ui.codex.shelf": {
    en: "Codex shelf",
    es: "Estante del códice",
    zh: "资料库分类",
  },
  "ui.codex.hint.drone": {
    en: "Lock onto a drone with the scan beam (rest, do not fire).",
    es: "Fija un dron con el haz de escaneo (reposa, no dispares).",
    zh: "用扫描光束锁定一架无人机（静止，不要射击）。",
  },
  "ui.codex.hint.dart": {
    en: "Lock onto a dart.",
    es: "Fija un dardo.",
    zh: "锁定一架飞镖机。",
  },
  "ui.codex.hint.turret": {
    en: "Lock onto a turret.",
    es: "Fija una torreta.",
    zh: "锁定一座炮塔。",
  },
  "ui.codex.hint.lancer": {
    en: "Lock onto a lancer.",
    es: "Fija un lancero.",
    zh: "锁定一架长枪机。",
  },
  "ui.codex.hint.warden": {
    en: "Lock onto the Warden.",
    es: "Fija al Guardián.",
    zh: "锁定守望者。",
  },
  "ui.codex.hint.wardenCore": {
    en: "Break two of the Warden's pods, then lock onto its core.",
    es: "Rompe dos cápsulas del Guardián y luego fija su núcleo.",
    zh: "击破守望者的两个武器舱，然后锁定其核心。",
  },
  "ui.codex.hint.recorder": {
    en: "Recover what drifts through sector 3.",
    es: "Recupera lo que flota en el sector 3.",
    zh: "回收在第 3 区漂流的东西。",
  },
  "ui.codex.shelf.factions": { en: "Factions", es: "Facciones", zh: "势力" },
  "ui.codex.shelf.factionsBody": {
    en:
      "The Authority, the contractors' guild, the people who live along the Lane. Not included in this vertical slice.",
    es:
      "La Autoridad, el gremio de contratistas, la gente que vive junto al Carril. No incluido en este corte vertical.",
    zh: "管理局、承包商公会，以及住在航道沿线的人们。本垂直切片未包含。",
  },
  "ui.codex.shelf.pilots": {
    en: "Pilot records",
    es: "Registros de pilotos",
    zh: "飞行员档案",
  },
  "ui.codex.shelf.pilotsBody": {
    en:
      "One hundred and twenty-one files, most of them closed. Not included in this vertical slice.",
    es:
      "Ciento veintiún expedientes, casi todos cerrados. No incluido en este corte vertical.",
    zh: "一百二十一份档案，大多已经结案。本垂直切片未包含。",
  },
  "ui.codex.shelf.lanes": {
    en: "Lanes and sectors",
    es: "Carriles y sectores",
    zh: "航道与星区",
  },
  "ui.codex.shelf.lanesBody": {
    en:
      "Forty sectors of history, weather and old wreckage. Not included in this vertical slice.",
    es:
      "Cuarenta sectores de historia, clima y restos antiguos. No incluido en este corte vertical.",
    zh: "四十个星区的历史、气候和旧残骸。本垂直切片未包含。",
  },
  "ui.codex.shelf.authority": {
    en: "Authority memos",
    es: "Memorandos de la Autoridad",
    zh: "管理局备忘录",
  },
  "ui.codex.shelf.authorityBody": {
    en:
      "Internal memos, some of them about you. Not included in this vertical slice.",
    es:
      "Memorandos internos, algunos sobre ti. No incluido en este corte vertical.",
    zh: "内部备忘录，其中一些与你有关。本垂直切片未包含。",
  },
  "ui.campaign.intro": {
    en:
      "Eight chapters, forty sectors. This vertical slice is chapter one, complete.",
    es:
      "Ocho capítulos, cuarenta sectores. Este corte vertical es el capítulo uno, completo.",
    zh: "八个章节，四十个星区。本垂直切片为完整的第一章。",
  },
  "ui.campaign.chapter": {
    en: "Chapter {n}",
    es: "Capítulo {n}",
    zh: "第 {n} 章",
  },
  "ui.campaign.thisSlice": {
    en: "This vertical slice",
    es: "Este corte vertical",
    zh: "本垂直切片",
  },
  "ui.campaign.ch1": { en: "The Lane", es: "El Carril", zh: "航道" },
  "ui.campaign.ch1Body": {
    en:
      "Onboarding, five sectors and the Warden. Open: choose a beat from Chapter Select.",
    es:
      "Inducción, cinco sectores y el Guardián. Abierto: elige un momento en Selección de capítulo.",
    zh: "入职培训、五个星区和守望者。已开放：可在章节选择中挑选段落。",
  },
  "ui.campaign.ch2": {
    en: "Salvage Rights",
    es: "Derechos de rescate",
    zh: "打捞权",
  },
  "ui.campaign.ch2Body": {
    en:
      "Who owns a wreck, and who owns its pilot. Not included in this vertical slice.",
    es:
      "De quién es un naufragio, y de quién es su piloto. No incluido en este corte vertical.",
    zh: "残骸归谁所有，它的飞行员又归谁所有。本垂直切片未包含。",
  },
  "ui.campaign.ch3": {
    en: "Escort Clause",
    es: "Cláusula de escolta",
    zh: "护送条款",
  },
  "ui.campaign.ch3Body": {
    en:
      "Keep a freighter alive through lanes that want it dead. Not included in this vertical slice.",
    es:
      "Mantén vivo un carguero en carriles que lo quieren muerto. No incluido en este corte vertical.",
    zh: "护送一艘货船穿过想要毁掉它的航道。本垂直切片未包含。",
  },
  "ui.campaign.ch4": { en: "The Tribunal", es: "El tribunal", zh: "法庭" },
  "ui.campaign.ch4Body": {
    en:
      "The Authority puts a Warden on trial, and asks you to testify. Not included in this vertical slice.",
    es:
      "La Autoridad juzga a un Guardián y te pide testificar. No incluido en este corte vertical.",
    zh: "管理局审判一名守望者，并要求你出庭作证。本垂直切片未包含。",
  },
  "ui.campaign.ch5": {
    en: "Quiet Lanes",
    es: "Carriles en silencio",
    zh: "寂静航道",
  },
  "ui.campaign.ch5Body": {
    en:
      "Sectors where no one fires first. Not included in this vertical slice.",
    es:
      "Sectores donde nadie dispara primero. No incluido en este corte vertical.",
    zh: "没有人先开火的星区。本垂直切片未包含。",
  },
  "ui.campaign.ch6": { en: "Severance", es: "Indemnización", zh: "遣散" },
  "ui.campaign.ch6Body": {
    en:
      "Your contract ends; the Authority's interest in you does not. Not included in this vertical slice.",
    es:
      "Tu contrato termina; el interés de la Autoridad en ti, no. No incluido en este corte vertical.",
    zh: "你的合同到期了，但管理局对你的兴趣没有。本垂直切片未包含。",
  },
  "ui.campaign.ch7": {
    en: "The Other Wardens",
    es: "Los otros Guardianes",
    zh: "其他守望者",
  },
  "ui.campaign.ch7Body": {
    en: "There was never only one. Not included in this vertical slice.",
    es: "Nunca hubo uno solo. No incluido en este corte vertical.",
    zh: "从来都不只有一个。本垂直切片未包含。",
  },
  "ui.campaign.ch8": { en: "Open Lane", es: "Carril abierto", zh: "开放航道" },
  "ui.campaign.ch8Body": {
    en:
      "How it ends depends on what you did in chapter one. Not included in this vertical slice.",
    es:
      "Cómo termina depende de lo que hiciste en el capítulo uno. No incluido en este corte vertical.",
    zh: "结局取决于你在第一章做了什么。本垂直切片未包含。",
  },
  "ui.intel.state.drift": { en: "Drifting", es: "A la deriva", zh: "漂移" },
  "ui.intel.state.reload": { en: "Reloading", es: "Recargando", zh: "装填" },
  "ui.intel.state.withdraw": {
    en: "Withdrawing",
    es: "Retirándose",
    zh: "撤离",
  },
  "ui.intel.state.parley": { en: "Parley", es: "Parlamento", zh: "交涉" },
  "ui.intel.state.sweep": { en: "Sweeping", es: "Barrido", zh: "横扫" },
  "ui.intel.state.fan": { en: "Fan fire", es: "Abanico", zh: "扇形射击" },
  "ui.intel.state.cannon": { en: "Cannon", es: "Cañón", zh: "主炮" },
  "ui.intel.state.summon": { en: "Summoning", es: "Convocando", zh: "召唤" },
  "ui.intel.state.spiral": { en: "Spiral", es: "Espiral", zh: "螺旋" },
  "ui.intel.state.fallen": { en: "Fallen", es: "Caído", zh: "坠落" },
  "ui.credits.originalGame": {
    en: "Original game",
    es: "Juego original",
    zh: "原版游戏",
  },
  "ui.credits.originalGameBody": {
    en: "Adam Smith, and his coupled agents",
    es: "Adam Smith, y sus agentes acoplados",
    zh: "Adam Smith 及其协作智能体",
  },
} as const satisfies Record<string, LocalizedText>;

/** The MIT license text, verbatim; hoisted so the table stays readable. */
function MIT_TEXT(): string {
  return 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';
}
