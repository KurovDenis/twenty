import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import { JsonTree } from 'twenty-ui/json-visualizer';
import { Card } from 'twenty-ui/layout';
import { JSONStreamingData } from '../../types/sgr-streaming.types';

const StyledContainer = styled(Card)`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledHeader = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.tertiary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTokenCounter = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledContent = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledJsonContainer = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  min-height: 150px;
  overflow: hidden;
  position: relative;
`;

const StyledRawJsonDisplay = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-family: ${({ theme }) => theme.font.family.monospace};
  font-size: ${({ theme }) => theme.font.size.sm};
  max-height: 300px;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(3)};
  white-space: pre-wrap;
  word-break: break-all;
`;

const StyledJsonTreeContainer = styled.div`
  max-height: 300px;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledValidationIndicator = styled(motion.div)<{ isValid: boolean }>`
  background: ${({ isValid, theme }) =>
    isValid ? theme.color.green : theme.color.orange};
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: bold;
  padding: 4px 8px;
  position: absolute;
  right: 8px;
  top: 8px;
`;

const StyledStreamingCursor = styled(motion.span)`
  display: inline-block;
  width: 2px;
  height: 1em;
  background: ${({ theme }) => theme.color.blue};
  margin-left: 2px;
  vertical-align: text-bottom;
`;

const StyledTabButton = styled.button<{ active: boolean }>`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: none;
  background: ${({ active, theme }) =>
    active ? theme.background.primary : 'transparent'};
  color: ${({ active, theme }) =>
    active ? theme.font.color.primary : theme.font.color.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.background.primary};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledTabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)}
    0;
`;

type ViewMode = 'raw' | 'tree';

type JSONStreamingViewerProps = {
  jsonData: JSONStreamingData;
  isActive: boolean;
};

/**
 * Компонент для визуализации JSON стриминга
 * Показывает поток JSON токенов в реальном времени с возможностью переключения режимов
 */
export const JSONStreamingViewer = ({
  jsonData,
  isActive,
}: JSONStreamingViewerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const rawJsonRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Автоскролл при добавлении новых токенов
  useEffect(() => {
    if (shouldAutoScroll && rawJsonRef.current && isActive) {
      rawJsonRef.current.scrollTop = rawJsonRef.current.scrollHeight;
    }
  }, [jsonData.rawJson, shouldAutoScroll, isActive]);

  /**
   * Обработка скролла пользователем
   */
  const handleScroll = useCallback(() => {
    if (rawJsonRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = rawJsonRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setShouldAutoScroll(isAtBottom);
    }
  }, []);

  /**
   * Форматирование скорости стриминга
   */
  const formatStreamingSpeed = useCallback((speed: number): string => {
    if (speed > 1000) {
      return `${(speed / 1000).toFixed(1)}k токенов/с`;
    }
    return `${speed.toFixed(0)} токенов/с`;
  }, []);

  /**
   * Рендер Raw JSON режима
   */
  const renderRawMode = useCallback(
    () => (
      <StyledRawJsonDisplay ref={rawJsonRef} onScroll={handleScroll}>
        {jsonData.rawJson}
        {isActive && (
          <StyledStreamingCursor
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </StyledRawJsonDisplay>
    ),
    [jsonData.rawJson, isActive, handleScroll],
  );

  /**
   * Рендер Tree JSON режима
   */
  const renderTreeMode = useCallback(() => {
    if (!jsonData.isValidJson || !jsonData.parsedJson) {
      return (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: 'var(--theme-font-color-secondary)',
          }}
        >
          {isActive ? 'Ожидание валидного JSON...' : 'JSON не валиден'}
        </div>
      );
    }

    return (
      <StyledJsonTreeContainer>
        <JsonTree
          value={jsonData.parsedJson as any}
          shouldExpandNodeInitially={() => true}
          emptyArrayLabel="Пустой массив"
          emptyObjectLabel="Пустой объект"
          emptyStringLabel="[пустая строка]"
          arrowButtonCollapsedLabel="Развернуть"
          arrowButtonExpandedLabel="Свернуть"
        />
      </StyledJsonTreeContainer>
    );
  }, [jsonData.isValidJson, jsonData.parsedJson, isActive]);

  return (
    <StyledContainer>
      {/* Заголовок */}
      <StyledHeader>
        <StyledTitle>
          🔄 JSON Стриминг
          {isActive && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              ⚙️
            </motion.div>
          )}
        </StyledTitle>

        <StyledTokenCounter>
          <span>{jsonData.totalTokens} токенов</span>
          {isActive && jsonData.streamingSpeed > 0 && (
            <span>• {formatStreamingSpeed(jsonData.streamingSpeed)}</span>
          )}
        </StyledTokenCounter>
      </StyledHeader>

      {/* Переключатель режимов */}
      <StyledTabs>
        <StyledTabButton
          active={viewMode === 'raw'}
          onClick={() => setViewMode('raw')}
        >
          Raw JSON
        </StyledTabButton>
        <StyledTabButton
          active={viewMode === 'tree'}
          onClick={() => setViewMode('tree')}
        >
          Tree View
        </StyledTabButton>
      </StyledTabs>

      {/* Контент */}
      <StyledContent>
        <StyledJsonContainer>
          {/* Индикатор валидности */}
          <StyledValidationIndicator
            isValid={jsonData.isValidJson}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {jsonData.isValidJson ? 'Valid' : 'Parsing...'}
          </StyledValidationIndicator>

          {/* Отображение JSON */}
          {jsonData.parsedJson &&
            Object.keys(jsonData.parsedJson).length > 0 && (
              <StyledJsonContainer>
                <JsonTree
                  value={jsonData.parsedJson as any}
                  shouldExpandNodeInitially={() => true}
                  emptyArrayLabel="Пустой массив"
                  emptyObjectLabel="Пустой объект"
                  emptyStringLabel="[пустая строка]"
                  arrowButtonCollapsedLabel="Развернуть"
                  arrowButtonExpandedLabel="Свернуть"
                />
              </StyledJsonContainer>
            )}
        </StyledJsonContainer>
      </StyledContent>
    </StyledContainer>
  );
};
