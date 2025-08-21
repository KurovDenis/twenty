import { atom } from 'recoil';
import { localStorageEffect } from '~/utils/recoil-effects';

/**
 * Business Setup AI Chat ID State
 * Хранит ID активного Business Setup AI чата для восстановления
 * ✅ Автоматически сохраняется в localStorage и восстанавливается при перезагрузке
 */
export const businessSetupChatIdState = atom<string | null>({
  key: 'businessSetupChatIdState',
  default: null,
  effects: [localStorageEffect()], // ✅ Persistence!
});

/**
 * Has Business Setup Chat State
 * Флаг того, что у пользователя есть активный Business Setup чат
 * ✅ Автоматически сохраняется в localStorage и восстанавливается при перезагрузке
 */
export const hasBusinessSetupChatState = atom<boolean>({
  key: 'hasBusinessSetupChatState',
  default: false,
  effects: [localStorageEffect()], // ✅ Persistence!
});
