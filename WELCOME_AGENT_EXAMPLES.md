# Welcome Agent - Примеры кода и использования

## 🚀 Быстрый старт

### **1. Базовое использование**

```typescript
// В компоненте
import { useShouldShowWelcomeAgent } from '@/ai/hooks/useShouldShowWelcomeAgent';
import { useSmartAgentSelection } from '@/ai/hooks/useSmartAgentSelection';

const MyComponent = () => {
  const { shouldShowWelcomeAgent, startWelcomeAgentSession } = useShouldShowWelcomeAgent();
  const { isWelcomeAgent, currentAgentId } = useSmartAgentSelection();

  const handleAIClick = () => {
    if (shouldShowWelcomeAgent) {
      startWelcomeAgentSession();
    }
    // Открыть AI чат
  };

  return (
    <div>
      {shouldShowWelcomeAgent && (
        <div className="welcome-agent-indicator">
          🎉 Новый пользователь! Попробуйте Welcome Agent
        </div>
      )}
      <button onClick={handleAIClick}>
        {isWelcomeAgent ? 'Welcome Agent' : 'Ask AI'}
      </button>
    </div>
  );
};
```

### **2. Интеграция с существующим UI**

```typescript
// FloatingAIChatButton.tsx
import { useShouldShowWelcomeAgent } from '../../hooks/useShouldShowWelcomeAgent';

export const FloatingAIChatButton = () => {
  const { shouldShowWelcomeAgent, startWelcomeAgentSession } = useShouldShowWelcomeAgent();
  
  const handleButtonClick = () => {
    if (shouldShowWelcomeAgent) {
      startWelcomeAgentSession();
    }
    handleClick();
  };

  return (
    <StyledFloatingAIChatButton>
      <FloatingIconButton onClick={handleButtonClick} />
      {shouldShowWelcomeAgent && (
        <StyledWelcomeBadge>Новый!</StyledWelcomeBadge>
      )}
      <StyledTooltip>
        {shouldShowWelcomeAgent 
          ? 'Welcome Agent (Новый!)' 
          : 'Ask AI (Press @)'
        }
      </StyledTooltip>
    </StyledFloatingAIChatButton>
  );
};
```

## 🎯 Примеры хуков

### **useShouldShowWelcomeAgent**

```typescript
// Полный пример использования
const WelcomeAgentExample = () => {
  const {
    shouldShowWelcomeAgent,
    isNewUser,
    hasActiveWelcomeSession,
    startWelcomeAgentSession,
    endWelcomeAgentSession,
    sessionInfo,
    debug
  } = useShouldShowWelcomeAgent();

  console.log('Debug info:', debug);
  // {
  //   workspaceCreatedAt: "2024-01-15T10:30:00Z",
  //   timeSinceCreation: 86400000, // 24 hours in ms
  //   isAiEnabled: true
  // }

  return (
    <div>
      <h3>Welcome Agent Status</h3>
      <p>Should show: {shouldShowWelcomeAgent ? 'Yes' : 'No'}</p>
      <p>Is new user: {isNewUser ? 'Yes' : 'No'}</p>
      <p>Active session: {hasActiveWelcomeSession ? 'Yes' : 'No'}</p>
      
      {shouldShowWelcomeAgent && (
        <button onClick={startWelcomeAgentSession}>
          Start Welcome Agent
        </button>
      )}
      
      {hasActiveWelcomeSession && (
        <button onClick={endWelcomeAgentSession}>
          End Session
        </button>
      )}
      
      <details>
        <summary>Session Info</summary>
        <pre>{JSON.stringify(sessionInfo, null, 2)}</pre>
      </details>
    </div>
  );
};
```

### **useSmartAgentSelection**

```typescript
// Пример умного выбора агента
const SmartAgentExample = () => {
  const {
    getOptimalAgentId,
    isWelcomeAgent,
    currentAgentId,
    welcomeAgent,
    defaultAgent,
    debug
  } = useSmartAgentSelection();

  const agentId = getOptimalAgentId();

  return (
    <div>
      <h3>Agent Selection</h3>
      <p>Current agent ID: {currentAgentId}</p>
      <p>Is Welcome Agent: {isWelcomeAgent ? 'Yes' : 'No'}</p>
      
      {welcomeAgent && (
        <div>
          <h4>Welcome Agent Details</h4>
          <p>ID: {welcomeAgent.id}</p>
          <p>Name: {welcomeAgent.name}</p>
          <p>Type: {welcomeAgent.agentType}</p>
        </div>
      )}
      
      {defaultAgent && (
        <div>
          <h4>Default Agent Details</h4>
          <p>ID: {defaultAgent.id}</p>
          <p>Name: {defaultAgent.name}</p>
        </div>
      )}
      
      <details>
        <summary>Debug Info</summary>
        <pre>{JSON.stringify(debug, null, 2)}</pre>
      </details>
    </div>
  );
};
```

