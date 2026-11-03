/**
 * Analytics 展示层规范化工具
 *
 * Vercel 的 x-vercel-ip-city 请求头是 URL 编码的（如 Los%20Angeles），
 * 历史数据里也同时存在大小写、空格、连字符不一致的写法。
 * 这里统一做解码 / 归一 / 中文映射，供周报、邮件和后台复用。
 */

export const UNKNOWN_CITY = '未知城市';

const CITY_NAME_MAP: Record<string, string> = {
  // 中国城市
  beijing: '北京',
  shanghai: '上海',
  tianjin: '天津',
  chongqing: '重庆',
  guangzhou: '广州',
  shenzhen: '深圳',
  hangzhou: '杭州',
  nanjing: '南京',
  suzhou: '苏州',
  wuxi: '无锡',
  changzhou: '常州',
  nantong: '南通',
  xuzhou: '徐州',
  yangzhou: '扬州',
  zhenjiang: '镇江',
  jiaxing: '嘉兴',
  huzhou: '湖州',
  shaoxing: '绍兴',
  ningbo: '宁波',
  wenzhou: '温州',
  jinhua: '金华',
  quzhou: '衢州',
  lishui: '丽水',
  zhoushan: '舟山',
  hefei: '合肥',
  wuhu: '芜湖',
  anqing: '安庆',
  bengbu: '蚌埠',
  fuzhou: '福州',
  xiamen: '厦门',
  quanzhou: '泉州',
  zhangzhou: '漳州',
  putian: '莆田',
  nanchang: '南昌',
  jiujiang: '九江',
  ganzhou: '赣州',
  jinan: '济南',
  qingdao: '青岛',
  yantai: '烟台',
  weifang: '潍坊',
  linyi: '临沂',
  zibo: '淄博',
  jining: '济宁',
  zhengzhou: '郑州',
  luoyang: '洛阳',
  kaifeng: '开封',
  xinxiang: '新乡',
  nanyang: '南阳',
  wuhan: '武汉',
  yichang: '宜昌',
  xiangyang: '襄阳',
  changsha: '长沙',
  zhuzhou: '株洲',
  xiangtan: '湘潭',
  dongguan: '东莞',
  foshan: '佛山',
  zhuhai: '珠海',
  zhongshan: '中山',
  huizhou: '惠州',
  shantou: '汕头',
  jiangmen: '江门',
  zhaoqing: '肇庆',
  nanning: '南宁',
  guilin: '桂林',
  liuzhou: '柳州',
  haikou: '海口',
  sanya: '三亚',
  chengdu: '成都',
  mianyang: '绵阳',
  deyang: '德阳',
  kunming: '昆明',
  dali: '大理',
  lijiang: '丽江',
  guiyang: '贵阳',
  zunyi: '遵义',
  xian: '西安',
  xianyang: '咸阳',
  taiyuan: '太原',
  datong: '大同',
  shijiazhuang: '石家庄',
  baoding: '保定',
  tangshan: '唐山',
  langfang: '廊坊',
  shenyang: '沈阳',
  dalian: '大连',
  anshan: '鞍山',
  changchun: '长春',
  jilin: '吉林',
  harbin: '哈尔滨',
  daqing: '大庆',
  hohhot: '呼和浩特',
  baotou: '包头',
  lanzhou: '兰州',
  xining: '西宁',
  yinchuan: '银川',
  urumqi: '乌鲁木齐',
  lhasa: '拉萨',
  'hong kong': '香港',
  macau: '澳门',
  macao: '澳门',
  taipei: '台北',
  kaohsiung: '高雄',
  taichung: '台中',
  tainan: '台南',
  hsinchu: '新竹',

  // 亚洲其他地区
  singapore: '新加坡',
  tokyo: '东京',
  osaka: '大阪',
  kyoto: '京都',
  nagoya: '名古屋',
  sapporo: '札幌',
  fukuoka: '福冈',
  seoul: '首尔',
  busan: '釜山',
  incheon: '仁川',
  bangkok: '曼谷',
  'chiang mai': '清迈',
  'kuala lumpur': '吉隆坡',
  penang: '槟城',
  jakarta: '雅加达',
  surabaya: '泗水',
  cyberjaya: '赛城',
  manila: '马尼拉',
  cebu: '宿务',
  'ho chi minh city': '胡志明市',
  hanoi: '河内',
  'da nang': '岘港',
  'phnom penh': '金边',
  yangon: '仰光',
  vientiane: '万象',
  male: '马累',
  kathmandu: '加德满都',
  dhaka: '达卡',
  colombo: '科伦坡',
  mumbai: '孟买',
  delhi: '德里',
  'new delhi': '新德里',
  bangalore: '班加罗尔',
  bengaluru: '班加罗尔',
  hyderabad: '海得拉巴',
  chennai: '金奈',
  kolkata: '加尔各答',
  pune: '浦那',

  // 大洋洲
  sydney: '悉尼',
  melbourne: '墨尔本',
  brisbane: '布里斯班',
  perth: '珀斯',
  adelaide: '阿德莱德',
  canberra: '堪培拉',
  auckland: '奥克兰',
  wellington: '惠灵顿',
  christchurch: '基督城',

  // 欧洲
  london: '伦敦',
  manchester: '曼彻斯特',
  birmingham: '伯明翰',
  edinburgh: '爱丁堡',
  glasgow: '格拉斯哥',
  dublin: '都柏林',
  paris: '巴黎',
  lyon: '里昂',
  marseille: '马赛',
  nice: '尼斯',
  berlin: '柏林',
  munich: '慕尼黑',
  munchen: '慕尼黑',
  frankfurt: '法兰克福',
  'frankfurt am main': '法兰克福',
  hamburg: '汉堡',
  cologne: '科隆',
  stuttgart: '斯图加特',
  dusseldorf: '杜塞尔多夫',
  amsterdam: '阿姆斯特丹',
  rotterdam: '鹿特丹',
  utrecht: '乌得勒支',
  brussels: '布鲁塞尔',
  zurich: '苏黎世',
  geneva: '日内瓦',
  basel: '巴塞尔',
  bern: '伯尔尼',
  vienna: '维也纳',
  prague: '布拉格',
  bratislava: '布拉迪斯拉发',
  warsaw: '华沙',
  krakow: '克拉科夫',
  budapest: '布达佩斯',
  lisbon: '里斯本',
  porto: '波尔图',
  madrid: '马德里',
  barcelona: '巴塞罗那',
  valencia: '瓦伦西亚',
  rome: '罗马',
  milan: '米兰',
  florence: '佛罗伦萨',
  venice: '威尼斯',
  naples: '那不勒斯',
  athens: '雅典',
  istanbul: '伊斯坦布尔',
  ankara: '安卡拉',
  moscow: '莫斯科',
  'saint petersburg': '圣彼得堡',
  'st petersburg': '圣彼得堡',
  kyiv: '基辅',
  kiev: '基辅',
  stockholm: '斯德哥尔摩',
  gothenburg: '哥德堡',
  oslo: '奥斯陆',
  copenhagen: '哥本哈根',
  helsinki: '赫尔辛基',
  reykjavik: '雷克雅未克',
  tallinn: '塔林',
  riga: '里加',
  vilnius: '维尔纽斯',

  // 中东与非洲
  dubai: '迪拜',
  'abu dhabi': '阿布扎比',
  doha: '多哈',
  riyadh: '利雅得',
  'tel aviv': '特拉维夫',
  jerusalem: '耶路撒冷',
  cairo: '开罗',
  casablanca: '卡萨布兰卡',
  'cape town': '开普敦',
  johannesburg: '约翰内斯堡',
  nairobi: '内罗毕',
  accra: '阿克拉',
  lagos: '拉各斯',
  'addis ababa': '亚的斯亚贝巴',

  // 南北美洲
  'new york': '纽约',
  brooklyn: '布鲁克林',
  'los angeles': '洛杉矶',
  'san francisco': '旧金山',
  oakland: '奥克兰',
  'san jose': '圣何塞',
  'palo alto': '帕洛阿尔托',
  'mountain view': '山景城',
  cupertino: '库比蒂诺',
  sunnyvale: '森尼韦尔',
  'santa clara': '圣克拉拉',
  seattle: '西雅图',
  portland: '波特兰',
  boardman: '博德曼',
  eugene: '尤金',
  sacramento: '萨克拉门托',
  'san diego': '圣迭戈',
  'las vegas': '拉斯维加斯',
  phoenix: '凤凰城',
  denver: '丹佛',
  boulder: '博尔德',
  dallas: '达拉斯',
  houston: '休斯敦',
  austin: '奥斯汀',
  'san antonio': '圣安东尼奥',
  atlanta: '亚特兰大',
  miami: '迈阿密',
  orlando: '奥兰多',
  tampa: '坦帕',
  chicago: '芝加哥',
  boston: '波士顿',
  cambridge: '剑桥',
  washington: '华盛顿',
  'washington dc': '华盛顿',
  philadelphia: '费城',
  pittsburgh: '匹兹堡',
  cleveland: '克利夫兰',
  minneapolis: '明尼阿波利斯',
  detroit: '底特律',
  nashville: '纳什维尔',
  'new orleans': '新奥尔良',
  honolulu: '檀香山',
  'st louis': '圣路易斯',
  'kansas city': '堪萨斯城',
  'salt lake city': '盐湖城',
  ashburn: '阿什本',
  boydton: '博伊顿',
  toronto: '多伦多',
  vancouver: '温哥华',
  montreal: '蒙特利尔',
  ottawa: '渥太华',
  calgary: '卡尔加里',
  edmonton: '埃德蒙顿',
  winnipeg: '温尼伯',
  victoria: '维多利亚',
  'mexico city': '墨西哥城',
  guadalajara: '瓜达拉哈拉',
  monterrey: '蒙特雷',
  bogota: '波哥大',
  medellin: '麦德林',
  lima: '利马',
  santiago: '圣地亚哥',
  'buenos aires': '布宜诺斯艾利斯',
  'sao paulo': '圣保罗',
  'rio de janeiro': '里约热内卢',
  brasilia: '巴西利亚',
};

