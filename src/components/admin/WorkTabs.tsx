import React, { useEffect, useState } from 'react';
import type { Handoff, Ticket } from '../../types';
import { api, fmtTime } from '../../lib/api';
import { StatusTag } from '../chat/parts';

/* ================= 报修工单 ================= */
export function TicketsTab() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<string>('');

  const load = () => api.listTickets(status || undefined).then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, [status]);

  const advance = async (t: Ticket, next: string) => {
    await api.patchTicket(t.id, { status: next });
    load();
  };

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          {([['', '全部'], ['pending', '待派单'], ['assigned', '已派单'], ['done', '已完成']] as const).map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
              {l}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {rows.length} 单</span>
        <button className="btn btn-sm" onClick={load}>刷新</button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 128 }}>工单号</th>
              <th style={{ width: 80 }}>房号</th>
              <th style={{ width: 145 }}>联系人</th>
              <th style={{ width: 80 }}>工种</th>
              <th style={{ width: 150 }}>责任单位</th>
              <th>问题描述</th>
              <th style={{ width: 78 }}>状态</th>
              <th style={{ width: 100 }}>创建时间</th>
              <th style={{ width: 96 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9}><div className="empty">暂无报修工单</div></td></tr>
            )}
            {rows.map((t) => (
              <tr key={t.id}>
                <td style={{ color: 'var(--amber)', fontWeight: 500 }}>{t.ticket_no}</td>
                <td>{t.room || '—'}</td>
                <td>{[t.contact_name, t.contact_phone].filter(Boolean).join(' ') || '—'}</td>
                <td>{t.trade || '—'}</td>
                <td style={{ color: 'var(--text-2)' }}>{t.unit || '—'}</td>
                <td style={{ color: 'var(--text-2)' }}>{t.description}</td>
                <td><StatusTag status={t.status} /></td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtTime(t.created_at)}</td>
                <td>
                  {t.status === 'pending' && (
                    <button className="btn btn-sm" onClick={() => advance(t, 'assigned')}>派单</button>
                  )}
                  {t.status === 'assigned' && (
                    <button className="btn btn-sm" onClick={() => advance(t, 'done')}>完成</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ================= 转人工留言 ================= */
export function HandoffsTab() {
  const [rows, setRows] = useState<Handoff[]>([]);
  const [status, setStatus] = useState<string>('');
  const [replying, setReplying] = useState<Handoff | null>(null);
  const [reply, setReply] = useState('');

  const load = () => api.listHandoffs(status || undefined).then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, [status]);

  const close = async () => {
    if (!replying) return;
    await api.patchHandoff(replying.id, { status: 'closed', reply, handled_at: new Date().toISOString() });
    setReplying(null);
    setReply('');
    load();
  };

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          {([['', '全部'], ['pending', '待处理'], ['processing', '处理中'], ['closed', '已闭环']] as const).map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
              {l}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {rows.length} 条</span>
        <button className="btn btn-sm" onClick={load}>刷新</button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 150 }}>转人工原因</th>
              <th style={{ width: 145 }}>联系人</th>
              <th>业主留言 / 对话摘要</th>
              <th style={{ width: 78 }}>状态</th>
              <th style={{ width: 100 }}>提交时间</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6}><div className="empty">暂无转人工记录</div></td></tr>
            )}
            {rows.map((h) => (
              <tr key={h.id}>
                <td style={{ color: 'var(--red)' }}>{h.reason || '—'}</td>
                <td>{[h.contact_name, h.contact_phone].filter(Boolean).join(' ') || '未留联系方式'}</td>
                <td style={{ color: 'var(--text-2)' }}>
                  {h.message || h.summary || '—'}
                  {h.reply && (
                    <div style={{ marginTop: 5, fontSize: 12, color: 'var(--green)' }}>回复：{h.reply}</div>
                  )}
                </td>
                <td><StatusTag status={h.status} /></td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtTime(h.created_at)}</td>
                <td>
                  {h.status !== 'closed' ? (
                    <>
                      {h.status === 'pending' && (
                        <button
                          className="btn btn-sm"
                          style={{ marginRight: 5 }}
                          onClick={async () => {
                            await api.patchHandoff(h.id, { status: 'processing' });
                            load();
                          }}
                        >
                          受理
                        </button>
                      )}
                      <button className="btn btn-sm btn-primary" onClick={() => setReplying(h)}>闭环</button>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtTime(h.handled_at || undefined)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {replying && (
        <div className="modal-mask" onClick={() => setReplying(null)}>
          <div className="modal fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ fontSize: 15, fontWeight: 600 }}>处理结果闭环</div>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 12 }}>
                业主：{replying.contact_name || '—'} {replying.contact_phone || ''}
                <br />
                留言：{replying.message || replying.summary || '—'}
              </div>
              <div className="field">
                <label>处理说明</label>
                <textarea
                  className="input"
                  value={reply}
                  placeholder="如：已电话联系业主，2026-08-07 上午安排精装总包A木工上门复查"
                  onChange={(e) => setReply(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setReplying(null)}>取消</button>
              <button className="btn btn-primary" onClick={close} disabled={!reply.trim()}>确认闭环</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default { TicketsTab, HandoffsTab };
