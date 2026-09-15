/**
 * 示例住宅项目 A 地块 责任单位 / 工种自动分类
 * 规则来源：A地块全楼栋责任单位及工种划分规则 v1.1（2026-07-25）
 * 判断顺序：外墙外窗保洁 > 精装总包A跨楼栋专业分包 > 厨房灯带 > 14家专业分包 > 精装总包兜底
 */

export interface ClassifyResult {
  unit: string;
  trade: string;
  matched: string | null;
  level: 'clean' | 'window' | 'structure' | 'public' | 'sub' | 'general' | 'unknown';
}

/** 楼栋 → 精装总包（兜底） */
export const GENERAL_CONTRACTOR: Record<number, string> = {
  1: '精装总包B',
  2: '门窗分包',
  7: '门窗分包',
  3: '湖南一建',
  4: '湖南一建',
  5: '湖南一建',
  6: '精装总包A精装',
  10: '精装总包A精装',
};

const CLEAN_KW = ['外墙外窗', '外窗保洁', '外窗污染', '外窗未做', '玻璃未清洁', '外墙保洁'];
const WINDOW_KW = ['玻璃划痕', '窗户把手', '窗扇变形', '窗户渗水', '窗户型材'];
const STRUCT_KW = ['结构开裂', '楼板裂缝', '外墙渗漏', '沉降'];
const PUBLIC_KW = ['公区照明', '公区插座', '公区给排水', '楼道灯', '地下室排水'];

/** 14 家专业分包规则（全楼栋统一） */
export const SUB_RULES: Array<{ keywords: string[]; unit: string; trade: string }> = [
  { keywords: ['入户门', '入户门槛', '进户门', '大门', '智能锁'], unit: '智能锁分包', trade: '入户门' },
  {
    keywords: ['厨房门', '户内门', '卫生间门', '阳台门', '卧室门', '书房门', '北卧门', '南卧门', '次卧门', '主卧门', '客厅门', '门框', '门套', '门吸', '合页', '移门', '推拉门', '防火门'],
    unit: '木门柜体分包', trade: '户内门',
  },
  { keywords: ['橱柜', '厨柜', '地柜', '吊柜', '橱柜台面', '厨房台面', '水槽', '凉霸'], unit: '厨柜分包', trade: '橱柜' },
  { keywords: ['油烟机', '灶具', '洗碗机'], unit: '滁州志鹏', trade: '厨电' },
  { keywords: ['玄关柜', '入户柜', '卫浴柜', '镜柜', '美妆冰箱', '洗脸柜', '洗手盆柜'], unit: '卫浴分包', trade: '玄关柜/卫浴柜' },
  { keywords: ['空调', '回风口', '出风口百叶', '空调百叶', '送风', '回风'], unit: '国网', trade: '空调' },
  { keywords: ['地板', '木地板', '踢脚线'], unit: '地板分包', trade: '地板' },
  { keywords: ['淋浴屏', '淋浴房', '马桶', '坐便器', '花洒', '龙头本体', '水槽本体'], unit: '海帛丽', trade: '淋浴屏/洁具' },
  { keywords: ['新风'], unit: '杭州三角洲', trade: '新风' },
  { keywords: ['智能面板', '智能家居', '总控制面板', '可视对讲'], unit: '智能化分包', trade: '智能面板' },
  { keywords: ['烟感', '烟感报警', '报警器', '手报按钮'], unit: '智能化分包', trade: '烟感' },
  { keywords: ['锅炉', '地暖分水器', '角阀装饰盖'], unit: '港华', trade: '地暖/锅炉' },
  { keywords: ['太阳能'], unit: '贝斯特', trade: '太阳能' },
  { keywords: ['入户门牌'], unit: '东海建设', trade: '门牌' },
];

function hit(text: string, kws: string[]): string | null {
  for (const kw of kws) if (text.includes(kw)) return kw;
  return null;
}

/**
 * 分类主函数
 * @param building 楼栋号，未知传 null
 * @param description 问题描述
 */
export function classify(building: number | null, description: string): ClassifyResult {
  const d = description || '';

  let m = hit(d, CLEAN_KW);
  if (m) return { unit: '精装总包A', trade: '保洁', matched: m, level: 'clean' };

  m = hit(d, WINDOW_KW);
  if (m) return { unit: '精装总包A', trade: '门窗', matched: m, level: 'window' };

  m = hit(d, STRUCT_KW);
  if (m) return { unit: '精装总包A', trade: '土建', matched: m, level: 'structure' };

  m = hit(d, PUBLIC_KW);
  if (m) return { unit: '精装总包A', trade: '水电', matched: m, level: 'public' };

  // 厨房灯带特判
  if (d.includes('灯带')) {
    if (['厨房', '地柜', '吊柜', '橱'].some((k) => d.includes(k))) {
      return { unit: '欧派厨柜', trade: '灯带', matched: '灯带', level: 'sub' };
    }
    return { unit: '厨柜分包', trade: '水电', matched: '灯带', level: 'sub' };
  }

  for (const rule of SUB_RULES) {
    const k = hit(d, rule.keywords);
    if (k) return { unit: rule.unit, trade: rule.trade, matched: k, level: 'sub' };
  }

  if (building && GENERAL_CONTRACTOR[building]) {
    return { unit: GENERAL_CONTRACTOR[building], trade: '待定', matched: null, level: 'general' };
  }
  return { unit: '待分类', trade: '待定', matched: null, level: 'unknown' };
}

/** 从文本中提取楼栋-房号，例如 7-2604 / 7栋2604 / 1栋201室 */
export function extractRoom(text: string): { room: string | null; building: number | null } {
  if (!text) return { room: null, building: null };
  const patterns: RegExp[] = [
    /(\d{1,2})\s*[栋幢座#]\s*(\d{3,4})\s*[室号]?/,
    /(\d{1,2})\s*[-－—]\s*(\d{3,4})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const b = parseInt(m[1], 10);
      return { room: `${b}-${m[2]}`, building: b };
    }
  }
  return { room: null, building: null };
}

/** 提取手机号 */
export function extractPhone(text: string): string | null {
  const m = (text || '').match(/1[3-9]\d{9}/);
  return m ? m[0] : null;
}
