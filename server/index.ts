import express from 'express';
import { query, unstable_v2_authenticate, unstable_v2_createSession, PermissionResult, CanUseTool } from '@tencent-ai/agent-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';
import { seedIfEmpty, searchFaqs, buildKbContext, KbHit } from './knowledge.js';
import { detectIntent, shouldHandoff, INTENT_LABELS, IntentCode } from './intent.js';
import { classify, extractRoom, extractPhone } from './classify.js';
import { BASE_SYSTEM_PROMPT, buildTurnContext, splitMeta, offlineAnswer, AgentMeta, AGENT_NAME } from './agent.js';
import { seedDemoData } from './seed-demo.js';

// 轻量加载 .env（不引入 dotenv 依赖），仅填充尚未存在的变量，避免覆盖真实环境
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
function loadEnvFile() {
  const p = resolve(process.cwd(), '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] !== '' && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnvFile();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json({ limit: '2mb' }));

// internal 环境（中国区 CodeBuddy）账号不提供 claude-sonnet-4，需使用中文模型
// 实测可用：deepseek-v4-pro / hy3 / glm-5.2 等（由 CB_MODEL 覆盖）
const defaultModel = process.env.CB_MODEL || 'deepseek-v4-pro';
let cachedModels: Array<{ modelId: string; name: string }> = [];

// SDK 可用性：null=未探测, true/false=已知
let sdkAvailable: boolean | null = process.env.DEMO_OFFLINE === '1' ? false : null;

const seeded = seedIfEmpty();
if (seeded) console.log(`[KB] 已写入 ${seeded} 条 FAQ 种子数据`);

// ============= 基础 =============
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    agent: AGENT_NAME,
    sdkAvailable,
    offlineForced: process.env.DEMO_OFFLINE === '1',
    faqCount: db.countFaqs(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/check-login', async (_req, res) => {
  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const envConfigured = Boolean(apiKey || authToken);
  const out: Record<string, unknown> = {
    envConfigured,
    apiKey: apiKey ? `${apiKey.slice(0, 6)}****${apiKey.slice(-4)}` : null,
    isLoggedIn: false,
    mode: 'offline',
  };
  try {
    let needsLogin = false;
    const result = await unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async () => { needsLogin = true; },
    });
    if (!needsLogin) {
      out.isLoggedIn = true;
      out.mode = 'sdk';
      out.user = (result as { userinfo?: { userName?: string } })?.userinfo?.userName ?? null;
      sdkAvailable = process.env.DEMO_OFFLINE === '1' ? false : true;
    } else {
      sdkAvailable = false;
    }
  } catch (e) {
    out.error = (e as Error)?.message;
    if (envConfigured) { out.isLoggedIn = true; out.mode = 'sdk'; }
    else sdkAvailable = false;
  }
  res.json(out);
});

app.get('/api/models', async (_req, res) => {
  try {
    if (!cachedModels.length) {
      const session = await unstable_v2_createSession({ cwd: process.cwd() });
      const models = await session.getAvailableModels();
      if (Array.isArray(models)) cachedModels = models as typeof cachedModels;
    }
    res.json({ models: cachedModels.length ? cachedModels : [{ modelId: defaultModel, name: 'Claude Sonnet 4' }], defaultModel });
  } catch {
    res.json({ models: [{ modelId: defaultModel, name: 'Claude Sonnet 4' }], defaultModel });
  }
});

// ============= 会话 =============
app.get('/api/sessions', (_req, res) => {
  const sessions = db.getAllSessions().map((s) => {
    const msgs = db.getMessagesBySession(s.id);
    const fbs = db.listFeedbacks(s.id);
    return {
      ...s,
      messageCount: msgs.length,
      lastMessage: msgs.length ? msgs[msgs.length - 1].content.slice(0, 40) : '',
      rating: fbs.length ? Math.round((fbs.reduce((a, b) => a + b.rating, 0) / fbs.length) * 10) / 10 : null,
    };
  });
  res.json({ sessions });
});

app.get('/api/sessions/:id', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: '会话不存在' });
  const messages = db.getMessagesBySession(req.params.id).map((m) => ({
    ...m,
    tool_calls: m.tool_calls ? safeJson(m.tool_calls) : null,
    kb_hits: m.kb_hits ? safeJson(m.kb_hits) : null,
  }));
  const feedbacks = db.listFeedbacks(req.params.id);
  res.json({ session, messages, feedbacks });
});

