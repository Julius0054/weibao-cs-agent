export type IntentCode =
  | 'repair_report'
  | 'repair_progress'
  | 'warranty_policy'
  | 'service_process'
  | 'complaint'
  | 'human_handoff'
  | 'greeting'
  | 'out_of_scope';

export interface IntentInfo {
  code: IntentCode | string;
  label: string;
  confidence: number;
  matched?: string[];
  urgent?: boolean;
}

export interface KbHit {
  id: string;
  question: string;
  category: string;
  score: number;
  answer?: string;
}

export interface Ticket {
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
  status: 'pending' | 'assigned' | 'done' | string;
  created_at: string;
  updated_at: string;
}

export interface Handoff {
  id: string;
  session_id?: string | null;
  reason?: string | null;
  summary?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  message?: string | null;
  status: 'pending' | 'processing' | 'closed' | string;
  reply?: string | null;
  created_at: string;
  handled_at?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  streaming?: boolean;
  intent?: IntentInfo;
  kbHits?: KbHit[];
  suggestion?: { unit: string; trade: string; matched: string | null } | null;
  ticket?: Ticket | null;
  handoff?: Handoff | null;
  offline?: boolean;
  latency?: number;
  rated?: 'up' | 'down';
  error?: boolean;
}

export interface SessionSummary {
  id: string;
  title: string;
  room?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: string;
  last_intent?: string | null;
  resolved?: number;
  messageCount: number;
  lastMessage?: string;
  rating?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords?: string | null;
  unit?: string | null;
  trade?: string | null;
  hit_count: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface Stats {
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

export const INTENT_META: Record<string, { label: string; color: string }> = {
  repair_report: { label: '报修申请', color: 'amber' },
  repair_progress: { label: '进度查询', color: 'cyan' },
  warranty_policy: { label: '质保咨询', color: 'green' },
  service_process: { label: '服务咨询', color: 'green' },
  complaint: { label: '投诉催办', color: 'red' },
  human_handoff: { label: '转人工', color: 'red' },
  greeting: { label: '问候寒暄', color: 'slate' },
  out_of_scope: { label: '超出范围', color: 'slate' },
};
