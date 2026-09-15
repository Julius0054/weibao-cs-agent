/**
 * FAQ 知识库：种子数据 + 中文检索（bigram + 关键词加权）
 */
import * as db from './db.js';
import type { DbFaq } from './db.js';

export interface SeedFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string;
  unit?: string;
  trade?: string;
}

export const SEED_FAQS: SeedFaq[] = [
  {
    id: 'faq-001', category: '报修流程',
    question: '房屋出现质量问题，怎么报修？',
    answer: '三种方式任选：\n1. 本智能客服直接描述问题（推荐，可自动生成工单）；\n2. 拨打维保中心热线，工作日 8:30-17:30；\n3. 前往 A 地块维保服务点现场登记。\n\n报修时请提供：**楼栋-房号**、**联系电话**、**问题描述**（有照片更佳）、**方便上门的时间**。',
    keywords: '报修,怎么报修,如何报修,维修申请,报事报修,登记,提交',
  },
  {
    id: 'faq-002', category: '报修流程',
    question: '报修后多久有人上门？',
    answer: '标准时效：\n- **紧急类**（漏水、停电、燃气、锁具无法开启）：2 小时内响应，24 小时内到场；\n- **一般类**（墙面、门窗、柜体、地板等）：24 小时内联系业主，3 个工作日内预约上门；\n- **需订货/定制件**（玻璃、台面、门扇等）：确认后 7-15 个工作日。\n\n上门前维修人员会电话联系确认时间。',
    keywords: '多久上门,响应时间,时效,几天,什么时候来,上门时间,预约',
  },
  {
    id: 'faq-003', category: '质保政策',
    question: '房屋各部位的保修期是多久？',
    answer: '按《建设工程质量管理条例》及购房合同约定：\n- 地基基础与主体结构：设计文件规定的合理使用年限\n- 屋面防水、有防水要求的卫生间/房间/外墙面防渗漏：**5 年**\n- 供热与供冷系统：**2 个采暖期、供冷期**\n- 电气管线、给排水管道、设备安装：**2 年**\n- 装修工程：**2 年**\n\n保修期自交付之日起算，具体以购房合同《住宅质量保证书》为准。',
    keywords: '保修期,质保,几年,多久,保修范围,质保期,包修',
  },
  {
    id: 'faq-004', category: '质保政策',
    question: '哪些情况不在保修范围内？',
    answer: '以下情形不属于工程质保范围：\n1. 业主自行装修、改造、拆改造成的损坏（含拆改承重墙、防水层破坏）；\n2. 使用不当或人为损坏（如重物撞击、私接电器超负荷）；\n3. 不可抗力（地震、台风、洪水等）；\n4. 正常损耗（灯泡、密封胶条老化、五金件磨损）；\n5. 已超过对应部位保修期限。\n\n此类维修可付费委托，我们可协助联系施工单位报价。',
    keywords: '不保修,不在范围,免责,自费,人为损坏,过保,超期',
  },
  {
    id: 'faq-005', category: '常见故障',
    question: '家里发现漏水/渗水怎么办？',
    answer: '**先止损，再报修**：\n1. 立即关闭对应区域进水阀门（厨房、卫生间角阀，或入户总阀）；\n2. 断开受影响区域电源，避免漏电；\n3. 用容器接水、移开家具家电；\n4. 拍照留证后立即报修，注明"漏水紧急"。\n\n我们按紧急类处理，2 小时内响应。若已影响楼下住户，请同时告知，便于一并安排查勘。',
    keywords: '漏水,渗水,滴水,水管爆裂,天花板漏水,卫生间漏水,厨房漏水,紧急',
    unit: '待现场判定', trade: '水电/防水',
  },
  {
    id: 'faq-006', category: '常见故障',
    question: '墙面开裂、空鼓、掉漆怎么处理？',
    answer: '**墙面开裂**分两类：\n- 抹灰层温度裂缝/腻子开裂：属精装总包保修范围，铲除后重新修补找平、打磨、刷涂料；\n- 结构性裂缝（贯穿、斜向、伴随楼板裂缝）：需土建单位现场查勘鉴定。\n\n**空鼓**：敲击有空响，面积超过标准需铲除重做。\n\n报修时请拍摄清晰照片（含裂缝全貌与近景），并说明具体房间位置。',
    keywords: '墙面开裂,裂缝,空鼓,掉漆,起皮,发霉,墙皮脱落,乳胶漆,腻子',
    trade: '墙面/油漆',
  },
  {
    id: 'faq-007', category: '常见故障',
    question: '智能锁打不开 / 提示电量不足怎么办？',
    answer: '**应急处理**：\n1. 电量不足：用充电宝通过锁体下方 Type-C 应急供电口临时供电后开门，随后更换 5 号碱性电池（不要用充电电池）；\n2. 指纹失灵：改用密码或机械钥匙；干燥、脱皮的手指建议重新录入指纹；\n3. 完全无响应：请勿反复强行拧动，立即报修。\n\n入户门及智能锁责任单位为 **智能锁分包**，工种：入户门。',
    keywords: '智能锁,门锁,打不开,没电,指纹,密码锁,入户门,锁具,智能锁分包',
    unit: '智能锁分包', trade: '入户门',
  },
  {
    id: 'faq-008', category: '常见故障',
    question: '可视对讲 / 智能面板无法使用？',
    answer: '先自查：\n1. 检查弱电箱内电源是否被误关；\n2. 面板黑屏可长按重启键 10 秒复位；\n3. 单元门口机呼叫无响应，可能为单元主机故障，属公共部位。\n\n户内智能面板、可视对讲责任单位为 **智能化分包**，工种：智能面板。报修时请说明是户内面板还是单元门口机。',
    keywords: '可视对讲,智能面板,门禁,对讲,黑屏,呼叫,智能家居,智能化分包',
    unit: '智能化分包', trade: '智能面板',
  },
  {
    id: 'faq-009', category: '常见故障',
    question: '地板起拱、有异响、缝隙大怎么办？',
    answer: '常见原因：\n- **起拱/鼓包**：受潮或伸缩缝预留不足，需排查是否有渗水源；\n- **异响**：地垫不平、龙骨松动或锁扣咬合不到位；\n- **缝隙**：季节性干缩属正常现象，超过 1mm 且持续扩大需处理。\n\n地板、踢脚线责任单位为 **地板分包**，工种：地板。请注明房间与具体位置，维修人员会带专用工具上门。',
    keywords: '地板,起拱,鼓包,异响,响声,缝隙,踢脚线,木地板,地板分包',
    unit: '地板分包', trade: '地板',
  },
  {
    id: 'faq-010', category: '常见故障',
    question: '橱柜门变形、台面开裂、水槽漏水？',
    answer: '**橱柜本体**（柜门、铰链、抽屉、台面、水槽）责任单位为 **厨柜分包**，工种：橱柜。\n**注意区分**：\n- 柜体周边墙缝、收口打胶 → 归精装总包；\n- 油烟机、灶具、洗碗机 → 归 **滁州志鹏**（厨电）；\n- 厨房灯带 → 归 **欧派厨柜**（灯带）。\n\n报修时描述越具体，派单越准确。',
    keywords: '橱柜,厨柜,柜门,台面,水槽,吊柜,地柜,变形,开裂,厨柜分包',
    unit: '厨柜分包', trade: '橱柜',
  },
  {
    id: 'faq-011', category: '常见故障',
    question: '户内门关不上、门吸松动、门套开裂？',
    answer: '厨房门、卫生间门、卧室门等**户内门本体**（含门框、门套、门吸、合页、移门）责任单位为 **木门柜体分包**，工种：户内门。\n\n若是门周边墙面不平、收口缝隙，则归各栋精装总包处理。入户门（大门）属 **智能锁分包**，不要混淆。',
    keywords: '户内门,卧室门,卫生间门,厨房门,门套,门吸,合页,推拉门,关不上,木门柜体分包',
    unit: '木门柜体分包', trade: '户内门',
  },
  {
    id: 'faq-012', category: '常见故障',
    question: '马桶冲水不畅、花洒漏水、龙头损坏？',
    answer: '**洁具本体质量问题**（马桶冲水无力/破裂、花洒本体漏水、龙头锈蚀、淋浴屏）责任单位为 **海帛丽**，工种：淋浴屏/洁具。\n\n**但是**：马桶安装不牢固/松动、花洒安装歪斜，属"安装不到位"，归各栋精装总包。\n\n请在描述中说明是"用不了"还是"装歪了/松动"，我们据此派单。',
    keywords: '马桶,坐便器,花洒,龙头,淋浴屏,淋浴房,冲水,漏水,洁具,海帛丽',
    unit: '海帛丽', trade: '淋浴屏/洁具',
  },
  {
    id: 'faq-013', category: '常见故障',
    question: '空调不制冷、出风口滴水、有异响？',
    answer: '中央空调（含回风口、出风口百叶）责任单位为 **国网**，工种：空调。\n\n自查建议：\n1. 确认模式与设定温度是否正确、滤网是否需清洗；\n2. 出风口凝露多因湿度高或送风温度过低，可先调高设定温度；\n3. 空调周边收口、缝隙问题归精装总包。\n\n新风系统单独由 **杭州三角洲** 负责（新风工种）。',
    keywords: '空调,不制冷,不制热,滴水,凝露,出风口,回风口,异响,国网,新风',
    unit: '国网', trade: '空调',
  },
  {
    id: 'faq-014', category: '常见故障',
    question: '地暖不热 / 锅炉报错怎么办？',
    answer: '地暖、分水器、锅炉责任单位为 **港华**，工种：地暖/锅炉。\n\n自查步骤：\n1. 检查分水器各回路阀门是否全开；\n2. 查看锅炉压力表，正常为 1.0-1.5bar，过低需补水；\n3. 记录锅炉显示的故障代码，报修时一并告知，可加快处理。\n\n采暖期内属紧急类，我们优先安排。',
    keywords: '地暖,不热,锅炉,分水器,采暖,供暖,报错,故障代码,港华',
    unit: '港华', trade: '地暖/锅炉',
  },
  {
    id: 'faq-015', category: '常见故障',
    question: '窗户渗水、玻璃划痕、把手损坏？',
    answer: '**系统门窗本体**（玻璃划痕、把手损坏、窗扇变形、窗户渗水、型材问题）责任单位为 **精装总包A**，工种：门窗。\n\n**注意**：窗框周边收口、打胶、窗台石属精装总包，不归精装总包A。\n\n外墙、外窗保洁（玻璃未清洁、外窗污染）同样由 **精装总包A** 负责，工种：保洁。',
    keywords: '窗户,玻璃,划痕,把手,窗扇,渗水,型材,外窗,门窗,精装总包A',
    unit: '精装总包A', trade: '门窗',
  },
  {
    id: 'faq-016', category: '常见故障',
    question: '烟感报警器误报、一直响怎么处理？',
    answer: '烟感、报警器、手报按钮责任单位为 **智能化分包**，工种：烟感。\n\n临时处理：\n1. 确认无真实火情后，按住烟感中央按钮 3-5 秒消音；\n2. 厨房油烟、浴室水汽易造成误报，做饭洗澡时注意通风；\n3. 频繁误报可能是探头积灰或元件老化，需更换。\n\n**请勿自行拆除烟感**，属消防设施。',
    keywords: '烟感,报警器,误报,一直响,消防,手报,警报,智能化分包',
    unit: '智能化分包', trade: '烟感',
  },
  {
    id: 'faq-017', category: '上门服务',
    question: '维修上门时业主必须在家吗？',
    answer: '三种配合方式，任选其一：\n1. **业主在家**：约定时间，维修人员上门时电话联系；\n2. **留密码**：告知门锁临时密码，我们全程录像留证，完工后发送照片与视频；\n3. **不方便**：告知您方便的时间段，我们重新排期。\n\n为保障您的财产安全，维修人员均佩戴工牌、双人上门，进门前后拍照记录。',
    keywords: '在家,上门,密码,不方便,配合,预约,时间,业主,门锁密码',
  },
  {
    id: 'faq-018', category: '上门服务',
    question: '维修完成后怎么验收？会回访吗？',
    answer: '流程如下：\n1. 维修完成后请现场确认效果，在《维修回执单》签字；\n2. 若不在现场，我们会将完工照片发给您确认；\n3. 完工 3 个工作日内维保中心电话回访，请为本次服务打分（1-5 星）；\n4. 同一问题 30 天内复发，可直接申请返修，不计入新工单。\n\n您也可以在本对话结束时直接评价，评分会进入我们的服务考核。',
    keywords: '验收,回访,评价,打分,签字,回执,完工,满意度,返修',
  },
  {
    id: 'faq-019', category: '上门服务',
    question: '维修费用谁承担？会不会乱收费？',
    answer: '**保修期内、属工程质量问题的维修，全部免费**，包括人工与材料。\n\n以下情况需业主承担费用：\n- 人为损坏、使用不当造成的损坏；\n- 已过保修期的维修；\n- 业主二次装修引发的问题。\n\n**任何维修人员均不得现场收取现金**。如遇索要费用，请立即拒绝并向维保中心举报。',
    keywords: '费用,收费,免费,多少钱,付费,收钱,材料费,人工费,乱收费',
  },
  {
    id: 'faq-020', category: '进度查询',
    question: '我的报修进度怎么查？',
    answer: '提供 **工单号** 或 **楼栋-房号 + 联系电话**，我可以为您查询当前状态。\n\n工单状态说明：\n- `待派单`：已受理，正在确认责任单位；\n- `已派单`：施工单位已接单，将联系您预约；\n- `处理中`：维修进行中或等待材料到货；\n- `已完成`：已完工并回访。\n\n工单号格式如 BX20260805001。',
    keywords: '进度,查询,工单,到哪一步,处理了吗,状态,什么时候修,催',
  },
  {
    id: 'faq-021', category: '投诉建议',
    question: '对维修服务不满意，怎么投诉？',
    answer: '我们重视每一条反馈：\n1. 在本对话中直接说明情况，我会立即生成投诉工单并转维保负责人；\n2. 或在服务评价中打 1-2 星并填写原因，系统自动触发升级处理；\n3. 投诉受理后 24 小时内由维保工程师专人回电。\n\n请尽量提供：工单号、维修日期、维修人员姓名、具体问题。',
    keywords: '投诉,不满意,态度差,没解决,反复维修,升级,催办,举报',
  },
  {
    id: 'faq-022', category: '装修改造',
    question: '想二次装修 / 拆改，有什么注意事项？',
    answer: '**严禁事项**：\n1. 拆改承重墙、剪力墙、梁柱及构造柱；\n2. 破坏卫生间、阳台防水层（如需改造须重做闭水试验）；\n3. 改动公共管道、消防设施（烟感、喷淋）；\n4. 阳台封闭改变外立面。\n\n**重要提示**：擅自拆改导致的质量问题将**不再享受保修**，且需承担修复责任。装修前请到物业办理装修登记备案。',
    keywords: '装修,二次装修,拆改,承重墙,改造,砸墙,防水层,备案',
  },
  {
    id: 'faq-023', category: '报修流程',
    question: '一次可以报多个问题吗？',
    answer: '可以。请**逐条描述**，例如：\n"7-2604：① 主卧墙面开裂；② 厨房橱柜门关不严；③ 卫生间马桶冲水无力"\n\n系统会按问题拆分为多张工单，分别派给对应责任单位（上例分别为精装总包、厨柜分包、海帛丽），各自独立跟踪进度，互不影响。',
    keywords: '多个问题,几个,一起报,批量,多条,同时',
  },
  {
    id: 'faq-024', category: '质保政策',
    question: '责任单位是怎么划分的？为什么不是物业修？',
    answer: '交付后质保期内的工程问题，由**原施工单位**负责维修，维保中心负责受理、派单、跟踪、验收。\n\nA 地块划分原则：\n1. **专业分包优先**：门、柜、地板、洁具、空调等由各专业厂家负责；\n2. **精装总包兜底**：墙面、油漆、收口打胶、户内水电等通用精装问题，按楼栋归属（1栋精装总包B，2/7栋门窗分包，3/4/5栋湖南一建，6/10栋精装总包A精装）；\n3. **精装总包A跨栋**：全楼栋门窗、土建结构、公区水电、外墙外窗保洁。\n\n您无需自己判断，描述问题即可，我会自动识别。',
    keywords: '责任单位,谁负责,谁来修,施工单位,分包,总包,物业,派单',
  },
];

