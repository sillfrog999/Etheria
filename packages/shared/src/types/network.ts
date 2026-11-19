export interface NetworkPlayer {
  id: string;
  characterId: string;
  name: string;
  class: string;
  level: number;
  x: number;
  y: number;
  region: string;
  hp: number;
  maxHp: number;
  animation?: string;
  facing?: 'north' | 'south' | 'east' | 'west';
}

export interface ChatMessage {
  id: string;
  channel: 'world' | 'local' | 'party' | 'guild' | 'private' | 'system';
  senderId?: string;
  senderName?: string;
  content: string;
  timestamp: number;
  recipientId?: string;
}
