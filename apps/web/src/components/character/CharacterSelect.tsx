import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useGameStore } from '../../store/gameStore';
import type { Character, CharacterClass } from '@etheria/shared';

const CLASSES: Array<{
  id: CharacterClass;
  name: string;
  desc: string;
  color: string;
  skills: string;
}> = [
  {
    id: 'mage',
    name: 'Mage',
    desc: 'Master of arcane mysteries, pyromancy, and destructive spellcraft.',
    color: '#4fc3f7',
    skills: 'Pyromancy, Cryomancy, Arcanism, Healing'
  },
  {
    id: 'fighter',
    name: 'Fighter',
    desc: 'Stalwart warrior trained in heavy arms, defensive postures, and brutal melee.',
    color: '#e57373',
    skills: 'Heavy Strike, Shield Bash, Whirlwind, Charge'
  },
  {
    id: 'assassin',
    name: 'Assassin',
    desc: 'Shadow stalker skilled in stealth, deadly burst attacks, and swift evasion.',
    color: '#ba68c8',
    skills: 'Shadow Step, Backstab, Smoke Veil, Ambush'
  },
  {
    id: 'ranger',
    name: 'Ranger',
    desc: 'Master of longbows and firearms with uncanny tactical positioning.',
    color: '#81c784',
    skills: 'Quick Shot, Piercing Shot, Explosive Arrow, Reload'
  }
];