## 🎨 Примеры компонентов

### **WelcomeAgentHeader**

```typescript
// Кастомный WelcomeAgentHeader
const CustomWelcomeHeader = () => {
  const { endWelcomeAgentSession } = useShouldShowWelcomeAgent();
  
  const handleSkip = () => {
    endWelcomeAgentSession();
    // Дополнительная логика
    showNotification('Welcome Agent пропущен');
  };

  return (
    <StyledWelcomeHeader>
      <StyledWelcomeContent>
        <IconSparkles size={24} />
        <div>
          <StyledWelcomeTitle>
            🎉 Добро пожаловать в Twenty!
          </StyledWelcomeTitle>
          <StyledWelcomeSubtitle>
            Я помогу вам освоить CRM за 5 минут
          </StyledWelcomeSubtitle>
        </div>
      </StyledWelcomeContent>
      <div>
        <Button variant="secondary" onClick={handleSkip}>
          Пропустить
        </Button>
        <Button variant="primary" onClick={() => console.log('Start tour')}>
          Начать тур
        </Button>
      </div>
    </StyledWelcomeHeader>
  );
};
```

### **Enhanced AIChatTab**

```typescript
// Расширенный AIChatTab с кастомной логикой
const EnhancedAIChatTab = ({ agentId, showWelcomeAgentUI = false }) => {
  const { endWelcomeAgentSession } = useShouldShowWelcomeAgent();
  const [welcomeMessages, setWelcomeMessages] = useState([]);

  const handleSkipWelcomeAgent = () => {
    endWelcomeAgentSession();
    
    // Показать уведомление
    showNotification('Переключение на обычный AI...');
    
    // Перезагрузить страницу для обновления состояния
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleWelcomeMessage = (message) => {
    if (showWelcomeAgentUI) {
      setWelcomeMessages(prev => [...prev, message]);
    }
  };

  return (
    <StyledContainer>
      {showWelcomeAgentUI && (
        <WelcomeAgentHeader onSkip={handleSkipWelcomeAgent} />
      )}
      
      {/* Специальные сообщения для Welcome Agent */}
      {showWelcomeAgentUI && welcomeMessages.length === 0 && (
        <WelcomeAgentEmptyState />
      )}
      
      {/* Обычный чат */}
      <AIChatMessages agentId={agentId} onMessage={handleWelcomeMessage} />
      
      <StyledInputArea>
        <TextArea
          placeholder={
            showWelcomeAgentUI 
              ? 'Задайте вопрос о Twenty...' 
              : 'Enter a question...'
          }
        />
        <SendButton />
      </StyledInputArea>
    </StyledContainer>
  );
};
```

## 🔌 GraphQL примеры

### **Отправка сообщения Welcome Agent**

```typescript
// Пример использования мутации
import { useSendWelcomeAgentMessageMutation } from '@/ai/graphql/mutations/sendWelcomeAgentMessage';

const WelcomeAgentChat = () => {
  const [sendMessage, { loading, error }] = useSendWelcomeAgentMessageMutation();
  const [messages, setMessages] = useState([]);

  const handleSendMessage = async (content: string) => {
    try {
      const response = await sendMessage({
        variables: {
          input: {
            agentId: 'welcome-agent-id',
            threadId: 'thread-id',
            workspaceId: 'workspace-id',
            messages: [{
              id: crypto.randomUUID(),
              role: 'user',
              content: content.trim(),
              timestamp: new Date().toISOString(),
            }]
          }
        }
      });

      if (response.data?.sendWelcomeAgentMessage) {
        const newMessage = response.data.sendWelcomeAgentMessage;
        setMessages(prev => [...prev, newMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          <strong>{message.role}:</strong> {message.content}
        </div>
      ))}
      
      <input 
        type="text" 
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSendMessage(e.target.value);
            e.target.value = '';
          }
        }}
        disabled={loading}
      />
      
      {error && <div className="error">{error.message}</div>}
    </div>
  );
};
```

