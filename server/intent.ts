/**
 * 意图识别（规则优先 + 实体抽取）
 * 业务范围严格框定在：房屋维修报修 + 维保常见问题解答
 */
import { extractRoom, extractPhone, classify } from './classify.js';

export type IntentCode =
  | 'repair_report'      // 报修申请
  | 'repair_progress'    // 进度查询
  | 'warranty_policy'    // 质保政策
  | 'service_process'    // 服务流程/上门配合
  | 'complaint'          // 投诉催办
  | 'human_handoff'      // 转人工
  | 'greeting'           // 问候
  | 'out_of_scope';      // 超出业务范围

export const INTENT_LABELS: Record<IntentCode, string> = {
  repair_report: '报修申请',
  repair_progress: '进度查询',
  warranty_policy: '质保咨询',
  service_process: '服务咨询',
  complaint: '投诉催办',
  human_handoff: '转人工',
  greeting: '问候寒暄',
  out_of_scope: '超出范围',
};

export const INTENT_COLORS: Record<IntentCode, string> = {
  repair_report: 'warning',
  repair_progress: 'primary',
  warranty_policy: 'success',
  service_process: 'success',
  complaint: 'danger',
  human_handoff: 'danger',
  greeting: 'default',
  out_of_scope: 'default',
};

interface Rule {
  intent: IntentCode;
  weight: number;
  kws: string[];
}

const RULES: Rule[] = [
  {
    intent: 'human_handoff', weight: 1.0,
    kws: ['转人工', '人工客服', '找个人', '真人', '要人工', '联系工程师', '给我电话', '打电话给我', '留言', '让人联系我'],
  },
  {
    intent: 'complaint', weight: 0.9,
    kws: ['投诉', '不满意', '态度', '几次了', '一直没', '拖了', '没人管', '敷衍', '曝光', '维权', '催一下', '催办', '反复', '又坏了', '还没修', '推诿', '踢皮球'],
  },
  {
    intent: 'repair_progress', weight: 0.85,
    kws: ['进度', '查一下', '查询', '到哪一步', '什么时候修', '什么时候来', '处理了吗', '有人接单', '工单号', 'bx2', '排到', '受理了吗'],
  },
  {
    intent: 'repair_report', weight: 0.8,
    kws: [
      '报修', '维修', '修一下', '坏了', '故障', '漏水', '渗水', '滴水', '开裂', '裂缝', '空鼓', '脱落', '掉漆', '发霉',
      '关不上', '打不开', '关不严', '变形', '松动', '异响', '响声', '不制冷', '不制热', '不热', '没电', '跳闸', '停电',
      '堵了', '不通', '冲不下', '起拱', '鼓包', '划痕', '破损', '损坏', '歪了', '不平', '缝隙', '积水', '返潮', '报警', '误报',
    ],
  },
  {
    intent: 'warranty_policy', weight: 0.75,
    kws: ['保修', '质保', '保几年', '保修期', '范围', '免费吗', '收费', '要钱吗', '费用', '谁负责', '责任单位', '谁来修', '过保'],
  },
  {
    intent: 'service_process', weight: 0.7,
    kws: ['怎么报', '如何报', '流程', '需要在家', '密码', '上门', '预约', '验收', '回访', '评价', '装修', '拆改', '承重墙', '备案', '几点', '工作时间'],
  },
  {
    intent: 'greeting', weight: 0.4,
    kws: ['你好', '在吗', '您好', 'hi', 'hello', '哈喽', '谢谢', '辛苦', '再见', '好的'],
  },
];

/** 明显与维保无关的话题 */
const OUT_OF_SCOPE_KWS = [
  '写代码', '股票', '天气', '笑话', '菜谱', '翻译', '作文', '电影', '游戏', '彩票', '算命',
  '买房', '房价', '中介', '贷款', '退房', '收房日期', '开发商起诉',
];

export interface IntentResult {
  intent: IntentCode;
  label: string;
  confidence: number;
  matched: string[];
  entities: {
    room: string | null;
    building: number | null;
    phone: string | null;
    ticketNo: string | null;
  };
  suggestion: { unit: string; trade: string; matched: string | null } | null;
  urgent: boolean;
}

const URGENT_KWS = ['漏水', '渗水', '爆管', '停电', '跳闸', '燃气', '着火', '烟感', '打不开', '关不上', '锁', '触电', '危险', '紧急', '泡了'];

