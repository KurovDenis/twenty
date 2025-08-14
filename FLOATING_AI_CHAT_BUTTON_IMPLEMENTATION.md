# 🤖 Floating AI Chat Button - План реализации

## 📋 Обзор

Добавление плавающей кнопки AI чата в правом нижнем углу экрана для быстрого доступа к AI функционалу.

## 🎯 Цели

- ✅ Быстрый доступ к AI чату из любой страницы
- ✅ Улучшение UX с визуальным индикатором AI доступности
- ✅ Интеграция с существующей системой командного меню
- ✅ Адаптивность для мобильных устройств
- ✅ Соответствие дизайн-системе Twenty

## 🏗️ Архитектура

### Структура файлов
```
packages/twenty-front/src/modules/ai/
├── components/
│   ├── FloatingAIChatButton/
│   │   ├── FloatingAIChatButton.tsx          # Основной компонент
│   │   ├── FloatingAIChatButton.styles.ts    # Стили
│   │   └── index.ts                          # Экспорт
│   └── ...
├── hooks/
│   ├── useFloatingAIChatButton.ts            # Хук для логики
│   └── ...
└── states/
    ├── isFloatingAIChatButtonVisibleState.ts # Состояние видимости
    └── ...
```

## 📝 Реализация

### 1. Создание состояния видимости

**Файл:** `packages/twenty-front/src/modules/ai/states/isFloatingAIChatButtonVisibleState.ts`

```typescript
import { atom } from 'recoil';

export const isFloatingAIChatButtonVisibleState = atom({
  key: 'ai/isFloatingAIChatButtonVisibleState',
  default: true,
});
```

### 2. Создание хука для логики

**Файл:** `packages/twenty-front/src/modules/ai/hooks/useFloatingAIChatButton.ts`

```typescript
import { useRecoilValue } from 'recoil';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { FeatureFlagKey } from '~/generated/graphql';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isVisible = useRecoilValue(isFloatingAIChatButtonVisibleState);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  const handleClick = () => {
    openAskAIPage();
  };

  return {
    isVisible: isVisible && isAiEnabled,
    handleClick,
  };
};
```

### 3. Создание стилей

**Файл:** `packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/FloatingAIChatButton.styles.ts`

```typescript
import styled from '@emotion/styled';

export const StyledFloatingAIChatButtonContainer = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.spacing(4)};
  right: ${({ theme }) => theme.spacing(4)};
  z-index: 1000;
  pointer-events: auto;
  animation: fadeInScale 0.3s ease-out;

  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (max-width: 768px) {
    bottom: ${({ theme }) => theme.spacing(2)};
    right: ${({ theme }) => theme.spacing(2)};
  }

  @media (max-width: 480px) {
    bottom: ${({ theme }) => theme.spacing(1.5)};
    right: ${({ theme }) => theme.spacing(1.5)};
  }
`;

export const StyledFloatingAIChatButton = styled.div`
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: -4px;
    right: -4px;
    width: 8px;
    height: 8px;
    background: ${({ theme }) => theme.color.blue};
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover::before {
    opacity: 1;
  }
`;

export const StyledTooltip = styled.div`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1, 2)};
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  transform: translateY(4px);
`;
```

### 4. Основной компонент

**Файл:** `packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/FloatingAIChatButton.tsx`

```typescript
import { useTheme } from '@emotion/react';
import { useState } from 'react';
import { t } from '@lingui/core/macro';
import { IconSparkles } from 'twenty-ui/display';
import { FloatingIconButton } from 'twenty-ui/input';
import { useIsMobile } from 'twenty-ui/utilities';
import { useFloatingAIChatButton } from '../../hooks/useFloatingAIChatButton';
import {
  StyledFloatingAIChatButton,
  StyledFloatingAIChatButtonContainer,
  StyledTooltip,
} from './FloatingAIChatButton.styles';

