# FloatingAIChatButton

Плавающая кнопка для быстрого доступа к AI чату в правом нижнем углу экрана.

## Описание

Компонент `FloatingAIChatButton` предоставляет пользователям быстрый доступ к AI функционалу из любой страницы приложения. Кнопка отображается в правом нижнем углу экрана и открывает AI чат при клике.

## Особенности

- 🎯 **Быстрый доступ** - кнопка доступна на всех страницах
- 🎨 **Анимации** - плавные переходы и hover эффекты
- 📱 **Адаптивность** - разные размеры для мобильных и десктопных устройств
- 🔧 **Feature Flag** - отображается только когда AI включен
- ♿ **Доступность** - поддержка ARIA атрибутов и клавиатурной навигации

## Использование

```tsx
import { FloatingAIChatButton } from '@/ai/components/FloatingAIChatButton';

function App() {
  return (
    <div>
      {/* Основной контент */}
      <FloatingAIChatButton />
    </div>
  );
}
```

## Пропсы

Компонент не принимает пропсы, все настройки управляются через хуки и состояния.

## Состояния

### isFloatingAIChatButtonVisibleState
Управляет видимостью кнопки. По умолчанию `true`.

```tsx
import { isFloatingAIChatButtonVisibleState } from '@/ai/states/isFloatingAIChatButtonVisibleState';

// Скрыть кнопку
set(isFloatingAIChatButtonVisibleState, false);
```

## Хуки

### useFloatingAIChatButton
Основной хук для управления логикой кнопки.

```tsx
import { useFloatingAIChatButton } from '@/ai/hooks/useFloatingAIChatButton';

const { isVisible, handleClick } = useFloatingAIChatButton();
```

**Возвращает:**
- `isVisible: boolean` - должна ли кнопка отображаться
- `handleClick: () => void` - обработчик клика

## Стилизация

Компонент использует emotion для стилизации и поддерживает:

- **Темы** - автоматически адаптируется к текущей теме
- **Адаптивность** - медиа-запросы для разных размеров экрана
- **Анимации** - Framer Motion для плавных переходов

## Адаптивность

| Размер экрана | Отступы | Размер кнопки |
|---------------|---------|---------------|
| Desktop (>768px) | 16px | medium |
| Tablet (≤768px) | 8px | medium |
| Mobile (≤480px) | 6px | small |

## Тестирование

```bash
# Запуск тестов
yarn test packages/twenty-front/src/modules/ai/components/FloatingAIChatButton
```

## Зависимости

- `@/command-menu/hooks/useOpenAskAIPageInCommandMenu` - для открытия AI чата
- `@/workspace/hooks/useIsFeatureEnabled` - для проверки feature flag
- `twenty-ui/input/FloatingIconButton` - базовый компонент кнопки
- `twenty-ui/display/IconSparkles` - иконка AI

## Примеры

### Базовое использование
```tsx
<FloatingAIChatButton />
```

### Условное отображение
```tsx
{isAiEnabled && <FloatingAIChatButton />}
```

## Troubleshooting

### Кнопка не отображается
1. Проверьте, что `IS_AI_ENABLED` feature flag включен
2. Убедитесь, что `isFloatingAIChatButtonVisibleState` установлен в `true`
3. Проверьте консоль на наличие ошибок

### Кнопка не открывает AI чат
1. Убедитесь, что AI Agent настроен в workspace
2. Проверьте, что командное меню работает корректно
3. Проверьте консоль на наличие ошибок

## SGR Avito Agent Integration

### Автоматическое создание специализированных агентов

Когда пользователь находится в процессе бизнес-настройки (`businessSetupStatus = 'WELCOME'`), клик на FloatingAIChatButton автоматически создает специализированный SGR Avito агент вместо стандартного AI чата.

```tsx
// Автоматическая логика определения типа агента
const businessSetupStatus = useBusinessSetupStatus();

if (businessSetupStatus === 'WELCOME') {
  // Создается SGR Avito агент для настройки интеграции
  createBusinessSetupChat();
} else {
  // Создается стандартный AI агент
  openAskAIPage();
}
```

### Особенности SGR интеграции

- 🤖 **Специализированные агенты** - автоматический выбор типа агента
- 🌊 **SGR Streaming** - визуализация прогресса выполнения задач
- 🔄 **Fallback механизм** - переключение на стандартный чат при ошибках
- 📊 **Контекстная персонализация** - агенты адаптируются к этапу настройки

### Документация

Подробную документацию по SGR интеграции см. в [`README-SGR-Avito-Integration.md`](../../business-setup/README-SGR-Avito-Integration.md)

## Связанные компоненты

- `AIChatTab` - основной компонент AI чата с SGR поддержкой
- `CommandMenuRouter` - роутер командного меню
- `FloatingIconButton` - базовая плавающая кнопка
- `useBusinessSetupAgentChat` - хук для создания специализированных агентов
- `BusinessSetupModule` - backend модуль для SGR агентов
