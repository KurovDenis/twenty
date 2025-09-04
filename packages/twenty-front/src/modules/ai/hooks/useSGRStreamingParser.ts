import { useSubscription } from '@apollo/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { ENHANCED_BUSINESS_SETUP_EVENTS_SUBSCRIPTION } from '../graphql/subscriptions/sgrStreamingEvents';
import { SGRToolExecutionStatus } from '../types/sgr-message.types';
import {
  SGRStreamEvent,
  SGRStreamEventType,
  SGRVisualizationState,
} from '../types/sgr-streaming.types';

/**
 * Конфигурация для SGR стриминга парсера
 */
type SGRParserConfig = {
  enableJsonParsing: boolean;
  enablePartialJsonValidation: boolean;
  jsonParsingThrottleMs: number;
  autoCompleteOnTimeout: boolean;
  timeoutMs: number;
};

const DEFAULT_CONFIG: SGRParserConfig = {
  enableJsonParsing: true,
  enablePartialJsonValidation: true,
  jsonParsingThrottleMs: 100,
  autoCompleteOnTimeout: true,
  timeoutMs: 30000, // 30 секунд
};

/**
 * Расширенный хук для парсинга SGR стриминга
 * Обрабатывает детальные события от бэкенда и обновляет UI состояние
 */
