import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';

const CHANNELS = [
  { id: 'world', label: 'World', color: '#ffb74d' },
  { id: 'local', label: 'Local', color: '#81c784' },
  { id: 'trade', label: 'Trade', color: '#ba68c8' },
  { id: 'guild', label: 'Guild', color: '#4fc3f7' },
  { id: 'system', label: 'System', color: '#ef5350' },
];

export function ChatBox() {
  const { chatMessages } = useGameStore();
  const [activeChannel, setActiveChannel] = useState('world');
  const [inputText, setInputText] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const socket = getSocket();
    socket.emit('chat:send', {
      channel: activeChannel,
      content: inputText.trim(),
    });

    setInputText('');
  };

  const filtered = chatMessages.filter(
    (m) => activeChannel === 'world' || m.channel === activeChannel || m.channel === 'system'
  );

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      bottom: '16px',
      left: '16px',
      width: '380px',
      height: '220px',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      {/* Channel Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #2a2419', paddingBottom: '4px' }}>
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setActiveChannel(ch.id)}
            style={{
              background: activeChannel === ch.id ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
              border: 'none',
              color: activeChannel === ch.id ? ch.color : '#777',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontWeight: activeChannel === ch.id ? 'bold' : 'normal',
            }}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* Messages stream */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        {filtered.map((msg) => {
          const chObj = CHANNELS.find((c) => c.id === msg.channel) || CHANNELS[0];
          return (
            <div key={msg.id} style={{ wordBreak: 'break-word', lineHeight: '1.3' }}>
              <span style={{ color: chObj?.color, fontWeight: 'bold' }}>
                [{chObj?.label}] {msg.senderName ? `${msg.senderName}: ` : ''}
              </span>
              <span style={{ color: msg.channel === 'system' ? '#ff8888' : '#e0e0e0' }}>
                {msg.content}
              </span>
            </div>
          );
        })}
        <div ref={msgEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '6px', borderTop: '1px solid #2a2419', paddingTop: '6px' }}>
        <input
          type="text"
          placeholder={`Press Enter to talk in ${activeChannel}...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={200}
          style={{
            flex: 1,
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid var(--color-gold-dark)',
            color: '#fff',
            fontSize: '12px',
            padding: '4px 8px',
            borderRadius: '2px',
            outline: 'none',
          }}
        />
        <button type="submit" className="fantasy-button" style={{ fontSize: '11px', padding: '4px 10px' }}>
          Send
        </button>
      </form>
    </div>
  );
}
