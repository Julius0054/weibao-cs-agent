/**
 * 演示数据：让管理后台一打开就有可看的统计
 */
import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';
import { detectIntent } from './intent.js';
import { classify } from './classify.js';

interface DemoTurn { user: string; bot: string }
interface DemoCase {
  room: string;
  name: string;
  phone: string;
  daysAgo: number;
  turns: DemoTurn[];
  rating?: number;
  handoff?: string;
  ticket?: { description: string; expect: string };
}

const CASES: DemoCase[] = [
  {
    room: '7-2604', name: '张先生', phone: '138****0000', daysAgo: 0,
    turns: [
      { user: '你好，7-2604 主卧墙面有一道裂缝，越来越明显了', bot: '您好，已记录 7-2604 主卧墙面开裂问题。这类问题多为抹灰层温度裂缝，属精装总包保修范围。2/7 栋精装总包为门窗分包，工种：墙面/油漆。\n方便留个手机号和上门时间段吗？我这边直接派单。' },
      { user: '138****0000，周六上午都可以', bot: '好的，工单已生成：\n· 房号：7-2604\n· 问题：主卧墙面开裂\n· 派单：门窗分包 · 墙面\n· 上门：周六上午\n施工单位会在 24 小时内与您电话确认，最终以现场查勘为准。' },
    ],
    rating: 5,
    ticket: { description: '主卧墙面出现裂缝，逐渐扩大', expect: '周六上午' },
  },
  {
    room: '1-1802', name: '李女士', phone: '138****0000', daysAgo: 1,
    turns: [
      { user: '房子保修期是几年啊？卫生间防水这块', bot: '按《建设工程质量管理条例》及购房合同：有防水要求的卫生间防渗漏保修期为 5 年，自交付之日起算。装修工程 2 年，给排水管道及设备安装 2 年。具体以您《住宅质量保证书》为准。' },
      { user: '明白了谢谢', bot: '不客气～有房屋质量问题随时找我，我可以直接受理报修并派单。' },
    ],
    rating: 5,
  },
  {
    room: '2-0903', name: '王先生', phone: '138****0000', daysAgo: 1,
    turns: [
      { user: '厨房水槽下面一直在滴水，地板都泡了', bot: '这属于紧急类，请先做应急处理：\n1. 关闭水槽下方角阀；\n2. 移开柜内物品，擦干积水；\n3. 拍照留证。\n水槽本体归厨柜分包（橱柜），若为下水管接口渗漏则归精装总包。请提供房号和联系电话，我按紧急工单派单，2 小时内响应。' },
      { user: '2-0903，138****0000', bot: '已生成紧急工单：\n· 房号：2-0903\n· 问题：厨房水槽下方渗漏\n· 派单：厨柜分包 · 橱柜（现场如判定为管道问题转门窗分包）\n维修人员会在 2 小时内联系您。' },
    ],
    rating: 4,
    ticket: { description: '厨房水槽下方持续滴水，地板受潮', expect: '尽快' },
  },
  {
    room: '10-1105', name: '陈女士', phone: '138****0000', daysAgo: 2,
    turns: [
      { user: '智能锁指纹总是识别不了，还老提示电量低', bot: '先按这两步处理：\n1. 更换 5 号碱性电池（不要用充电电池）；\n2. 重新录入指纹，录入时手指保持干燥、多角度按压。\n若仍无法识别，属锁体故障，责任单位为智能锁分包，工种：入户门。需要我帮您报修吗？' },
      { user: '要的，10-1105，138****0000，工作日下午在家', bot: '工单已生成：\n· 房号：10-1105\n· 问题：智能锁指纹识别失败、电量异常\n· 派单：智能锁分包 · 入户门\n· 上门：工作日下午\n智能锁分包售后会先电话联系您确认。' },
    ],
    rating: 5,
    ticket: { description: '智能锁指纹识别失败，频繁提示电量不足', expect: '工作日下午' },
  },
  {
    room: '4-0601', name: '刘先生', phone: '138****0000', daysAgo: 3,
    turns: [
      { user: '我上周报的地板起拱到现在没人来，怎么回事', bot: '非常抱歉让您久等。地板问题责任单位为地板分包，正常应在 3 个工作日内预约上门。我已将此工单标记为催办并升级至维保工程师人工跟进，24 小时内会有专人回电向您说明。' },
    ],
    handoff: '投诉催办：地板报修超期未上门',
    rating: 2,
  },
  {
    room: '5-1503', name: '赵女士', phone: '138****0000', daysAgo: 4,
    turns: [
      { user: '维修师傅上门我必须在家吗？我白天要上班', bot: '不用一直在家，三种方式任选：\n1. 约晚间或周末，您在家；\n2. 留门锁临时密码，我们全程录像留证，完工发照片视频给您；\n3. 告知方便时段，我们重新排期。\n维修人员均双人上门、佩戴工牌，进出拍照记录。' },
      { user: '那我留密码吧', bot: '好的，请在维修人员电话联系时直接告知临时密码，建议维修完成后及时修改。我已在工单备注"留密码上门，需录像留证"。' },
    ],
    rating: 5,
  },
  {
    room: '3-2201', name: '孙先生', phone: '138****0000', daysAgo: 6,
    turns: [
      { user: '空调出风口一直滴水，滴到地板上了', bot: '出风口凝露多因室内湿度高、送风温度设定过低。请先将设定温度调高 2-3℃，并检查滤网是否需要清洗。\n若持续滴水，责任单位为国网，工种：空调。需要我帮您报修吗？' },
      { user: '调过了还是滴，报修吧 3-2201 138****0000', bot: '工单已生成：\n· 房号：3-2201\n· 问题：空调出风口凝露滴水\n· 派单：国网 · 空调\n国网售后 24 小时内联系您预约。' },
    ],
    rating: 4,
    ticket: { description: '空调出风口凝露滴水，已调高设定温度无改善', expect: '工作日' },
  },
  {
    room: '6-0808', name: '周女士', phone: '138****0000', daysAgo: 8,
    turns: [
      { user: '我想把阳台和客厅之间的墙砸了，可以吗', bot: '这类改造需要非常谨慎：严禁拆改承重墙、剪力墙、梁柱及构造柱。阳台与客厅之间的墙体多数为承重结构或配重墙，擅自拆改会影响结构安全，并导致该部位及相关联部位**不再享受保修**。\n建议装修前到物业办理装修登记备案，由结构工程师现场确认。' },
      { user: '那算了，还是不动了', bot: '这是稳妥的选择～二次装修如需破坏防水层，记得重做闭水试验。有其他维保问题随时找我。' },
    ],
    rating: 5,
  },
  {
    room: '1-0502', name: '吴先生', phone: '138****0000', daysAgo: 10,
    turns: [
      { user: '烟感半夜一直响，吵死了，我把它拆了行不行', bot: '请不要自行拆除，烟感属消防设施，擅自拆除有安全风险且需恢复。\n临时处理：确认无火情后，按住烟感中央按钮 3-5 秒消音。频繁误报通常是探头积灰或元件老化，需更换。\n责任单位为智能化分包，工种：烟感。要我帮您报修吗？' },
      { user: '报吧 1-0502 138****0000', bot: '工单已生成：\n· 房号：1-0502\n· 问题：烟感频繁误报\n· 派单：智能化分包 · 烟感\n智能化分包会尽快联系您上门检测更换。' },
    ],
    rating: 4,
    ticket: { description: '烟感夜间频繁误报', expect: '尽快' },
  },
  {
    room: '7-1201', name: '郑女士', phone: '138****0000', daysAgo: 12,
    turns: [
      { user: '我要找人工，跟机器人说不清楚', bot: '好的，已为您登记人工服务需求，维保工程师会在 24 小时内回电。为便于联系，请告知您的房号、称呼和方便接听的时间段。' },
      { user: '7-1201 郑女士 晚上6点后', bot: '已记录：7-1201 郑女士，方便时间晚上 6 点后。留言已提交至维保中心，请保持电话畅通。' },
    ],
    handoff: '业主主动要求人工服务',
    rating: 3,
  },
];