### **Создание thread Welcome Agent**

```typescript
// Пример создания thread
import { useCreateWelcomeAgentThreadMutation } from '@/ai/graphql/mutations/createWelcomeAgentThread';

const CreateWelcomeThread = () => {
  const [createThread, { loading, error }] = useCreateWelcomeAgentThreadMutation();
  const [threadId, setThreadId] = useState(null);

  const handleCreateThread = async () => {
    try {
      const response = await createThread({
        variables: {
          input: {
            agentId: 'welcome-agent-id'
          }
        }
      });

      if (response.data?.createWelcomeAgentThread) {
        const thread = response.data.createWelcomeAgentThread;
        setThreadId(thread.id);
        console.log('Thread created:', thread);
      }
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  };

  return (
    <div>
      <button onClick={handleCreateThread} disabled={loading}>
        {loading ? 'Creating...' : 'Create Welcome Thread'}
      </button>
      
      {threadId && (
        <div>
          <strong>Thread ID:</strong> {threadId}
        </div>
      )}
      
      {error && <div className="error">{error.message}</div>}
    </div>
  );
};
```

## 🧪 Примеры тестирования

### **Тест useShouldShowWelcomeAgent**

```typescript
// __tests__/useShouldShowWelcomeAgent.test.ts
import { renderHook, act } from '@testing-library/react';
import { useShouldShowWelcomeAgent } from '../useShouldShowWelcomeAgent';
import { RecoilRoot } from 'recoil';

const mockCurrentWorkspace = {
  id: 'workspace-1',
  createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
};

const mockFeatureFlag = true;

jest.mock('@/auth/states/currentWorkspaceState', () => ({
  currentWorkspaceState: mockCurrentWorkspace,
}));

jest.mock('@/workspace/hooks/useIsFeatureEnabled', () => ({
  useIsFeatureEnabled: () => mockFeatureFlag,
}));

describe('useShouldShowWelcomeAgent', () => {
  it('should show welcome agent for new users', () => {
    const { result } = renderHook(() => useShouldShowWelcomeAgent(), {
      wrapper: RecoilRoot,
    });

    expect(result.current.shouldShowWelcomeAgent).toBe(true);
    expect(result.current.isNewUser).toBe(true);
  });

  it('should not show welcome agent for existing users', () => {
    const oldWorkspace = {
      ...mockCurrentWorkspace,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
    };

    jest.spyOn(require('@/auth/states/currentWorkspaceState'), 'currentWorkspaceState')
      .mockReturnValue(oldWorkspace);

    const { result } = renderHook(() => useShouldShowWelcomeAgent(), {
      wrapper: RecoilRoot,
    });

    expect(result.current.shouldShowWelcomeAgent).toBe(false);
    expect(result.current.isNewUser).toBe(false);
  });

  it('should manage session state', () => {
    const { result } = renderHook(() => useShouldShowWelcomeAgent(), {
      wrapper: RecoilRoot,
    });

    act(() => {
      result.current.startWelcomeAgentSession();
    });

    expect(result.current.hasActiveWelcomeSession).toBe(true);
    expect(result.current.sessionInfo.hasActiveSession).toBe(true);

    act(() => {
      result.current.endWelcomeAgentSession();
    });

    expect(result.current.hasActiveWelcomeSession).toBe(false);
    expect(result.current.sessionInfo.skipCount).toBe(1);
  });
});
```

### **Тест WelcomeAgentHeader**

```typescript
// __tests__/WelcomeAgentHeader.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeAgentHeader } from '../WelcomeAgentHeader';

describe('WelcomeAgentHeader', () => {
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    mockOnSkip.mockClear();
  });

  it('should render welcome message', () => {
    render(<WelcomeAgentHeader onSkip={mockOnSkip} />);
    
    expect(screen.getByText('Добро пожаловать в Twenty!')).toBeInTheDocument();
    expect(screen.getByText('Я ваш персональный помощник для освоения CRM')).toBeInTheDocument();
  });

  it('should call onSkip when skip button is clicked', () => {
    render(<WelcomeAgentHeader onSkip={mockOnSkip} />);
    
    const skipButton = screen.getByText('Пропустить');
    fireEvent.click(skipButton);
    
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('should render sparkles icon', () => {
    render(<WelcomeAgentHeader onSkip={mockOnSkip} />);
    
    const icon = screen.getByTestId('sparkles-icon');
    expect(icon).toBeInTheDocument();
  });
});
```

