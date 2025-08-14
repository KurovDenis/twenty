# Чек-лист локального развертывания Twenty

## 🚀 БЫСТРЫЙ СТАРТ (Дистиллят)

### Минимальные шаги для запуска:

```bash
# 1. Запустить базу данных и Redis
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis

# 2. Создать .env файлы (если отсутствуют)
copy packages\twenty-server\.env.example packages\twenty-server\.env
copy packages\twenty-front\.env.example packages\twenty-front\.env

# 3. Выполнить миграции базы данных
npx nx database:migrate twenty-server

# 4. Запустить сервер
npx nx start twenty-server

# 5. В новом терминале запустить фронтенд
npx nx start twenty-front
```

**Результат:** 
- Сервер: http://localhost:3000
- Фронтенд: http://localhost:3001

### При проблемах с регистрацией/workspace:
```bash
# Полная очистка и перезапуск
docker-compose -f packages/twenty-docker/docker-compose.yml down -v
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis
npx nx database:migrate twenty-server
```

---

## 🤖 AI ФУНКЦИОНАЛ (Новое!)

### AI включен по умолчанию для всех workspace

**Что было добавлено:**
- ✅ AI Feature Flag (`IS_AI_ENABLED`) включен по умолчанию
- ✅ AI Agent создается автоматически для каждого workspace
- ✅ AI чат доступен в командном меню (Ctrl+K → "Ask AI")

### Проверка AI функционала:
1. Создайте новый workspace
2. Нажмите `Ctrl+K` для открытия командного меню
3. Найдите "Ask AI" в списке команд
4. AI чат должен быть доступен автоматически

### Если AI не работает:
```bash
# Проверить feature flag в базе данных
docker exec twenty-db-1 psql -U postgres -d default -c "SELECT * FROM core.\"featureFlag\" WHERE \"key\" = 'IS_AI_ENABLED';"

# Проверить AI агента
docker exec twenty-db-1 psql -U postgres -d default -c "SELECT * FROM core.\"agent\" WHERE \"name\" = 'ai-assistant';"
```

---

## 📋 ПОЛНЫЙ ЧЕК-ЛИСТ

## Предварительные требования

- [ ] Node.js версии 24.5.0 или выше установлен
- [ ] Yarn версии 4.0.2 или выше установлен
- [ ] Docker и Docker Compose установлены
- [ ] Git установлен
- [ ] Клонирован репозиторий Twenty

## Шаг 1: Запуск базовых сервисов

### 1.1 Запуск базы данных и Redis (Вариант 1: Docker Compose)
```bash
# Перейти в корневую директорию проекта
cd /path/to/twenty

# Запустить базу данных и Redis в фоновом режиме
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis
```

### 1.2 Запуск базы данных и Redis (Вариант 2: Makefile - Рекомендуется)
```bash
# Использовать Makefile для автоматической настройки
make setup-twenty

# Или по отдельности:
make postgres-on-docker
make redis-on-docker
```

**Преимущества Makefile:**
- ✅ Автоматически создает базу данных "default"
- ✅ Автоматически создает схему "core"
- ✅ Очищает старые контейнеры
- ✅ Работает на Windows и Linux

**Проверка:**
- [ ] Контейнеры `twenty_pg` и `twenty_redis` запущены
- [ ] Нет ошибок в логах Docker
- [ ] База данных "default" создана
- [ ] Схема "core" создана

### 1.3 Проверка статуса контейнеров
```bash
# Для Docker Compose
docker-compose -f packages/twenty-docker/docker-compose.yml ps

# Для Makefile
docker ps | grep twenty
```

## Шаг 2: Установка зависимостей

### 2.1 Установка всех зависимостей проекта
```bash
# Убедиться, что находитесь в корневой директории
cd /path/to/twenty

# Установить зависимости с помощью Yarn
yarn install
```

**Проверка:**
- [ ] Зависимости установлены без критических ошибок
- [ ] Папка `node_modules` создана
- [ ] Предупреждения о peer dependencies допустимы

## Шаг 3: Настройка переменных окружения

### 3.1 Проверка файлов окружения
```bash
# Проверить наличие .env файлов
ls -la packages/twenty-front/.env*
ls -la packages/twenty-server/.env*
```

### 3.2 Создание .env файлов (если отсутствуют)
```bash
# Для фронтенда
cd packages/twenty-front
cp .env.example .env

# Для бэкенда
cd ../twenty-server
cp .env.example .env
```

