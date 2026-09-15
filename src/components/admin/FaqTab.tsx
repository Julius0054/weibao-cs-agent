import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Faq } from '../../types';
import { api, fmtTime } from '../../lib/api';

const EMPTY: Partial<Faq> = { category: '报修流程', question: '', answer: '', keywords: '' };

export default function FaqTab() {
  const [rows, setRows] = useState<Faq[]>([]);
  const [kw, setKw] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<Partial<Faq> | null>(null);
  const [testQ, setTestQ] = useState('');
  const [testHits, setTestHits] = useState<any[] | null>(null);

  const load = () => api.listFaqs().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);

  const data = useMemo(() => {
    let d = rows;
    if (cat) d = d.filter((r) => r.category === cat);
    if (kw.trim()) {
      const k = kw.trim();
      d = d.filter((r) => [r.question, r.answer, r.keywords].some((v) => (v || '').includes(k)));
    }
    return d;
  }, [rows, kw, cat]);

  const save = async () => {
    if (!editing?.question?.trim() || !editing?.answer?.trim()) return;
    await api.saveFaq(editing);
    setEditing(null);
    load();
  };

  const remove = async (f: Faq) => {
    if (!confirm(`删除知识条目「${f.question}」？`)) return;
    await api.deleteFaq(f.id);
    load();
  };

  const runTest = async () => {
    if (!testQ.trim()) return;
    setTestHits(await api.searchKb(testQ.trim(), 5));
  };

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          <Plus size={14} /> 新增条目
        </button>
        <select className="input" style={{ width: 140 }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div style={{ position: 'relative', flex: '0 1 260px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="搜索问题 / 答案" value={kw} onChange={(e) => setKw(e.target.value)} />
        </div>
        <span style={{ flex: 1 }} />
        <input
          className="input"
          style={{ width: 220 }}
          placeholder="检索测试：输入业主问法"
          value={testQ}
          onChange={(e) => setTestQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runTest()}
        />
        <button className="btn btn-sm" onClick={runTest}>
          试检索
        </button>
      </div>

      {testHits && (
        <div className="card" style={{ marginBottom: 13 }}>
          <div className="card-title">
            检索结果（{testHits.length}）
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setTestHits(null)}>
              关闭
            </button>
          </div>
          {testHits.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>无命中 —— 该问法会走大模型自由应答或转人工，建议补充知识条目。</div>
          ) : (
            testHits.map((h) => (
              <div key={h.id} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '6px 0', fontSize: 12.5 }}>
                <span className="kb-score">{Math.round(h.score * 100)}%</span>
                <span className="tag tag-slate">{h.category}</span>
                <span>{h.question}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 96 }}>分类</th>
              <th style={{ width: 240 }}>标准问法</th>
              <th>标准答案</th>
              <th style={{ width: 150 }}>关键词</th>
              <th style={{ width: 60 }}>命中</th>
              <th style={{ width: 100 }}>更新</th>
              <th style={{ width: 74 }} />
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty">暂无知识条目</div>
                </td>
              </tr>
            )}
            {data.map((f) => (
              <tr key={f.id}>
                <td>
                  <span className="tag tag-cyan">{f.category}</span>
                </td>
                <td style={{ color: 'var(--text)' }}>{f.question}</td>
                <td style={{ color: 'var(--text-2)', maxWidth: 460 }}>
                  {f.answer.length > 120 ? `${f.answer.slice(0, 120)}…` : f.answer}
                </td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{f.keywords || '—'}</td>
                <td style={{ color: f.hit_count > 0 ? 'var(--brand)' : 'var(--text-3)' }}>{f.hit_count}</td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtTime(f.updated_at)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setEditing(f)}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }} onClick={() => remove(f)}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-mask" onClick={() => setEditing(null)}>
          <div className="modal wide fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editing.id ? '编辑知识条目' : '新增知识条目'}</div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>分类</label>
                  <input className="input" value={editing.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                </div>
                <div className="field">
                  <label>检索关键词（空格分隔，可选）</label>
                  <input className="input" value={editing.keywords || ''} onChange={(e) => setEditing({ ...editing, keywords: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>标准问法 *</label>
                <input className="input" value={editing.question || ''} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
              </div>
              <div className="field">
                <label>标准答案 *</label>
                <textarea
                  className="input"
                  style={{ minHeight: 150 }}
                  value={editing.answer || ''}
                  onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={save} disabled={!editing.question?.trim() || !editing.answer?.trim()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
