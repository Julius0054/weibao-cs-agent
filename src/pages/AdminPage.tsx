import React, { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import type { Stats } from '../types';
import { api } from '../lib/api';
import Overview from '../components/admin/Overview';
import SessionsTab from '../components/admin/SessionsTab';
import { HandoffsTab, TicketsTab } from '../components/admin/WorkTabs';
import FaqTab from '../components/admin/FaqTab';

type TabKey = 'overview' | 'sessions' | 'tickets' | 'handoffs' | 'faq';

const TABS: Array<[TabKey, string]> = [
  ['overview', '数据概览'],
  ['sessions', '对话记录'],
  ['tickets', '报修工单'],
  ['handoffs', '转人工留言'],
  ['faq', '知识库'],
];

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const loadStats = useCallback(() => {
    api.stats(14).then(setStats).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, tab]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  const seed = async () => {
    setBusy(true);
    try {
      const r = await api.seedDemo(false);
      flash(r.created > 0 ? `已生成 ${r.created} 个演示会话` : '已有数据，未重复生成');
      loadStats();
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!confirm('清空所有会话、工单、转人工与评价数据？（知识库保留）')) return;
    setBusy(true);
    try {
      await api.clearAll();
      flash('已清空业务数据');
      loadStats();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="main-area" style={{ flexDirection: 'column' }}>
      <div style={{ padding: '14px 26px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="seg">
            {TABS.map(([k, l]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {l}
                {k === 'handoffs' && stats && stats.pendingHandoffs > 0 && (
                  <span className="tag tag-red" style={{ marginLeft: 6, padding: '0 5px' }}>
                    {stats.pendingHandoffs}
                  </span>
                )}
              </button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={loadStats} disabled={busy}>
            <RefreshCw size={13} /> 刷新
          </button>
          <button className="btn btn-sm" onClick={seed} disabled={busy}>
            <Database size={13} /> 填充演示数据
          </button>
          <button className="btn btn-sm btn-danger" onClick={clear} disabled={busy}>
            清空数据
          </button>
        </div>
      </div>

      <div className="admin-body">
        <div className="admin-inner">
          {tab === 'overview' && (stats ? <Overview stats={stats} /> : <div className="empty">加载统计数据中…</div>)}
          {tab === 'sessions' && <SessionsTab />}
          {tab === 'tickets' && <TicketsTab />}
          {tab === 'handoffs' && <HandoffsTab />}
          {tab === 'faq' && <FaqTab />}
        </div>
      </div>

      {toast && (
        <div
          className="fade-in"
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
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
