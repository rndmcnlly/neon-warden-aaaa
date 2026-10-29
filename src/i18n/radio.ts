/**
 * Text-only radio: lines shown as on-screen radio text with no voice, to
 * keep the VO budget for the lines that matter. Voiced radio lines live in
 * `vo/script.yaml` (`rad_*`); `src/scenes/radio.ts` mixes both into one
 * bank keyed by enemy kind and situation.
 *
 * Ids are dotted (`radio.<source>.<situation>.<n>`) so tooling never mistakes
 * them for VO ids. Callsigns name the channel in the radio box and stand in
 * for subtitle speaker names of the radio speakers.
 *
 * What leaks here is lore, in passing: the scouts are grown, escort unarmed
 * convoys and fire only on ships that fire first; Lane Control is surveying
 * for tollgates and keeping Pilot stock; beyond this chapter there are more
 * sectors, a freight guild and a commons movement.
 */

import type { LocalizedText } from "./types.ts";

export const RADIO_TEXT = {
  // -- callsigns
  "radio.callsign.scout": {
    en: "Scout channel",
    es: "Canal de exploradores",
    zh: "侦察机频道",
  },
  "radio.callsign.authority": {
    en: "Lane Control",
    es: "Control de Rutas",
    zh: "航道控制",
  },
  "radio.callsign.recorder": {
    en: "Flight recorder #0121",
    es: "Registrador de vuelo #0121",
    zh: "0121号飞行记录仪",
  },

  // -- drones: Outer Drift scouts
  "radio.drone.patrol.1": {
    en:
      "Drift Four to Drift Six: Saltline convoy through at the half-bell. Keep the lane wide.",
    es:
      "Deriva Cuatro a Deriva Seis: convoy de la Línea de Sal pasa a media campanada. Mantengan la ruta amplia.",
    zh: "漂流四号呼叫漂流六号：盐线车队半更时通过。保持航道宽敞。",
  },
  "radio.drone.patrol.2": {
    en:
      "Hauler asked after the Warden again. Told them: tired, loud, still here.",
    es:
      "Un transportista volvió a preguntar por el Guardián. Le dije: cansado, ruidoso, todavía aquí.",
    zh: "又有货船问起守望者。我说：累了，嗓门大，还在。",
  },
  "radio.drone.patrol.3": {
    en: "Count the rings. All nine lit. Good.",
    es: "Cuenta los anillos. Los nueve encendidos. Bien.",
    zh: "数数光环。九个都亮着。很好。",
  },
  "radio.drone.locked.1": {
    en: "It's reading us. Let it read. Nothing in here it can bill.",
    es: "Nos está leyendo. Que lea. Aquí no hay nada que pueda cobrar.",
    zh: "它在读取我们。让它读。我们身上没什么能让它收费的。",
  },
  "radio.drone.locked.2": {
    en: "Lock tone on Six. Hold your pattern. Wait for its shot.",
    es: "Tono de fijado en Seis. Mantén tu patrón. Espera su disparo.",
    zh: "六号收到锁定提示音。保持队形。等它先开火。",
  },
  "radio.drone.disarmed.1": {
    en: "Drift Six, disarmed, not dead. Repeat: not dead. Mark it.",
    es: "Deriva Seis, desarmado, no muerto. Repito: no muerto. Anótenlo.",
    zh: "漂流六号，已缴械，没死。重复：没死。记下来。",
  },
  "radio.drone.disarmed.2": {
    en: "Going home to regrow a gun. Tell the Warden I'm fine.",
    es:
      "Me voy a casa a que me vuelva a crecer el arma. Díganle al Guardián que estoy bien.",
    zh: "回家重新长一门炮。告诉守望者我没事。",
  },
  "radio.drone.retreat.1": {
    en: "Back to the nursery. Somebody save me a mooring.",
    es: "De vuelta al vivero. Que alguien me guarde un amarre.",
    zh: "回育成所。谁给我留个泊位。",
  },
  "radio.drone.lost.1": {
    en: "Write the number down. The Warden learns all the numbers.",
    es: "Anoten el número. El Guardián se aprende todos los números.",
    zh: "把编号记下来。守望者会记住每一个编号。",
  },
  "radio.drone.lost.2": {
    en: "That's another one it can bill for.",
    es: "Ese es otro que puede cobrar.",
    zh: "又一个它能拿去报账的。",
  },

  // -- darts: Shatter Belt, unarmed since the treaty
  "radio.dart.patrol.1": {
    en:
      "Treaty of the Belt, clause one: no guns in the shoals. The Authority never signed. Still not our problem.",
    es:
      "Tratado del Cinturón, cláusula uno: nada de armas en los bajíos. La Autoridad nunca lo firmó. Sigue sin ser nuestro problema.",
    zh:
      "碎裂带条约第一条：浅滩内禁止武器。管理局从没签过。这仍然不是我们的问题。",
  },
  "radio.dart.patrol.2": {
    en: "Dive, mark, pull up. Show it where the lane is. That's all we do.",
    es:
      "Picada, marca, arriba. Muéstrale dónde está la ruta. Es todo lo que hacemos.",
    zh: "俯冲，标记，拉起。告诉它航道在哪儿。我们就干这个。",
  },
  "radio.dart.locked.1": {
    en: "Let the scanner look. Write that down, contractor: unarmed.",
    es: "Que mire el escáner. Anótalo, contratista: desarmado.",
    zh: "让它扫吧。记下来，合同工：无武装。",
  },
  "radio.dart.disarmed.1": {
    en: "Nose is cracked. Fine. I wasn't using it to hurt anybody.",
    es: "Se me rajó la nariz. Bueno. No la usaba para lastimar a nadie.",
    zh: "机鼻裂了。算了。我又没拿它伤过谁。",
  },
  "radio.dart.retreat.1": {
    en: "Pulling out of the dive. The Belt is yours. Mind the shoals.",
    es: "Salgo de la picada. El Cinturón es tuyo. Cuidado con los bajíos.",
    zh: "退出俯冲。碎裂带交给你了。小心浅滩。",
  },
  "radio.dart.lost.1": {
    en: "Treaty doesn't cover this. The treaty never covered them.",
    es: "El tratado no cubre esto. El tratado nunca los cubrió a ellos.",
    zh: "条约管不了这个。条约从来管不到他们。",
  },

  // -- turrets: Gun Lanes, bolted down
  "radio.turret.patrol.1": {
    en:
      "We were grown to stand still and look frightening. Mostly we stand still.",
    es:
      "Nos cultivaron para quedarnos quietas y dar miedo. Casi siempre nos quedamos quietas.",
    zh:
      "我们被培育出来，就是为了站着不动、样子吓人。大多数时候我们只是站着不动。",
  },
  "radio.turret.patrol.2": {
    en:
      "Survey drones at the lane mouth again. Warden says shoot the measuring tape, not the crew.",
    es:
      "Otra vez drones de topografía en la boca de la ruta. El Guardián dice que le disparemos a la cinta métrica, no a la tripulación.",
    zh: "航道口又出现了勘测无人机。守望者说：打卷尺，别打人。",
  },
  "radio.turret.locked.1": {
    en:
      "Scanner in the lane. It wants to know what I'm thinking. I'm thinking: go home.",
    es: "Escáner en la ruta. Quiere saber qué pienso. Pienso: vete a casa.",
    zh: "航道里有扫描。它想知道我在想什么。我在想：回家吧。",
  },
  "radio.turret.disarmed.1": {
    en: "Can't retreat, I'm bolted down. I'll be ornamental for a while.",
    es: "No puedo retirarme, estoy atornillada. Seré decorativa un rato.",
    zh: "我撤不了，我是焊死的。先当一阵子摆设吧。",
  },
  "radio.turret.retreat.1": {
    en: "Unbolting. First time in ninety years. Wish me luck.",
    es: "Desatornillándome. Primera vez en noventa años. Deséenme suerte.",
    zh: "正在解除固定。九十年来头一回。祝我好运。",
  },
  "radio.turret.lost.1": {
    en:
      "Station two is gone. Ninety years in the lane, and it never fired first.",
    es:
      "Se perdió la estación dos. Noventa años en la ruta, y nunca disparó primero.",
    zh: "二号站没了。在航道里守了九十年，从没先开过火。",
  },

  // -- lancers: Lancer Gate, crossfire across the lane
  "radio.lancer.patrol.1": {
    en:
      "Someone tried to anchor a tollgate in the Gate again. We cut it loose. Across, never along.",
    es:
      "Otra vez alguien intentó anclar una caseta de peaje en la Puerta. La soltamos. A través, nunca a lo largo.",
    zh: "又有人想在大门里锚一座收费站。我们把它切断了。横穿，永不顺着。",
  },
  "radio.lancer.patrol.2": {
    en:
      "Commons Assembly wants an escort through the Gate next cycle. Tell them yes. Always yes.",
    es:
      "La Asamblea de los Comunes pide escolta por la Puerta el próximo ciclo. Díganles que sí. Siempre que sí.",
    zh: "公地议会下个周期要护航穿过大门。告诉他们可以。永远可以。",
  },
  "radio.lancer.disarmed.1": {
    en: "Spared, I think. Tell the Warden: spared.",
    es: "Perdonado, creo. Díganle al Guardián: perdonado.",
    zh: "我好像被放过了。告诉守望者：放过了。",
  },
  "radio.lancer.retreat.1": {
    en: "Lancer Gate falling back. Somebody else hold the crossfire.",
    es:
      "Puerta de los Lanceros en repliegue. Que alguien más sostenga el fuego cruzado.",
    zh: "枪骑之门后撤。谁来接手交叉火力。",
  },

  // -- Lane Control
  "radio.authority.patrol.1": {
    en:
      "Tollmouth Station reports the subscriber waitlist for the Shatter Belt at forty thousand.",
    es:
      "La Estación Bocapeaje reporta cuarenta mil personas en lista de espera de suscripción para el Cinturón Quebrado.",
    zh: "收费口站报告：碎裂带订阅候补名单已达四万。",
  },
  "radio.authority.patrol.2": {
    en:
      "Licensing reminds all contractors: the Lantern Reach and the Ninefold Shoals remain unlicensed. Do not enter. Yet.",
    es:
      "Licencias recuerda a todos los contratistas: el Alcance de los Faroles y los Bajíos Nueveplegados siguen sin licencia. No entren. Todavía.",
    zh: "许可处提醒所有合同工：灯笼域与九重浅滩仍未获许可。请勿进入。暂时。",
  },
  "radio.authority.patrol.3": {
    en:
      "Advisory: Commons Assembly broadcasts in sectors six through nine are unlicensed content. Do not relay.",
    es:
      "Aviso: las transmisiones de la Asamblea de los Comunes en los sectores seis a nueve son contenido sin licencia. No las retransmitan.",
    zh: "通告：第六至第九星区的公地议会广播属于未授权内容。请勿转发。",
  },
  "radio.authority.patrol.4": {
    en:
      "The Saltline Haulers have filed another petition. Petition received. Petition filed.",
    es:
      "Los Transportistas de la Línea de Sal presentaron otra petición. Petición recibida. Petición archivada.",
    zh: "盐线货运行会又提交了一份请愿。请愿已收到。请愿已归档。",
  },
  "radio.authority.locked.1": {
    en: "Scan data monetized. Thank you for contributing to the Lane Atlas.",
    es:
      "Datos de escaneo monetizados. Gracias por contribuir al Atlas de Rutas.",
    zh: "扫描数据已变现。感谢你为航道图集作出贡献。",
  },
  "radio.authority.disarmed.1": {
    en:
      "Note to file: disarmed scouts regrow armament in about one season. Completion is recommended.",
    es:
      "Nota para el expediente: los exploradores desarmados regeneran su armamento en una temporada aproximadamente. Se recomienda la eliminación.",
    zh: "备注：被缴械的侦察机大约一个季度就能重新长出武器。建议予以清除。",
  },
  "radio.authority.retreat.1": {
    en: "Retreating assets are not billable. Do not pursue unless billable.",
    es:
      "Los activos en retirada no son facturables. No los persigan a menos que sean facturables.",
    zh: "撤退目标不可计费。除非可计费，否则不予追击。",
  },
  "radio.authority.lost.1": {
    en: "Asset retired. Survey teams, you may proceed.",
    es: "Activo retirado. Equipos de topografía, pueden proceder.",
    zh: "目标已清除。勘测队可以进场了。",
  },
} as const satisfies Record<string, LocalizedText>;