/** 初始化：库为空时写入种子数据 */
export function seedIfEmpty(): number {
  if (db.countFaqs() > 0) return 0;
  const now = new Date().toISOString();
  SEED_FAQS.forEach((f) => {
    db.upsertFaq({
      id: f.id,
      category: f.category,
      question: f.question,
      answer: f.answer,
      keywords: f.keywords,
      unit: f.unit ?? null,
      trade: f.trade ?? null,
      hit_count: 0,
      enabled: 1,
      created_at: now,
      updated_at: now,
    });
  });
  return SEED_FAQS.length;
}

// ============= 检索 =============

const STOP_CHARS = /[\s，。、？！；：""''（）()《》【】,.\?!;:~·\-—_+=*&%$#@|\\/\[\]{}0-9a-zA-Z]/g;

function bigrams(text: string): string[] {
  const clean = (text || '').replace(STOP_CHARS, '');
  const out: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2));
  if (clean.length === 1) out.push(clean);
  return out;
}

function overlap(a: string[], b: Set<string>): number {
  if (!a.length) return 0;
  let n = 0;
  for (const g of a) if (b.has(g)) n++;
  return n / a.length;
}

export interface KbHit {
  id: string;
  question: string;
  answer: string;
  category: string;
  unit?: string | null;
  trade?: string | null;
  score: number;
}

