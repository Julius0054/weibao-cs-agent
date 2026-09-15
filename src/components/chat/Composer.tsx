import React, { useEffect, useRef } from 'react';
import { Headphones, Send, Square } from 'lucide-react';
import { QUICK_ASKS } from '../../config';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onHandoff: () => void;
  loading: boolean;
  showQuick: boolean;
}

export default function Composer({ value, onChange, onSend, onStop, onHandoff, loading, showQuick }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!loading && value.trim()) onSend();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        {showQuick && (
          <div className="quick-row">
            {QUICK_ASKS.map((q) => (
              <button key={q} className="chip" onClick={() => onChange(q)} disabled={loading}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="composer">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            placeholder="描述您的房屋问题，例如：7-2604 卫生间漏水，联系电话 138xxxx1234"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="btn btn-ghost btn-sm" onClick={onHandoff} title="转人工留言">
            <Headphones size={15} />
          </button>
          {loading ? (
            <button className="btn btn-sm" onClick={onStop} title="停止生成">
              <Square size={13} fill="currentColor" /> 停止
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={onSend} disabled={!value.trim()} title="发送（Enter）">
              <Send size={14} /> 发送
            </button>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 7, textAlign: 'center' }}>
          Enter 发送 · Shift+Enter 换行 · 报修请提供「楼号-房号 + 问题 + 联系电话」
        </div>
      </div>
    </div>
  );
}
