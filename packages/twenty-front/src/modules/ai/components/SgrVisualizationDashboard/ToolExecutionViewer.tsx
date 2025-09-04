import { motion } from 'framer-motion';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { type JsonValue } from 'type-fest';

import { IconBolt, IconCheck, IconLoader, IconX } from 'twenty-ui/display';
import { ProgressBar } from 'twenty-ui/feedback';
import { JsonTree } from 'twenty-ui/json-visualizer';
import { SGRToolExecutionStatus } from '../../types/sgr-message.types';
import { ToolCallData } from '../../types/sgr-streaming.types';

const StyledContainer = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background: ${({ theme }) => theme.background.tertiary};
`;

const StyledToolInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledToolName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledStatusBadge = styled(motion.div)<{ status: SGRToolExecutionStatus }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  color: white;
  background: ${({ status, theme }) => {
    switch (status) {
      case SGRToolExecutionStatus.IN_PROGRESS: return theme.color.blue;
      case SGRToolExecutionStatus.COMPLETED: return theme.color.green;
      case SGRToolExecutionStatus.FAILED: return theme.color.red;
      default: return theme.color.gray;
    }
  }};
`;

const StyledExecutionTime = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledContent = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSectionTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StyledParametersContainer = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(2)};
  max-height: 200px;
  overflow-y: auto;
`;

const StyledErrorDisplay = styled(motion.div)`
  background: ${({ theme }) => theme.color.red}10;
  border: 1px solid ${({ theme }) => theme.color.red}30;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(3)};
  color: ${({ theme }) => theme.color.red};
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledProgressSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledProgressLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledArgsContainer = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(2)};
  max-height: 200px;
  overflow-y: auto;
`;

const StyledArgsTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledEmptyArgs = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-style: italic;
  text-align: center;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledResultContainer = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(2)};
  max-height: 200px;
  overflow-y: auto;
`;

const StyledResultTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

type ToolExecutionViewerProps = {
  toolCall: ToolCallData;
  isActive: boolean;
};

/**
 * Компонент для визуализации выполнения инструмента
 * Показывает параметры, прогресс и результат выполнения инструмента
 */
export const ToolExecutionViewer = ({
  toolCall,
  isActive,
}: ToolExecutionViewerProps) => {
  const [executionTime, setExecutionTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const hasArgs: boolean = Boolean(toolCall.toolArgs) && Object.keys(toolCall.toolArgs).length > 0;

  const argsContent: ReactNode = hasArgs ? (
    <JsonTree
      value={toolCall.toolArgs as JsonValue}
      shouldExpandNodeInitially={() => true}
      emptyArrayLabel="Пустой массив"
      emptyObjectLabel="Пустой объект"
      emptyStringLabel="[пустая строка]"
      arrowButtonCollapsedLabel="Развернуть"
      arrowButtonExpandedLabel="Свернуть"
    />
  ) : (
    <StyledEmptyArgs>Нет аргументов</StyledEmptyArgs>
  );

  // Симуляция времени выполнения
  useEffect(() => {
    if (!isActive || toolCall.status !== SGRToolExecutionStatus.IN_PROGRESS) {
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setExecutionTime(elapsed);
      
      // Симуляция прогресса (будет заменено на реальные данные)
      const progressValue = Math.min((elapsed / 5000) * 100, 90); // Максимум 90% до завершения
      setProgress(progressValue);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, toolCall.status]);

  // Обновление финального времени выполнения
  useEffect(() => {
    if (toolCall.executionTime) {
      setExecutionTime(toolCall.executionTime);
      setProgress(100);
    }
  }, [toolCall.executionTime]);

  /**
   * Получение иконки для статуса
   */
  const getStatusIcon = useCallback(() => {
    switch (toolCall.status) {
      case SGRToolExecutionStatus.IN_PROGRESS:
        return <IconLoader />;
      case SGRToolExecutionStatus.COMPLETED:
        return <IconCheck />;
      case SGRToolExecutionStatus.FAILED:
        return <IconX />;
      default:
        return <IconBolt />;
    }
  }, [toolCall.status]);

  /**
   * Получение текста статуса
   */
  const getStatusText = useCallback(() => {
    switch (toolCall.status) {
      case SGRToolExecutionStatus.IN_PROGRESS:
        return 'Выполняется';
      case SGRToolExecutionStatus.COMPLETED:
        return 'Завершено';
      case SGRToolExecutionStatus.FAILED:
        return 'Ошибка';
      default:
        return 'Ожидание';
    }
  }, [toolCall.status]);

  /**
   * Форматирование времени выполнения
   */
  const formatExecutionTime = useCallback((timeMs: number): string => {
    if (timeMs < 1000) {
      return `${timeMs}мс`;
    }
    return `${(timeMs / 1000).toFixed(1)}с`;
  }, []);

  const progressColor = useCallback(() => {
    if (progress >= 90) return 'green';
    if (progress >= 50) return 'blue';
    return 'gray';
  }, [progress]);

  return (
    <StyledContainer>
      {/* Заголовок */}
      <StyledHeader>
        <StyledToolInfo>
          {getStatusIcon()}
          <div>
            <StyledToolName>{toolCall.toolName}</StyledToolName>
            {executionTime > 0 && (
              <StyledExecutionTime>
                {formatExecutionTime(executionTime)}
              </StyledExecutionTime>
            )}
          </div>
        </StyledToolInfo>
        
        <StyledStatusBadge
          status={toolCall.status}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {getStatusText()}
        </StyledStatusBadge>
      </StyledHeader>

      {/* Контент */}
      <StyledContent>
        {/* Прогресс выполнения */}
        {toolCall.status === SGRToolExecutionStatus.IN_PROGRESS && (
          <StyledProgressSection>
            <StyledProgressLabel>
              <span>Прогресс выполнения</span>
              <span>{Math.round(progress)}%</span>
            </StyledProgressLabel>
            <ProgressBar
              value={progress / 100}
              barColor={progressColor()}
            />
          </StyledProgressSection>
        )}

        
        
        
        
        
        
        
        
        
        
        
        {/* Отображение аргументов инструмента */}
        <StyledArgsContainer>
          <StyledArgsTitle>Аргументы:</StyledArgsTitle>
          {argsContent}
        </StyledArgsContainer>

        {/* Отображение результата */}
        {toolCall.result !== undefined && toolCall.result !== null ? (
          <StyledResultContainer>
            <StyledResultTitle>Результат:</StyledResultTitle>
            <JsonTree
              value={toolCall.result as JsonValue}
              shouldExpandNodeInitially={() => true}
              emptyArrayLabel="Пустой массив"
              emptyObjectLabel="Пустой объект"
              emptyStringLabel="[пустая строка]"
              arrowButtonCollapsedLabel="Развернуть"
              arrowButtonExpandedLabel="Свернуть"
            />
          </StyledResultContainer>
        ) : null}

        {/* Ошибка выполнения */}
        {toolCall.status === SGRToolExecutionStatus.FAILED && toolCall.error && (
          <StyledErrorDisplay
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <IconX />
            <div>
              <strong>Ошибка выполнения:</strong><br />
              {toolCall.error}
            </div>
          </StyledErrorDisplay>
        )}
      </StyledContent>
    </StyledContainer>
  );
};
