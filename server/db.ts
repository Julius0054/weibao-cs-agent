import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'chat.db');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: Database.Database = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============= 建表 =============
db.exec(`
  -- 会话表（一次业主咨询 = 一个会话）
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    sdk_session_id TEXT,
    channel TEXT DEFAULT 'web',
    customer_name TEXT,
    customer_phone TEXT,
    room TEXT,
    status TEXT NOT NULL DEFAULT 'active',   -- active | handoff | closed
    last_intent TEXT,
    resolved INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    intent TEXT,
    intent_label TEXT,
    confidence REAL,
    kb_hits TEXT,
    needs_human INTEGER DEFAULT 0,
    latency_ms INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_intent ON messages(intent);

  -- FAQ 知识库
  CREATE TABLE IF NOT EXISTS faqs (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT,
    unit TEXT,          -- 责任单位
    trade TEXT,         -- 工种
    hit_count INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 报修工单
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    ticket_no TEXT NOT NULL,
    session_id TEXT,
    room TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    trade TEXT,
    unit TEXT,
    description TEXT NOT NULL,
    expect_time TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | assigned | done
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 转人工留言
  CREATE TABLE IF NOT EXISTS handoffs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    reason TEXT,
    summary TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | closed
    reply TEXT,
    created_at TEXT NOT NULL,
    handled_at TEXT
  );

  -- 满意度评价
  CREATE TABLE IF NOT EXISTS feedbacks (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    message_id TEXT,
    rating INTEGER NOT NULL,      -- 1~5
    thumb TEXT,                   -- up | down
    comment TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feedbacks_session ON feedbacks(session_id);
`);

// 兼容旧库的轻量迁移
function ensureColumn(table: string, column: string, ddl: string) {
  try {
    const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!info.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  } catch {
    /* ignore */
  }
}
[
  ['sessions', 'sdk_session_id', 'sdk_session_id TEXT'],
  ['sessions', 'channel', "channel TEXT DEFAULT 'web'"],
  ['sessions', 'customer_name', 'customer_name TEXT'],
  ['sessions', 'customer_phone', 'customer_phone TEXT'],
  ['sessions', 'room', 'room TEXT'],
  ['sessions', 'status', "status TEXT DEFAULT 'active'"],
  ['sessions', 'last_intent', 'last_intent TEXT'],
  ['sessions', 'resolved', 'resolved INTEGER DEFAULT 0'],
  ['messages', 'intent', 'intent TEXT'],
  ['messages', 'intent_label', 'intent_label TEXT'],
  ['messages', 'confidence', 'confidence REAL'],
  ['messages', 'kb_hits', 'kb_hits TEXT'],
  ['messages', 'needs_human', 'needs_human INTEGER DEFAULT 0'],
  ['messages', 'latency_ms', 'latency_ms INTEGER'],
].forEach(([t, c, d]) => ensureColumn(t, c, d));

// ============= 类型 =============
export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id?: string | null;
  channel?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  room?: string | null;
  status?: string;
  last_intent?: string | null;
  resolved?: number;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string | null;
  created_at: string;
  tool_calls?: string | null;
  intent?: string | null;
  intent_label?: string | null;
  confidence?: number | null;
  kb_hits?: string | null;
  needs_human?: number;
  latency_ms?: number | null;
}

export interface DbFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords?: string | null;
  unit?: string | null;
  trade?: string | null;
  hit_count?: number;
  enabled?: number;
  created_at: string;
  updated_at: string;
}

export interface DbTicket {
  id: string;
  ticket_no: string;
  session_id?: string | null;
  room?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  trade?: string | null;
  unit?: string | null;
  description: string;
  expect_time?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
}

export interface DbHandoff {
  id: string;
  session_id?: string | null;
  reason?: string | null;
  summary?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  message?: string | null;
  status?: string;
  reply?: string | null;
  created_at: string;
  handled_at?: string | null;
}

export interface DbFeedback {
  id: string;
  session_id: string;
  message_id?: string | null;
  rating: number;
  thumb?: string | null;
  comment?: string | null;
  created_at: string;
}

// ============= 会话 =============
export function getAllSessions(): DbSession[] {
  return db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as DbSession[];
}

export function getSession(id: string): DbSession | undefined {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as DbSession | undefined;
}