export const useSGRStreamingParser = (
  threadId: string,
  config: Partial<SGRParserConfig> = {},
) => {
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const finalConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config],
  );

  // Основное состояние
  const [visualizationState, setVisualizationState] =
    useState<SGRVisualizationState>({
      status: 'idle',
      threadId: null,
      stepId: null,
    });

  // Состояние подключения
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Таймауты для автоматического завершения
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Подписка на события
  const { data, loading, error } = useSubscription(
    ENHANCED_BUSINESS_SETUP_EVENTS_SUBSCRIPTION,
    {
      variables: {
        input: {
          userId: currentUser?.id,
          workspaceId: currentWorkspace?.id,
          eventTypes: [
            'SGR_STREAMING_START',
            'SGR_JSON_STREAM_START',
            'SGR_JSON_TOKEN_CHUNK',
            'SGR_JSON_STREAM_END',
            'SGR_TOOL_CALL_PENDING',
            'SGR_STREAMING_END',
            'SGR_STREAMING_ERROR',
          ],
          includeMetadata: true,
        },
      },
      skip: !currentUser?.id || !currentWorkspace?.id || !threadId,
      onError: (subscriptionError) => {
        console.error('SGR streaming subscription error:', subscriptionError);
        setConnectionError(subscriptionError);
        setVisualizationState((prev) => ({
          ...prev,
          status: 'error',
          error: subscriptionError.message,
        }));
      },
    },
  );

  /**
   * Парсинг частичного JSON с обработкой ошибок
   */
  const parsePartialJson = useCallback(
    (jsonString: string): Record<string, unknown> => {
      if (!finalConfig.enableJsonParsing) return {};

      try {
        // Попытка парсинга полного JSON
        return JSON.parse(jsonString);
      } catch {
        if (!finalConfig.enablePartialJsonValidation) return {};

        try {
          // Поиск последнего валидного JSON объекта
          const jsonMatches = jsonString.match(/\{[^{}]*\}/g);
          if (jsonMatches && jsonMatches.length > 0) {
            const lastMatch = jsonMatches[jsonMatches.length - 1];
            return JSON.parse(lastMatch);
          }

          // Попытка завершить незавершенный JSON
          const completedJson = completePartialJson(jsonString);
          if (completedJson) {
            return JSON.parse(completedJson);
          }
        } catch {
          // Ignore parsing errors for partial JSON
        }

        return {};
      }
    },
    [finalConfig.enableJsonParsing, finalConfig.enablePartialJsonValidation],
  );

  /**
   * Завершение частичного JSON
   */
  const completePartialJson = useCallback((partial: string): string | null => {
    try {
      let completed = partial.trim();

      // Подсчет открытых скобок
      let openBraces = 0;
      let openBrackets = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < completed.length; i++) {
        const char = completed[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') openBraces++;
          else if (char === '}') openBraces--;
          else if (char === '[') openBrackets++;
          else if (char === ']') openBrackets--;
        }
      }

      // Закрытие открытых скобок
      completed += '}'.repeat(Math.max(0, openBraces));
      completed += ']'.repeat(Math.max(0, openBrackets));

      // Проверка валидности
      JSON.parse(completed);
      return completed;
    } catch {
      return null;
    }
  }, []);

  /**
   * Обработка события стриминга
   */
  const handleStreamingEvent = useCallback(
    (event: SGRStreamEvent) => {
      const { type, payload } = event;

      // Фильтрация по threadId
      if (payload.threadId !== threadId) return;

      setVisualizationState((prevState) => {
        const newState = { ...prevState };

        switch (type) {
          case 'SGR_PROCESS_START':
            // Сброс таймаута
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            // Установка нового таймаута
            const newTimeoutId = setTimeout(() => {
              if (finalConfig.autoCompleteOnTimeout) {
                setVisualizationState((state) => ({
                  ...state,
                  status: 'error',
                  error: 'SGR process timeout',
                  endTime: new Date(),
                }));
              }
            }, finalConfig.timeoutMs);

            setTimeoutId(newTimeoutId);

            return {
              ...newState,
              status: 'starting',
              threadId: payload.threadId,
              stepId: payload.stepId,
              startTime: new Date(),
              error: undefined,
            };

          case 'SGR_JSON_STREAM_START':
            return {
              ...newState,
              status: 'streaming_json',
              jsonStreaming: {
                rawJson: '',
                isValidJson: false,
                currentToken: '',
                totalTokens: 0,
                streamingSpeed: 0,
              },
            };

          case 'SGR_JSON_TOKEN_CHUNK':
            if (!newState.jsonStreaming) return newState;

            const updatedJson =
              newState.jsonStreaming.rawJson + (payload.token || '');
            const parsedJson = parsePartialJson(updatedJson);
            const isValidJson = Object.keys(parsedJson).length > 0;

            // Расчет скорости стриминга
            const currentTime = Date.now();
            const timeElapsed = newState.startTime
              ? (currentTime - newState.startTime.getTime()) / 1000
              : 1;
            const streamingSpeed = updatedJson.length / timeElapsed;

            return {
              ...newState,
              jsonStreaming: {
                ...newState.jsonStreaming,
                rawJson: updatedJson,
                parsedJson,
                isValidJson,
                currentToken: payload.token || '',
                totalTokens: newState.jsonStreaming.totalTokens + 1,
                streamingSpeed,
              },
            };

          case 'SGR_JSON_STREAM_END':
            const finalJson =
              payload.fullJson || newState.jsonStreaming?.rawJson || '';
            const finalParsed = parsePartialJson(finalJson);

            return {
              ...newState,
              status: 'parsing',
              jsonStreaming: newState.jsonStreaming
                ? {
                    ...newState.jsonStreaming,
                    rawJson: finalJson,
                    parsedJson: finalParsed,
                    isValidJson: Object.keys(finalParsed).length > 0,
                  }
                : undefined,
            };

          case 'SGR_TOOL_CALL_PENDING':
            // Извлечение информации об инструменте из parsedJson или payload
            const toolName = payload.toolName || 'unknown';
            let toolArgs: Record<string, unknown> = {};
            const rawToolArgs: unknown = (payload as any).toolArgs;
            if (typeof rawToolArgs === 'string') {
              try {
                toolArgs = JSON.parse(rawToolArgs);
              } catch {
                toolArgs = {};
              }
            } else if (rawToolArgs && typeof rawToolArgs === 'object') {
              toolArgs = rawToolArgs as Record<string, unknown>;
            }

            return {
              ...newState,
              status: 'tool_pending',
              toolCall: {
                toolName,
                toolArgs,
                status: SGRToolExecutionStatus.IN_PROGRESS,
                executionTime: 0,
              },
            };

          case 'SGR_PROCESS_END':
            // Очистка таймаута
            if (timeoutId) {
              clearTimeout(timeoutId);
              setTimeoutId(null);
            }

            return {
              ...newState,
              status: 'completed',
              endTime: new Date(),
              totalProcessingTime: newState.startTime
                ? Date.now() - newState.startTime.getTime()
                : undefined,
            };

          case 'SGR_PROCESS_ERROR':
            // Очистка таймаута
            if (timeoutId) {
              clearTimeout(timeoutId);
              setTimeoutId(null);
            }

            return {
              ...newState,
              status: 'error',
              error: payload.error || 'Unknown SGR error',
              endTime: new Date(),
            };

          default:
            return newState;
        }
      });
    },
    [threadId, parsePartialJson, timeoutId, finalConfig],
  );

  // Обработка входящих данных подписки
  useEffect(() => {
    if (data?.onBusinessSetupEvent) {
      const event = data.onBusinessSetupEvent;

      // Проверка, что это SGR событие
      if (event.metadata?.sgrStreaming && event.type.startsWith('SGR_')) {
        const sgrEvent: SGRStreamEvent = {
          type: event.type as SGRStreamEventType,
          payload: event.payload,
        };

        handleStreamingEvent(sgrEvent);
      }

      // Очистка ошибки подключения при успешном получении данных
      if (connectionError) {
        setConnectionError(null);
      }
    }
  }, [data, handleStreamingEvent, connectionError]);

  // Отслеживание статуса подключения
  useEffect(() => {
    setIsConnected(!loading && !error && !connectionError);
  }, [loading, error, connectionError]);

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  /**
   * Сброс состояния стриминга
   */
  const resetStreaming = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }

    setVisualizationState({
      status: 'idle',
      threadId: null,
      stepId: null,
    });

    setConnectionError(null);
  }, [timeoutId]);

  /**
   * Получение метрик стриминга
   */
  const getStreamingMetrics = useCallback(() => {
    const { jsonStreaming, startTime, endTime, totalProcessingTime } =
      visualizationState;

    return {
      isActive:
        visualizationState.status !== 'idle' &&
        visualizationState.status !== 'completed',
      totalTokens: jsonStreaming?.totalTokens || 0,
      streamingSpeed: jsonStreaming?.streamingSpeed || 0,
      processingTime:
        totalProcessingTime ||
        (startTime ? Date.now() - startTime.getTime() : 0),
      isValidJson: jsonStreaming?.isValidJson || false,
      hasError: !!visualizationState.error,
    };
  }, [visualizationState]);

  return {
    // Основное состояние
    visualizationState,

    // Состояние подключения
    isConnected,
    isLoading: loading,
    connectionError: error || connectionError,

    // Вычисляемые свойства
    isStreaming:
      visualizationState.status !== 'idle' &&
      visualizationState.status !== 'completed',
    currentStatus: visualizationState.status,
    hasError: !!visualizationState.error,

    // JSON стриминг данные
    jsonData: visualizationState.jsonStreaming,
    rawJson: visualizationState.jsonStreaming?.rawJson || '',
    parsedJson: visualizationState.jsonStreaming?.parsedJson || {},
    isValidJson: visualizationState.jsonStreaming?.isValidJson || false,

    // Данные инструмента
    toolCall: visualizationState.toolCall,

    // Действия
    resetStreaming,

    // Метрики
    getStreamingMetrics,

    // Утилиты
    parsePartialJson,
  };
};

/**
 * Упрощенная версия хука для базового использования
 */
export const useSGRStreamingBasic = (threadId: string) => {
  const {
    visualizationState,
    isConnected,
    isStreaming,
    currentStatus,
    hasError,
    jsonData,
    toolCall,
    resetStreaming,
  } = useSGRStreamingParser(threadId);

  return {
    status: currentStatus,
    isStreaming,
    isConnected,
    hasError,
    error: visualizationState.error,
    jsonProgress: {
      rawJson: jsonData?.rawJson || '',
      parsedJson: jsonData?.parsedJson || {},
      isValid: jsonData?.isValidJson || false,
      tokenCount: jsonData?.totalTokens || 0,
    },
    toolProgress: toolCall,
    reset: resetStreaming,
  };
};
