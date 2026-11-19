import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export function AuthModal() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() || email.split('@')[0] },
          },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestPlay = async () => {
    setError(null);
    setLoading(true);
    const guestId = Math.random().toString(36).substring(2, 8);
    const guestEmail = `guest_${guestId}@etheria.world`;
    const guestPass = `Guest_${guestId}!99`;

    try {
      const { error } = await supabase.auth.signUp({
        email: guestEmail,
        password: guestPass,
        options: {
          data: { username: `Guest_${guestId}` },
        },
      });
      if (error) {
        // Try login in case it exists
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: guestEmail,
          password: guestPass,
        });
        if (loginErr) throw loginErr;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1a1f2c 0%, #06090e 100%)',
      position: 'relative',
    }}>
      <div className="fantasy-panel" style={{ width: '420px', padding: '32px', textAlign: 'center' }}>
        <h1 className="fantasy-header" style={{ fontSize: '28px', marginBottom: '8px', letterSpacing: '2px' }}>
          PROJECT ETHERIA
        </h1>
        <p style={{ color: '#8c7320', fontSize: '13px', marginBottom: '24px', letterSpacing: '1px' }}>
          A WORLD BEYOND ADVENTURE
        </p>

        {error && (
          <div style={{
            background: 'rgba(255, 68, 68, 0.15)',
            border: '1px solid #ff4444',
            color: '#ff8888',
            fontSize: '12px',
            padding: '8px',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Username / Realm Identity"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid var(--color-gold-dark)',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: '3px',
                outline: 'none',
              }}
            />
          )}

          <input
            type="email"
            placeholder="Account Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid var(--color-gold-dark)',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: '3px',
              outline: 'none',
            }}
          />

          <input
            type="password"
            placeholder="Secret Passphrase"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid var(--color-gold-dark)',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: '3px',
              outline: 'none',
            }}
          />

          <button type="submit" className="fantasy-button" disabled={loading} style={{ height: '42px', fontSize: '15px' }}>
            {loading ? 'Communing...' : isLogin ? 'Enter Etheria' : 'Forge Account'}
          </button>
        </form>

        <div style={{ margin: '16px 0', borderTop: '1px solid #2a2419', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#0e1218', padding: '0 8px', fontSize: '11px', color: '#666' }}>
            OR
          </span>
        </div>

        <button
          onClick={handleGuestPlay}
          className="fantasy-button"
          disabled={loading}
          style={{ width: '100%', height: '38px', background: 'transparent', borderColor: '#4a3f2d', color: '#a0947d' }}
        >
          Instant Guest Play
        </button>

        <p style={{ marginTop: '20px', fontSize: '12px', color: '#888' }}>
          {isLogin ? "No identity yet in the realm? " : "Already have an account? "}
          <span
            onClick={() => setIsLogin(!isLogin)}
            style={{ color: 'var(--color-gold)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLogin ? 'Register now' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  );
}
