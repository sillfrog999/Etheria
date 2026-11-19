import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ITEM_DATABASE } from '@etheria/game-data';
import { RARITY_COLORS } from '@etheria/shared';

export function MarketplaceWindow() {
  const { windows, closeWindow, character, token, gold } = useGameStore();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/marketplace/listings?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (windows.marketplace) {
      fetchListings();
    }
  }, [windows.marketplace, search]);

  if (!windows.marketplace || !character) return null;

  const handleBuy = async (listingId: string) => {
    try {
      setMsg(null);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/marketplace/listings/${listingId}/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ buyerCharacterId: character.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to purchase');

      setMsg('Purchase completed successfully!');
      await fetchListings();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 40,
      pointerEvents: 'auto',
    }}>
      <div className="fantasy-panel" style={{ width: '600px', height: '450px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 className="fantasy-header" style={{ margin: 0, fontSize: '18px' }}>
              AURELIA CENTRAL MARKETPLACE
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--color-gold)' }}>Your purse: {gold} Gold</span>
          </div>
          <span onClick={() => closeWindow('marketplace')} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
        </div>

        {msg && (
          <div style={{ padding: '6px 10px', background: 'rgba(212, 175, 55, 0.1)', border: '1px solid var(--color-gold)', borderRadius: '3px', fontSize: '12px', marginBottom: '10px' }}>
            {msg}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search items by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid var(--color-gold-dark)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '3px',
            outline: 'none',
            fontSize: '12px',
            marginBottom: '12px',
          }}
        />

        {/* Listings List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {listings.map((l) => {
            const def = ITEM_DATABASE[l.definition_id];
            const totalCost = l.price_per_unit * l.quantity;
            const isMine = l.seller_character_id === character.id;

            return (
              <div
                key={l.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: `1px solid ${def ? RARITY_COLORS[def.rarity] : '#2a2419'}`,
                  padding: '8px 12px',
                  borderRadius: '4px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>
                    {def?.name || l.definition_id} (x{l.quantity})
                  </div>
                  <div style={{ fontSize: '11px', color: '#777' }}>
                    Seller: {l.seller?.name || 'Unknown'} | {def?.category || 'General'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--color-gold-bright)', fontWeight: 'bold', fontSize: '13px' }}>
                      {totalCost} Gold
                    </div>
                    <span style={{ fontSize: '10px', color: '#888' }}>({l.price_per_unit} each)</span>
                  </div>

                  <button
                    onClick={() => handleBuy(l.id)}
                    disabled={isMine || gold < totalCost}
                    className="fantasy-button"
                    style={{
                      fontSize: '11px',
                      padding: '4px 12px',
                      opacity: isMine || gold < totalCost ? 0.5 : 1,
                    }}
                  >
                    {isMine ? 'Your Item' : 'Buy'}
                  </button>
                </div>
              </div>
            );
          })}

          {listings.length === 0 && !loading && (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '13px', marginTop: '40px' }}>
              No active listings found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
