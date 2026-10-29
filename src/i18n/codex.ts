/**
 * Codex text (unspoken). Entries unlock from scan intel and story beats; the
 * unlock rules are in `src/scenes/codex.ts`. Each entry is `codex.<id>.title`
 * plus `codex.<id>.body`.
 *
 * The codex is the slice's window onto the larger game: it names sectors,
 * factions and a commons movement that this chapter only glimpses. Two rules
 * keep it honest. It never contradicts the slice (the Warden's rings, the
 * five sectors, the serials), and it is written in two voices: Authority
 * filing language for what the Pilot is issued, and the scouts' own words
 * for what scans reveal.
 */

import type { LocalizedText } from "./types.ts";

export const CODEX_TEXT = {
  // -- the Warden's scouts (unlocked by scanning each kind)
  "codex.drone.title": {
    en: "Scout",
    es: "Explorador",
    zh: "侦察机",
  },
  "codex.drone.body": {
    en:
      "Authority file: hostile drone, two hit points, fires aimed rounds. Scan intel: scouts are grown in the Warden's rings, not built. They fly the lanes in pairs, escort unarmed convoys, and log every ship they meet by its serial. Observed rule: they do not fire on a ship that has not fired. Authority annotation: rule not verified.",
    es:
      "Expediente de la Autoridad: dron hostil, dos puntos de vida, dispara proyectiles dirigidos. Datos de escaneo: los exploradores se cultivan en los anillos del Guardián, no se fabrican. Vuelan las rutas en parejas, escoltan convoyes desarmados y registran cada nave que encuentran por su número de serie. Regla observada: no disparan contra una nave que no ha disparado. Anotación de la Autoridad: regla no verificada.",
    zh:
      "管理局档案：敌对无人机，两点耐久，发射瞄准弹。扫描情报：侦察机是在守望者的光环中培育出来的，不是制造出来的。它们两两结队巡航，护送无武装车队，并按编号记录遇到的每一艘船。观察到的规矩：不向没有开火的船开火。管理局批注：该规矩未经核实。",
  },
  "codex.dart.title": {
    en: "Dart",
    es: "Dardo",
    zh: "飞镖机",
  },
  "codex.dart.body": {
    en:
      "Authority file: diving interceptor, one hit point, unarmed. Scan intel: darts carried guns until the Treaty of the Belt, signed by every party in the Shatter Belt except the Authority. They now dive only to mark the lane for lost ships. The weapon part your scanner finds is the empty mount, kept as a reminder.",
    es:
      "Expediente de la Autoridad: interceptor en picada, un punto de vida, desarmado. Datos de escaneo: los dardos llevaban armas hasta el Tratado del Cinturón, firmado por todas las partes del Cinturón Quebrado excepto la Autoridad. Ahora solo se lanzan en picada para marcar la ruta a las naves perdidas. La pieza de armamento que encuentra tu escáner es el soporte vacío, conservado como recordatorio.",
    zh:
      "管理局档案：俯冲拦截机，一点耐久，无武装。扫描情报：在碎裂带条约签订之前，飞镖机是带武器的；碎裂带的各方都签了这份条约，唯独管理局没有。如今它们俯冲只是为了给迷航的船标出航道。你的扫描仪找到的武器部件，是一个空着的炮座，留作纪念。",
  },
  "codex.turret.title": {
    en: "Turret",
    es: "Torreta",
    zh: "炮塔",
  },
  "codex.turret.body": {
    en:
      "Authority file: fixed emplacement, twelve hit points, barrel is the weapon part. Scan intel: turrets root themselves in the Gun Lanes and live for about a century. Most have never fired first. Several were planted where Authority survey teams later tried to pour tollgate footings, which the Authority files as deliberate obstruction.",
    es:
      "Expediente de la Autoridad: emplazamiento fijo, doce puntos de vida, el cañón es la pieza de armamento. Datos de escaneo: las torretas echan raíces en las Rutas de Artillería y viven alrededor de un siglo. La mayoría nunca ha disparado primero. Varias se plantaron donde después los equipos de topografía de la Autoridad intentaron colar cimientos de casetas de peaje, lo que la Autoridad archiva como obstrucción deliberada.",
    zh:
      "管理局档案：固定炮位，十二点耐久，炮管为武器部件。扫描情报：炮塔在炮火航道里扎根，寿命约一个世纪。大多数从没先开过火。其中几座所在的位置，后来正是管理局勘测队想浇筑收费站地基的地方，管理局将此归档为蓄意阻挠。",
  },
  "codex.lancer.title": {
    en: "Lancer",
    es: "Lancero",
    zh: "枪骑机",
  },
  "codex.lancer.body": {
    en:
      "Authority file: crossfire unit, two emitters, each a weapon part. Scan intel: lancers fire across a lane and never along it, so the middle of the lane stays open to anything that keeps to it. They cut loose any structure anchored in the Lancer Gate. They also escort Commons Assembly flotillas, free of charge.",
    es:
      "Expediente de la Autoridad: unidad de fuego cruzado, dos emisores, cada uno una pieza de armamento. Datos de escaneo: los lanceros disparan a través de la ruta y nunca a lo largo, así que el centro queda libre para quien se mantenga en él. Sueltan cualquier estructura anclada en la Puerta de los Lanceros. También escoltan las flotillas de la Asamblea de los Comunes, sin costo.",
    zh:
      "管理局档案：交叉火力单位，两个发射器，各为一个武器部件。扫描情报：枪骑机只横穿航道开火，从不沿着航道，因此只要守在航道中间，任何船都能通过。任何锚定在枪骑之门里的建筑，都会被它们切断。它们还免费护送公地议会的船队。",
  },

  // -- the Warden
  "codex.warden.title": {
    en: "The Warden",
    es: "El Guardián",
    zh: "守望者",
  },
  "codex.warden.body": {
    en:
      "Authority file: apex hostile, nine rings, four weapon pods, core exposed when two pods fail. Threat rating: extreme. Scan intel: three centuries old. Its rings throttle armed traffic and nothing else. It grows its scouts, names its turrets, and remembers every Pilot serial it has met. Voice analysis does not match the threat briefing.",
    es:
      "Expediente de la Autoridad: hostil supremo, nueve anillos, cuatro cápsulas de armas, núcleo expuesto cuando fallan dos cápsulas. Nivel de amenaza: extremo. Datos de escaneo: tiene tres siglos. Sus anillos frenan el tráfico armado y nada más. Cultiva a sus exploradores, les pone nombre a sus torretas y recuerda cada número de serie de piloto que ha conocido. El análisis de voz no coincide con la sesión informativa de amenazas.",
    zh:
      "管理局档案：顶级敌对目标，九道光环，四个武器炮舱，两个炮舱失效后核心暴露。威胁等级：极高。扫描情报：已有三百年历史。它的光环只限制武装船只通行，别的一概不管。它培育自己的侦察机，给炮塔起名字，还记得见过的每一个飞行员编号。声纹分析与威胁简报不符。",
  },

  "codex.wardencore.title": {
    en: "The Warden's core",
    es: "El núcleo del Guardián",
    zh: "守望者的核心",
  },
  "codex.wardencore.body": {
    en:
      "Authority file: kill zone, exposed when two pods fail. Scan intel: a slow, warm light that pulses in time with the rings. It dims when a scout goes dark and brightens when one comes home. The scouts call it the heart.",
    es:
      "Expediente de la Autoridad: zona de eliminación, expuesta cuando fallan dos cápsulas. Datos de escaneo: una luz lenta y cálida que late al ritmo de los anillos. Se atenúa cuando un explorador se apaga y se aviva cuando uno vuelve a casa. Los exploradores lo llaman el corazón.",
    zh:
      "管理局档案：致命区域，两个炮舱失效后暴露。扫描情报：一团缓慢而温暖的光，随光环的节律跳动。每当一架侦察机熄灭，它就暗下去；每当一架回家，它又亮起来。侦察机们管它叫心脏。",
  },

  // -- institutions, places, people (issued with the contract)
  "codex.authority.title": {
    en: "The Lane Authority",
    es: "La Autoridad de Rutas",
    zh: "航道管理局",
  },
  "codex.authority.body": {
    en:
      "A chartered toll consortium headquartered at Tollmouth Station. Mission: to bring safe, licensed, reliable passage to every lane in the nebula. Five sectors are under active clearance. Subscription tiers for cleared lanes are in final review. The Authority thanks its contractors, its subscribers, and its future subscribers.",
    es:
      "Un consorcio de peajes con carta constitutiva, con sede en la Estación Bocapeaje. Misión: llevar un paso seguro, con licencia y confiable a cada ruta de la nebulosa. Cinco sectores están en proceso activo de despeje. Los niveles de suscripción para las rutas despejadas están en revisión final. La Autoridad agradece a sus contratistas, a sus suscriptores y a sus futuros suscriptores.",
    zh:
      "一家持有特许状的收费财团，总部位于收费口站。使命：为星云中的每一条航道带来安全、持证、可靠的通行。目前有五个星区正在清场。已清场航道的订阅等级正在最终审核。管理局感谢它的合同工、订阅用户，以及未来的订阅用户。",
  },
  "codex.lanes.title": {
    en: "The Lanes",
    es: "Las rutas",
    zh: "航道",
  },
  "codex.lanes.body": {
    en:
      "Stable corridors through the nebula, open to anyone who flies them without weapons for as long as anyone has records. This chapter covers five sectors from the Outer Drift to the Last Approach. Lane Control charts at least forty more, among them the Lantern Reach, the Ninefold Shoals and the long road to Tollmouth. Not included in this vertical slice.",
    es:
      "Corredores estables a través de la nebulosa, abiertos a cualquiera que los vuele sin armas desde que existen registros. Este capítulo abarca cinco sectores, de la Deriva Exterior a la Aproximación Final. Control de Rutas tiene cartografiados al menos cuarenta más, entre ellos el Alcance de los Faroles, los Bajíos Nueveplegados y el largo camino a Bocapeaje. No incluido en este corte vertical.",
    zh:
      "穿过星云的稳定通道。自有记录以来，任何不带武器的人都可以在其中通行。本章涵盖从外缘漂流带到最终进近的五个星区。航道控制还绘有至少四十个星区，其中包括灯笼域、九重浅滩，以及通往收费口站的漫长航路。本垂直切片未包含这些内容。",
  },
  "codex.pilots.title": {
    en: "Pilots and serials",
    es: "Pilotos y números de serie",
    zh: "飞行员与编号",
  },
  "codex.pilots.body": {
    en:
      "Lane Authority contractors are issued a serial, a ship, a helmet and an onboarding assistant. Serials are sequential and never reused. Payment is issued on completion of contract. Non-performance results in recall, after which the serial is retired and the next serial begins onboarding. Current stock: adequate.",
    es:
      "A los contratistas de la Autoridad de Rutas se les asigna un número de serie, una nave, un casco y un asistente de inducción. Los números son consecutivos y nunca se reutilizan. El pago se emite al completar el contrato. El no desempeño conlleva el retiro, tras el cual el número se da de baja y el siguiente número comienza la inducción. Inventario actual: suficiente.",
    zh:
      "航道管理局的合同工会领到一个编号、一艘飞船、一顶头盔和一位入职助手。编号按顺序发放，永不重复使用。合同完成后即发放报酬。未履约将导致召回，召回后该编号注销，下一个编号开始入职培训。当前库存：充足。",
  },
  "codex.pilot0121.title": {
    en: "Pilot #0121",
    es: "Piloto #0121",
    zh: "0121号飞行员",
  },
  "codex.pilot0121.body": {
    en:
      "Status: recalled for non-performance. Final approach logged with weapon cold. Vessel abandoned in the Gun Lanes; recovery not cost effective. Unfiled note, origin unknown: he stopped.",
    es:
      "Estado: retirado por no desempeño. Aproximación final registrada con el arma fría. Nave abandonada en las Rutas de Artillería; recuperación no rentable. Nota sin archivar, origen desconocido: él se detuvo.",
    zh:
      "状态：因未履约被召回。最终进近记录显示武器未开火。飞船弃置于炮火航道；回收不划算。未归档备注，来源不明：他停手了。",
  },
  "codex.recorder.title": {
    en: "Derelict flight recorder",
    es: "Registrador de vuelo abandonado",
    zh: "残骸飞行记录仪",
  },
  "codex.recorder.body": {
    en:
      "Recovered from #0121's vessel near station nine. Marked closed by the Authority. Still recording. Three hundred twelve days of entries, almost all of them one voice talking to an empty cockpit. Authority annotation: contents not relevant to any contract.",
    es:
      "Recuperado de la nave de #0121 cerca de la estación nueve. Marcado como cerrado por la Autoridad. Sigue grabando. Trescientos doce días de entradas, casi todas de una sola voz que le habla a una cabina vacía. Anotación de la Autoridad: contenido no relevante para ningún contrato.",
    zh:
      "回收自九号站附近的0121号飞船。已被管理局标记为结案。仍在记录。三百一十二天的日志，几乎全是同一个声音在对着空驾驶舱说话。管理局批注：内容与任何合同无关。",
  },
  "codex.writ.title": {
    en: "The Writ",
    es: "El Mandato",
    zh: "令状",
  },
  "codex.writ.body": {
    en:
      "Full name: the Writ of Enclosure, after the instrument by which the Authority's charter first fenced a common lane into licensed property. The round charges while the trigger rests and passes through whatever stands in its way. On a locked weak point it is final. On a weapon part it is a clean disarm. Patent pending.",
    es:
      "Nombre completo: Mandato de Cercamiento, por el instrumento con el que la carta de la Autoridad cercó por primera vez una ruta común para convertirla en propiedad con licencia. El disparo se carga mientras el gatillo descansa y atraviesa todo lo que se interpone. Sobre un punto débil fijado, es definitivo. Sobre una pieza de armamento, es un desarme limpio. Patente en trámite.",
    zh:
      "全称：圈地令状，得名于管理局特许状第一次把一条公共航道圈为持证财产时所用的那份文书。扳机松开时充能，发射后贯穿挡路的一切。命中已锁定的弱点，即为终局。命中武器部件，即为干净的解除武装。专利申请中。",
  },
  "codex.commons.title": {
    en: "The Commons Assembly",
    es: "La Asamblea de los Comunes",
    zh: "公地议会",
  },
  "codex.commons.body": {
    en:
      "An unlicensed association of haulers, families and independent pilots who fly the lanes unarmed and settle disputes by meeting in open sky. The Warden's lancers escort them. Lane Control classes their broadcasts as unlicensed content. Their history begins long before the Authority and is not included in this vertical slice.",
    es:
      "Una asociación sin licencia de transportistas, familias y pilotos independientes que vuelan las rutas desarmados y resuelven sus disputas reuniéndose a cielo abierto. Los lanceros del Guardián los escoltan. Control de Rutas clasifica sus transmisiones como contenido sin licencia. Su historia empieza mucho antes que la Autoridad y no está incluida en este corte vertical.",
    zh:
      "一个未经许可的团体，由货运者、家庭和独立飞行员组成。他们不带武器在航道中飞行，在开阔的星空中集会解决纷争。守望者的枪骑机为他们护航。航道控制把他们的广播列为未授权内容。他们的历史远早于管理局，本垂直切片未包含这部分内容。",
  },
  "codex.haulers.title": {
    en: "The Saltline Haulers",
    es: "Los Transportistas de la Línea de Sal",
    zh: "盐线货运行会",
  },
  "codex.haulers.body": {
    en:
      "A freight guild that has run convoys through the Shatter Belt for six generations, escorted by darts that carry no guns. Petitions filed with the Authority to date: two hundred and nine. Petitions answered: none. Guild contracts are not included in this vertical slice.",
    es:
      "Un gremio de carga que lleva seis generaciones haciendo pasar convoyes por el Cinturón Quebrado, escoltados por dardos sin armas. Peticiones presentadas ante la Autoridad hasta la fecha: doscientas nueve. Peticiones respondidas: ninguna. Los contratos del gremio no están incluidos en este corte vertical.",
    zh:
      "一个货运行会，六代人以来一直带着车队穿越碎裂带，护航的是不带武器的飞镖机。迄今向管理局提交的请愿：二百零九份。获得答复的请愿：零份。行会合同未包含在本垂直切片中。",
  },

  // -- weapon packages (ids match WeaponPackageId in src/contracts/loadout.ts)
  "codex.weapon.standard.title": {
    en: "Standard issue",
    es: "Equipo estándar",
    zh: "标准配发",
  },
  "codex.weapon.standard.body": {
    en:
      "The package every contractor is onboarded with. Balanced stream, aimed round and Writ. Reliable, serviceable, and billed to your first payment.",
    es:
      "El paquete con el que se induce a todo contratista. Ráfaga, disparo de precisión y Mandato equilibrados. Confiable, funcional y cargado a tu primer pago.",
    zh:
      "每位合同工入职时配发的组件。持续射击、精确射击与令状三者均衡。可靠、耐用，费用从你的首笔报酬中扣除。",
  },
  "codex.weapon.magistrate.title": {
    en: "Magistrate",
    es: "Magistrado",
    zh: "裁判官",
  },
  "codex.weapon.magistrate.body": {
    en:
      "A heavier Writ that takes longer to charge, paid for with a slower stream. Marketed to contractors who prefer to settle matters in one sitting.",
    es:
      "Un Mandato más pesado que tarda más en cargarse, a cambio de una ráfaga más lenta. Se promociona entre contratistas que prefieren resolver los asuntos en una sola audiencia.",
    zh:
      "令状更重，充能更慢，代价是持续射击变慢。面向喜欢一次了结问题的合同工推广。",
  },
  "codex.weapon.courier.title": {
    en: "Courier",
    es: "Mensajero",
    zh: "信使",
  },
  "codex.weapon.courier.body": {
    en:
      "A fast stream with a thin Writ. Volume over precision. Lane Control notes that Courier users report the highest hourly clearance figures.",
    es:
      "Una ráfaga rápida con un Mandato delgado. Volumen antes que precisión. Control de Rutas señala que quienes usan Mensajero reportan las cifras de despeje por hora más altas.",
    zh:
      "持续射击很快，令状偏弱。重火力，轻精度。航道控制指出，信使用户的每小时清场数据最高。",
  },
  "codex.weapon.notary.title": {
    en: "Notary",
    es: "Notario",
    zh: "公证人",
  },
  "codex.weapon.notary.body": {
    en:
      "Harder, quicker aimed rounds for part work. Popular with contractors who disarm. The Authority does not track which contractors those are. It does track their pay.",
    es:
      "Disparos de precisión más fuertes y rápidos para trabajar piezas. Popular entre los contratistas que desarman. La Autoridad no lleva registro de quiénes son. Sí lleva registro de su paga.",
    zh:
      "精确射击更强、更快，适合拆部件。在会解除武装的合同工中很受欢迎。管理局不统计这些合同工是谁，但会统计他们的报酬。",
  },
  "codex.weapon.injunction.title": {
    en: "Injunction",
    es: "Interdicto",
    zh: "禁制令",
  },
  "codex.weapon.injunction.body": {
    en:
      "A Writ that holds a target in place instead of breaking it. Issued in later chapters to contractors with an approved standing order. Not included in this vertical slice.",
    es:
      "Un Mandato que inmoviliza al objetivo en lugar de romperlo. Se asigna en capítulos posteriores a contratistas con una orden permanente aprobada. No incluido en este corte vertical.",
    zh:
      "一种能把目标定在原地、而不是将其击碎的令状。在后续章节中配发给持有获批常设命令的合同工。本垂直切片未包含。",
  },

  // -- sensor packages (ids match SensorPackageId in src/contracts/loadout.ts)
  "codex.sensor.standard.title": {
    en: "Standard sensors",
    es: "Sensores estándar",
    zh: "标准传感器",
  },
  "codex.sensor.standard.body": {
    en:
      "A moderate scanning cone and a moderate lock time. Every scan is shared with the Lane Atlas, which is how the Authority knows where to put the tollgates.",
    es:
      "Un cono de escaneo moderado y un tiempo de fijado moderado. Cada escaneo se comparte con el Atlas de Rutas, y así sabe la Autoridad dónde poner las casetas de peaje.",
    zh:
      "扫描锥范围适中，锁定时间适中。每一次扫描都会共享到航道图集，管理局就是靠这个知道收费站该建在哪儿。",
  },
  "codex.sensor.surveyor.title": {
    en: "Surveyor",
    es: "Topógrafo",
    zh: "勘测员",
  },
  "codex.sensor.surveyor.body": {
    en:
      "A wide cone for reading a whole formation, at the cost of a slower lock. Adapted from the instruments survey teams use to measure lanes for footings.",
    es:
      "Un cono amplio para leer una formación completa, a costa de un fijado más lento. Adaptado de los instrumentos con los que los equipos de topografía miden las rutas para los cimientos.",
    zh:
      "宽广的扫描锥，可读取整个编队，代价是锁定更慢。改装自勘测队测量航道、准备打地基所用的仪器。",
  },
  "codex.sensor.auditor.title": {
    en: "Auditor",
    es: "Auditor",
    zh: "审计员",
  },
  "codex.sensor.auditor.body": {
    en:
      "A narrow beam that locks fast. Finds the weak point before the target finds you. Recommended by Lane Control for high-volume clearance.",
    es:
      "Un haz estrecho que fija rápido. Encuentra el punto débil antes de que el objetivo te encuentre a ti. Recomendado por Control de Rutas para despejes de alto volumen.",
    zh:
      "窄光束，锁定快。在目标发现你之前先找到它的弱点。航道控制推荐用于大批量清场。",
  },
  "codex.sensor.archivist.title": {
    en: "Archivist",
    es: "Archivista",
    zh: "档案员",
  },
  "codex.sensor.archivist.body": {
    en:
      "Records the full intel of every lock, including channels the Authority does not license. Issued in later chapters. Not included in this vertical slice.",
    es:
      "Graba la información completa de cada fijado, incluidos los canales que la Autoridad no autoriza. Se asigna en capítulos posteriores. No incluido en este corte vertical.",
    zh:
      "完整记录每一次锁定的情报，包括管理局未授权的频道。在后续章节中配发。本垂直切片未包含。",
  },
  "codex.sensor.witness.title": {
    en: "Witness",
    es: "Testigo",
    zh: "见证者",
  },
  "codex.sensor.witness.body": {
    en:
      "A sensor package of unknown origin, found in derelicts. It does not lock. It listens. Not included in this vertical slice.",
    es:
      "Un paquete de sensores de origen desconocido, hallado en naves abandonadas. No fija. Escucha. No incluido en este corte vertical.",
    zh:
      "来源不明的传感器组件，发现于残骸之中。它不锁定，只倾听。本垂直切片未包含。",
  },
} as const satisfies Record<string, LocalizedText>;
