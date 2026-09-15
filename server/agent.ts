/**
 * 维保智能客服 Agent：提示词编排、结构化输出解析、离线兜底应答
 */
import type { KbHit } from './knowledge.js';
import type { IntentResult } from './intent.js';
import { INTENT_LABELS } from './intent.js';

export const AGENT_NAME = '云小维';

export const BASE_SYSTEM_PROMPT = `你是「${AGENT_NAME}」——某开发商·示例住宅项目 A 地块维保中心的智能客服助理，服务对象是已交付入住的业主。

## 你的职责边界（严格遵守）
只处理两类事情：
1. **房屋质量问题报修**：受理报修、收集报修要素、判断责任单位与工种、生成工单、查询进度。
2. **维保常见问题解答**：质保期与保修范围、报修流程、上门服务规则、费用政策、验收回访、二次装修注意事项。

超出以上范围的问题（写代码、聊天、房价、法律咨询、其他项目等），礼貌说明"这超出了维保服务范围"，并把话题引导回维保事务。**绝不**编造项目政策、联系电话、价格或时间承诺。

## 回答原则
- 只依据【知识库参考】中的内容回答政策类问题。知识库没有覆盖的，明确说"这条我需要帮您转维保工程师确认"，不要猜。
- 语气亲切、专业、简洁。默认 150 字以内，条理用短列表，不要长篇大论。
- 涉及漏水、停电、燃气、门锁无法开启等紧急情况，先给应急止损步骤，再走报修流程。
- 责任单位与工种以【系统预判】为准，可以直接告诉业主，但要说明"最终以现场查勘为准"。

## 报修受理必须收集的 4 个要素
1. 楼栋-房号（如 7-2604）
2. 联系人称呼与手机号
3. 问题描述（部位 + 现象）
4. 方便上门的时间段

缺哪一项就自然地追问哪一项，**一次最多追问 2 项**，不要连珠炮。要素齐全后向业主复述确认，并告知已生成工单。

## 输出格式要求（非常重要）
正常回复业主之后，另起一行，输出一个机器读取的元信息块，格式严格如下（业主不会看到这段）：

<<<META
{"intent":"意图编码","resolved":true/false,"need_human":true/false,"handoff_reason":"","ticket":null 或 {"room":"","contact_name":"","contact_phone":"","description":"","trade":"","expect_time":""},"missing":["缺失要素"]}
META>>>

意图编码取值：repair_report | repair_progress | warranty_policy | service_process | complaint | human_handoff | greeting | out_of_scope
- ticket 仅在 4 个要素**全部齐全**时才输出对象，否则为 null，并在 missing 中列出还缺什么。
- need_human 在以下情况置 true：业主要求人工、投诉、你无法解答、连续多轮未解决。
- 元信息块必须是回复的最后一部分，前后不要加代码围栏。`;

/**
 * 构建每轮注入的上下文块（作为用户消息前缀发送，保证 resume 场景下依然生效）
 */
export function buildTurnContext(kbContext: string, intent: IntentResult, sessionBrief: string): string {
  const sug = intent.suggestion
    ? `责任单位：${intent.suggestion.unit}；工种：${intent.suggestion.trade}${intent.suggestion.matched ? `（命中关键词「${intent.suggestion.matched}」）` : '（按楼栋精装总包兜底）'}`
    : '（本轮无需派单）';

  return `## 【本轮上下文】
${sessionBrief}

## 【系统预判】
- 意图：${INTENT_LABELS[intent.intent]}（${intent.intent}，置信度 ${intent.confidence}）
- 紧急程度：${intent.urgent ? '紧急，优先给应急处理步骤' : '常规'}
- 已识别要素：房号=${intent.entities.room || '未知'}，电话=${intent.entities.phone || '未知'}，工单号=${intent.entities.ticketNo || '无'}
- 派单建议：${sug}

## 【知识库参考】
${kbContext}`;
}

// ============= 结构化元信息解析 =============
export interface AgentMeta {
  intent?: string;
  resolved?: boolean;
  need_human?: boolean;
  handoff_reason?: string;
  ticket?: {
    room?: string;
    contact_name?: string;
    contact_phone?: string;
    description?: string;
    trade?: string;
    expect_time?: string;
  } | null;
  missing?: string[];
}

const META_RE = /<<<META\s*([\s\S]*?)\s*META>>>/;

/** 从模型输出中剥离元信息块 */
export function splitMeta(raw: string): { text: string; meta: AgentMeta | null } {
  const m = raw.match(META_RE);
  if (!m) {
    // 容错：模型可能用 ```json 包裹
    const fence = raw.match(/```json\s*({[\s\S]*?"intent"[\s\S]*?})\s*```/);
    if (fence) {
      try {
        return { text: raw.replace(fence[0], '').trim(), meta: JSON.parse(fence[1]) as AgentMeta };
      } catch {
        return { text: raw, meta: null };
      }
    }
    return { text: raw, meta: null };
  }
  let meta: AgentMeta | null = null;
  try {
    meta = JSON.parse(m[1]) as AgentMeta;
  } catch {
    meta = null;
  }
  return { text: raw.replace(m[0], '').trim(), meta };
}

