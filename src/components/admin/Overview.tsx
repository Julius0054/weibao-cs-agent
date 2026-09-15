import React from 'react';
import type { Stats } from '../../types';

const COLORS = ['#f4666a', '#f5a524', '#facc15', '#4ade80', '#2dd4bf'];

function StatCard({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/** 每日趋势：纯 SVG 折线 + 面积 */
function TrendChart({ data }: { data: Stats['dailyTrend'] }) {
  const W = 560;
  const H = 170;
  const PAD = { l: 30, r: 12, t: 14, b: 24 };
  if (!data.length) return <div className="empty">暂无数据</div>;

  const max = Math.max(4, ...data.map((d) => Math.max(d.messages, d.sessions)));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (i * iw) / (data.length - 1));
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  const line = (key: 'messages' | 'sessions') => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[key])}`).join(' ');
  const area = `${line('messages')} L${x(data.length - 1)},${PAD.t + ih} L${x(0)},${PAD.t + ih} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((r) => (
        <g key={r}>
          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * r} y2={PAD.t + ih * r} stroke="#1f2c3d" strokeWidth="1" />
          <text x={PAD.l - 6} y={PAD.t + ih * r + 4} fill="#64748b" fontSize="9.5" textAnchor="end">
            {Math.round(max * (1 - r))}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#ag)" />
      <path d={line('messages')} fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinejoin="round" />
      <path d={line('sessions')} fill="none" stroke="#a78bfa" strokeWidth="1.6" strokeDasharray="4 3" />
      {data.map((d, i) => (
        <g key={d.date}>
          <circle cx={x(i)} cy={y(d.messages)} r="2.6" fill="#2dd4bf" />
          {(i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && (
            <text x={x(i)} y={H - 7} fill="#64748b" fontSize="9.5" textAnchor="middle">
              {d.date.slice(5)}
            </text>
          )}
        </g>
      ))}
      <g>
        <circle cx={W - 118} cy={12} r="3" fill="#2dd4bf" />
        <text x={W - 110} y={15.5} fill="#93a4b8" fontSize="10">消息</text>
        <circle cx={W - 66} cy={12} r="3" fill="#a78bfa" />
        <text x={W - 58} y={15.5} fill="#93a4b8" fontSize="10">会话</text>
      </g>
    </svg>
  );
}

export default function Overview({ stats }: { stats: Stats }) {
  const maxIntent = Math.max(1, ...stats.intentDist.map((i) => i.count));
  const maxRating = Math.max(1, ...stats.ratingDist.map((r) => r.count));
  const ratingMap = new Map(stats.ratingDist.map((r) => [r.rating, r.count]));

  return (
    <>
      <div className="stat-grid">
        <StatCard label="累计会话" value={stats.totalSessions} hint={`消息 ${stats.totalMessages} 条 · 提问 ${stats.userMessages} 次`} />
        <StatCard
          label="平均满意度"
          value={stats.ratingCount ? `${stats.avgRating.toFixed(1)} ★` : '—'}
          hint={`${stats.ratingCount} 次评价 · 好评 ${stats.thumbUp} / 差评 ${stats.thumbDown}`}
          tone={stats.avgRating >= 4 ? 'var(--green)' : stats.avgRating >= 3 ? 'var(--amber)' : 'var(--red)'}
        />
        <StatCard
          label="自助解决率"
          value={`${stats.resolvedRate}%`}
          hint={`转人工率 ${stats.handoffRate}%`}
          tone="var(--brand)"
        />
        <StatCard
          label="待处理人工"
          value={stats.pendingHandoffs}
          hint={`累计转人工会话 ${stats.handoffSessions} 个`}
          tone={stats.pendingHandoffs > 0 ? 'var(--red)' : undefined}
        />
        <StatCard label="报修工单" value={stats.totalTickets} hint={`待派单 ${stats.pendingTickets} 个`} tone="var(--amber)" />
        <StatCard label="平均响应" value={stats.avgLatency ? `${(stats.avgLatency / 1000).toFixed(1)}s` : '—'} hint="从提问到应答完成" />
      </div>

      <div className="panel-grid">
        <div className="card">
          <div className="card-title">近 14 日会话趋势</div>
          <TrendChart data={stats.dailyTrend} />
        </div>

        <div className="card">
          <div className="card-title">满意度分布</div>
          {stats.ratingCount === 0 ? (
            <div className="empty">暂无评价数据</div>
          ) : (
            [5, 4, 3, 2, 1].map((n) => {
              const c = ratingMap.get(n) || 0;
              return (
                <div className="bar-row" key={n}>
                  <div className="bar-name">{'★'.repeat(n)}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(c / maxRating) * 100}%`, background: COLORS[n - 1] }} />
                  </div>
                  <div className="bar-num">{c}</div>
                </div>
              );
            })
          )}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-soft)', fontSize: 12, color: 'var(--text-2)' }}>
            好评率{' '}
            <strong style={{ color: 'var(--green)', fontSize: 15 }}>
              {stats.ratingCount ? Math.round((stats.thumbUp / stats.ratingCount) * 100) : 0}%
            </strong>
            <span style={{ color: 'var(--text-3)' }}>（4 星及以上计入好评）</span>
          </div>
        </div>
      </div>

      <div className="panel-grid">
        <div className="card">
          <div className="card-title">意图分布</div>
          {stats.intentDist.length === 0 ? (
            <div className="empty">暂无数据</div>
          ) : (
            stats.intentDist.map((it) => (
              <div className="bar-row" key={it.intent}>
                <div className="bar-name">{it.label}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(it.count / maxIntent) * 100}%`,
                      background: 'linear-gradient(90deg, #2dd4bf, #22d3ee)',
                    }}
                  />
                </div>
                <div className="bar-num">{it.count}</div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-title">知识库命中 Top 8</div>
          {stats.topFaqs.length === 0 ? (
            <div className="empty">暂无命中记录</div>
          ) : (
            stats.topFaqs.slice(0, 8).map((f, i) => (
              <div
                key={f.id}
                style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '7px 0', borderBottom: i === 7 ? 'none' : '1px solid var(--line-soft)' }}
              >
                <span style={{ width: 18, color: i < 3 ? 'var(--brand)' : 'var(--text-3)', fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                <span className="tag tag-slate">{f.category}</span>
                <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.question}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{f.hit_count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
