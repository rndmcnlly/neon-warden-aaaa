/** Environmental records, not VO or combat prompts. Each survives in the archive. */
export type WorldLanguage = "en" | "es" | "zh";
export interface Discovery {
  readonly id: string;
  readonly sector: number;
  readonly at: number;
  readonly text: Readonly<Record<WorldLanguage, string>>;
}
const record = (
  sector: number,
  at: number,
  id: string,
  en: string,
  es: string,
  zh: string,
): Discovery => ({ sector, at, id, text: { en, es, zh } });

export const WORLD_LORE: readonly Discovery[] = [
  record(
    1,
    0,
    "public-beacon",
    "PUBLIC BEACON\nPassage is not a purchase.",
    "BALIZA PÚBLICA\nPasar no es comprar.",
    "公共航标\n通行不是交易。",
  ),
  record(
    1,
    420,
    "saltline-manifest",
    "SALTLINE HAULERS\nCargo: water. Fare: none.",
    "TRANSPORTISTAS DE LA LÍNEA DE SAL\nCarga: agua. Pasaje: gratis.",
    "盐线货运行会\n货物：水。通行费：无。",
  ),
  record(
    1,
    1020,
    "route-remnant",
    "OLD ROUTE CHART\nFree passage, renewed by use.",
    "CARTA DE RUTA ANTIGUA\nPaso libre, renovado con cada viaje.",
    "旧航路图\n自由通行，每次航行都是延续。",
  ),
  record(
    2,
    0,
    "commons-splice",
    "COMMONS REPAIR 08\nDifferent bolts. Same bridge.",
    "REPARACIÓN COMUNAL 08\nDistintos pernos. El mismo puente.",
    "公地维修08\n螺栓不同，桥还是那座桥。",
  ),
  record(
    2,
    540,
    "erased-number",
    "ASSET NUMBER REMOVED\nThe welds still hold.",
    "NÚMERO DE ACTIVO BORRADO\nLas soldaduras siguen firmes.",
    "资产编号已划去\n焊缝依然牢固。",
  ),
  record(
    2,
    1260,
    "mining-return",
    "MINING WINCH\nRebuilt from three abandoned claims.",
    "CABRESTANTE MINERO\nReconstruido con tres concesiones abandonadas.",
    "矿用绞盘\n由三处废弃矿权设施拼修而成。",
  ),
  record(
    3,
    0,
    "customs-survey",
    "CUSTOMS SURVEY\nInspection capacity: 0. Billing: ready.",
    "ESTUDIO ADUANERO\nInspecciones: 0. Cobro: listo.",
    "海关勘测\n检验能力：0。计费：就绪。",
  ),
  record(
    3,
    660,
    "petition-spool",
    "PETITION SPOOL\n209 received. No reply recorded.",
    "CARRETE DE PETICIONES\n209 recibidas. Sin respuesta registrada.",
    "请愿卷轴\n收到209份。未记录任何答复。",
  ),
  record(
    3,
    1380,
    "recorder-berth",
    "BERTH 0121\nAccount closed. Beacon still transmitting.",
    "ATRAQUE 0121\nCuenta cerrada. La baliza sigue transmitiendo.",
    "0121号泊位\n账户已关闭。航标仍在发信。",
  ),
  record(
    4,
    0,
    "switchyard",
    "COMMONS SWITCHYARD\nLeave room for the next convoy.",
    "PATIO COMUNAL\nDeja espacio para el próximo convoy.",
    "公地编组场\n给下一支船队留出位置。",
  ),
  record(
    4,
    660,
    "closure-arm",
    "AUTHORITY CLOSURE\nOpening date subject to subscription.",
    "CIERRE DE LA AUTORIDAD\nApertura sujeta a suscripción.",
    "管理局封锁\n开放日期以订阅情况为准。",
  ),
  record(
    4,
    1440,
    "freight-transfer",
    "TRANSFER RECORD\nNo owner field. Everyone arrived.",
    "REGISTRO DE TRANSBORDO\nSin campo de propietario. Llegaron todos.",
    "转运记录\n没有所有者一栏。所有船只均已抵达。",
  ),
  record(
    5,
    0,
    "guardian-heart",
    "THE INNER GARDEN\nA place to grow scouts. A way home.",
    "EL JARDÍN INTERIOR\nDonde crecen exploradores. Un camino a casa.",
    "内环苗圃\n侦察机在此生长。归途由此延续。",
  ),
  record(
    5,
    720,
    "guardian-maintenance",
    "RING MAINTENANCE\nThree centuries. No invoice.",
    "MANTENIMIENTO DE ANILLOS\nTres siglos. Sin factura.",
    "光环养护\n三个世纪。从未开过账单。",
  ),
  record(
    5,
    1500,
    "dormant-toll",
    "TOLL HARDWARE\nInstalled in advance. Not yet connected.",
    "EQUIPO DE PEAJE\nInstalado de antemano. Aún sin conexión.",
    "收费设备\n已预先安装。尚未接通。",
  ),
];

/** Small adapter surface for a future codex reader. No DOM and no sim writes. */
export class WorldArchive {
  private found = new Map<string, Discovery>();
  discover(sector: number, elapsedTicks: number): void {
    for (const item of WORLD_LORE) {
      if (item.sector === sector && elapsedTicks >= item.at) {
        this.found.set(item.id, item);
      }
    }
  }
  entries(language: WorldLanguage = "en") {
    return [...this.found.values()].map((item) => ({
      id: item.id,
      sector: item.sector,
      text: item.text[language],
    }));
  }
  clear(): void {
    this.found.clear();
  }
}
