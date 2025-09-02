import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

import { IconBolt, IconCheck, IconLoader, IconSparkles, IconX } from 'twenty-ui/display';
import { useSGRStreamingParser } from '../../hooks/useSGRStreamingParser';
import { SGRStreamingStatus } from '../../types/sgr-streaming.types';

import { JSONStreamingViewer } from './JSONStreamingViewer';
import { StreamingMetrics } from './StreamingMetrics';
import { StreamingProgressBar } from './StreamingProgressBar';
import { ToolExecutionViewer } from './ToolExecutionViewer';

const StyledDashboardContainer = styled(motion.div)`
  position: relative;
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow: hidden;
  min-height: 200px;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background: ${({ theme }) => theme.background.primary};
`;

const StyledStatusIndicator = styled.div<{ status: SGRStreamingStatus }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme, status }) => {
    switch (status) {
      case 'streaming_json': return theme.color.blue;
      case 'tool_pending': return theme.color.orange;
      case 'completed': return theme.color.green;
      case 'error': return theme.color.red;
      default: return theme.font.color.secondary;
    }
  }};
`;

const StyledContent = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledErrorDisplay = styled(motion.div)`
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.color.red}10;
  border: 1px solid ${({ theme }) => theme.color.red}30;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.color.red};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

type SgrVisualizationDashboardProps = {
  threadId: string;
  showMetrics?: boolean;
  autoHideOnComplete?: boolean;
  autoHideDelayMs?: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
};

/**
 * Главный компонент визуализации SGR стриминга
 * Отображает весь процесс мышления AI в реальном времени
 */
export const SgrVisualizationDashboard = ({
  threadId,
  showMetrics = true,
  autoHideOnComplete = false,
  autoHideDelayMs = 3000,
  onComplete,
  onError,
}: SgrVisualizationDashboardProps) => {
  const {
    visualizationState,
    isConnected,
    isStreaming,
    currentStatus,
    hasError,
    jsonData,
    toolCall,
    getStreamingMetrics,
    resetStreaming,
  } = useSGRStreamingParser(threadId);

  const [isVisible, setIsVisible] = useState(false);
  const [autoHideTimeout, setAutoHideTimeout] = useState<NodeJS.Timeout | null>(null);

  // Показать дашборд когда начинается стриминг
  useEffect(() => {
    if (isStreaming && !isVisible) {
      setIsVisible(true);
    }
  }, [isStreaming, isVisible]);

  // Автоскрытие при завершении
  useEffect(() => {
    if (currentStatus === 'completed' && autoHideOnComplete) {
      const timeout = setTimeout(() => {
        setIsVisible(false);
        if (onComplete) {
          onComplete();
        }
      }, autoHideDelayMs);
      
      setAutoHideTimeout(timeout);
    }
    
    return () => {
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
      }
    };
  }, [currentStatus, autoHideOnComplete, autoHideDelayMs, onComplete, autoHideTimeout]);

  // Обработка ошибок
  useEffect(() => {
    if (hasError && visualizationState.error && onError) {
      onError(visualizationState.error);
    }
  }, [hasError, visualizationState.error, onError]);

  /**
   * Получение иконки для текущего статуса
   */
  const getStatusIcon = useCallback(() => {
    switch (currentStatus) {
      case 'starting':
      case 'streaming_json':
        return <IconLoader />;
      case 'parsing':
        return <IconSparkles />;
      case 'tool_pending':
        return <IconBolt />;
      case 'completed':
        return <IconCheck />;
      case 'error':
        return <IconX />;
      default:
        return <IconSparkles />;
    }
  }, [currentStatus]);

  /**
   * Получение текста для текущего статуса
   */
  const getStatusText = useCallback(() => {
    switch (currentStatus) {
      case 'starting':
        return 'Начинаю анализ...';
      case 'streaming_json':
        return 'Обрабатываю данные...';
      case 'parsing':
        return 'Анализирую результат...';
      case 'tool_pending':
        return `Выполняю: ${toolCall?.toolName || 'инструмент'}`;
      case 'completed':
        return 'Анализ завершен';
      case 'error':
        return 'Произошла ошибка';
      default:
        return 'Ожидание...';
    }
  }, [currentStatus, toolCall?.toolName]);

  // Не показывать если не активен
  if (!isVisible || currentStatus === 'idle') {
    return null;
  }

  return (
    <AnimatePresence>
      <StyledDashboardContainer
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Заголовок с индикатором статуса */}
        <StyledHeader>
          <StyledStatusIndicator status={currentStatus}>
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </StyledStatusIndicator>
          
          {/* Метрики стриминга */}
          {showMetrics && isStreaming && (
            <StreamingMetrics 
              metrics={getStreamingMetrics()}
              isConnected={isConnected}
            />
          )}
        </StyledHeader>

        {/* Прогресс-бар */}
        <StreamingProgressBar 
          status={currentStatus}
          jsonProgress={jsonData}
          toolProgress={toolCall}
        />

        {/* Основной контент */}
        <StyledContent>
          {/* Отображение ошибки */}
          {hasError && visualizationState.error && (
            <StyledErrorDisplay
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <IconX />
              <div>
                <strong>Ошибка процесса:</strong> {visualizationState.error}
              </div>
            </StyledErrorDisplay>
          )}

          {/* JSON стриминг */}
          {(currentStatus === 'streaming_json' || currentStatus === 'parsing') && jsonData && (
            <JSONStreamingViewer 
              jsonData={jsonData}
              isActive={currentStatus === 'streaming_json'}
            />
          )}

          {/* Выполнение инструмента */}
          {currentStatus === 'tool_pending' && toolCall && (
            <ToolExecutionViewer 
              toolCall={toolCall}
              isActive={true}
            />
          )}

          {/* Завершение */}
          {currentStatus === 'completed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                textAlign: 'center',
                padding: '20px',
                color: 'var(--theme-color-green)',
              }}
            >
              <IconCheck size="lg" />
              <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                Анализ успешно завершен
              </div>
              {visualizationState.totalProcessingTime && (
                <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>
                  Время обработки: {Math.round(visualizationState.totalProcessingTime / 1000)}с
                </div>
              )}
            </motion.div>
          )}
        </StyledContent>
      </StyledDashboardContainer>
    </AnimatePresence>
  );
};