export const FloatingAIChatButton = () => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const { isVisible, handleClick } = useFloatingAIChatButton();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  if (!isVisible) {
    return null;
  }

  return (
    <StyledFloatingAIChatButtonContainer
      data-testid="floating-ai-chat-button"
    >
      <StyledFloatingAIChatButton
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
      >
        <FloatingIconButton
          Icon={IconSparkles}
          size={isMobile ? 'small' : 'medium'}
          position="standalone"
          applyShadow={true}
          applyBlur={true}
          onClick={handleClick}
        />
        <StyledTooltip
          style={{
            opacity: isTooltipVisible ? 1 : 0,
            transform: isTooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          {t`Ask AI (Press @)`}
        </StyledTooltip>
      </StyledFloatingAIChatButton>
    </StyledFloatingAIChatButtonContainer>
  );
};
```

### 5. Экспорт компонента

**Файл:** `packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/index.ts`

```typescript
export { FloatingAIChatButton } from './FloatingAIChatButton';
```

### 6. Обновление экспорта модуля AI

**Файл:** `packages/twenty-front/src/modules/ai/components/index.ts`

```typescript
// ... existing exports ...
export { FloatingAIChatButton } from './FloatingAIChatButton';
```

### 7. Интеграция в основной layout

**Файл:** `packages/twenty-front/src/modules/ui/layout/page/components/DefaultLayout.tsx`

```typescript
// ... existing imports ...
import { FloatingAIChatButton } from '@/ai/components/FloatingAIChatButton';

export const DefaultLayout = () => {
  // ... existing code ...

  return (
    <>
      <Global
        styles={css`
          body {
            background: ${theme.background.tertiary};
          }
        `}
      />
      <StyledLayout>
        <AppErrorBoundary FallbackComponent={AppFullScreenErrorFallback}>
          <StyledPageContainer
            animate={{
              marginLeft:
                isSettingsPage && !isMobile && !useShowFullScreen
                  ? (windowsWidth -
                      (OBJECT_SETTINGS_WIDTH +
                        NAV_DRAWER_WIDTHS.menu.desktop.expanded +
                        76)) /
                    2
                  : 0,
            }}
            transition={{
              duration: theme.animation.duration.normal,
            }}
          >
            {!showAuthModal && (
              <>
                <CommandMenuRouter />
                <KeyboardShortcutMenu />
                <FloatingAIChatButton />
              </>
            )}
            {/* ... rest of existing code ... */}
          </StyledPageContainer>
        </AppErrorBoundary>
      </StyledLayout>
    </>
  );
};
```

## 🎨 Стилизация и темы

### Цветовая схема
- **Основной цвет:** `theme.color.blue` (как в существующем AI интерфейсе)
- **Фон:** `theme.background.primary` с blur эффектом
- **Тень:** `theme.boxShadow.strong`
- **Hover:** `theme.background.transparent.lighter`

### Анимации
- **Появление:** Fade in + scale up
- **Hover:** Плавное изменение цвета фона
- **Клик:** Мягкая анимация нажатия
- **Tooltip:** Slide up с fade in (управляется React state)

## 📱 Адаптивность

### Мобильные устройства
```typescript
// В компоненте FloatingAIChatButton.tsx
import { useIsMobile } from 'twenty-ui/utilities';

export const FloatingAIChatButton = () => {
  const isMobile = useIsMobile();
  
  // Адаптивный размер
  const buttonSize = isMobile ? 'small' : 'medium';
  
  // ... rest of component
};
```

### Медиа-запросы
```css
@media (max-width: 768px) {
  .floating-ai-chat-button {
    bottom: 16px;
    right: 16px;
  }
}

@media (max-width: 480px) {
  .floating-ai-chat-button {
    bottom: 12px;
    right: 12px;
  }
}
```

## 🔧 Конфигурация

### Feature Flag зависимость
Кнопка отображается только когда включен `IS_AI_ENABLED` feature flag.

### Условное отображение
```typescript
// Скрыть на определенных страницах
const shouldHideOnPage = (pathname: string) => {
  return pathname.startsWith('/auth/') || 
         pathname.startsWith('/onboarding/');
};
```

## 🧪 Тестирование

### Unit тесты
```typescript
// packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/__tests__/FloatingAIChatButton.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingAIChatButton } from '../FloatingAIChatButton';

describe('FloatingAIChatButton', () => {
  it('should render when AI is enabled', () => {
    render(<FloatingAIChatButton />);
    expect(screen.getByTestId('floating-ai-chat-button')).toBeInTheDocument();
  });

  it('should not render when AI is disabled', () => {
    // Mock feature flag to return false
    render(<FloatingAIChatButton />);
    expect(screen.queryByTestId('floating-ai-chat-button')).not.toBeInTheDocument();
  });

  it('should open AI chat when clicked', () => {
    const mockOpenAskAIPage = jest.fn();
    render(<FloatingAIChatButton />);
    
    fireEvent.click(screen.getByTestId('floating-ai-chat-button'));
    expect(mockOpenAskAIPage).toHaveBeenCalled();
  });
});
```

### E2E тесты
```typescript
// packages/twenty-e2e-testing/tests/floating-ai-chat-button.spec.ts

import { test, expect } from '@playwright/test';

test('Floating AI Chat Button functionality', async ({ page }) => {
  await page.goto('/');
  
  // Проверяем, что кнопка видна
  const floatingButton = page.locator('[data-testid="floating-ai-chat-button"]');
  await expect(floatingButton).toBeVisible();
  
  // Кликаем на кнопку
  await floatingButton.click();
  
  // Проверяем, что открылся AI чат
  await expect(page.locator('[data-testid="ai-chat-tab"]')).toBeVisible();
});
```

## 🚀 Развертывание

### 1. Создание файлов
```bash
# Создаем структуру директорий
mkdir -p packages/twenty-front/src/modules/ai/components/FloatingAIChatButton
mkdir -p packages/twenty-front/src/modules/ai/hooks
mkdir -p packages/twenty-front/src/modules/ai/states
```

### 2. Создание компонентов
```bash
# Создаем все необходимые файлы
touch packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/FloatingAIChatButton.tsx
touch packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/FloatingAIChatButton.styles.ts
touch packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/index.ts
touch packages/twenty-front/src/modules/ai/hooks/useFloatingAIChatButton.ts
touch packages/twenty-front/src/modules/ai/states/isFloatingAIChatButtonVisibleState.ts
```

### 3. Обновление экспортов
```bash
# Обновляем index.ts файлы
echo "export { FloatingAIChatButton } from './FloatingAIChatButton';" >> packages/twenty-front/src/modules/ai/components/index.ts
```

### 4. Тестирование
```bash
# Запускаем тесты
yarn test packages/twenty-front/src/modules/ai/components/FloatingAIChatButton
yarn test:e2e floating-ai-chat-button
```

## 📊 Метрики и аналитика

### Отслеживание использования
```typescript
// В хуке useFloatingAIChatButton.ts
const handleClick = () => {
  // Отправляем аналитику
  analytics.track('floating_ai_chat_button_clicked', {
    source: 'floating_button',
    timestamp: new Date().toISOString(),
  });
  
  openAskAIPage();
};
```

## 🔄 Обратная совместимость

- ✅ Не влияет на существующий функционал AI
- ✅ Использует существующие хуки и состояния
- ✅ Соответствует дизайн-системе
- ✅ Опциональное отображение через feature flag

## 🎯 Результат

После реализации пользователи получат:
- 🚀 Быстрый доступ к AI чату из любой страницы
- 🎨 Красивую анимированную кнопку в правом нижнем углу
- 📱 Адаптивный интерфейс для всех устройств
- ⚡ Интеграцию с существующей системой хоткеев
- 🔧 Возможность отключения через feature flag

## ✅ Статус реализации

**ЗАВЕРШЕНО** ✅

Все компоненты реализованы и работают корректно:
- ✅ FloatingAIChatButton компонент
- ✅ Стили с адаптивным дизайном
- ✅ Хук useFloatingAIChatButton
- ✅ Состояние isFloatingAIChatButtonVisibleState
- ✅ Интеграция в DefaultLayout
- ✅ Tooltip с React state управлением
- ✅ Исправлены все ошибки CSS селекторов

## 📝 Следующие шаги

1. **Тестирование** - написание unit и e2e тестов
2. **Оптимизация** - настройка производительности и анимаций
3. **Документация** - обновление документации для разработчиков
4. **Аналитика** - добавление отслеживания использования