export function createSession(s: Partial<DbSession> & { id: string; title: string; model: string; created_at: string; updated_at: string }): DbSession {
  db.prepare(`
    INSERT INTO sessions (id, title, model, sdk_session_id, channel, customer_name, customer_phone, room, status, last_intent, resolved, created_at, updated_at)
    VALUES (@id, @title, @model, @sdk_session_id, @channel, @customer_name, @customer_phone, @room, @status, @last_intent, @resolved, @created_at, @updated_at)
  `).run({
    sdk_session_id: null,
    channel: 'web',
    customer_name: null,
    customer_phone: null,
    room: null,
    status: 'active',
    last_intent: null,
    resolved: 0,
    ...s,
  });
  return getSession(s.id)!;
}

export function updateSession(id: string, updates: Partial<DbSession>): boolean {
  const allow = ['title', 'model', 'sdk_session_id', 'customer_name', 'customer_phone', 'room', 'status', 'last_intent', 'resolved'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allow) {
    const v = (updates as Record<string, unknown>)[key];
    if (v !== undefined) {
      fields.push(`${key} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  const result = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[]));
  return result.changes > 0;
}

export function deleteSession(id: string): boolean {
  return db.prepare('DELETE FROM sessions WHERE id = ?').run(id).changes > 0;
}

// ============= 消息 =============
export function getMessagesBySession(sessionId: string): DbMessage[] {
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC').all(sessionId) as DbMessage[];
}

export function createMessage(m: DbMessage): DbMessage {
  db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls, intent, intent_label, confidence, kb_hits, needs_human, latency_ms)
    VALUES (@id, @session_id, @role, @content, @model, @created_at, @tool_calls, @intent, @intent_label, @confidence, @kb_hits, @needs_human, @latency_ms)
  `).run({
    model: null,
    tool_calls: null,
    intent: null,
    intent_label: null,
    confidence: null,
    kb_hits: null,
    needs_human: 0,
    latency_ms: null,
    ...m,
  });
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), m.session_id);
  return m;
}

