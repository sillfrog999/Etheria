import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useGameStore } from './store/gameStore';
import { AuthModal } from './components/auth/AuthModal';
import { CharacterSelect } from './components/character/CharacterSelect';
import { GamePage } from './components/game/GamePage';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { character, setToken, setCharacter } = useGameStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setToken(session.access_token);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setToken(session.access_token);
      } else {
        setToken(null);
        setCharacter(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setToken, setCharacter]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-black text-[#d4af37] font-serif">
        <h1 className="text-4xl tracking-widest animate-pulse mb-4">PROJECT ETHERIA</h1>
        <p className="text-sm text-stone-400">Connecting to the living world...</p>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return <AuthModal />;
  }

  // Logged in, but character not selected
  if (!character) {
    return <CharacterSelect />;
  }

  // In-game
  return <GamePage />;
}
