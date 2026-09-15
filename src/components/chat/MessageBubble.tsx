import React from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { APP_CONFIG } from '../../config';
import { fmtClock } from '../../lib/api';
import { HandoffCard, IntentTag, KbPanel, RateBar, TicketCard, Typing } from './parts';

/** 轻量富文本：支持 **加粗**、`代码`、- 列表、有序列表 */
function renderRich(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const bullet = /^\s*[-•]\s+/.test(line);
    const num = /^\s*\d+[.、)]\s+/.test(line);
    const content = line.replace(/^\s*[-•]\s+/, '');
    const parts: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*|`(.+?)`/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      if (m.index > last) parts.push(content.slice(last, m.index));
      if (m[1]) parts.push(<strong key={`${i}-${m.index}`}>{m[1]}</strong>);
      else if (m[2])
        parts.push(
          <code
            key={`${i}-${m.index}`}
            style={{ background: 'rgba(255,255,255,.07)', padding: '1px 5px', borderRadius: 5, fontSize: '.92em' }}
          >
            {m[2]}
          </code>,
        );
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push(content.slice(last));

    return (
      <div key={i} style={bullet || num ? { paddingLeft: 14, position: 'relative' } : undefined}>
        {bullet && <span style={{ position: 'absolute', left: 2, color: 'var(--brand)' }}>·</span>}
        {parts.length ? parts : '\u00a0'}
      </div>
    );
  });
}

interface Props {
  msg: ChatMessage;
  onRate?: (msg: ChatMessage, rating: number, thumb: 'up' | 'down') => void;
  onLeaveMsg?: () => void;
  showRate?: boolean;
}

export default function MessageBubble({ msg, onRate, onLeaveMsg, showRate }: Props) {
  const isUser = msg.role === 'user';

  return (
    <div className={`msg-row ${isUser ? 'user' : ''} fade-in`}>
      <div className={`avatar ${isUser ? 'user' : 'bot'}`}>{isUser ? '业主' : APP_CONFIG.initial}</div>
      <div className="msg-body">
        {(msg.intent || msg.offline) && (
          <div className="msg-meta">
            <IntentTag intent={msg.intent} />
            {msg.intent?.urgent && (
              <span className="tag tag-red">
                <AlertTriangle size={11} /> 紧急
              </span>
            )}
            {msg.offline && (
              <span className="tag tag-slate">
                <WifiOff size={11} /> 本地知识库
              </span>
            )}
            {!isUser && msg.latency ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{(msg.latency / 1000).toFixed(1)}s</span> : null}
          </div>
        )}

        <div className={`bubble ${isUser ? 'user' : 'bot'}`} style={msg.error ? { borderColor: 'rgba(244,102,106,.4)' } : undefined}>
          {msg.content ? renderRich(msg.content) : msg.streaming ? <Typing /> : '\u00a0'}
          {msg.streaming && msg.content && (
            <span
              className="blink"
              style={{ display: 'inline-block', width: 7, height: 15, background: 'var(--brand)', verticalAlign: '-2px', marginLeft: 3, borderRadius: 2 }}
            />
          )}
        </div>

        {!isUser && <KbPanel hits={msg.kbHits} />}
        {msg.ticket && <TicketCard ticket={msg.ticket} />}
        {msg.handoff && <HandoffCard handoff={msg.handoff} onLeaveMsg={onLeaveMsg} />}

        {!isUser && showRate && !msg.streaming && onRate && (
          <RateBar rated={msg.rated} onRate={(r, t) => onRate(msg, r, t)} />
        )}

        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{fmtClock(msg.createdAt)}</div>
      </div>
    </div>
  );
}
