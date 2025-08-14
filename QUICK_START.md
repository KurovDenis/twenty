# 🚀 Быстрый запуск Twenty

## Минимальные требования
- Node.js 24.5.0+
- Yarn 4.0.2+
- Docker & Docker Compose
- Git

## Быстрый старт (5 шагов)

### 1. Запуск базы данных
```bash
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis
```

### 2. Создание .env файлов
```bash
# Windows PowerShell
copy packages\twenty-server\.env.example packages\twenty-server\.env
copy packages\twenty-front\.env.example packages\twenty-front\.env

# Linux/Mac
cp packages/twenty-server/.env.example packages/twenty-server/.env
cp packages/twenty-front/.env.example packages/twenty-front/.env
```

### 3. Инициализация базы данных
```bash
npx nx database:migrate twenty-server
```

### 4. Запуск сервера
```bash
npx nx start twenty-server
```

### 5. Запуск фронтенда (в новом терминале)
```bash
npx nx start twenty-front
```

## ✅ Проверка запуска

- **Сервер API**: http://localhost:3000
- **Фронтенд**: http://localhost:3001
- **База данных**: PostgreSQL на порту 5432
- **Redis**: на порту 6379

## 🔧 Решение проблем

### Проблема: "User does not have access to this workspace"
```bash
# Полная очистка и перезапуск
docker-compose -f packages/twenty-docker/docker-compose.yml down -v
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis
npx nx database:migrate twenty-server
```

### Проблема: Порт занят
```bash
# Проверить занятые порты
netstat -an | findstr :3000
netstat -an | findstr :3001

# Остановить процессы
docker-compose -f packages/twenty-docker/docker-compose.yml down
```

### Проблема: База данных не инициализируется
```bash
# Очистить все данные и перезапустить
docker-compose -f packages/twenty-docker/docker-compose.yml down -v
docker system prune -f
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis
# Подождать 30-60 секунд
npx nx database:migrate twenty-server
```

## 🛑 Остановка

```bash
# Остановить Docker контейнеры
docker-compose -f packages/twenty-docker/docker-compose.yml down

# Остановить процессы разработки (Ctrl+C в терминалах)
```

## 📝 Примечания

- При первом запуске может появиться ошибка "User does not have access to this workspace" - это нормально
- Зарегистрируйтесь или войдите в систему для создания workspace
- Все данные сохраняются в Docker volumes
- Для полной очистки используйте `docker-compose down -v`

---

**Для подробной информации см. `LOCAL_DEPLOYMENT_CHECKLIST.md`**