### 3.3 Проверка файлов окружения в Windows
```powershell
# В Windows PowerShell
dir packages\twenty-server\.env*
dir packages\twenty-front\.env*

# Если файлы отсутствуют, создать их
copy packages\twenty-server\.env.example packages\twenty-server\.env
copy packages\twenty-front\.env.example packages\twenty-front\.env
```

## Шаг 3.5: Инициализация базы данных

### 3.5.1 Выполнение миграций базы данных
```bash
# Убедиться, что база данных запущена и .env файлы созданы
# Выполнить миграции
npx nx database:migrate twenty-server
```

**Проверка:**
- [ ] Миграции выполнены успешно
- [ ] Нет ошибок в консоли
- [ ] Сообщение "No migrations are pending" или успешное выполнение миграций
- [ ] AI Feature Flag включен автоматически
- [ ] AI Agent создан автоматически

### 3.5.2 Проверка инициализации базы данных
```bash
# Проверить статус базы данных
docker-compose -f packages/twenty-docker/docker-compose.yml logs db

# Проверить подключение к базе данных
docker exec -it twenty-db-1 psql -U postgres -d postgres -c "\dt"

# Проверить AI функционал
docker exec twenty-db-1 psql -U postgres -d default -c "SELECT * FROM core.\"featureFlag\" WHERE \"key\" = 'IS_AI_ENABLED';"
docker exec twenty-db-1 psql -U postgres -d default -c "SELECT * FROM core.\"agent\" WHERE \"name\" = 'ai-assistant';"
```

## Шаг 4: Запуск бэкенда

### 4.1 Запуск сервера разработки
```bash
# Вернуться в корневую директорию
cd /path/to/twenty

# Запустить сервер разработки
npx nx start twenty-server
```

**Проверка:**
- [ ] Сервер запущен на порту 3000 (по умолчанию)
- [ ] Нет ошибок в консоли
- [ ] API доступен по адресу http://localhost:3000

## Шаг 5: Запуск фронтенда

### 5.1 Запуск клиента разработки
```bash
# В новом терминале, из корневой директории
cd /path/to/twenty

# Запустить фронтенд
npx nx start twenty-front
```

**Проверка:**
- [ ] Фронтенд запущен на порту 3001 (по умолчанию)
- [ ] Нет ошибок в консоли
- [ ] Приложение доступно по адресу http://localhost:3001

## Шаг 6: Проверка работоспособности

### 6.1 Проверка всех сервисов
- [ ] База данных PostgreSQL доступна
- [ ] Redis доступен
- [ ] Бэкенд API отвечает
- [ ] Фронтенд загружается без ошибок
- [ ] Можно зарегистрироваться/войти в систему

### 6.2 Проверка AI функционала
- [ ] Создать новый workspace
- [ ] Нажать `Ctrl+K` для открытия командного меню
- [ ] Найти "Ask AI" в списке команд
- [ ] AI чат должен открыться без ошибок

### 6.3 Проверка портов
```bash
# Проверить какие порты заняты
netstat -an | findstr :3000
netstat -an | findstr :3001
netstat -an | findstr :5432
netstat -an | findstr :6379
```

## Шаг 7: Дополнительные сервисы (опционально)

### 7.1 Запуск всех сервисов Docker
```bash
# Если нужны все сервисы (включая Grafana, etc.)
docker-compose -f packages/twenty-docker/docker-compose.yml up -d
```

### 7.2 Запуск Storybook (для разработки UI компонентов)
```bash
npx nx storybook:serve:dev twenty-ui
```

## Шаг 8: Проверка успешного запуска

### 8.1 Проверка статуса всех сервисов
```bash
# Проверить Docker контейнеры
docker-compose -f packages/twenty-docker/docker-compose.yml ps

# Проверить порты сервера и фронтенда
netstat -an | findstr :3000
netstat -an | findstr :3001
```

**Ожидаемый результат:**
- [ ] Контейнеры `twenty-db-1` и `twenty-redis-1` в статусе "Up" и "healthy"
- [ ] Порт 3000 (сервер) в статусе "LISTENING"
- [ ] Порт 3001 (фронтенд) в статусе "LISTENING"

### 8.2 Проверка доступа к приложению
- [ ] Открыть браузер и перейти на http://localhost:3001
- [ ] Фронтенд загружается без ошибок
- [ ] При первом запуске может появиться ошибка "User does not have access to this workspace" - это нормально
- [ ] Можно зарегистрироваться или войти в систему

