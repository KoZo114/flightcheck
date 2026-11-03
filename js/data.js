// 空港名・航空会社名・機材の座席数（推定人数の計算に使う）

export const AIRPORTS = {
  // 国内
  CTS: '札幌(新千歳)', OKD: '札幌(丘珠)', HKD: '函館', AKJ: '旭川', KUH: '釧路',
  OBO: '帯広', MMB: '女満別', WKJ: '稚内', MBE: '紋別', SHB: '中標津',
  AOJ: '青森', MSJ: '三沢', HNA: '花巻', AXT: '秋田', ONJ: '大館能代',
  GAJ: '山形', SYO: '庄内', SDJ: '仙台', KIJ: '新潟', HAC: '八丈島',
  OIM: '大島', MYE: '三宅島', KMQ: '小松', TOY: '富山', NTQ: '能登',
  NGO: '名古屋(中部)', ITM: '大阪(伊丹)', KIX: '大阪(関西)', UKB: '神戸',
  OKJ: '岡山', HIJ: '広島', IWK: '岩国', UBJ: '山口宇部', TTJ: '鳥取',
  YGJ: '米子', IZO: '出雲', IWJ: '石見', TKS: '徳島', TAK: '高松',
  KCZ: '高知', MYJ: '松山', FUK: '福岡', KKJ: '北九州', HSG: '佐賀',
  NGS: '長崎', KMJ: '熊本', OIT: '大分', KMI: '宮崎', KOJ: '鹿児島',
  ASJ: '奄美', OKA: '沖縄(那覇)', ISG: '石垣', MMY: '宮古', SHI: '下地島',
  // 国際
  ICN: 'ソウル(仁川)', GMP: 'ソウル(金浦)', PUS: '釜山', PEK: '北京(首都)',
  PKX: '北京(大興)', PVG: '上海(浦東)', SHA: '上海(虹橋)', CAN: '広州',
  SZX: '深圳', HKG: '香港', TPE: '台北(桃園)', TSA: '台北(松山)', KHH: '高雄',
  TAO: '青島', DLC: '大連', HGH: '杭州', XMN: '厦門', MNL: 'マニラ',
  BKK: 'バンコク', DMK: 'バンコク(ドンムアン)', SIN: 'シンガポール',
  KUL: 'クアラルンプール', CGK: 'ジャカルタ', SGN: 'ホーチミン', HAN: 'ハノイ',
  DEL: 'デリー', BOM: 'ムンバイ', DXB: 'ドバイ', DOH: 'ドーハ', IST: 'イスタンブール',
  LHR: 'ロンドン', CDG: 'パリ', FRA: 'フランクフルト', MUC: 'ミュンヘン',
  HEL: 'ヘルシンキ', AMS: 'アムステルダム', VIE: 'ウィーン', ZRH: 'チューリッヒ',
  MXP: 'ミラノ', FCO: 'ローマ', MAD: 'マドリード', CPH: 'コペンハーゲン',
  JFK: 'ニューヨーク(JFK)', EWR: 'ニューヨーク(ニューアーク)', LAX: 'ロサンゼルス',
  SFO: 'サンフランシスコ', SEA: 'シアトル', ORD: 'シカゴ', DFW: 'ダラス',
  IAH: 'ヒューストン', ATL: 'アトランタ', DTW: 'デトロイト', MSP: 'ミネアポリス',
  BOS: 'ボストン', IAD: 'ワシントン', YVR: 'バンクーバー', YYZ: 'トロント',
  HNL: 'ホノルル', KOA: 'コナ', GUM: 'グアム', SYD: 'シドニー',
  MEL: 'メルボルン', BNE: 'ブリスベン', AKL: 'オークランド',
};

export const DOMESTIC = new Set([
  'CTS','OKD','HKD','AKJ','KUH','OBO','MMB','WKJ','MBE','SHB','AOJ','MSJ','HNA','AXT','ONJ',
  'GAJ','SYO','SDJ','KIJ','HAC','OIM','MYE','KMQ','TOY','NTQ','NGO','ITM','KIX','UKB','OKJ',
  'HIJ','IWK','UBJ','TTJ','YGJ','IZO','IWJ','TKS','TAK','KCZ','MYJ','FUK','KKJ','HSG','NGS',
  'KMJ','OIT','KMI','KOJ','ASJ','OKA','ISG','MMY','SHI',
]);

// 大型機が多い国内幹線
export const TRUNK = new Set(['CTS', 'FUK', 'OKA', 'ITM', 'KIX', 'KOJ', 'HIJ', 'KMJ']);

