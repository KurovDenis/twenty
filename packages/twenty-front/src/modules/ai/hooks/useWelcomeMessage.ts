import { useCallback, useEffect, useState } from 'react';
import { BUSINESS_SETUP_EVENTS, WelcomeChatCreatedEventFrontend, WelcomeChatCreationFailedEventFrontend } from 'twenty-shared/types';
import { getCurrentUserId } from '~/auth/utils/get-current-user-id';
import { getEventEmitter } from '~/utils/event-emitter';

export const useWelcomeMessage = () => {
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    // Подписываемся на события создания welcome чата
    const eventEmitter = getEventEmitter();
    
    const handleWelcomeChatCreated = (payload: WelcomeChatCreatedEventFrontend) => {
      // Проверяем, что событие для текущего пользователя
      if (payload.userId === getCurrentUserId()) {
        setWelcomeMessage(payload.aiResponse);
        setThreadId(payload.threadId);
        setShowPopup(true);
      }
    };

    const handleWelcomeChatCreationFailed = (payload: WelcomeChatCreationFailedEventFrontend) => {
      // Проверяем, что событие для текущего пользователя
      if (payload.userId === getCurrentUserId()) {
        console.warn('Welcome chat creation failed:', payload.error);
        // Можно показать уведомление об ошибке
      }
    };

    eventEmitter.on(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED, handleWelcomeChatCreated);
    eventEmitter.on(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED, handleWelcomeChatCreationFailed);

    return () => {
      eventEmitter.off(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED, handleWelcomeChatCreated);
      eventEmitter.off(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED, handleWelcomeChatCreationFailed);
    };
  }, []);

  const showWelcomePopup = useCallback(() => {
    setShowPopup(true);
  }, []);

  const hideWelcomePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  const continueChat = useCallback(() => {
    // TODO: Интегрировать с существующим AI чатом
    // Открыть чат с threadId
    console.log('Continue chat with thread:', threadId);
    hideWelcomePopup();
  }, [threadId, hideWelcomePopup]);

  return {
    welcomeMessage,
    showWelcomePopup,
    hideWelcomePopup,
    continueChat,
    showPopup,
    setShowPopup,
    threadId
  };
};