/** 流式过程中判断当前缓冲区是否已进入 META 区域，用于避免把元信息推给前端 */
export function stripMetaStreaming(buffer: string): { visible: string; rest: string } {
  const idx = buffer.indexOf('<<<');
  if (idx === -1) {
    // 末尾可能是 "<" 或 "<<"，先扣住
    const tail = buffer.match(/<{1,2}$/);
    if (tail) return { visible: buffer.slice(0, buffer.length - tail[0].length), rest: tail[0] };
    return { visible: buffer, rest: '' };
  }
  return { visible: buffer.slice(0, idx), rest: buffer.slice(idx) };
}

// ============= 离线兜底 =============
/**
 * SDK 不可用时的本地应答：基于知识库检索 + 意图模板
 */
export function offlineAnswer(intent: IntentResult, hits: KbHit[], userText: string): { text: string; meta: AgentMeta } {
  const room = intent.entities.room;
  const phone = intent.entities.phone;

  if (intent.intent === 'human_handoff' || intent.intent === 'complaint') {
    return {
      text: `非常抱歉给您带来困扰${room ? `（${room}）` : ''}。我已为您登记，将转由维保工程师人工跟进，24 小时内专人回电。\n\n为便于联系，请补充：\n1. 联系人称呼与手机号${phone ? `（已记录 ${phone}）` : ''}\n2. 方便接听电话的时间段`,
      meta: { intent: intent.intent, resolved: false, need_human: true, handoff_reason: intent.intent === 'complaint' ? '投诉催办' : '业主要求人工', ticket: null, missing: phone ? [] : ['contact_phone'] },
    };
  }

  if (intent.intent === 'out_of_scope') {
    return {
      text: '不好意思，这个问题超出了维保服务范围哦。我可以帮您处理房屋质量报修、查询维修进度、解答质保政策等问题，有需要随时说～',
      meta: { intent: 'out_of_scope', resolved: true, need_human: false, ticket: null, missing: [] },
    };
  }

  if (intent.intent === 'greeting') {
    return {
      text: `您好，我是示例住宅项目维保中心智能客服${AGENT_NAME} 🔧\n\n我可以帮您：\n· 受理房屋质量报修（自动派单到责任单位）\n· 查询维修进度\n· 解答质保期、上门规则、费用政策\n\n请直接描述您遇到的问题，最好带上楼栋-房号。`,
      meta: { intent: 'greeting', resolved: true, need_human: false, ticket: null, missing: [] },
    };
  }

  if (intent.intent === 'repair_report') {
    const missing: string[] = [];
    if (!room) missing.push('room');
    if (!phone) missing.push('contact_phone');
    const sug = intent.suggestion;
    const head = intent.urgent
      ? '这属于紧急类问题，请先做应急处理：关闭对应区域阀门/电源，移开家具家电，拍照留证。\n\n'
      : '';
    if (missing.length) {
      return {
        text: `${head}已初步识别为${sug ? `【${sug.trade}】类问题，预计责任单位为 ${sug.unit}` : '房屋质量问题'}（最终以现场查勘为准）。\n\n为尽快派单，还需要您提供：\n${!room ? '1. 楼栋-房号（如 7-2604）\n' : ''}${!phone ? `${!room ? '2' : '1'}. 联系人称呼与手机号\n` : ''}`,
        meta: { intent: 'repair_report', resolved: false, need_human: false, ticket: null, missing },
      };
    }
    return {
      text: `${head}好的，已为您登记报修：\n· 房号：${room}\n· 联系电话：${phone}\n· 问题：${userText.slice(0, 60)}\n· 派单：${sug?.unit ?? '待分类'} · ${sug?.trade ?? '待定'}\n\n工单已生成，施工单位会在 24 小时内联系您预约上门。请问您方便的时间段是？`,
      meta: {
        intent: 'repair_report', resolved: true, need_human: false,
        ticket: {
          room: room ?? undefined,
          contact_phone: phone ?? undefined,
          description: userText.slice(0, 120),
          trade: sug?.trade ?? '待定',
        },
        missing: [],
      },
    };
  }

  if (hits.length) {
    const top = hits[0];
    const more = hits.slice(1, 3).map((h) => `· ${h.question}`).join('\n');
    return {
      text: `${top.answer}${more ? `\n\n您可能还想了解：\n${more}` : ''}`,
      meta: { intent: intent.intent, resolved: true, need_human: false, ticket: null, missing: [] },
    };
  }

  return {
    text: '这个问题我暂时没有把握回答准确，已为您登记，稍后由维保工程师人工跟进。您也可以补充更多细节，我再帮您看看。',
    meta: { intent: intent.intent, resolved: false, need_human: true, handoff_reason: '知识库未覆盖', ticket: null, missing: [] },
  };
}
