import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquarePlus, RefreshCw, Trash2, Wifi, WifiOff, Wrench, ShieldCheck, Search, Sparkles } from 'lucide-react';
import { APP_CONFIG } from '../config';
import type { ChatMessage, Handoff, SessionSummary, Ticket } from '../types';
import { api, fmtTime, streamChat } from '../lib/api';
import MessageBubble from '../components/chat/MessageBubble';
import Composer from '../components/chat/Composer';
import HandoffModal from '../components/chat/HandoffModal';
import { StatusTag } from '../components/chat/parts';

const uid = () => Math.random().toString(36).slice(2, 11);

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    `您好，我是${APP_CONFIG.shortName}，${APP_CONFIG.project}维保中心的智能客服 🔥\n\n我可以帮您：\n- **登记房屋报修**（渗漏、裂缝、门窗、五金、电气、智能设备等）\n- **解答质保政策**（各部位保修年限、免费范围）\n- **说明维修流程**（受理、派单、上门、验收）\n- **查询进度 / 转人工**（复杂问题直接转工作人员）\n\n报修时请一次说清「**楼号-房号 + 问题描述 + 联系电话**」，我可以直接为您生成工单。`,
  createdAt: new Date().toISOString(),
};

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [toast, setToast] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  sessionIdRef.current = sessionId;

  const currentSession = useMemo(() => sessions.find((s) => s.id === sessionId) || null, [sessions, sessionId]);

  /* -------- 初始化 -------- */
  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.listSessions());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSessions();
    api
      .health()
      .then((h) => {
        if (h.offlineForced) {
          setOnline(false);
          return;
        }
        // 未探测过 SDK 状态时，主动探一次
        if (h.sdkAvailable === null) {
          api
            .checkLogin()
            .then((r) => setOnline(r.mode === 'sdk'))
            .catch(() => setOnline(false));
        } else {
          setOnline(h.sdkAvailable);
        }
      })
      .catch(() => setOnline(false));
  }, [loadSessions]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  /* -------- 会话切换 -------- */
  const openSession = async (id: string) => {
    if (loading) return;
    try {
      const [detail, tickets, handoffs] = await Promise.all([api.getSession(id), api.listTickets(), api.listHandoffs()]);
      const myTickets = tickets.filter((t: Ticket) => t.session_id === id);
      const myHandoffs = handoffs.filter((h: Handoff) => h.session_id === id);
      const ratedMap = new Map<string, 'up' | 'down'>();
      (detail.feedbacks || []).forEach((f: any) => {
        if (f.message_id) ratedMap.set(f.message_id, f.thumb === 'up' ? 'up' : 'down');
      });

      const list: ChatMessage[] = (detail.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        intent: m.intent ? { code: m.intent, label: m.intent_label || m.intent, confidence: m.confidence ?? 0 } : undefined,
        kbHits: m.role === 'assistant' && Array.isArray(m.kb_hits) ? m.kb_hits.map((k: any) => ({ ...k, category: k.category || '知识库' })) : undefined,
        offline: m.model === 'local-kb',
        latency: m.latency_ms,
        rated: ratedMap.get(m.id),
      }));

      // 把工单 / 转人工挂到时间最接近的助手消息上
      const assistants = list.filter((m) => m.role === 'assistant');
      myTickets.forEach((t: Ticket) => {
        const target = [...assistants].reverse().find((m) => new Date(m.createdAt) >= new Date(t.created_at) || true);
        if (target) target.ticket = t;
      });
      if (myHandoffs.length && assistants.length) assistants[assistants.length - 1].handoff = myHandoffs[myHandoffs.length - 1];

      setSessionId(id);
      setMessages(list.length ? list : [WELCOME]);
    } catch {
      flash('加载会话失败');
    }
  };

  const newSession = () => {
    if (loading) return;
    setSessionId(null);
    setMessages([WELCOME]);
    setInput('');
  };

  const removeSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('删除该会话及其全部消息？')) return;
    await api.deleteSession(id);
    if (id === sessionId) newSession();
    loadSessions();
  };

  /* -------- 发送 -------- */
  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, createdAt: new Date().toISOString() };
    const botId = uid();
    const botMsg: ChatMessage = { id: botId, role: 'assistant', content: '', createdAt: new Date().toISOString(), streaming: true };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    setLoading(true);

    const patchBot = (patch: Partial<ChatMessage>) =>
      setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, ...patch } : m)));

    const ac = new AbortController();
    abortRef.current = ac;

    await streamChat(
      { sessionId: sessionId || undefined, message: text },
      {
        onInit: (e) => {
          if (!sessionIdRef.current) {
            setSessionId(e.sessionId);
            sessionIdRef.current = e.sessionId;
          }
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === userMsg.id) return { ...m, intent: e.intent };
              if (m.id === botId) return { ...m, kbHits: e.kbHits, suggestion: e.suggestion };
              return m;
            }),
          );
        },
        onText: (chunk) => setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, content: m.content + chunk } : m))),
        onNotice: (e) => patchBot({ offline: true }),
        onTicket: (t) => patchBot({ ticket: t }),
        onHandoff: (h) => patchBot({ handoff: h }),
        onDone: (e) => patchBot({ streaming: false, latency: e.latency, offline: Boolean(e.meta?.offline) }),
        onError: (msg) => patchBot({ streaming: false, content: `⚠️ ${msg}`, error: true }),
      },
      ac.signal,
    );

    setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, streaming: false } : m)));
    setLoading(false);
    abortRef.current = null;
    loadSessions();
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  };

  /* -------- 评价 -------- */
  const rate = async (msg: ChatMessage, rating: number, thumb: 'up' | 'down') => {
    if (!sessionIdRef.current) return;
    try {
      const r = await api.feedback({ sessionId: sessionIdRef.current, messageId: msg.id, rating, thumb });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, rated: thumb } : m)));
      flash(r.escalated ? '已记录，并自动转交人工回访 🙏' : '感谢您的评价！');
      loadSessions();
    } catch {
      flash('提交评价失败');
    }
  };

  /* -------- 转人工 -------- */
  const submitHandoff = async (payload: { contactName: string; contactPhone: string; message: string }) => {
    try {
      const h = await api.handoff({
        sessionId: sessionIdRef.current || undefined,
        ...payload,
        reason: '业主主动留言',
      });
      setHandoffOpen(false);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: `已收到您的留言，工单已流转至人工坐席。\n\n**联系人**：${payload.contactName || '业主'}　**电话**：${payload.contactPhone}\n工作人员会在工作日 4 小时内与您联系，请保持电话畅通。`,
          createdAt: new Date().toISOString(),
          handoff: h,
        },
      ]);
      flash('留言已提交，人工同事会尽快联系您');
      loadSessions();
    } catch {
      flash('提交失败，请稍后重试');
    }
  };

  const lastAssistantId = useMemo(() => {
    const arr = messages.filter((m) => m.role === 'assistant' && m.id !== 'welcome');
    return arr.length ? arr[arr.length - 1].id : null;
  }, [messages]);

  return (
    <div className="main-area">
      {/* 侧栏 */}
      <aside className="side">
        <div className="side-head">
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={newSession}>
            <MessageSquarePlus size={15} /> 新的咨询
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 11, fontSize: 11.5, color: 'var(--text-3)' }}>
            {online === false ? <WifiOff size={12} /> : <Wifi size={12} />}
            {online === null ? '连接中…' : online ? '智能应答在线' : '本地知识库模式'}
            <span style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" onClick={loadSessions} title="刷新">
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        <div className="side-list">
          {sessions.length === 0 && <div className="empty" style={{ padding: '28px 12px' }}>暂无历史咨询</div>}
          {sessions.map((s) => (
            <div key={s.id} className={`side-item ${s.id === sessionId ? 'active' : ''}`} onClick={() => openSession(s.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="side-item-title" style={{ flex: 1 }}>
                  {s.title || '未命名咨询'}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={(e) => removeSession(s.id, e)} title="删除">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="side-item-meta">
                <span>{s.room || '未填房号'}</span>
                <span>{s.messageCount} 条</span>
                {s.status === 'handoff' && <span style={{ color: 'var(--red)' }}>转人工</span>}
                {s.rating != null && <span style={{ color: 'var(--amber)' }}>{s.rating}★</span>}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{fmtTime(s.updated_at)}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--line-soft)', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.75 }}>
          <div>{APP_CONFIG.project}</div>
          <div>{APP_CONFIG.hotlineTip}</div>
        </div>
      </aside>

      {/* 对话区 */}
      <div className="chat-wrap">
        {currentSession && (
          <div style={{ padding: '9px 24px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-2)' }}>
            <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{currentSession.title}</strong>
            {currentSession.room && <span className="tag tag-cyan">{currentSession.room}</span>}
            {currentSession.customer_phone && <span className="tag tag-slate">{currentSession.customer_phone}</span>}
            <StatusTag status={currentSession.status} />
          </div>
        )}

        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-inner">
            {messages.length === 1 && messages[0].id === 'welcome' && (
              <div className="welcome-hero">
                <div className="welcome-badge"><Sparkles size={13} /> 智能客服 · 在线</div>
                <div className="welcome-title">您好，我是云小维</div>
                <div className="welcome-sub">{APP_CONFIG.project} 维保中心 · 报修受理 / 政策解答 / 进度查询</div>
                <div className="welcome-cards">
                  <div className="welcome-card">
                    <div className="ic"><Wrench size={16} /></div>
                    <div className="t">一键报修</div>
                    <div className="d">渗漏·裂缝·门窗·电气，自动生成工单</div>
                  </div>
                  <div className="welcome-card">
                    <div className="ic"><ShieldCheck size={16} /></div>
                    <div className="t">质保政策</div>
                    <div className="d">各部位保修年限与免费范围</div>
                  </div>
                  <div className="welcome-card">
                    <div className="ic"><Search size={16} /></div>
                    <div className="t">进度查询</div>
                    <div className="d">报修工单状态实时跟踪</div>
                  </div>
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                onRate={rate}
                onLeaveMsg={() => setHandoffOpen(true)}
                showRate={Boolean(sessionId) && m.id === lastAssistantId && !m.streaming}
              />
            ))}
          </div>
        </div>

        <Composer
          value={input}
          onChange={setInput}
          onSend={send}
          onStop={stop}
          onHandoff={() => setHandoffOpen(true)}
          loading={loading}
          showQuick={messages.length <= 1}
        />
      </div>

      <HandoffModal
        open={handoffOpen}
        defaultName={currentSession?.customer_name || ''}
        defaultPhone={currentSession?.customer_phone || ''}
        onClose={() => setHandoffOpen(false)}
        onSubmit={submitHandoff}
      />

      {toast && (
        <div
          className="fade-in"
          style={{
            position: 'fixed', bottom: 92, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 12,
            padding: '10px 18px', fontSize: 13, boxShadow: 'var(--shadow)', zIndex: 200,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