export function detectIntent(text: string, history: string[] = []): IntentResult {
  const t = (text || '').toLowerCase();
  const scores = new Map<IntentCode, { score: number; matched: string[] }>();

  for (const rule of RULES) {
    let s = 0;
    const matched: string[] = [];
    for (const kw of rule.kws) {
      if (t.includes(kw.toLowerCase())) {
        s += rule.weight;
        matched.push(kw);
      }
    }
    if (s > 0) {
      const prev = scores.get(rule.intent);
      scores.set(rule.intent, {
        score: (prev?.score || 0) + s,
        matched: [...(prev?.matched || []), ...matched],
      });
    }
  }

  const oos = OUT_OF_SCOPE_KWS.filter((k) => t.includes(k));

  const { room, building } = extractRoom(text);
  const phone = extractPhone(text);
  const ticketMatch = (text || '').match(/BX\d{9,}/i);

  // 出现房号 + 问题描述，强化报修意图
  if (room && (scores.has('repair_report') || text.length > 8)) {
    const prev = scores.get('repair_report');
    scores.set('repair_report', { score: (prev?.score || 0) + 0.5, matched: [...(prev?.matched || []), '房号'] });
  }
  if (ticketMatch) {
    const prev = scores.get('repair_progress');
    scores.set('repair_progress', { score: (prev?.score || 0) + 0.8, matched: [...(prev?.matched || []), '工单号'] });
  }

  let best: IntentCode = 'service_process';
  let bestScore = 0;
  let bestMatched: string[] = [];
  scores.forEach((v, k) => {
    if (v.score > bestScore) {
      bestScore = v.score;
      best = k;
      bestMatched = v.matched;
    }
  });

  if (bestScore === 0) {
    if (oos.length) {
      best = 'out_of_scope';
      bestScore = 0.8;
      bestMatched = oos;
    } else {
      // 没有任何命中：结合历史，默认按咨询处理
      best = history.length > 0 ? 'repair_report' : 'service_process';
      bestScore = 0.3;
    }
  } else if (oos.length && bestScore < 0.8) {
    best = 'out_of_scope';
    bestMatched = oos;
    bestScore = 0.8;
  }

  const confidence = Math.min(0.99, Math.round(Math.min(bestScore / 1.6, 0.99) * 100) / 100);

  const DISPATCH_INTENTS: IntentCode[] = ['repair_report', 'complaint'];
  const suggestion = DISPATCH_INTENTS.includes(best)
    ? (() => {
        const r = classify(building, text);
        return { unit: r.unit, trade: r.trade, matched: r.matched };
      })()
    : null;

  return {
    intent: best,
    label: INTENT_LABELS[best],
    confidence,
    matched: Array.from(new Set(bestMatched)).slice(0, 6),
    entities: { room, building, phone, ticketNo: ticketMatch ? ticketMatch[0].toUpperCase() : null },
    suggestion,
    urgent: URGENT_KWS.some((k) => t.includes(k)),
  };
}

/**
 * 是否应当触发转人工
 *
 * 触发原则：仅在「无法解决」或「业主明确要人工/投诉」时转人工。
 * - human_handoff / complaint 意图、低分评价、多轮未解决：明确转人工。
 * - 升级投诉类兜底关键词（法律/诉讼/12345/住建等）：仅在问题尚未解决、且不是标准报修意图时触发，
 *   避免"正常报修文本里恰好出现这些字眼"被误判为需转人工（报修会生成工单即视为已闭环）。
 */
export function shouldHandoff(params: {
  intent: IntentCode;
  text: string;
  unresolvedRounds: number;
  resolved?: boolean;
  lowRating?: boolean;
}): { need: boolean; reason: string } {
  const { intent, text, unresolvedRounds, resolved, lowRating } = params;
  if (intent === 'human_handoff') return { need: true, reason: '业主主动要求人工服务' };
  if (intent === 'complaint') return { need: true, reason: '投诉/催办类问题，需人工介入' };
  if (lowRating) return { need: true, reason: '业主评价较低，触发服务升级' };
  if (unresolvedRounds >= 3) return { need: true, reason: '多轮沟通仍未解决，自动转人工' };
  // 升级投诉类兜底关键词。注意 12345 需加数字边界，避免命中手机号（如 138****0000）中的连续数字。
  const escalationRe = /(法律|诉讼|起诉|媒体|记者|投诉到|住建)/;
  const hotlineRe = /(?<!\d)12345(?!\d)/;
  if (!resolved && intent !== 'repair_report' && (escalationRe.test(text) || hotlineRe.test(text))) {
    return { need: true, reason: '涉及升级投诉渠道，需人工处理' };
  }
  return { need: false, reason: '' };
}
