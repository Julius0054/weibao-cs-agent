import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ClipboardList, Headphones, Star } from 'lucide-react';
import type { Handoff, IntentInfo, KbHit, Ticket } from '../../types';
import { INTENT_META } from '../../types';

/* ---------- 意图标签 ---------- */
export function IntentTag({ intent }: { intent?: IntentInfo }) {
  if (!intent) return null;
  const meta = INTENT_META[intent.code] || { label: intent.label || intent.code, color: 'slate' };
  return (
    <span className={`tag tag-${meta.color}`} title={intent.matched?.length ? `命中词：${intent.matched.join('、')}` : undefined}>
      {meta.label}
      {typeof intent.confidence === 'number' && intent.confidence > 0 && (
        <em style={{ fontStyle: 'normal', opacity: 0.65 }}>{Math.round(intent.confidence * 100)}%</em>
      )}
    </span>
  );
}

/* ---------- 打字动画 ---------- */
export function Typing() {
  return (
    <span className="typing">
      <i /><i /><i />
    </span>
  );
}

/* ---------- 知识库命中面板 ---------- */
export function KbPanel({ hits }: { hits?: KbHit[] }) {
  const [open, setOpen] = useState(false);
  if (!hits || hits.length === 0) return null;
  return (
    <div className="kb-panel">
      <div className="kb-head" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <BookOpen size={12} />
        <span>参考知识库 {hits.length} 条</span>
        <span style={{ flex: 1 }} />
        <span className="kb-score">{Math.round((hits[0]?.score ?? 0) * 100)}% 相关</span>
      </div>
      {open &&
        hits.map((h) => (
          <div key={h.id} className="kb-item">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="tag tag-slate">{h.category}</span>
              <span style={{ flex: 1 }}>{h.question}</span>
              <span className="kb-score">{Math.round(h.score * 100)}%</span>
            </div>
          </div>
        ))}
    </div>
  );
}

/* ---------- 工单卡片 ---------- */
export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="ticket-card fade-in">
      <div className="ticket-head">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClipboardList size={13} /> 报修工单已生成
        </span>
        <span>{ticket.ticket_no}</span>
      </div>
      <div className="ticket-body">
        <div>
          <div className="kv-label">房号</div>
          <div className="kv-value">{ticket.room || '—'}</div>
        </div>
        <div>
          <div className="kv-label">联系人</div>
          <div className="kv-value">
            {ticket.contact_name || '业主'} {ticket.contact_phone || ''}
          </div>
        </div>
        <div>
          <div className="kv-label">工种</div>
          <div className="kv-value">{ticket.trade || '待定'}</div>
        </div>
        <div>
          <div className="kv-label">责任单位</div>
          <div className="kv-value">{ticket.unit || '待定'}</div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="kv-label">问题描述</div>
          <div className="kv-value">{ticket.description}</div>
        </div>
        {ticket.expect_time && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="kv-label">期望上门时间</div>
            <div className="kv-value">{ticket.expect_time}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 转人工卡片 ---------- */
export function HandoffCard({ handoff, reason, onLeaveMsg }: { handoff: Handoff; reason?: string; onLeaveMsg?: () => void }) {
  return (
    <div className="handoff-card fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>
        <Headphones size={14} /> 已为您转人工跟进
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
        原因：{reason || handoff.reason || '需人工处理'}
        <br />
        工作人员会在 <strong style={{ color: 'var(--text)' }}>工作日 4 小时内</strong> 与您联系。
        {handoff.contact_phone ? ` 回电号码：${handoff.contact_phone}` : ' 建议补充联系方式，便于回电。'}
      </div>
      {onLeaveMsg && (
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={onLeaveMsg}>
          补充留言 / 联系方式
        </button>
      )}
    </div>
  );
}

/* ---------- 满意度评价 ---------- */
export function RateBar({
  rated,
  onRate,
}: {
  rated?: 'up' | 'down';
  onRate: (rating: number, thumb: 'up' | 'down') => void;
}) {
  const [hover, setHover] = useState(0);
  const [score, setScore] = useState(0);

  if (rated) {
    return (
      <div className="rate-bar" style={{ borderStyle: 'solid' }}>
        <span style={{ fontSize: 12.5, color: rated === 'up' ? 'var(--green)' : 'var(--amber)' }}>
          {rated === 'up' ? '感谢您的好评，我会继续努力 🔥' : '抱歉没能帮上忙，已转交人工同事跟进'}
        </span>
      </div>
    );
  }

  return (
    <div className="rate-bar">
      <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>本次解答满意吗？</span>
      <span style={{ display: 'flex', gap: 3 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`star ${(hover || score) >= n ? 'on' : ''}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              setScore(n);
              onRate(n, n >= 4 ? 'up' : 'down');
            }}
            title={`${n} 分`}
          >
            <Star size={17} fill={(hover || score) >= n ? 'currentColor' : 'none'} />
          </button>
        ))}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>（2 分及以下将自动转人工回访）</span>
    </div>
  );
}

/* ---------- 通用小标签 ---------- */
export function StatusTag({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: '待处理', color: 'amber' },
    assigned: { label: '已派单', color: 'cyan' },
    processing: { label: '处理中', color: 'cyan' },
    done: { label: '已完成', color: 'green' },
    closed: { label: '已关闭', color: 'slate' },
    active: { label: '进行中', color: 'cyan' },
    handoff: { label: '转人工', color: 'red' },
  };
  const m = map[status] || { label: status, color: 'slate' };
  return <span className={`tag tag-${m.color}`}>{m.label}</span>;
}

export default { IntentTag, KbPanel, TicketCard, HandoffCard, RateBar, Typing, StatusTag };