export function updateMessage(id: string, updates: Partial<DbMessage>): boolean {
  const allow = ['content', 'tool_calls', 'intent', 'intent_label', 'confidence', 'kb_hits', 'needs_human', 'latency_ms'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allow) {
    const v = (updates as Record<string, unknown>)[key];
    if (v !== undefined) {
      fields.push(`${key} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return false;
  values.push(id);
  return db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[])).changes > 0;
}

export function deleteMessage(id: string): boolean {
  return db.prepare('DELETE FROM messages WHERE id = ?').run(id).changes > 0;
}

// ============= FAQ =============
export function listFaqs(opts: { keyword?: string; category?: string; onlyEnabled?: boolean } = {}): DbFaq[] {
  let sql = 'SELECT * FROM faqs WHERE 1=1';
  const params: unknown[] = [];
  if (opts.onlyEnabled) sql += ' AND enabled = 1';
  if (opts.category) {
    sql += ' AND category = ?';
    params.push(opts.category);
  }
  if (opts.keyword) {
    sql += ' AND (question LIKE ? OR answer LIKE ? OR keywords LIKE ?)';
    const kw = `%${opts.keyword}%`;
    params.push(kw, kw, kw);
  }
  sql += ' ORDER BY hit_count DESC, created_at ASC';
  return db.prepare(sql).all(...(params as never[])) as DbFaq[];
}

export function getFaq(id: string): DbFaq | undefined {
  return db.prepare('SELECT * FROM faqs WHERE id = ?').get(id) as DbFaq | undefined;
}

export function upsertFaq(f: DbFaq): DbFaq {
  db.prepare(`
    INSERT INTO faqs (id, category, question, answer, keywords, unit, trade, hit_count, enabled, created_at, updated_at)
    VALUES (@id, @category, @question, @answer, @keywords, @unit, @trade, @hit_count, @enabled, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      question = excluded.question,
      answer = excluded.answer,
      keywords = excluded.keywords,
      unit = excluded.unit,
      trade = excluded.trade,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `).run({ keywords: null, unit: null, trade: null, hit_count: 0, enabled: 1, ...f });
  return getFaq(f.id)!;
}

export function deleteFaq(id: string): boolean {
  return db.prepare('DELETE FROM faqs WHERE id = ?').run(id).changes > 0;
}

export function incrFaqHit(ids: string[]): void {
  if (!ids.length) return;
  const stmt = db.prepare('UPDATE faqs SET hit_count = hit_count + 1 WHERE id = ?');
  const tx = db.transaction((list: string[]) => list.forEach((id) => stmt.run(id)));
  tx(ids);
}

export function countFaqs(): number {
  return (db.prepare('SELECT COUNT(*) as c FROM faqs').get() as { c: number }).c;
}

// ============= 工单 =============
export function createTicket(t: DbTicket): DbTicket {
  db.prepare(`
    INSERT INTO tickets (id, ticket_no, session_id, room, contact_name, contact_phone, trade, unit, description, expect_time, status, created_at, updated_at)
    VALUES (@id, @ticket_no, @session_id, @room, @contact_name, @contact_phone, @trade, @unit, @description, @expect_time, @status, @created_at, @updated_at)
  `).run({
    session_id: null, room: null, contact_name: null, contact_phone: null,
    trade: null, unit: null, expect_time: null, status: 'pending', ...t,
  });
  return t;
}

export function listTickets(status?: string): DbTicket[] {
  if (status) return db.prepare('SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC').all(status) as DbTicket[];
  return db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all() as DbTicket[];
}

export function updateTicket(id: string, updates: Partial<DbTicket>): boolean {
  const allow = ['room', 'contact_name', 'contact_phone', 'trade', 'unit', 'description', 'expect_time', 'status'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allow) {
    const v = (updates as Record<string, unknown>)[key];
    if (v !== undefined) { fields.push(`${key} = ?`); values.push(v); }
  }
  if (!fields.length) return false;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  return db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[])).changes > 0;
}

export function nextTicketNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const c = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE ticket_no LIKE ?").get(`BX${ymd}%`) as { c: number }).c;
  return `BX${ymd}${String(c + 1).padStart(3, '0')}`;
}

// ============= 转人工 =============
export function createHandoff(h: DbHandoff): DbHandoff {
  db.prepare(`
    INSERT INTO handoffs (id, session_id, reason, summary, contact_name, contact_phone, message, status, reply, created_at, handled_at)
    VALUES (@id, @session_id, @reason, @summary, @contact_name, @contact_phone, @message, @status, @reply, @created_at, @handled_at)
  `).run({
    session_id: null, reason: null, summary: null, contact_name: null,
    contact_phone: null, message: null, status: 'pending', reply: null, handled_at: null, ...h,
  });
  return h;
}

export function listHandoffs(status?: string): DbHandoff[] {
  if (status) return db.prepare('SELECT * FROM handoffs WHERE status = ? ORDER BY created_at DESC').all(status) as DbHandoff[];
  return db.prepare('SELECT * FROM handoffs ORDER BY created_at DESC').all() as DbHandoff[];
}

export function updateHandoff(id: string, updates: Partial<DbHandoff>): boolean {
  const allow = ['status', 'reply', 'contact_name', 'contact_phone', 'summary'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allow) {
    const v = (updates as Record<string, unknown>)[key];
    if (v !== undefined) { fields.push(`${key} = ?`); values.push(v); }
  }
  if (!fields.length) return false;
  if (updates.status && updates.status !== 'pending') {
    fields.push('handled_at = ?');
    values.push(new Date().toISOString());
  }
  values.push(id);
  return db.prepare(`UPDATE handoffs SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[])).changes > 0;
}

export function pendingHandoffCount(): number {
  return (db.prepare("SELECT COUNT(*) as c FROM handoffs WHERE status = 'pending'").get() as { c: number }).c;
}

// ============= 满意度 =============
export function createFeedback(f: DbFeedback): DbFeedback {
  db.prepare(`
    INSERT INTO feedbacks (id, session_id, message_id, rating, thumb, comment, created_at)
    VALUES (@id, @session_id, @message_id, @rating, @thumb, @comment, @created_at)
  `).run({ message_id: null, thumb: null, comment: null, ...f });
  return f;
}

export function listFeedbacks(sessionId?: string): DbFeedback[] {
  if (sessionId) return db.prepare('SELECT * FROM feedbacks WHERE session_id = ? ORDER BY created_at DESC').all(sessionId) as DbFeedback[];
  return db.prepare('SELECT * FROM feedbacks ORDER BY created_at DESC').all() as DbFeedback[];
}

// ============= 统计 =============
export interface StatsResult {
  totalSessions: number;
  totalMessages: number;
  userMessages: number;
  handoffSessions: number;
  handoffRate: number;
  resolvedRate: number;
  avgRating: number;
  ratingCount: number;
  thumbUp: number;
  thumbDown: number;
  ratingDist: Array<{ rating: number; count: number }>;
  intentDist: Array<{ intent: string; label: string; count: number }>;
  dailyTrend: Array<{ date: string; sessions: number; messages: number; handoffs: number }>;
  topFaqs: Array<{ id: string; question: string; category: string; hit_count: number }>;
  pendingHandoffs: number;
  pendingTickets: number;
  totalTickets: number;
  avgLatency: number;
}

export function getStats(days = 14): StatsResult {
  const totalSessions = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number }).c;
  const totalMessages = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }).c;
  const userMessages = (db.prepare("SELECT COUNT(*) as c FROM messages WHERE role='user'").get() as { c: number }).c;
  const handoffSessions = (db.prepare("SELECT COUNT(DISTINCT session_id) as c FROM handoffs").get() as { c: number }).c;
  const resolvedSessions = (db.prepare('SELECT COUNT(*) as c FROM sessions WHERE resolved = 1').get() as { c: number }).c;

  const ratingRow = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as c FROM feedbacks').get() as { avg: number | null; c: number };
  const thumbUp = (db.prepare("SELECT COUNT(*) as c FROM feedbacks WHERE thumb='up'").get() as { c: number }).c;
  const thumbDown = (db.prepare("SELECT COUNT(*) as c FROM feedbacks WHERE thumb='down'").get() as { c: number }).c;

  const ratingDistRaw = db.prepare('SELECT rating, COUNT(*) as count FROM feedbacks GROUP BY rating').all() as Array<{ rating: number; count: number }>;
  const ratingDist = [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: ratingDistRaw.find((x) => x.rating === r)?.count ?? 0 }));

  const intentDist = db.prepare(`
    SELECT intent, COALESCE(intent_label, intent) as label, COUNT(*) as count
    FROM messages WHERE role='user' AND intent IS NOT NULL
    GROUP BY intent ORDER BY count DESC
  `).all() as Array<{ intent: string; label: string; count: number }>;

  const dailyTrend: Array<{ date: string; sessions: number; messages: number; handoffs: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const s = (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE substr(created_at,1,10) = ?").get(day) as { c: number }).c;
    const m = (db.prepare("SELECT COUNT(*) as c FROM messages WHERE substr(created_at,1,10) = ?").get(day) as { c: number }).c;
    const h = (db.prepare("SELECT COUNT(*) as c FROM handoffs WHERE substr(created_at,1,10) = ?").get(day) as { c: number }).c;
    dailyTrend.push({ date: day.slice(5), sessions: s, messages: m, handoffs: h });
  }

  const topFaqs = db.prepare('SELECT id, question, category, hit_count FROM faqs ORDER BY hit_count DESC LIMIT 8')
    .all() as Array<{ id: string; question: string; category: string; hit_count: number }>;

  const pendingHandoffs = pendingHandoffCount();
  const pendingTickets = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='pending'").get() as { c: number }).c;
  const totalTickets = (db.prepare('SELECT COUNT(*) as c FROM tickets').get() as { c: number }).c;
  const avgLatencyRow = db.prepare("SELECT AVG(latency_ms) as a FROM messages WHERE latency_ms IS NOT NULL").get() as { a: number | null };

  return {
    totalSessions,
    totalMessages,
    userMessages,
    handoffSessions,
    handoffRate: totalSessions ? Math.round((handoffSessions / totalSessions) * 1000) / 10 : 0,
    resolvedRate: totalSessions ? Math.round((resolvedSessions / totalSessions) * 1000) / 10 : 0,
    avgRating: ratingRow.avg ? Math.round(ratingRow.avg * 100) / 100 : 0,
    ratingCount: ratingRow.c,
    thumbUp,
    thumbDown,
    ratingDist,
    intentDist,
    dailyTrend,
    topFaqs,
    pendingHandoffs,
    pendingTickets,
    totalTickets,
    avgLatency: avgLatencyRow.a ? Math.round(avgLatencyRow.a) : 0,
  };
}

export function clearAllData(): void {
  db.exec('DELETE FROM feedbacks; DELETE FROM handoffs; DELETE FROM tickets; DELETE FROM messages; DELETE FROM sessions;');
}

export default db;
