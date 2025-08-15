# FloatingAIChatButton

Плавающая кнопка AI чата, которая отображается в правом нижнем углу экрана для быстрого доступа к AI функционалу.

## Особенности

### 🎯 Основная функциональность
- Быстрый доступ к AI чату из любой страницы
- Адаптивный дизайн для мобильных устройств
- Интеграция с существующей системой командного меню
- Поддержка хоткеев (Press @)

### 🚀 Onboarding поддержка
- **Видимость на onboarding страницах:** Кнопка отображается на всех этапах onboarding
- **Контекстные tooltip'ы:** Разные подсказки в зависимости от текущего статуса onboarding
- **Специальная анимация:** Пульсирующая анимация для привлечения внимания
- **Адаптивные иконки:** Разные иконки для onboarding и обычных страниц

## Статусы Onboarding

| Статус | Tooltip | Описание |
|--------|---------|----------|
| `PLAN_REQUIRED` | "Need help choosing a plan?" | Помощь в выборе плана подписки |
| `WORKSPACE_ACTIVATION` | "Need help setting up your workspace?" | Помощь в настройке workspace |
| `PROFILE_CREATION` | "Need help creating your profile?" | Помощь в создании профиля |
| `SYNC_EMAIL` | "Need help syncing your email?" | Помощь в синхронизации email |
| `INVITE_TEAM` | "Need help inviting your team?" | Помощь в приглашении команды |
| `BOOK_ONBOARDING` | "Need help with onboarding?" | Помощь с onboarding процессом |
| `COMPLETED` | "Need help exploring Twenty?" | Помощь в изучении платформы |

## Использование

### Базовое использование
```tsx
import { FloatingAIChatButton } from '@/ai/components/FloatingAIChatButton';

function App() {
  return (
    <div>
      {/* Ваш контент */}
      <FloatingAIChatButton />
    </div>
  );
}
```

### Интеграция в layout
```tsx
// В DefaultLayout.tsx
import { FloatingAIChatButton } from '@/ai/components/FloatingAIChatButton';

export const DefaultLayout = () => {
  return (
    <StyledLayout>
      {/* Существующий контент */}
      <FloatingAIChatButton />
    </StyledLayout>
  );
};
```

## Хуки

### useFloatingAIChatButton
Основной хук для управления кнопкой.

```tsx
import { useFloatingAIChatButton } from '@/ai/hooks/useFloatingAIChatButton';

const MyComponent = () => {
  const { 
    isVisible, 
    isOnboardingPage, 
    onboardingStatus, 
    handleClick 
  } = useFloatingAIChatButton();

  return (
    <button onClick={handleClick}>
      {isOnboardingPage ? 'Onboarding AI' : 'Ask AI'}
    </button>
  );
};
```

### useOnboardingAIChat
Специальный хук для onboarding AI функциональности.

```tsx
import { useOnboardingAIChat } from '@/ai/hooks/useOnboardingAIChat';

const OnboardingComponent = () => {
  const { 
    sendOnboardingQuestion, 
    welcomeMessage, 
    currentStep 
  } = useOnboardingAIChat();

  const handleQuestion = async (question: string) => {
    const response = await sendOnboardingQuestion(question);
    console.log('AI response:', response.message);
  };

  return (
    <div>
      {welcomeMessage && <p>{welcomeMessage}</p>}
      <button onClick={() => handleQuestion('How do I create a profile?')}>
        Ask AI
      </button>
    </div>
  );
};
```

## Стилизация

### CSS переменные
```css
/* Основные цвета */
--floating-ai-button-bg: theme.color.blue;
--floating-ai-button-color: theme.font.color.inverted;

/* Onboarding специфичные */
--floating-ai-button-onboarding-bg: theme.color.blue;
--floating-ai-button-onboarding-color: theme.font.color.inverted;
```

### Кастомизация
```tsx
// Переопределение стилей
<FloatingAIChatButton 
  style={{
    backgroundColor: 'custom-color',
    position: 'fixed',
    bottom: '20px',
    right: '20px',
  }}
/>
```

## Тестирование

### Unit тесты
```bash
yarn test packages/twenty-front/src/modules/ai/components/FloatingAIChatButton
```

### E2E тесты
```bash
yarn test:e2e floating-ai-chat-button
```

## Конфигурация

### Feature Flags
- `IS_AI_ENABLED`: Основной флаг для включения AI функциональности
- Кнопка отображается только когда этот флаг включен

### Состояние видимости
```tsx
import { useRecoilValue } from 'recoil';
import { isFloatingAIChatButtonVisibleState } from '@/ai/states/isFloatingAIChatButtonVisibleState';

const isVisible = useRecoilValue(isFloatingAIChatButtonVisibleState);
```

## Аналитика

### Отслеживаемые события
- `floating_ai_chat_button_clicked`: Клик по кнопке
- `onboarding_ai_question_sent`: Отправка вопроса в onboarding контексте
- `onboarding_ai_response_received`: Получение ответа от AI

### Метрики
```tsx
// В хуке useFloatingAIChatButton
const handleClick = () => {
  analytics.track('floating_ai_chat_button_clicked', {
    source: 'floating_button',
    context: isOnboardingPage ? 'onboarding' : 'regular',
    onboardingStatus,
    timestamp: new Date().toISOString(),
  });
  
  openAskAIPage();
};
```

## Совместимость

### Браузеры
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Устройства
- Desktop: Полная функциональность
- Tablet: Адаптивный дизайн
- Mobile: Оптимизированный интерфейс

## Известные ограничения

1. **Auth страницы:** Кнопка скрыта на страницах авторизации
2. **Command Menu:** Не отображается когда открыт Command Menu
3. **Мобильные устройства:** Уменьшенный размер для экономии места

## Будущие улучшения

- [ ] Интеграция с голосовым вводом
- [ ] Поддержка жестов на мобильных устройствах
- [ ] Персонализированные подсказки на основе поведения пользователя
- [ ] Интеграция с системой уведомлений