## 🎯 Примеры интеграции

### **Интеграция с существующим приложением**

```typescript
// App.tsx - интеграция на уровне приложения
import { RecoilRoot } from 'recoil';
import { FloatingAIChatButton } from '@/ai/components/FloatingAIChatButton';
import { CommandMenu } from '@/command-menu/components/CommandMenu';

const App = () => {
  return (
    <RecoilRoot>
      <div className="app">
        {/* Основной контент приложения */}
        <main>
          {/* ... */}
        </main>
        
        {/* Floating AI Chat Button с Welcome Agent поддержкой */}
        <FloatingAIChatButton />
        
        {/* Command Menu с умным выбором агента */}
        <CommandMenu />
      </div>
    </RecoilRoot>
  );
};
```

### **Кастомная логика для разных сценариев**

```typescript
// Кастомный хук для расширенной логики
const useWelcomeAgentWithAnalytics = () => {
  const welcomeAgent = useShouldShowWelcomeAgent();
  const [analytics, setAnalytics] = useState({});

  const startSessionWithAnalytics = useCallback(() => {
    // Отправить аналитику
    analytics.track('welcome_agent_session_started', {
      userId: currentUser.id,
      workspaceId: currentWorkspace.id,
      timestamp: new Date().toISOString(),
    });

    // Начать сессию
    welcomeAgent.startWelcomeAgentSession();
  }, [welcomeAgent, analytics, currentUser, currentWorkspace]);

  const endSessionWithAnalytics = useCallback(() => {
    // Отправить аналитику
    analytics.track('welcome_agent_session_ended', {
      userId: currentUser.id,
      workspaceId: currentWorkspace.id,
      sessionDuration: Date.now() - welcomeAgent.sessionInfo.sessionStartTime,
      skipCount: welcomeAgent.sessionInfo.skipCount,
    });

    // Завершить сессию
    welcomeAgent.endWelcomeAgentSession();
  }, [welcomeAgent, analytics, currentUser, currentWorkspace]);

  return {
    ...welcomeAgent,
    startSessionWithAnalytics,
    endSessionWithAnalytics,
  };
};
```

## 🚀 Примеры оптимизации

### **Мемоизация компонентов**

```typescript
// Оптимизированный компонент
import React, { memo, useMemo, useCallback } from 'react';

const WelcomeAgentButton = memo(({ onStart, onSkip }) => {
  const { shouldShowWelcomeAgent, isNewUser } = useShouldShowWelcomeAgent();

  const buttonText = useMemo(() => {
    if (shouldShowWelcomeAgent) {
      return '🎉 Welcome Agent (Новый!)';
    }
    return 'Ask AI (Press @)';
  }, [shouldShowWelcomeAgent]);

  const handleClick = useCallback(() => {
    if (shouldShowWelcomeAgent) {
      onStart();
    } else {
      onSkip();
    }
  }, [shouldShowWelcomeAgent, onStart, onSkip]);

  if (!isNewUser) {
    return null; // Не рендерим для старых пользователей
  }

  return (
    <button 
      onClick={handleClick}
      className={shouldShowWelcomeAgent ? 'welcome-agent' : 'standard-ai'}
    >
      {buttonText}
    </button>
  );
});

WelcomeAgentButton.displayName = 'WelcomeAgentButton';
```

### **Ленивая загрузка**

```typescript
// Ленивая загрузка Welcome Agent компонентов
const LazyWelcomeAgentHeader = lazy(() => import('./WelcomeAgentHeader'));
const LazyWelcomeAgentChat = lazy(() => import('./WelcomeAgentChat'));

const AIChatContainer = ({ showWelcomeAgentUI }) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {showWelcomeAgentUI ? (
        <LazyWelcomeAgentChat />
      ) : (
        <StandardAIChat />
      )}
    </Suspense>
  );
};
```

Эти примеры демонстрируют различные способы использования Welcome Agent и помогут разработчикам быстро интегрировать функциональность в свои проекты.