### 8.3 Проверка API сервера
- [ ] Открыть браузер и перейти на http://localhost:3000
- [ ] Сервер должен отвечать (может показать информацию о NestJS или GraphQL playground)

### 8.4 Проверка AI функционала
- [ ] Создать новый workspace
- [ ] Нажать `Ctrl+K` для открытия командного меню
- [ ] Найти и выбрать "Ask AI"
- [ ] AI чат должен открыться и быть готовым к использованию

## Шаг 9: Первоначальная настройка (при первом запуске)

### 9.1 Создание рабочего пространства
При первом запуске Twenty потребуется:
- [ ] Зарегистрироваться или войти в систему
- [ ] Создать рабочее пространство
- [ ] Настроить базовые параметры
- [ ] AI функционал будет доступен автоматически

### 9.2 Решение ошибки "User does not have access to this workspace"
Эта ошибка появляется при первом запуске и решается:
- [ ] Регистрацией нового пользователя
- [ ] Созданием рабочего пространства
- [ ] Или входом в существующее рабочее пространство

## Шаг 10: Решение проблем с регистрацией и workspace

### 10.1 Проблема: Ошибка при регистрации нового пользователя
Если при регистрации возникает ошибка и не создается workspace:

```bash
# 1. Остановить все сервисы
docker-compose -f packages/twenty-docker/docker-compose.yml down

# 2. Очистить данные базы данных
docker-compose -f packages/twenty-docker/docker-compose.yml down -v

# 3. Перезапустить базу данных
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis

# 4. Подождать полной инициализации (30-60 секунд)

# 5. Выполнить миграции заново
npx nx database:migrate twenty-server

# 6. Запустить сервер
npx nx start twenty-server

# 7. Запустить фронтенд
npx nx start twenty-front
```

### 10.2 Проверка инициализации базы данных
```bash
# Проверить, что таблицы созданы
docker exec -it twenty-db-1 psql -U postgres -d postgres -c "\dt"

# Проверить логи базы данных
docker-compose -f packages/twenty-docker/docker-compose.yml logs db
```

### 10.3 Альтернативное решение - сброс к начальному состоянию
```bash
# Полная очистка системы
docker-compose -f packages/twenty-docker/docker-compose.yml down -v
docker system prune -f
docker volume prune -f

# Переустановка зависимостей (если нужно)
yarn cache clean
rm -rf node_modules
yarn install

# Запуск с нуля
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis
npx nx database:migrate twenty-server
npx nx start twenty-server
npx nx start twenty-front
```

### 10.4 Проверка успешной инициализации
После перезапуска проверьте:
- [ ] База данных инициализирована (логи без ошибок)
- [ ] Миграции выполнены успешно
- [ ] Сервер запускается без ошибок
- [ ] Фронтенд загружается
- [ ] Можно зарегистрироваться и создать workspace
- [ ] AI функционал доступен

## Шаг 11: Решение проблем с AI функционалом

### 11.1 Проблема: AI чат не отображается
Если AI чат не появляется в командном меню:

```bash
# 1. Проверить feature flag
docker exec twenty-db-1 psql -U postgres -d default -c "SELECT * FROM core.\"featureFlag\" WHERE \"key\" = 'IS_AI_ENABLED';"

# 2. Если feature flag отсутствует, создать его
docker exec twenty-db-1 psql -U postgres -d default -c "INSERT INTO core.\"featureFlag\" (\"key\", \"workspaceId\", \"value\", \"createdAt\", \"updatedAt\") VALUES ('IS_AI_ENABLED', 'YOUR_WORKSPACE_ID', true, NOW(), NOW());"

# 3. Проверить AI агента
docker exec twenty-db-1 psql -U postgres -d default -c "SELECT * FROM core.\"agent\" WHERE \"name\" = 'ai-assistant';"
```

### 11.2 Проблема: AI агент не создается автоматически
Если AI агент не создается при создании workspace:

```bash
# 1. Проверить миграции
npx nx database:migrate twenty-server

# 2. Проверить логи сервера на наличие ошибок
# 3. Перезапустить сервер
npx nx start twenty-server
```