/**
 * 检索 FAQ
 * @param queryText 用户提问
 * @param topK 返回条数
 * @param threshold 相关性阈值
 */
export function searchFaqs(queryText: string, topK = 3, threshold = 0.12): KbHit[] {
  const faqs = db.listFaqs({ onlyEnabled: true });
  if (!faqs.length) return [];

  const qGrams = bigrams(queryText);
  const qSet = new Set(qGrams);
  const qRaw = (queryText || '').toLowerCase();

  const scored = faqs.map((f: DbFaq) => {
    // 1) 关键词命中（权重最高）
    const kws = (f.keywords || '').split(',').map((k) => k.trim()).filter(Boolean);
    let kwScore = 0;
    for (const kw of kws) {
      if (kw && qRaw.includes(kw.toLowerCase())) kwScore += kw.length >= 3 ? 0.28 : 0.18;
    }
    kwScore = Math.min(kwScore, 0.75);

    // 2) 问题字面相似
    const qsGrams = bigrams(f.question);
    const qsSet = new Set(qsGrams);
    const simQ = (overlap(qGrams, qsSet) + overlap(qsGrams, qSet)) / 2;

    // 3) 答案覆盖（弱权重）
    const ansSet = new Set(bigrams(f.answer));
    const simA = overlap(qGrams, ansSet);

    // 4) 分类命中
    const catBonus = qRaw.includes(f.category) ? 0.1 : 0;

    const score = kwScore + simQ * 0.9 + simA * 0.25 + catBonus;
    return {
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category,
      unit: f.unit,
      trade: f.trade,
      score: Math.round(score * 1000) / 1000,
    } as KbHit;
  });

  return scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 把检索结果拼成注入提示词的上下文 */
export function buildKbContext(hits: KbHit[]): string {
  if (!hits.length) return '（本次未检索到高相关的知识库条目）';
  return hits
    .map((h, i) => `【知识条目${i + 1}｜${h.category}｜相关度${h.score}】\nQ: ${h.question}\nA: ${h.answer}`)
    .join('\n\n');
}
