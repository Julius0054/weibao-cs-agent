import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  defaultName?: string;
  defaultPhone?: string;
  onClose: () => void;
  onSubmit: (payload: { contactName: string; contactPhone: string; message: string }) => Promise<void> | void;
}

export default function HandoffModal({ open, defaultName, defaultPhone, onClose, onSubmit }: Props) {
  const [name, setName] = useState(defaultName || '');
  const [phone, setPhone] = useState(defaultPhone || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;

  const submit = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setErr('请填写正确的 11 位手机号，便于工作人员回电');
      return;
    }
    if (!msg.trim()) {
      setErr('请简要描述需要人工协助的问题');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      await onSubmit({ contactName: name.trim(), contactPhone: phone.trim(), message: msg.trim() });
      setMsg('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>转人工留言</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
              工作日 8:30-17:30，工作人员将在 4 小时内回电
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>称呼</label>
            <input className="input" value={name} placeholder="如：李女士" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>联系电话 *</label>
            <input
              className="input"
              value={phone}
              placeholder="11 位手机号"
              maxLength={11}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="field">
            <label>留言内容 *</label>
            <textarea
              className="input"
              value={msg}
              placeholder="请说明房号与需要人工处理的问题，例如：7-2604 主卧渗水已报修两次仍未解决，希望尽快安排"
              onChange={(e) => setMsg(e.target.value)}
            />
          </div>
          {err && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? '提交中…' : '提交留言'}
          </button>
        </div>
      </div>
    </div>
  );
}
