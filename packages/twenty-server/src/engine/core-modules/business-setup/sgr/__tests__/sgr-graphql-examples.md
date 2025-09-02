# SGR Streaming GraphQL Testing Examples

Этот файл содержит примеры GraphQL запросов для тестирования функциональности SGR стриминга.

## Настройка

1. Запустите Twenty сервер в режиме разработки
2. Откройте GraphQL Playground: `http://localhost:3000/graphql`
3. Убедитесь, что у вас есть валидная аутентификация
4. Скопируйте и вставьте запросы из этого файла

## 1. Основная подписка на Business Setup события

### Подписка на все SGR события

```graphql
subscription OnAllSGREvents($workspaceId: String!) {
  onBusinessSetupEvent(
    input: {
      workspaceId: $workspaceId
      eventTypes: [
        SGR_STREAMING_START,
        SGR_JSON_STREAM_START,
        SGR_JSON_TOKEN_CHUNK,
        SGR_JSON_STREAM_END,
        SGR_TOOL_CALL_PENDING,
        SGR_STREAMING_END,
        SGR_STREAMING_ERROR
      ]
      includeMetadata: true
    }
  ) {
    id
    type
    payload {
      ... on SGRStreamingPayload {
        threadId
        stepId
        token
        fullJson
        toolName
        toolArgs
        error
        timestamp
        metadata {
          stepNumber
          totalSteps
          processingTime
          tokensEmitted
        }
      }
    }
    metadata {
      source
      version
      timestamp
      sgrStreaming
    }
  }
}
```

**Переменные:**
```json
{
  "workspaceId": "your-workspace-id-here"
}
```

## 2. Специализированная SGR подписка

### Подписка только на SGR события с токен-стримингом

```graphql
subscription OnSGRStreamingEvents($workspaceId: String!, $threadId: String) {
  onSGRStreamingEvents(
    input: {
      workspaceId: $workspaceId
      threadId: $threadId
      eventTypes: [SGR_JSON_TOKEN_CHUNK, SGR_TOOL_CALL_PENDING]
      includeMetadata: true
      enablePartialJsonParsing: true
      enableTokenThrottling: true
    }
  ) {
    id
    type
    payload {
      ... on SGRStreamingPayload {
        threadId
        stepId
        token
        toolName
        toolArgs
        timestamp
        metadata {
          stepNumber
          tokensEmitted
          batchSize
        }
      }
    }
    metadata {
      sgrStreaming
      resolvedAt
    }
  }
}
```

**Переменные:**
```json
{
  "workspaceId": "your-workspace-id-here",
  "threadId": "optional-thread-id"
}
```

## 3. Supervisor SGR подписка

### Подписка на высокоуровневые Supervisor события

```graphql
subscription OnSupervisorSGREvents($workspaceId: String!) {
  onSupervisorSGREvents(
    input: {
      workspaceId: $workspaceId
      includeThinkingSteps: true
      includeToolExecution: true
    }
  ) {
    id
    type
    payload {
      ... on SupervisorSGRPayload {
        userId
        workspaceId
        threadId
        stepId
        currentState
        plannedSteps
        selectedTool
        toolExecution {
          status
          result
          error
        }
        timestamp
        metadata {
          stepNumber
          totalSteps
          processingTime
          aiModelUsed
        }
      }
    }
    metadata {
      supervisorSGR
      resolvedAt
    }
  }
}
```

## 4. Тестирование инициации SGR процесса

### Mutation для запуска SGR процесса (если доступен)

```graphql
mutation StartSGRProcess($input: StartSGRProcessInput!) {
  startSGRProcess(input: $input) {
    success
    threadId
    message
  }
}
```

**Переменные:**
```json
{
  "input": {
    "workspaceId": "your-workspace-id-here",
    "message": "Please analyze my business setup status",
    "enableDetailedStreaming": true
  }
}
```

## 5. Health Check

### Проверка работоспособности системы

```graphql
subscription OnHealthCheck {
  onHealthCheck
}
```

## Ожидаемые результаты

### 1. SGR Process Start Event
```json
{
  "id": "event-id-123",
  "type": "SGR_STREAMING_START",
  "payload": {
    "threadId": "thread-abc-123",
    "stepId": "sgr-step-1234567890",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "metadata": {
    "source": "EventEmitterBridge",
    "version": "2.0.0",
    "sgrStreaming": true,
    "resolvedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. JSON Token Chunk Event
```json
{
  "id": "event-id-124",
  "type": "SGR_JSON_TOKEN_CHUNK",
  "payload": {
    "threadId": "thread-abc-123",
    "stepId": "sgr-step-1234567890",
    "token": "{\"current_state\": \"analyzing request\",",
    "timestamp": "2024-01-15T10:30:01.000Z",
    "metadata": {
      "stepNumber": 1,
      "tokensEmitted": 15,
      "batchSize": 35
    }
  },
  "metadata": {
    "sgrStreaming": true,
    "resolvedAt": "2024-01-15T10:30:01.000Z"
  }
}
```

### 3. Tool Call Event
```json
{
  "id": "event-id-125",
  "type": "SGR_TOOL_CALL_PENDING",
  "payload": {
    "threadId": "thread-abc-123",
    "stepId": "sgr-step-1234567890",
    "toolName": "check_business_setup_status",
    "toolArgs": "{\"userId\": \"user-123\", \"workspaceId\": \"workspace-456\"}",
    "timestamp": "2024-01-15T10:30:02.000Z",
    "metadata": {
      "stepNumber": 1,
      "totalSteps": 3
    }
  },
  "metadata": {
    "sgrStreaming": true,
    "resolvedAt": "2024-01-15T10:30:02.000Z"
  }
}
```

## Отладка

### Проверка подключения
1. Убедитесь, что WebSocket соединение установлено
2. Проверьте, что аутентификация прошла успешно
3. Убедитесь, что workspace ID корректный

### Частые проблемы
1. **Нет событий**: Проверьте, что SGR процесс запущен
2. **Фильтрация**: Убедитесь, что eventTypes включают нужные типы
3. **Аутентификация**: Проверьте токен авторизации

### Логи для мониторинга
```bash
# В логах сервера вы должны увидеть:
[EventEmitterBridge] Processing SGR streaming event: SGR_PROCESS_START for thread thread-abc-123
[EventEmitterBridge] Successfully published SGR streaming event to 2 channels
[BusinessSetupSubscriptionsResolver] Starting SGR streaming events subscription for workspace: workspace-456
```

## Метрики

### Получение метрик производительности
Используйте health check для получения метрик:

```javascript
// В браузерной консоли или через API
const healthCheck = await fetch('/api/health/sgr-streaming');
const metrics = await healthCheck.json();
console.log('SGR Metrics:', metrics.sgrMetrics);
```

Ожидаемые метрики:
```json
{
  "totalEventsProcessed": 150,
  "totalTokensEmitted": 1250,
  "averageProcessingTime": 45.5,
  "errorRate": 0.02,
  "uptime": 3600000,
  "activeTokenBuffers": 3
}
```
