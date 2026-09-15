import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Search, X } from 'lucide-react';
import type { SessionSummary } from '../../types';
import { INTENT_META } from '../../types';
import { api, fmtTime } from '../../lib/api';
import { StatusTag } from '../chat/parts';

function SessionDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ session: any; messages: any[]; feedbacks: any[] } | null>(null);

  useEffect(() => {
    api.getSession(id).then(setData).catch(() => setData(null));
  }, [id]);

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal wide fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{data?.session?.title || '会话详情'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, display: 'flex', gap: 10 }}>
              <span>房号 {data?.session?.room || '—'}</span>
              <span>电话 {data?.session?.customer_phone || '—'}</span>
              <span>{fmtTime(data?.session?.created_at)}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {!data && <div className="empty">加载中…</div>}
          {data?.messages?.map((m) => (
            <div key={m.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className={`tag ${m.role === 'user' ? 'tag-slate' : 'tag-cyan'}`}>{m.role === 'user' ? '业主' : '云小维'}</span>
                {m.intent && <span className="tag tag-violet">{INTENT_META[m.intent]?.label || m.intent_label || m.intent}</span>}
                {m.needs_human === 1 && <span className="tag tag-red">需人工</span>}
                {m.model === 'local-kb' && <span className="tag tag-slate">本地库</span>}
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtTime(m.created_at)}</span>
                {m.latency_ms ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{(m.latency_ms / 1000).toFixed(1)}s</span> : null}
              </div>
              <div
                style={{
                  background: m.role === 'user' ? 'rgba(45,212,191,.07)' : 'var(--bg-soft)',
                  border: '1px solid var(--line-soft)',
                  borderRadius: 10,
                  padding: '10px 13px',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.7,
                }}
              >
                {m.content}
              </div>
              {Array.isArray(m.kb_hits) && m.kb_hits.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  引用：{m.kb_hits.map((k: any) => `${k.question}(${Math.round((k.score || 0) * 100)}%)`).join('　')}
                </div>
              )}
            </div>
          ))}

          {data && data.feedbacks?.length > 0 && (
            <div className="card" style={{ marginTop: 6 }}>
              <div className="card-title">满意度评价</div>
              {data.feedbacks.map((f: any) => (
                <div key={f.id} style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--amber)' }}>{'★'.repeat(f.rating)}</span>
                  <span style={{ marginLeft: 8 }}>{f.comment || (f.thumb === 'up' ? '好评' : '差评')}</span>
                  <span style={{ marginLeft: 8, color: 'var(--text-3)' }}>{fmtTime(f.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessionsTab() {
  const [rows, setRows] = useState<SessionSummary[]>([]);
  const [kw, setKw] = useState('');
  const [filter, setFilter] = useState<'all' | 'handoff' | 'rated'>('all');
  const [detail, setDetail] = useState<string | null>(null);

  const load = () => api.listSessions().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);

  const data = useMemo(() => {
    let d = rows;
    if (filter === 'handoff') d = d.filter((r) => r.status === 'handoff');
    if (filter === 'rated') d = d.filter((r) => r.rating != null);
    if (kw.trim()) {
      const k = kw.trim();
      d = d.filter((r) => [r.title, r.room, r.customer_phone, r.lastMessage].some((v) => (v || '').includes(k)));
    }
    return d;
  }, [rows, kw, filter]);

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          {([['all', '全部'], ['handoff', '转人工'], ['rated', '已评价']] as const).map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: '0 1 280px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="搜索房号 / 电话 / 关键词"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {data.length} 条</span>
        <button className="btn btn-sm" onClick={load}>
          刷新
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 210 }}>咨询主题</th>
              <th style={{ width: 90 }}>房号</th>
              <th style={{ width: 115 }}>联系电话</th>
              <th style={{ width: 95 }}>最后意图</th>
              <th>最近消息</th>
              <th style={{ width: 60 }}>消息数</th>
              <th style={{ width: 74 }}>满意度</th>
              <th style={{ width: 78 }}>状态</th>
              <th style={{ width: 105 }}>更新时间</th>
              <th style={{ width: 58 }} />
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="empty">暂无会话记录，可在「概览」中点击「填充演示数据」</div>
                </td>
              </tr>
            )}
            {data.map((s) => (
              <tr key={s.id}>
                <td style={{ color: 'var(--text)' }}>{s.title}</td>
                <td>{s.room || '—'}</td>
                <td>{s.customer_phone || '—'}</td>
                <td>{s.last_intent ? <span className={`tag tag-${INTENT_META[s.last_intent]?.color || 'slate'}`}>{INTENT_META[s.last_intent]?.label || s.last_intent}</span> : '—'}</td>
                <td style={{ color: 'var(--text-2)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.lastMessage || '—'}
                </td>
                <td>{s.messageCount}</td>
                <td style={{ color: s.rating != null ? 'var(--amber)' : 'var(--text-3)' }}>{s.rating != null ? `${s.rating}★` : '—'}</td>
                <td>
                  <StatusTag status={s.status} />
                </td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtTime(s.updated_at)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDetail(s.id)} title="查看完整对话">
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && <SessionDetail id={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