export function CharacterSelect() {
  const { setCharacter, token } = useGameStore();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Creation form
  const [name, setName] = useState('');
  const [charClass, setCharClass] = useState<CharacterClass>('fighter');
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/characters`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCharacters(data.characters || []);
        if (data.characters?.length > 0) {
          setSelectedChar(data.characters[0]);
        } else {
          setIsCreating(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, [token]);

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setSubmitting(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/characters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          characterClass: charClass,
          appearance: { bodyType: 1, hairStyle: 1, hairColor: '#8B4513', skinTone: '#FFD39B', faceStyle: 1 }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create character');
      }

      setIsCreating(false);
      setName('');
      await fetchCharacters();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnterWorld = () => {
    if (selectedChar) {
      setCharacter(selectedChar);
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(circle at center, #151922 0%, #05070a 100%)',
      padding: '40px',
      boxSizing: 'border-box',
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 className="fantasy-header" style={{ fontSize: '32px', margin: 0 }}>PROJECT ETHERIA</h1>
          <p style={{ color: 'var(--color-gold-dark)', margin: '4px 0 0 0', fontSize: '13px' }}>
            SELECT YOUR HERO OR FORGE A NEW DESTINY
          </p>
        </div>
        <button onClick={handleLogout} className="fantasy-button" style={{ background: '#251313', borderColor: '#732c2c' }}>
          Leave Realm
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', gap: '30px', flex: 1, overflow: 'hidden' }}>
        {/* Left: Character List */}
        <div className="fantasy-panel" style={{ width: '360px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 className="fantasy-header" style={{ fontSize: '16px', marginBottom: '14px', borderBottom: '1px solid #332816', paddingBottom: '8px' }}>
            ROSTER ({characters.length}/5)
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {characters.map((char) => {
              const isSelected = selectedChar?.id === char.id && !isCreating;
              return (
                <div
                  key={char.id}
                  onClick={() => { setSelectedChar(char); setIsCreating(false); }}
                  style={{
                    padding: '12px',
                    borderRadius: '4px',
                    background: isSelected ? 'rgba(212, 175, 55, 0.15)' : 'rgba(0, 0, 0, 0.4)',
                    border: `1px solid ${isSelected ? 'var(--color-gold)' : '#2a2419'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: isSelected ? '#fff' : '#ccc', fontSize: '15px' }}>
                      {char.name}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-gold)' }}>
                      Lv. {char.level}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginTop: '4px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{char.class}</span>
                    <span>{char.region}</span>
                  </div>
                </div>
              );
            })}

            {characters.length === 0 && !loading && (
              <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
                No heroes founded yet. Create one!
              </p>
            )}
          </div>

          {characters.length < 5 && (
            <button
              onClick={() => setIsCreating(true)}
              className="fantasy-button"
              style={{ marginTop: '16px', width: '100%', height: '38px' }}
            >
              + Create New Character
            </button>
          )}
        </div>

        {/* Right: Character Details or Creation View */}
        <div className="fantasy-panel" style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {isCreating ? (
            /* Creation Form */
            <div>
              <h2 className="fantasy-header" style={{ fontSize: '22px', marginBottom: '8px' }}>
                FORGE A HERO
              </h2>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
                Select a class archetype and declare your name to enter Greenfall.
              </p>

              {createError && (
                <div style={{ background: 'rgba(255, 68, 68, 0.15)', border: '1px solid #ff4444', color: '#ff8888', padding: '8px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateCharacter} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-gold)', marginBottom: '6px' }}>HERO NAME</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name (3-24 characters)"
                    required
                    style={{
                      width: '320px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid var(--color-gold-dark)',
                      color: '#fff',
                      padding: '10px 14px',
                      borderRadius: '3px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-gold)', marginBottom: '10px' }}>CHOOSE CLASS</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', maxWidth: '640px' }}>
                    {CLASSES.map((cls) => {
                      const isSelected = charClass === cls.id;
                      return (
                        <div
                          key={cls.id}
                          onClick={() => setCharClass(cls.id)}
                          style={{
                            padding: '16px',
                            background: isSelected ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0, 0, 0, 0.4)',
                            border: `2px solid ${isSelected ? cls.color : '#2a2419'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ color: cls.color, fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>
                            {cls.name}
                          </div>
                          <p style={{ color: '#aaa', fontSize: '12px', margin: '0 0 10px 0' }}>{cls.desc}</p>
                          <span style={{ fontSize: '11px', color: 'var(--color-gold-dark)' }}>Key spells: {cls.skills}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px', marginTop: '20px' }}>
                  <button type="submit" className="fantasy-button" disabled={submitting} style={{ padding: '10px 28px', fontSize: '15px' }}>
                    {submitting ? 'Creating...' : 'Forge & Enter World'}
                  </button>
                  {characters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="fantasy-button"
                      style={{ background: 'transparent', borderColor: '#444', color: '#888' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : selectedChar ? (
            /* Selected Character Details */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 className="fantasy-header" style={{ fontSize: '28px', margin: '0 0 4px 0' }}>
                      {selectedChar.name}
                    </h2>
                    <span style={{ color: 'var(--color-gold)', fontSize: '15px', textTransform: 'capitalize' }}>
                      Level {selectedChar.level} {selectedChar.class}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--color-gold-bright)', fontSize: '18px', fontWeight: 'bold' }}>
                      {selectedChar.gold} Gold
                    </div>
                    <span style={{ color: '#777', fontSize: '12px' }}>Spawn Region: {selectedChar.region}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '30px' }}>
                  <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #2a2419', padding: '16px', borderRadius: '4px' }}>
                    <h4 style={{ color: 'var(--color-gold)', margin: '0 0 10px 0', fontSize: '13px' }}>VITAL ATTRIBUTES</h4>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#bbb' }}>
                      <div>Hit Points: <span style={{ color: '#ff6666' }}>{selectedChar.stats?.hp || 100} / {selectedChar.stats?.max_hp || 100}</span></div>
                      <div>Mana Pool: <span style={{ color: '#66a3ff' }}>{selectedChar.stats?.mana || 50} / {selectedChar.stats?.max_mana || 50}</span></div>
                      <div>Stamina: <span style={{ color: '#66ff66' }}>{selectedChar.stats?.stamina || 100} / {selectedChar.stats?.max_stamina || 100}</span></div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #2a2419', padding: '16px', borderRadius: '4px' }}>
                    <h4 style={{ color: 'var(--color-gold)', margin: '0 0 10px 0', fontSize: '13px' }}>COMBAT RATINGS</h4>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#bbb' }}>
                      <div>Physical Attack: <span style={{ color: '#fff' }}>{selectedChar.stats?.attack || 5}</span></div>
                      <div>Defence: <span style={{ color: '#fff' }}>{selectedChar.stats?.defence || 5}</span></div>
                      <div>Magic Power: <span style={{ color: '#fff' }}>{selectedChar.stats?.magic_power || 5}</span></div>
                      <div>Mobility: <span style={{ color: '#fff' }}>{selectedChar.stats?.mobility || 5}</span></div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #2a2419', padding: '16px', borderRadius: '4px' }}>
                    <h4 style={{ color: 'var(--color-gold)', margin: '0 0 10px 0', fontSize: '13px' }}>CURRENT LOCATION</h4>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#bbb' }}>
                      <div>Region: <span style={{ color: 'var(--color-gold)' }}>Greenfall Grasslands</span></div>
                      <div>Coordinates: <span style={{ color: '#aaa' }}>({Math.round(selectedChar.pos_x)}, {Math.round(selectedChar.pos_y)})</span></div>
                      <div>Zone Status: <span style={{ color: '#66ff66' }}>Safe Sanctuary</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #2a2419', paddingTop: '20px' }}>
                <button
                  onClick={handleEnterWorld}
                  className="fantasy-button"
                  style={{ padding: '14px 44px', fontSize: '18px', letterSpacing: '1px' }}
                >
                  Enter Greenfall
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
              Select a character to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
