import { useMemo } from 'react';
import styled from 'styled-components';

import { ProgressBar } from 'twenty-ui/feedback';
import { JSONStreamingData, SGRStreamingStatus, ToolCallData } from '../../types/sgr-streaming.types';

const StyledProgressContainer = styled.div`
  padding: 0 ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.primary};
`;

const StyledProgressInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

type StreamingProgressBarProps = {
  status: SGRStreamingStatus;
  jsonProgress?: JSONStreamingData;
  toolProgress?: ToolCallData;
};

/**
 * Компонент прогресс-бара для SGR стриминга
 * Показывает прогресс в зависимости от текущего этапа
 */
export const StreamingProgressBar = ({
  status,
  jsonProgress,
  toolProgress,
}: StreamingProgressBarProps) => {
  
  /**
   * Расчет общего прогресса процесса
   */
  const { progress, progressText } = useMemo(() => {
    switch (status) {
      case 'starting':
        return { progress: 10, progressText: 'Инициализация...' };
      
      case 'streaming_json':
        // Прогресс основан на количестве токенов (предполагаем примерно 100 токенов для полного JSON)
        const tokenProgress = Math.min((jsonProgress?.totalTokens || 0) / 100 * 60, 60);
        return { 
          progress: 10 + tokenProgress, 
          progressText: `Получено ${jsonProgress?.totalTokens || 0} токенов...` 
        };
      
      case 'parsing':
        return { progress: 75, progressText: 'Обработка данных...' };
      
      case 'tool_pending':
        return { progress: 85, progressText: `Выполнение: ${toolProgress?.toolName || 'инструмент'}...` };
      
      case 'completed':
        return { progress: 100, progressText: 'Завершено' };
      
      case 'error':
        return { progress: 0, progressText: 'Ошибка' };
      
      default:
        return { progress: 0, progressText: 'Ожидание...' };
    }
  }, [status, jsonProgress, toolProgress]);

  /**
   * Цвет прогресс-бара в зависимости от статуса
   */
  const progressColor = useMemo(() => {
    switch (status) {
      case 'error':
        return 'red';
      case 'completed':
        return 'green';
      default:
        return 'blue';
    }
  }, [status]);

  return (
    <StyledProgressContainer>
      <StyledProgressInfo>
        <span>{progressText}</span>
        <span>{Math.round(progress)}%</span>
      </StyledProgressInfo>
      
      <ProgressBar
        value={progress / 100}
        barColor={progressColor}
      />
    </StyledProgressContainer>
  );
};