export function seedDemoData(force = false): number {
  if (!force && db.getAllSessions().length > 0) return 0;

  let created = 0;
  for (const c of CASES) {
    const base = new Date();
    base.setDate(base.getDate() - c.daysAgo);
    base.setHours(9 + (created % 8), 20 + (created % 30), 0, 0);

    const sessionId = uuidv4();
    const createdAt = base.toISOString();
    const lastIntent = detectIntent(c.turns[c.turns.length - 1].user);

    db.createSession({
      id: sessionId,
      title: c.turns[0].user.slice(0, 24),
      model: 'claude-sonnet-4',
      room: c.room,
      customer_name: c.name,
      customer_phone: c.phone,
      status: c.handoff ? 'handoff' : 'closed',
      last_intent: lastIntent.intent,
      resolved: c.handoff ? 0 : 1,
      created_at: createdAt,
      updated_at: createdAt,
    });

    c.turns.forEach((turn, i) => {
      const ts = new Date(base.getTime() + i * 90_000).toISOString();
      const it = detectIntent(turn.user);
      db.createMessage({
        id: uuidv4(), session_id: sessionId, role: 'user', content: turn.user,
        created_at: ts, intent: it.intent, intent_label: it.label, confidence: it.confidence,
      });
      db.createMessage({
        id: uuidv4(), session_id: sessionId, role: 'assistant', content: turn.bot,
        model: 'claude-sonnet-4', created_at: new Date(base.getTime() + i * 90_000 + 4000).toISOString(),
        intent: it.intent, intent_label: it.label, confidence: it.confidence,
        needs_human: c.handoff ? 1 : 0, latency_ms: 1200 + ((created * 137) % 2600),
      });
    });

    if (c.ticket) {
      const building = parseInt(c.room.split('-')[0], 10);
      const cls = classify(building, c.ticket.description);
      db.createTicket({
        id: uuidv4(),
        ticket_no: db.nextTicketNo(),
        session_id: sessionId,
        room: c.room,
        contact_name: c.name,
        contact_phone: c.phone,
        trade: cls.trade,
        unit: cls.unit,
        description: c.ticket.description,
        expect_time: c.ticket.expect,
        status: c.daysAgo > 5 ? 'done' : c.daysAgo > 2 ? 'assigned' : 'pending',
        created_at: createdAt,
        updated_at: createdAt,
      });
    }

    if (c.handoff) {
      db.createHandoff({
        id: uuidv4(),
        session_id: sessionId,
        reason: c.handoff,
        summary: c.turns.map((t) => t.user).join(' / ').slice(0, 200),
        contact_name: c.name,
        contact_phone: c.phone,
        message: null,
        status: c.daysAgo > 8 ? 'closed' : 'pending',
        reply: c.daysAgo > 8 ? '已电话回访，业主认可处理结果' : null,
        created_at: createdAt,
        handled_at: c.daysAgo > 8 ? createdAt : null,
      });
    }

    if (c.rating) {
      db.createFeedback({
        id: uuidv4(),
        session_id: sessionId,
        message_id: null,
        rating: c.rating,
        thumb: c.rating >= 4 ? 'up' : 'down',
        comment: c.rating <= 2 ? '响应太慢，报修一周没人来' : c.rating === 3 ? '问题没完全解决' : null,
        created_at: createdAt,
      });
    }

    created++;
  }
  return created;
}