### 11.3 Полная пересборка с AI функционалом
```bash
# 1. Остановить все сервисы
docker-compose -f packages/twenty-docker/docker-compose.yml down -v

# 2. Использовать Makefile для полной настройки
make setup-twenty

# 3. Выполнить миграции
npx nx database:migrate twenty-server

# 4. Запустить сервер и фронтенд
npx nx start twenty-server
npx nx start twenty-front
```

## Устранение неполадок

### Проблемы с портами
```bash
# Если порты заняты, можно изменить их в .env файлах
# REACT_APP_PORT=3002 для фронтенда
# PORT=3001 для бэкенда
```

### Проблемы с базой данных
```bash
# Перезапустить контейнеры
docker-compose -f packages/twenty-docker/docker-compose.yml down
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis
```

### Проблемы с инициализацией базы данных
```bash
# Если база данных не инициализируется или есть ошибки Theme switcher:

# 1. Остановить все сервисы
docker-compose -f packages/twenty-docker/docker-compose.yml down

# 2. Очистить данные базы данных (ВНИМАНИЕ: это удалит все данные!)
docker-compose -f packages/twenty-docker/docker-compose.yml down -v

# 3. Перезапустить базу данных
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis

# 4. Подождать полной инициализации базы данных (30-60 секунд)
# 5. Выполнить миграции
npx nx database:migrate twenty-server

# 6. Проверить статус
docker-compose -f packages/twenty-docker/docker-compose.yml ps
```

### Проблемы с зависимостями
```bash
# Очистить кэш и переустановить
yarn cache clean
rm -rf node_modules
yarn install
```

### Проблемы с переменными окружения
```bash
# Сбросить .env файлы к примеру
npx nx reset:env twenty-front
npx nx reset:env twenty-server
```

### Полный перезапуск системы (рекомендуется при проблемах с Theme switcher)
```bash
# 1. Остановить все процессы
docker-compose -f packages/twenty-docker/docker-compose.yml down
# Ctrl+C в терминалах с сервером и фронтендом

# 2. Очистить все данные
docker-compose -f packages/twenty-docker/docker-compose.yml down -v
docker system prune -f

# 3. Перезапустить базу данных
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis

# 4. Подождать инициализации (30-60 секунд)
# 5. Выполнить миграции
npx nx database:migrate twenty-server

# 6. Запустить сервер
npx nx start twenty-server

# 7. В новом терминале запустить фронтенд
npx nx start twenty-front
```

## Полезные команды

### Остановка всех сервисов
```bash
# Остановить Docker контейнеры
docker-compose -f packages/twenty-docker/docker-compose.yml down

# Остановить процессы разработки (Ctrl+C в терминалах)
```

### Просмотр логов
```bash
# Логи Docker контейнеров
docker-compose -f packages/twenty-docker/docker-compose.yml logs -f

# Логи конкретного сервиса
docker-compose -f packages/twenty-docker/docker-compose.yml logs -f db
```

### Очистка и перезапуск
```bash
# Полная очистка
docker-compose -f packages/twenty-docker/docker-compose.yml down -v
docker system prune -f
yarn cache clean
rm -rf node_modules
yarn install
```

### Команды для работы с AI функционалом
```bash
# Проверить AI feature flag
docker exec twenty-db-1 psql -U postgres -d default -c "SELECT * FROM core.\"featureFlag\" WHERE \"key\" = 'IS_AI_ENABLED';"

# Проверить AI агентов
docker exec twenty-db-1 psql -U postgres -d default -c "SELECT * FROM core.\"agent\";"

# Включить AI для конкретного workspace
docker exec twenty-db-1 psql -U postgres -d default -c "INSERT INTO core.\"featureFlag\" (\"key\", \"workspaceId\", \"value\", \"createdAt\", \"updatedAt\") VALUES ('IS_AI_ENABLED', 'WORKSPACE_ID', true, NOW(), NOW()) ON CONFLICT (\"key\", \"workspaceId\") DO UPDATE SET \"value\" = true;"
```

## Контакты и поддержка

- Документация: [docs.twenty.com](https://docs.twenty.com)
- GitHub Issues: [github.com/twentyhq/twenty/issues](https://github.com/twentyhq/twenty/issues)
- Discord: [discord.gg/twenty](https://discord.gg/twenty)

---

**Примечание:** Этот чек-лист предназначен для локальной разработки. Для продакшн развертывания используйте официальную документацию Twenty.

**AI Функционал:** AI чат включен по умолчанию для всех новых workspace. Используйте `Ctrl+K` → "Ask AI" для доступа к AI ассистенту.