app.post('/api/sessions', (req, res) => {
  const now = new Date().toISOString();
  const session = db.createSession({
    id: uuidv4(),
    title: req.body?.title || '新的咨询',
    model: req.body?.model || defaultModel,
    room: req.body?.room ?? null,
    customer_name: req.body?.customerName ?? null,
    customer_phone: req.body?.customerPhone ?? null,
    created_at: now,
    updated_at: now,
  });
  res.json({ session });
});

app.patch('/api/sessions/:id', (req, res) => {
  const ok = db.updateSession(req.params.id, req.body || {});
  if (!ok) return res.status(404).json({ error: '会话不存在或无更新字段' });
  res.json({ success: true, session: db.getSession(req.params.id) });
});

app.delete('/api/sessions/:id', (req, res) => {
  const ok = db.deleteSession(req.params.id);
  if (!ok) return res.status(404).json({ error: '会话不存在' });
  res.json({ success: true });
});

// ============= 知识库检索（独立接口，供前端"命中详情"用）=============
app.get('/api/kb/search', (req, res) => {
  const q = String(req.query.q || '');
  res.json({ hits: q ? searchFaqs(q, Number(req.query.k) || 3) : [] });
});

app.get('/api/faqs', (req, res) => {
  res.json({
    faqs: db.listFaqs({
      keyword: req.query.keyword ? String(req.query.keyword) : undefined,
      category: req.query.category ? String(req.query.category) : undefined,
    }),
  });
});

app.post('/api/faqs', (req, res) => {
  const now = new Date().toISOString();
  const body = req.body || {};
  if (!body.question || !body.answer) return res.status(400).json({ error: '问题和答案不能为空' });
  const faq = db.upsertFaq({
    id: body.id || `faq-${uuidv4().slice(0, 8)}`,
    category: body.category || '其他',
    question: body.question,
    answer: body.answer,
    keywords: body.keywords ?? null,
    unit: body.unit ?? null,
    trade: body.trade ?? null,
    hit_count: 0,
    enabled: body.enabled === 0 ? 0 : 1,
    created_at: body.created_at || now,
    updated_at: now,
  });
  res.json({ faq });
});

app.delete('/api/faqs/:id', (req, res) => {
  res.json({ success: db.deleteFaq(req.params.id) });
});

