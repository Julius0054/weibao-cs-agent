import type { Faq, Handoff, KbHit, SessionSummary, Stats, Ticket } from '../types';

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function jsend<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

/* ---------------- 基础 ---------------- */
export const api = {
  health: () =>
    jget<{ status: string; agent: string; sdkAvailable: boolean | null; offlineForced: boolean; faqCount: number }>('/api/health'),
  checkLogin: () =>
    jget<{ envConfigured: boolean; isLoggedIn: boolean; mode: 'sdk' | 'offline'; user?: string | null; error?: string }>(
      '/api/check-login',
    ),

  /* 会话 */
  listSessions: () => jget<{ sessions: SessionSummary[] }>('/api/sessions').then((d) => d.sessions),
  getSession: (id: string) => jget<{ session: any; messages: any[]; feedbacks: any[] }>(`/api/sessions/${id}`),
  createSession: (payload: Record<string, unknown> = {}) =>
    jsend<{ session: SessionSummary }>('/api/sessions', 'POST', payload).then((d) => d.session),
  patchSession: (id: string, payload: Record<string, unknown>) =>
    jsend<{ success: boolean }>(`/api/sessions/${id}`, 'PATCH', payload),
  deleteSession: (id: string) => jsend<{ success: boolean }>(`/api/sessions/${id}`, 'DELETE'),

  /* 知识库 */
  searchKb: (q: string, k = 3) =>
    jget<{ hits: KbHit[] }>(`/api/kb/search?q=${encodeURIComponent(q)}&k=${k}`).then((d) => d.hits),
  listFaqs: (params: { keyword?: string; category?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.keyword) qs.set('keyword', params.keyword);
    if (params.category) qs.set('category', params.category);
    return jget<{ faqs: Faq[] }>(`/api/faqs?${qs.toString()}`).then((d) => d.faqs);
  },
  saveFaq: (faq: Partial<Faq>) => jsend<{ faq: Faq }>('/api/faqs', 'POST', faq).then((d) => d.faq),
  deleteFaq: (id: string) => jsend<{ success: boolean }>(`/api/faqs/${id}`, 'DELETE'),

  /* 满意度 */
  feedback: (payload: {
    sessionId: string;
    messageId?: string;
    rating?: number;
    thumb?: 'up' | 'down';
    comment?: string;
  }) => jsend<{ feedback: any; escalated: boolean }>('/api/feedback', 'POST', payload),

  /* 转人工 */
  handoff: (payload: {
    sessionId?: string;
    contactName?: string;
    contactPhone?: string;
    message?: string;
    reason?: string;
  }) => jsend<{ handoff: Handoff }>('/api/handoff', 'POST', payload).then((d) => d.handoff),
  listHandoffs: (status?: string) =>
    jget<{ handoffs: Handoff[] }>(`/api/handoffs${status ? `?status=${status}` : ''}`).then((d) => d.handoffs),
  patchHandoff: (id: string, payload: Record<string, unknown>) =>
    jsend<{ success: boolean }>(`/api/handoffs/${id}`, 'PATCH', payload),

  /* 工单 */
  listTickets: (status?: string) =>
    jget<{ tickets: Ticket[] }>(`/api/tickets${status ? `?status=${status}` : ''}`).then((d) => d.tickets),
  patchTicket: (id: string, payload: Record<string, unknown>) =>
    jsend<{ success: boolean }>(`/api/tickets/${id}`, 'PATCH', payload),

  classify: (text: string, building?: number | null) =>
    jsend<{ result: any; room: any }>('/api/classify', 'POST', { text, building }),

  /* 管理后台 */
  stats: (days = 14) => jget<Stats>(`/api/admin/stats?days=${days}`),
  seedDemo: (force = false) => jsend<{ created: number }>('/api/admin/seed-demo', 'POST', { force }),
  clearAll: () => jsend<{ success: boolean }>('/api/admin/clear', 'POST'),
};

/* ---------------- SSE 对话 ---------------- */
export interface ChatEvents {
  onInit?: (e: any) => void;
  onText?: (chunk: string) => void;
  onNotice?: (e: { level: string; message: string }) => void;
  onTicket?: (t: Ticket) => void;
  onHandoff?: (h: Handoff, reason?: string) => void;
  onDone?: (e: { meta: any; missing: string[]; latency: number }) => void;
  onError?: (msg: string) => void;
}

export async function streamChat(
  payload: { sessionId?: string; message: string; model?: string; room?: string; customerName?: string; customerPhone?: string },
  events: ChatEvents,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    events.onError?.('无法连接服务，请确认后端已启动');
    return;
  }

  if (!res.ok || !res.body) {
    events.onError?.(`服务异常（${res.status}）`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      break;
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const jsonText = line.slice(5).trim();
      if (!jsonText) continue;
      let evt: any;
      try {
        evt = JSON.parse(jsonText);
      } catch {
        continue;
      }
      switch (evt.type) {
        case 'init':
          events.onInit?.(evt);
          break;
        case 'text':
          if (evt.content) events.onText?.(evt.content);
          break;
        case 'notice':
          events.onNotice?.(evt);
          break;
        case 'ticket':
          events.onTicket?.(evt.ticket);
          break;
        case 'handoff':
          events.onHandoff?.(evt.handoff, evt.reason);
          break;
        case 'error':
          events.onError?.(evt.message || '服务异常');
          break;
        case 'done':
          events.onDone?.(evt);
          break;
      }
    }
  }
}

export function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtClock(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
