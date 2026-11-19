export type TradeState =
  | 'pending' | 'accepted' | 'active'
  | 'confirming' | 'completed' | 'cancelled' | 'expired' | 'failed';

export interface TradeItem {
  instanceId: string;
  definitionId: string;
  quantity: number;
  name: string;
  iconKey: string;
  rarity: string;
}

export interface TradeOffer {
  items: TradeItem[];
  gold: number;
}

export interface TradeSession {
  id: string;
  initiatorId: string;
  initiatorName: string;
  targetId: string;
  targetName: string;
  state: TradeState;
  initiatorOffer: TradeOffer;
  targetOffer: TradeOffer;
  initiatorConfirmed: boolean;
  targetConfirmed: boolean;
  createdAt: number;
  updatedAt: number;
}
