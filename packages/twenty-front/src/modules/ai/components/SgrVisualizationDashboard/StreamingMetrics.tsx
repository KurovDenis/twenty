import { useMemo } from 'react';
import styled from 'styled-components';

import { Chip } from 'twenty-ui/components';

const StyledMetricsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-wrap: wrap;
`;

const StyledMetricChip = styled(Chip)<{ variant: 'info' | 'success' | 'warning' | 'error' }>`
  font-size: ${({ theme }) => theme.font.size.xs};
  
  ${({ variant, theme }) => {
    const colors = {
      info: theme.color.blue,
      success: theme.color.green,
      warning: theme.color.orange,
      error: theme.color.red,
    };
    
    return `
      background: ${colors[variant]}15;
      color: ${colors[variant]};
      border: 1px solid ${colors[variant]}30;
    `;
  }}
`;

type StreamingMetricsData = {
  isActive: boolean;
  totalTokens: number;
  streamingSpeed: number;
  processingTime: number;
  isValidJson: boolean;
  hasError: boolean;
};

type StreamingMetricsProps = {
  metrics: StreamingMetricsData;
  isConnected: boolean;
};

/**
 * Компонент для отображения метрик SGR стриминга
 * Показывает производительность и статус подключения
 */
export const StreamingMetrics = ({
  metrics,
  isConnected,
}: StreamingMetricsProps) => {
  
  /**
   * Форматирование времени обработки
   */
  const formattedProcessingTime = useMemo(() => {
    const seconds = metrics.processingTime / 1000;
    if (seconds < 1) {
      return `${metrics.processingTime}мс`;
    }
    return `${seconds.toFixed(1)}с`;
  }, [metrics.processingTime]);

  /**
   * Форматирование скорости стриминга
   */
  const formattedStreamingSpeed = useMemo(() => {
    if (metrics.streamingSpeed > 1000) {
      return `${(metrics.streamingSpeed / 1000).toFixed(1)}k т/с`;
    }
    return `${metrics.streamingSpeed.toFixed(0)} т/с`;
  }, [metrics.streamingSpeed]);

  return (
    <StyledMetricsContainer>
      {/* Статус подключения */}
      <StyledMetricChip
        variant={isConnected ? 'success' : 'error'}
        label={isConnected ? 'Подключено' : 'Нет связи'}
      />

      {/* Количество токенов */}
      {metrics.totalTokens > 0 && (
        <StyledMetricChip
          variant="info"
          label={`${metrics.totalTokens} токенов`}
        />
      )}

      {/* Скорость стриминга */}
      {metrics.isActive && metrics.streamingSpeed > 0 && (
        <StyledMetricChip
          variant="info"
          label={formattedStreamingSpeed}
        />
      )}

      {/* Время обработки */}
      {metrics.processingTime > 0 && (
        <StyledMetricChip
          variant="info"
          label={formattedProcessingTime}
        />
      )}

      {/* Статус JSON валидации */}
      {metrics.totalTokens > 0 && (
        <StyledMetricChip
          variant={metrics.isValidJson ? 'success' : 'warning'}
          label={metrics.isValidJson ? 'JSON OK' : 'Парсинг...'}
        />
      )}

      {/* Индикатор ошибки */}
      {metrics.hasError && (
        <StyledMetricChip
          variant="error"
          label="Ошибка"
        />
      )}
    </StyledMetricsContainer>
  );
};
