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
    getSocket().emit('chat:send', { channel: activeChannel, content: inputText.trim() });
    setInputText('');
  };

  const filtered = chatMessages.filter(
    (m) => activeChannel === 'world' || m.channel === activeChannel || m.channel === 'system'
  );

  return (
    <div className="fantasy-panel hud-chat wow-chat" style={{
      position: 'absolute',
      bottom: '22px',
      left: '18px',
      width: 'min(370px, calc(100vw - 36px))',
      height: '190px',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div className="wow-chat-tabs">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setActiveChannel(ch.id)}
            style={{
              color: activeChannel === ch.id ? ch.color : '#a99b82',
              borderBottomColor: activeChannel === ch.id ? ch.color : 'transparent',
            }}
          >
            {ch.label}
          </button>
        ))}
      </div>
      <div className="wow-chat-messages">
        {filtered.map((msg) => {
          const chObj = CHANNELS.find((c) => c.id === msg.channel) || CHANNELS[0];
          return (
            <div key={msg.id} className="wow-chat-line">
              <span style={{ color: chObj.color }}>
                [{chObj.label}] {msg.senderName ? `${msg.senderName}: ` : ''}
              </span>
              <span style={{ color: msg.channel === 'system' ? '#f0c46d' : '#e7dfd0' }}>
                {msg.content}
              </span>
            </div>
          );
        })}
        <div ref={msgEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="wow-chat-input">
        <input
          type="text"
          placeholder={`Press Enter to talk in ${activeChannel}...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={200}
        />
        <button type="submit" className="fantasy-button">Send</button>
      </form>
    </div>
  );
}