const UNKNOWN_KEYS = new Set([
  'unknown', 'unknown city', 'n/a', 'n a', 'na', 'nil', 'null', 'undefined', 'none', '-', '--',
  'not available', 'not set', '未知', '未知城市', '未识别', '其他', '其它',
]);

function cleanText(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2060\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeDecode(value: string) {
  let current = value.replace(/\+/g, ' ');
  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9a-f]{2}/i.test(current)) break;
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

function canonicalKey(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[-_\u2010-\u2015\u2212/]+/g, ' ')
    .replace(/[.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupKey(value: string) {
  return value.replace(/,.*$/, '').replace(/\s+(city|shi)$/, '').trim();
}

const CITY_LOOKUP = new Map<string, string>();
for (const [alias, label] of Object.entries(CITY_NAME_MAP)) {
  CITY_LOOKUP.set(canonicalKey(alias), label);
}
for (const label of new Set(Object.values(CITY_NAME_MAP))) {
  CITY_LOOKUP.set(canonicalKey(label), label);
}

export function clipText(value: string, maxLength = 120) {
  const chars = Array.from(value);
  if (chars.length <= maxLength) return value;
  return `${chars.slice(0, Math.max(1, maxLength - 1)).join('')}…`;
}

/** 只做解码与空白清理，不翻译；用于写入原始 analytics 字段 */
export function decodeCityName(value: unknown) {
  if (typeof value !== 'string') return '';
  return cleanText(safeDecode(value));
}

/** 通用标签清理：URL 解码、空白折叠、空值兜底 */
export function cleanLabel(value: unknown, fallback = '未知') {
  if (typeof value !== 'string') return fallback;
  const cleaned = cleanText(safeDecode(value));
  return cleaned || fallback;
}

function titleCaseEnglish(value: string) {
  if (/[\u3400-\u9fff]/.test(value)) return value;
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => word
      .split('-')
      .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part))
      .join('-'))
    .join(' ');
}

