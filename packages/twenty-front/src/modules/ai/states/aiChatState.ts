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
 * AI Chat Type - ЕДИНЫЙ тип для всех чатов
 */
export type AIChat = {
  id: string; // Уникальный ID чата
  title: string; // Заголовок для вкладки
  context: 'business-setup' | 'general' | null; // Контекст чата
  initialMessage: string | null; // Начальное сообщение
  messages: AIChatMessage[]; // История сообщений
  createdAt: Date; // Дата создания
  lastAccessed: Date; // Последний доступ
  isActive: boolean; // Активна ли вкладка
  isBusinessSetup: boolean; // Это Business Setup чат?

  // ✅ Серверная часть (опционально)
  graphqlThreadId?: string | null; // ID серверного потока
  agentId?: string | null; // ID AI агента

  // ✅ UI состояние
  isPinned?: boolean; // Закреплена ли вкладка
  isClosable?: boolean; // Можно ли закрыть
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

/**
 * Фабрика для создания чатов
 */
export const createAIChat = {
  // ✅ Создать Business Setup чат
  businessSetup: (title = 'Настройка системы'): AIChat => ({
    id: `business-setup-${Date.now()}`,
    title,
    context: 'business-setup',
    initialMessage: title,
    messages: [],
    createdAt: new Date(),
    lastAccessed: new Date(),
    isActive: true,
    isBusinessSetup: true,
    isPinned: true, // Business Setup чат закреплен
    isClosable: false, // Нельзя закрыть во время настройки
    graphqlThreadId: null,
    agentId: null,
  }),

  // ✅ Создать обычный чат
  general: (title = 'Новый чат'): AIChat => ({
    id: `chat-${Date.now()}`,
    title,
    context: 'general',
    initialMessage: null,
    messages: [],
    createdAt: new Date(),
    lastAccessed: new Date(),
    isActive: false,
    isBusinessSetup: false,
    isPinned: false,
    isClosable: true,
    graphqlThreadId: null,
    agentId: null,
  }),

  // ✅ Создать чат из существующего GraphQL потока
  fromGraphQL: (
    graphqlThreadId: string,
    title: string,
    agentId: string,
  ): AIChat => ({
    id: `graphql-${graphqlThreadId}`,
    title,
    context: 'general',
    initialMessage: null,
    messages: [], // TODO: Загрузить из GraphQL
    createdAt: new Date(),
    lastAccessed: new Date(),
    isActive: false,
    isBusinessSetup: false,
    isPinned: false,
    isClosable: true,
    graphqlThreadId,
    agentId,
  }),
};
