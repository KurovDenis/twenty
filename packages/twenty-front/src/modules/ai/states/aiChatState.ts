import { atom } from 'recoil';
import { localStorageEffect } from '~/utils/recoil-effects';

/**
 * AI Chat Message Type
 */
export type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

/**
 * AI Chat Type
 */
export type AIChat = {
  id: string;
  context: 'business-setup' | 'general' | null;
  initialMessage: string | null;
  messages: AIChatMessage[];
  createdAt: Date;
  lastAccessed: Date;
};

/**
 * AI Chats State
 * Хранит все AI чаты с их контекстом и сообщениями
 * ✅ Автоматически сохраняется в localStorage и восстанавливается при перезагрузке
 */
export const aiChatsState = atom<Record<string, AIChat>>({
  key: 'aiChatsState',
  default: {},
  effects: [localStorageEffect()], // ✅ Persistence!
});

/**
 * Current AI Chat ID State
 * Хранит ID текущего активного AI чата
 * ✅ Автоматически сохраняется в localStorage и восстанавливается при перезагрузке
 */
export const currentChatIdState = atom<string | null>({
  key: 'currentChatIdState',
  default: null,
  effects: [localStorageEffect()], // ✅ Persistence!
});