export function resolveCity(value: unknown): { key: string; label: string } {
  const decoded = decodeCityName(value);
  const canonical = canonicalKey(decoded);
  if (!canonical || UNKNOWN_KEYS.has(canonical) || UNKNOWN_KEYS.has(decoded)) {
    return { key: 'unknown', label: UNKNOWN_CITY };
  }

  const mapped = CITY_LOOKUP.get(canonical) || CITY_LOOKUP.get(lookupKey(canonical));
  if (mapped) {
    return { key: `city:${canonicalKey(mapped)}`, label: mapped };
  }

  return {
    key: `raw:${lookupKey(canonical) || canonical}`,
    label: clipText(titleCaseEnglish(decoded), 40),
  };
}

/** 周报 / 后台展示用的城市名：解码 + 规范大小写与空格 + 常见城市转中文 */
export function normalizeCityName(value: unknown) {
  return resolveCity(value).label;
}

export type CityStat = { name: string; count: number; visitors: number };

/**
 * 聚合城市访问：同一城市的不同写法合并计数，按次数降序，并列按名称稳定排序。
 * visitor 传入访客唯一标识后，可同时给出访问人数，便于识别是同一人重复访问还是异常流量。
 */
export function aggregateCityStats(
  entries: Array<{ city: unknown; visitor?: string | null }>,
  limit = 12,
): CityStat[] {
  const map = new Map<string, { name: string; count: number; visitors: Set<string> }>();
  for (const entry of entries) {
    const { key, label } = resolveCity(entry.city);
    const item = map.get(key) || { name: label, count: 0, visitors: new Set<string>() };
    item.count += 1;
    if (entry.visitor) item.visitors.add(entry.visitor);
    map.set(key, item);
  }

  return Array.from(map.values())
    .map((item) => ({ name: item.name, count: item.count, visitors: item.visitors.size }))
    .sort((a, b) => b.visitors - a.visitors || b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))
    .slice(0, limit);
}
