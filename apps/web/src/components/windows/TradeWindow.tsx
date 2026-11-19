import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { ITEM_DATABASE } from '@etheria/game-data';
import { RARITY_COLORS } from '@etheria/shared';

export function TradeWindow() {
  const { windows, closeWindow, activeTrade, character, inventory, gold } = useGameStore();
  const [offeredGold, setOfferedGold] = useState(0);

  if (!windows.trade || !activeTrade || !character) return null;

  const isInitiator = activeTrade.initiatorId === character.id;
  const myOffer = isInitiator ? activeTrade.initiatorOffer : activeTrade.targetOffer;
  const theirOffer = isInitiator ? activeTrade.targetOffer : activeTrade.initiatorOffer;
  const myConfirmed = isInitiator ? activeTrade.initiatorConfirmed : activeTrade.targetConfirmed;
  const theirConfirmed = isInitiator ? activeTrade.targetConfirmed : activeTrade.initiatorConfirmed;
  const partnerName = isInitiator ? activeTrade.targetName : activeTrade.initiatorName;

  const handleAddItemToTrade = (itemInst: any) => {
    if (!itemInst || myConfirmed) return;
    const defId = itemInst.definition_id || itemInst.definitionId;
    const def = ITEM_DATABASE[defId];
    if (!def || !def.tradable) return;

    // Check if already in trade
    if (myOffer.items.some((it) => it.instanceId === (itemInst.id || itemInst.instanceId))) {
      return;
    }

    const newItems = [
      ...myOffer.items,
      {
        instanceId: itemInst.id || itemInst.instanceId,
        definitionId: defId,
        quantity: itemInst.quantity || 1,
        name: def.name,
        iconKey: def.iconKey,
        rarity: def.rarity,
      },
    ];

    const socket = getSocket();
    socket.emit('trade:offer_update', {
      tradeId: activeTrade.id,
      offer: { items: newItems, gold: offeredGold },
    });
  };

  const handleRemoveItem = (instanceId: string) => {
    if (myConfirmed) return;
    const newItems = myOffer.items.filter((it) => it.instanceId !== instanceId);
    const socket = getSocket();
    socket.emit('trade:offer_update', {
      tradeId: activeTrade.id,
      offer: { items: newItems, gold: offeredGold },
    });
  };

  const handleGoldChange = (amount: number) => {
    if (myConfirmed) return;
    const clamped = Math.max(0, Math.min(gold, amount));
    setOfferedGold(clamped);

    const socket = getSocket();
    socket.emit('trade:offer_update', {
      tradeId: activeTrade.id,
      offer: { items: myOffer.items, gold: clamped },
    });
  };

  const handleConfirm = () => {
    const socket = getSocket();
    socket.emit('trade:confirm', { tradeId: activeTrade.id });
  };

  const handleCancel = () => {
    const socket = getSocket();
    socket.emit('trade:cancel', { tradeId: activeTrade.id });
    closeWindow('trade');
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
      <div className="fantasy-panel" style={{ width: '640px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 className="fantasy-header" style={{ margin: 0, fontSize: '18px' }}>
              SECURE EXCHANGE
            </h3>
            <span style={{ fontSize: '12px', color: '#888' }}>
              Trading with: <strong style={{ color: 'var(--color-gold)' }}>{partnerName}</strong>
            </span>
          </div>
          <span onClick={handleCancel} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
        </div>

        {/* Status Alert Banner */}
        <div style={{
          padding: '8px 12px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '12px',
          textAlign: 'center',
          background: activeTrade.state === 'confirming' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(0,0,0,0.4)',
          border: '1px solid #332816',
          color: activeTrade.state === 'confirming' ? 'var(--color-gold-bright)' : '#bbb',
        }}>
          {activeTrade.state === 'confirming'
            ? 'Both parties are reviewing. Any alteration resets mutual confirmation.'
            : 'Configure your trade offering below. Both parties must lock and confirm.'}
        </div>

        {/* Two-Column Comparison Window */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left: Your Offer */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #2a2419', padding: '14px', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>Your Offering</span>
              <span style={{ fontSize: '11px', color: myConfirmed ? '#4caf50' : '#ffa726' }}>
                {myConfirmed ? '✓ CONFIRMED' : 'UNCONFIRMED'}
              </span>
            </div>

            {/* Offered items grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', minHeight: '120px' }}>
              {myOffer.items.map((it) => (
                <div
                  key={it.instanceId}
                  className="slot-box"
                  onClick={() => handleRemoveItem(it.instanceId)}
                  style={{ width: '50px', height: '50px', borderColor: (RARITY_COLORS as any)[it.rarity] || '#aaa' }}
                  title={`${it.name}\nClick to Remove`}
                >
                  <span style={{ fontSize: '9px', textAlign: 'center' }}>{it.name.slice(0, 7)}</span>
                  {it.quantity > 1 && (
                    <span style={{ position: 'absolute', bottom: '2px', right: '3px', fontSize: '9px', color: '#ffd700' }}>
                      {it.quantity}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Gold input */}
            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--color-gold)' }}>Offered Gold:</label>
              <input
                type="number"
                min={0}
                max={gold}
                value={offeredGold}
                onChange={(e) => handleGoldChange(Number(e.target.value))}
                disabled={myConfirmed}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid var(--color-gold-dark)',
                  color: '#ffd700',
                  padding: '6px 10px',
                  borderRadius: '2px',
                  marginTop: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Right: Partner's Offer */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #2a2419', padding: '14px', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{partnerName}'s Offer</span>
              <span style={{ fontSize: '11px', color: theirConfirmed ? '#4caf50' : '#ffa726' }}>
                {theirConfirmed ? '✓ CONFIRMED' : 'UNCONFIRMED'}
              </span>
            </div>

            {/* Partner's items grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', minHeight: '120px' }}>
              {theirOffer.items.map((it) => (
                <div
                  key={it.instanceId}
                  className="slot-box"
                  style={{ width: '50px', height: '50px', borderColor: (RARITY_COLORS as any)[it.rarity] || '#aaa' }}
                  title={`${it.name} (${it.quantity})`}
                >
                  <span style={{ fontSize: '9px', textAlign: 'center' }}>{it.name.slice(0, 7)}</span>
                  {it.quantity > 1 && (
                    <span style={{ position: 'absolute', bottom: '2px', right: '3px', fontSize: '9px', color: '#ffd700' }}>
                      {it.quantity}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Partner's offered gold */}
            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--color-gold)' }}>Offered Gold:</label>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid #332816',
                color: '#ffd700',
                padding: '6px 10px',
                borderRadius: '2px',
                marginTop: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
              }}>
                {theirOffer.gold} Gold
              </div>
            </div>
          </div>
        </div>

        {/* Quick Click Inventory Selector */}
        <div style={{ marginTop: '16px', borderTop: '1px solid #2a2419', paddingTop: '12px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '6px' }}>
            Click an inventory item below to place into trade:
          </span>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px' }}>
            {inventory.filter((s) => s.item).map((s) => {
              const defId = (s.item as any).definition_id || (s.item as any).definitionId;
              const def = ITEM_DATABASE[defId];
              return (
                <div
                  key={s.slot}
                  className="slot-box"
                  onClick={() => handleAddItemToTrade(s.item)}
                  style={{ minWidth: '40px', height: '40px' }}
                  title={def ? `Add ${def.name}` : ''}
                >
                  <span style={{ fontSize: '8px', textAlign: 'center' }}>{def?.name.slice(0, 5)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', gap: '14px', marginTop: '20px' }}>
          <button
            onClick={handleConfirm}
            className="fantasy-button"
            style={{
              flex: 1,
              height: '42px',
              fontSize: '15px',
              background: myConfirmed ? '#1b4a15' : undefined,
              borderColor: myConfirmed ? '#4caf50' : undefined,
            }}
          >
            {myConfirmed ? 'Waiting for Partner...' : 'Confirm Offering'}
          </button>
          <button
            onClick={handleCancel}
            className="fantasy-button"
            style={{ width: '120px', background: '#251313', borderColor: '#732c2c' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
