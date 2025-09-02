# SGR Streaming - Руководство по тестированию

## Пошаговое тестирование бэкенда SGR стриминга

### Предварительные требования

1. **Запущенный сервер Twenty**:
   ```bash
   cd packages/twenty-server
   npm run start:dev
   ```

2. **Redis для pub/sub**:
   ```bash
   # Убедитесь, что Redis запущен
   redis-server
   ```

3. **Доступ к GraphQL Playground**:
   - URL: `http://localhost:3000/graphql`
   - Или используйте любой GraphQL клиент

### Этап 1: Проверка базовой подписки

1. **Откройте GraphQL Playground**
2. **Установите заголовки аутентификации**:
   ```json
   {
     "Authorization": "Bearer YOUR_TOKEN_HERE"
   }
   ```

3. **Выполните базовую подписку**:
   ```graphql
   subscription TestBusinessSetupEvents {
     onBusinessSetupEvent(
       input: {
         workspaceId: "YOUR_WORKSPACE_ID"
         includeMetadata: true
       }
     ) {
       id
       type
       metadata {
         source
         timestamp
       }
     }
   }
   ```

4. **Ожидаемый результат**: Подписка должна установиться без ошибок

### Этап 2: Тестирование SGR событий

1. **Подпишитесь на SGR события**:
   ```graphql
   subscription TestSGREvents {
     onSGRStreamingEvents(
       input: {
         workspaceId: "YOUR_WORKSPACE_ID"
         eventTypes: [
           SGR_STREAMING_START,
           SGR_JSON_TOKEN_CHUNK,
           SGR_TOOL_CALL_PENDING,
           SGR_STREAMING_END
         ]
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
           timestamp
         }
       }
     }
   }
   ```

2. **Инициируйте SGR процесс**:
   - Отправьте сообщение в чат, которое будет обработано Supervisor
   - Или используйте существующий API endpoint для запуска SGR

3. **Ожидаемые события в последовательности**:
   - `SGR_STREAMING_START`
   - `SGR_JSON_STREAM_START`
   - Множественные `SGR_JSON_TOKEN_CHUNK`
   - `SGR_JSON_STREAM_END`
   - `SGR_TOOL_CALL_PENDING`
   - `SGR_STREAMING_END`

### Этап 3: Проверка токен-стриминга

1. **Мониторинг JSON токенов**:
   ```graphql
   subscription TokenStreaming {
     onSGRStreamingEvents(
       input: {
         workspaceId: "YOUR_WORKSPACE_ID"
         eventTypes: [SGR_JSON_TOKEN_CHUNK]
         enableTokenThrottling: false
       }
     ) {
       payload {
         ... on SGRStreamingPayload {
           token
           metadata {
             tokensEmitted
             batchSize
           }
         }
       }
     }
   }
   ```

2. **Проверка throttling**:
   - Включите `enableTokenThrottling: true`
   - Токены должны приходить батчами
   - Меньше отдельных событий

### Этап 4: Тестирование безопасности

1. **Проверка санитизации**:
   - Инициируйте процесс с чувствительными данными
   - Убедитесь, что в `toolArgs` нет паролей/токенов

2. **Проверка фильтрации по workspace**:
   - Подпишитесь с неправильным `workspaceId`
   - События не должны приходить

### Этап 5: Мониторинг производительности

1. **Health Check**:
   ```graphql
   subscription HealthCheck {
     onHealthCheck
   }
   ```

2. **Проверка метрик** (через API или логи):
   ```bash
   # Логи сервера должны показывать:
   [EventEmitterBridge] SGR Streaming Metrics: {
     totalEventsProcessed: 25,
     totalTokensEmitted: 156,
     averageProcessingTime: 23.4,
     errorRate: 0
   }
   ```

### Этап 6: Тестирование ошибок

1. **Отключите Redis**:
   ```bash
   redis-cli shutdown
   ```

2. **Инициируйте SGR процесс**:
   - Должны появиться события `SGR_STREAMING_ERROR`
   - Система должна продолжать работать

3. **Восстановите Redis**:
   ```bash
   redis-server
   ```

### Автоматизированные тесты

**Запуск интеграционных тестов**:
```bash
cd packages/twenty-server
npm test -- sgr-streaming-integration.test.ts
```

**Запуск всех SGR тестов**:
```bash
npm test -- --testPathPattern="sgr.*test"
```

### Критерии успешного тестирования

#### ✅ Обязательные проверки:

1. **Подписка устанавливается** без ошибок
2. **События приходят в правильной последовательности**:
   - START → JSON_START → TOKEN_CHUNKS → JSON_END → TOOL_CALL → END
3. **JSON токены формируют валидный JSON** при объединении
4. **Санитизация работает** - нет чувствительных данных
5. **Фильтрация по workspace** работает корректно
6. **Throttling токенов** снижает количество событий
7. **Метрики обновляются** корректно

#### ✅ Дополнительные проверки:

1. **Обработка ошибок** без падения системы
2. **Восстановление соединения** после сбоев
3. **Производительность** - < 100мс на событие
4. **Очистка ресурсов** при отключении

### Решение проблем

#### Проблема: События не приходят
**Решение**:
1. Проверьте workspaceId
2. Убедитесь в правильной аутентификации
3. Проверьте логи сервера на ошибки

#### Проблема: Неполные JSON токены
**Решение**:
1. Включите `enablePartialJsonParsing: true`
2. Проверьте throttling настройки
3. Мониторьте `batchSize` в метаданных

#### Проблема: Медленная работа
**Решение**:
1. Включите throttling
2. Уменьшите количество типов событий в подписке
3. Проверьте нагрузку на Redis

### Контактная информация

Если тестирование выявило проблемы:
1. Проверьте логи в `packages/twenty-server/logs/`
2. Создайте issue с детальным описанием
3. Приложите выводы GraphQL и логи сервера

### Дальнейшие шаги

После успешного тестирования бэкенда:
1. Переходите к Фазе 2 - Frontend реализация
2. Интегрируйте с существующими UI компонентами
3. Добавьте визуализацию стриминга в реальном времени