// ============= 满意度 =============
app.post('/api/feedback', (req, res) => {
  const { sessionId, messageId, rating, thumb, comment } = req.body || {};
  if (!sessionId || (!rating && !thumb)) return res.status(400).json({ error: '参数不完整' });
  const score = rating ?? (thumb === 'up' ? 5 : 2);
  const fb = db.createFeedback({
    id: uuidv4(),
    session_id: sessionId,
    message_id: messageId ?? null,
    rating: score,
    thumb: thumb ?? (score >= 4 ? 'up' : 'down'),
    comment: comment ?? null,
    created_at: new Date().toISOString(),
  });

  // 低分自动升级为人工跟进
  let handoff = null;
  if (score <= 2) {
    const session = db.getSession(sessionId);
    handoff = db.createHandoff({
      id: uuidv4(),
      session_id: sessionId,
      reason: '满意度评价过低，自动升级',
      summary: comment || '业主对本次服务评价不满意',
      contact_name: session?.customer_name ?? null,
      contact_phone: session?.customer_phone ?? null,
      message: comment ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    db.updateSession(sessionId, { status: 'handoff' });
  } else {
    db.updateSession(sessionId, { resolved: 1 });
  }
  res.json({ feedback: fb, escalated: Boolean(handoff) });
});

// ============= 转人工 =============
app.post('/api/handoff', (req, res) => {
  const { sessionId, contactName, contactPhone, message, reason } = req.body || {};
  const session = sessionId ? db.getSession(sessionId) : null;
  const msgs = sessionId ? db.getMessagesBySession(sessionId) : [];
  const summary = msgs.filter((m) => m.role === 'user').slice(-3).map((m) => m.content).join(' / ').slice(0, 200);
  const h = db.createHandoff({
    id: uuidv4(),
    session_id: sessionId ?? null,
    reason: reason || '业主主动留言',
    summary: summary || message?.slice(0, 200) || null,
    contact_name: contactName ?? session?.customer_name ?? null,
    contact_phone: contactPhone ?? session?.customer_phone ?? null,
    message: message ?? null,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  if (sessionId) {
    db.updateSession(sessionId, {
      status: 'handoff',
      customer_name: contactName ?? undefined,
      customer_phone: contactPhone ?? undefined,
    });
  }
  res.json({ handoff: h });
});

app.get('/api/handoffs', (req, res) => {
  res.json({ handoffs: db.listHandoffs(req.query.status ? String(req.query.status) : undefined) });
});

app.patch('/api/handoffs/:id', (req, res) => {
  res.json({ success: db.updateHandoff(req.params.id, req.body || {}) });
});

// ============= 工单 =============
app.get('/api/tickets', (req, res) => {
  res.json({ tickets: db.listTickets(req.query.status ? String(req.query.status) : undefined) });
});

app.patch('/api/tickets/:id', (req, res) => {
  res.json({ success: db.updateTicket(req.params.id, req.body || {}) });
});

/** 责任单位/工种试算（前端演示用） */
app.post('/api/classify', (req, res) => {
  const { text, building } = req.body || {};
  const room = extractRoom(text || '');
  res.json({ result: classify(building ?? room.building, text || ''), room });
});

// ============= 管理后台 =============
app.get('/api/admin/stats', (req, res) => {
  const stats = db.getStats(Number(req.query.days) || 14);
  res.json({
    ...stats,
    intentDist: stats.intentDist.map((i) => ({
      ...i,
      label: INTENT_LABELS[i.intent as IntentCode] || i.intent,
    })),
  });
});

app.post('/api/admin/seed-demo', (req, res) => {
  const n = seedDemoData(Boolean(req.body?.force));
  res.json({ success: true, created: n });
});

app.post('/api/admin/clear', (_req, res) => {
  db.clearAllData();
  res.json({ success: true });
});

// ============= 核心：对话 =============
app.post('/api/chat', async (req, res) => {
  const startedAt = Date.now();
  const { sessionId, message, model, room: roomHint, customerName, customerPhone } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: '消息不能为空' });

  const now = new Date().toISOString();
  let session = sessionId ? db.getSession(sessionId) : null;
  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: String(message).slice(0, 24),
      model: model || defaultModel,
      room: roomHint ?? null,
      customer_name: customerName ?? null,
      customer_phone: customerPhone ?? null,
      created_at: now,
      updated_at: now,
    });
  }

  const history = db.getMessagesBySession(session.id);
  const userHistory = history.filter((m) => m.role === 'user').map((m) => m.content);

  // 1) 意图识别
  const intent = detectIntent(String(message), userHistory);

  // 2) 知识库检索
  const hits: KbHit[] = searchFaqs(String(message), 3);
  if (hits.length) db.incrFaqHit(hits.map((h) => h.id));

  // 3) 落库用户消息
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();
  db.createMessage({
    id: userMessageId,
    session_id: session.id,
    role: 'user',
    content: String(message),
    created_at: now,
    intent: intent.intent,
    intent_label: intent.label,
    confidence: intent.confidence,
    kb_hits: JSON.stringify(hits.map((h) => ({ id: h.id, question: h.question, score: h.score }))),
  });

  // 会话档案补全
  const patch: Record<string, unknown> = { last_intent: intent.intent };
  if (intent.entities.room && !session.room) patch.room = intent.entities.room;
  if (intent.entities.phone && !session.customer_phone) patch.customer_phone = intent.entities.phone;
  if (history.length === 0) patch.title = String(message).slice(0, 24);
  db.updateSession(session.id, patch);

  // SSE
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  send({
    type: 'init',
    sessionId: session.id,
    userMessageId,
    assistantMessageId,
    intent: { code: intent.intent, label: intent.label, confidence: intent.confidence, matched: intent.matched, urgent: intent.urgent },
    entities: intent.entities,
    suggestion: intent.suggestion,
    kbHits: hits.map((h) => ({ id: h.id, question: h.question, category: h.category, score: h.score })),
  });

  const sessionBrief = [
    `会话轮次：第 ${userHistory.length + 1} 轮`,
    `已知房号：${session.room || intent.entities.room || '未知'}`,
    `已知联系人：${session.customer_name || '未知'} / ${session.customer_phone || intent.entities.phone || '未知'}`,
    userHistory.length ? `业主此前说过：${userHistory.slice(-3).join(' ｜ ')}` : '这是本次会话第一条消息',
  ].join('\n');

  const turnContext = buildTurnContext(buildKbContext(hits), intent, sessionBrief);
  const prompt = `${turnContext}\n\n---\n## 【业主本轮消息】\n${message}`;

  let raw = '';
  let emitted = 0;
  const pushText = (chunk: string) => {
    raw += chunk;
    const idx = raw.indexOf('<<<');
    let visible = idx === -1 ? raw : raw.slice(0, idx);
    if (idx === -1) {
      const tail = visible.match(/<{1,2}$/);
      if (tail) visible = visible.slice(0, visible.length - tail[0].length);
    }
    if (visible.length > emitted) {
      send({ type: 'text', content: visible.slice(emitted) });
      emitted = visible.length;
    }
  };

  let meta: AgentMeta | null = null;
  let usedOffline = false;

  // 真实模型调用：CodeBuddy 鉴权链路在沙箱网络下偶发抖动（"Authentication required"），
  // 加重试吸收瞬时失败；全部失败后回退本地知识库兜底。
  const MAX_RETRY = 3;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      if (sdkAvailable === false) throw new Error('SDK 未启用（离线模式）');

      raw = '';
      emitted = 0;

      const stream = query({
        prompt,
        options: {
          cwd: process.cwd(),
          model: model || session.model || defaultModel,
          maxTurns: 1,
          systemPrompt: BASE_SYSTEM_PROMPT,
          // bypassPermissions：客服 Agent 不调用任何工具，无需权限交互，避免 agent 循环卡在权限确认
          permissionMode: 'bypassPermissions',
          environment: (process.env.CODEBUDDY_INTERNET_ENVIRONMENT || 'internal') as any,
          env: {
            // 关键：transport 仅转发 options.env，不会自动继承 process.env，
            // 必须显式把 API Key 透传进 codebuddy-code 子进程，否则报 auth required
            ...(process.env.CODEBUDDY_API_KEY ? { CODEBUDDY_API_KEY: process.env.CODEBUDDY_API_KEY } : {}),
            CODEBUDDY_INTERNET_ENVIRONMENT: process.env.CODEBUDDY_INTERNET_ENVIRONMENT || 'internal',
          },
          ...(attempt === 1 && session.sdk_session_id ? { resume: session.sdk_session_id } : {}),
        },
      });

      for await (const msg of stream) {
        const m = msg as {
          type: string; subtype?: string; session_id?: string;
          message?: { content?: unknown }; result?: unknown;
        };
        if (m.type === 'system' && m.subtype === 'init') {
          if (m.session_id && m.session_id !== session.sdk_session_id) {
            db.updateSession(session.id, { sdk_session_id: m.session_id });
          }
          sdkAvailable = true;
        } else if (m.type === 'assistant') {
          const content = m.message?.content;
          const grab = (t: string) => {
            // 过滤鉴权报错文本，避免泄露给用户 / 污染 raw
            if (/Authentication (required|failed)/i.test(t)) return;
            pushText(t);
          };
          if (typeof content === 'string') grab(content);
          else if (Array.isArray(content)) {
            for (const block of content as Array<{ type: string; text?: string }>) {
              // 跳过 thinking 等内部块，只把可见文本推流
              if (block.type === 'text' && block.text) grab(block.text);
            }
          }
        } else if (m.type === 'result') {
          // 部分模型（如 deepseek）正文只在 result.result 中，assistant 仅含 thinking
          if (typeof m.result === 'string' && m.result.length > raw.length) {
            raw = m.result;
          }
        }
      }
      if (raw.trim()) break; // 成功拿到真实回复
      throw new Error('模型未返回内容');
    } catch (err) {
      lastErr = err;
      console.warn(`[Chat] SDK 第 ${attempt}/${MAX_RETRY} 次尝试失败:`, (err as Error)?.message);
      if (attempt < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  if (!raw.trim()) {
    // ---- 离线兜底 ----
    usedOffline = true;
    if (sdkAvailable === null) sdkAvailable = false;
    console.warn('[Chat] 走离线兜底(已重试):', (lastErr as Error)?.message);
    const fallback = offlineAnswer(intent, hits, String(message));
    raw = fallback.text;
    meta = fallback.meta;
    send({ type: 'notice', level: 'info', message: '当前为本地知识库应答模式' });
    // 模拟流式，体验一致
    const step = 12;
    for (let i = 0; i < fallback.text.length; i += step) {
      send({ type: 'text', content: fallback.text.slice(i, i + step) });
      await new Promise((r) => setTimeout(r, 18));
    }
    emitted = fallback.text.length;
  }

  // 解析元信息
  const parsed = splitMeta(raw);
  const answerText = parsed.text || raw;
  if (!meta) meta = parsed.meta;
  if (emitted < answerText.length) {
    send({ type: 'text', content: answerText.slice(emitted) });
  }

  // 4) 工单生成
  let ticketPayload: db.DbTicket | null = null;
  const t = meta?.ticket;
  const finalRoom = t?.room || intent.entities.room || session.room || null;
  const finalPhone = t?.contact_phone || intent.entities.phone || session.customer_phone || null;
  if (t && finalRoom && finalPhone && (t.description || message)) {
    const building = finalRoom ? parseInt(finalRoom.split('-')[0], 10) : null;
    const cls = classify(Number.isNaN(building as number) ? null : building, t.description || String(message));
    const nowIso = new Date().toISOString();
    ticketPayload = {
      id: uuidv4(),
      ticket_no: db.nextTicketNo(),
      session_id: session.id,
      room: finalRoom,
      contact_name: t.contact_name || session.customer_name || null,
      contact_phone: finalPhone,
      trade: t.trade || cls.trade,
      unit: cls.unit,
      description: t.description || String(message),
      expect_time: t.expect_time || null,
      status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    };
    db.createTicket(ticketPayload);
    db.updateSession(session.id, {
      room: finalRoom,
      customer_phone: finalPhone,
      customer_name: ticketPayload.contact_name ?? undefined,
      resolved: 1,
    });
    send({ type: 'ticket', ticket: ticketPayload });
  }

  // 5) 转人工判定
  const unresolvedRounds = userHistory.length + 1 - (meta?.resolved ? 1 : 0);
  const ho = shouldHandoff({
    intent: intent.intent,
    text: String(message),
    unresolvedRounds: meta?.resolved ? 0 : unresolvedRounds,
    resolved: meta?.resolved,
  });
  let needHuman = Boolean(meta?.need_human) || ho.need;
  // 正常报修已生成工单且视为已闭环（resolved）：不再因兜底关键词转人工
  const handoffBlocked = Boolean(ticketPayload) && Boolean(meta?.resolved);
  if (handoffBlocked) needHuman = false;
  if (needHuman) {
    const existing = db.listHandoffs('pending').find((h) => h.session_id === session!.id);
    if (!existing) {
      const h = db.createHandoff({
        id: uuidv4(),
        session_id: session.id,
        reason: meta?.handoff_reason || ho.reason || '需人工跟进',
        summary: [...userHistory.slice(-2), String(message)].join(' / ').slice(0, 200),
        contact_name: session.customer_name ?? null,
        contact_phone: finalPhone,
        message: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      db.updateSession(session.id, { status: 'handoff' });
      send({ type: 'handoff', handoff: h, reason: h.reason });
    } else {
      send({ type: 'handoff', handoff: existing, reason: existing.reason });
    }
  } else if (meta?.resolved) {
    db.updateSession(session.id, { resolved: 1 });
  }

  // 6) 落库助手消息
  db.createMessage({
    id: assistantMessageId,
    session_id: session.id,
    role: 'assistant',
    content: answerText,
    model: usedOffline ? 'local-kb' : model || session.model || defaultModel,
    created_at: new Date().toISOString(),
    intent: intent.intent,
    intent_label: intent.label,
    confidence: intent.confidence,
    kb_hits: JSON.stringify(hits.map((h) => ({ id: h.id, question: h.question, score: h.score }))),
    needs_human: needHuman ? 1 : 0,
    latency_ms: Date.now() - startedAt,
  });

  send({
    type: 'done',
    meta: { ...meta, offline: usedOffline },
    missing: meta?.missing ?? [],
    latency: Date.now() - startedAt,
  });
  res.end();
});

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}

// ============= 生产托管：直接返回打包后的前端 =============
// 单一端口同时承载 API 与前端，免 vite、免 5173、免端口代理。
// 部署时先 `npm run build` 生成 dist/，再用 `npm run server` 启动即可。
const distDir = resolve(process.cwd(), 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  // SPA 回退：非 /api 的 GET 一律返回 index.html（支持 /admin 前端路由）
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(resolve(distDir, 'index.html'));
  });
}

// 绑定 127.0.0.1（仅本机），兼容未开启 IPv4 映射 IPv6 的网卡，并收紧访问范围
app.listen(PORT, '127.0.0.1', () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  维保智能客服 Agent · ${AGENT_NAME}                         
║  API   : http://localhost:${PORT}
║  DB    : data/chat.db
║  FAQ   : ${db.countFaqs()} 条
║  模式  : ${process.env.DEMO_OFFLINE === '1' ? '本地知识库（离线）' : 'CodeBuddy Agent SDK（失败自动兜底）'}
╚══════════════════════════════════════════════════════╝
`);
});