// IATA / ICAO の両方で引けるようにする
export const AIRLINES = {
  JL: 'JAL', JAL: 'JAL', NH: 'ANA', ANA: 'ANA', BC: 'スカイマーク', SKY: 'スカイマーク',
  '7G': 'スターフライヤー', SFJ: 'スターフライヤー', '6J': 'ソラシドエア', SNJ: 'ソラシドエア',
  HD: 'エア・ドゥ', ADO: 'エア・ドゥ', NU: 'JTA', JTA: 'JTA', MM: 'ピーチ', APJ: 'ピーチ',
  KE: '大韓航空', OZ: 'アシアナ航空', '7C': 'チェジュ航空', CA: '中国国際航空',
  MU: '中国東方航空', CZ: '中国南方航空', CX: 'キャセイパシフィック', BR: 'エバー航空',
  CI: 'チャイナエアライン', IT: 'タイガーエア台湾', SQ: 'シンガポール航空', TG: 'タイ国際航空',
  PR: 'フィリピン航空', VN: 'ベトナム航空', GA: 'ガルーダ', MH: 'マレーシア航空',
  QR: 'カタール航空', EK: 'エミレーツ航空', TK: 'ターキッシュ エアラインズ',
  BA: 'ブリティッシュ・エアウェイズ', AF: 'エールフランス', LH: 'ルフトハンザ',
  AY: 'フィンエアー', UA: 'ユナイテッド航空', AA: 'アメリカン航空', DL: 'デルタ航空',
  HA: 'ハワイアン航空', AC: 'エア・カナダ', QF: 'カンタス航空', NZ: 'ニュージーランド航空',
};

// 機材ごとの座席数（国内線仕様 / 国際線仕様のおおよその値）
// キーは ICAO 機材コード。ODPT の機材名（例 "787-8"）も normalizeAircraft で寄せる。
export const SEATS = {
  B788: { dom: 335, intl: 206, name: 'ボーイング787-8' },
  B789: { dom: 377, intl: 215, name: 'ボーイング787-9' },
  B78X: { dom: 429, intl: 294, name: 'ボーイング787-10' },
  B772: { dom: 390, intl: 236, name: 'ボーイング777-200' },
  B773: { dom: 514, intl: 264, name: 'ボーイング777-300' },
  B77W: { dom: 500, intl: 244, name: 'ボーイング777-300ER' },
  B763: { dom: 270, intl: 202, name: 'ボーイング767-300' },
  B738: { dom: 166, intl: 166, name: 'ボーイング737-800' },
  B38M: { dom: 166, intl: 166, name: 'ボーイング737 MAX 8' },
  B739: { dom: 180, intl: 180, name: 'ボーイング737-900' },
  A320: { dom: 166, intl: 166, name: 'エアバスA320' },
  A20N: { dom: 146, intl: 174, name: 'エアバスA320neo' },
  A321: { dom: 194, intl: 194, name: 'エアバスA321' },
  A21N: { dom: 194, intl: 194, name: 'エアバスA321neo' },
  A333: { dom: 277, intl: 277, name: 'エアバスA330-300' },
  A359: { dom: 369, intl: 300, name: 'エアバスA350-900' },
  A35K: { dom: 239, intl: 239, name: 'エアバスA350-1000' },
  A388: { dom: 520, intl: 520, name: 'エアバスA380' },
  E170: { dom: 76, intl: 76, name: 'エンブラエル170' },
  E190: { dom: 95, intl: 95, name: 'エンブラエル190' },
  DH8D: { dom: 74, intl: 74, name: 'ボンバルディアQ400' },
};

export function normalizeAircraft(raw) {
  if (!raw) return null;
  const s = String(raw).toUpperCase().replace(/^ODPT\.AIRCRAFTTYPE:/, '').replace(/[\s_]/g, '');
  if (SEATS[s]) return s;
  const map = [
    [/7878|787-8|B787-8/, 'B788'], [/7879|787-9/, 'B789'], [/78710|787-10/, 'B78X'],
    [/77W|777-300ER/, 'B77W'], [/773|777-300/, 'B773'], [/772|777-200/, 'B772'],
    [/763|767-300/, 'B763'], [/7M8|737MAX|38M/, 'B38M'], [/738|737-800/, 'B738'], [/739|737-900/, 'B739'],
    [/32N|A20N|A320NEO/, 'A20N'], [/320|A320/, 'A320'], [/32Q|A21N|A321NEO/, 'A21N'], [/321|A321/, 'A321'],
    [/359|A350-900/, 'A359'], [/351|A35K|A350-1000/, 'A35K'], [/333|A330/, 'A333'], [/388|A380/, 'A388'],
    [/E70|E170|ERJ170/, 'E170'], [/E90|E190|ERJ190/, 'E190'], [/DH4|Q400|DHC8/, 'DH8D'],
  ];
  for (const [re, code] of map) if (re.test(s)) return code;
  return null;
}
