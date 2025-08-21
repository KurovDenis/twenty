# 🚀 Быстрый запуск Twenty

## 🧹 Быстрая очистка (если что-то сломалось)
```bash
# Полная очистка за 3 команды:
Set-Alias -Name make -Value "C:\Program Files (x86)\GnuWin32\bin\make.exe"
make clean-containers
docker system prune -a -f && docker volume prune -f
make setup-twenty
```

## Минимальные требования
- Node.js 24.5.0+
- Yarn 4.0.2+
- Docker & Docker Compose
- Git

## 🪟 Windows с GnuWin32 Make

Если у вас установлен Make через GnuWin32 в `C:\Program Files (x86)\GnuWin32\bin`:

### Добавление Make в PATH
```bash
# Добавить в системные переменные PATH
C:\Program Files (x86)\GnuWin32\bin

# Или использовать полный путь
"C:\Program Files (x86)\GnuWin32\bin\make.exe" setup-twenty
```

### Альтернативный способ (без изменения PATH)
```bash
# Использовать полный путь к make.exe
"C:\Program Files (x86)\GnuWin32\bin\make.exe" setup-twenty
```

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

## 🚀 Быстрый старт через Makefile (Windows)

### Вариант 1: Добавить в PATH
```bash
# Добавить C:\Program Files (x86)\GnuWin32\bin в системные переменные PATH
# Затем использовать обычные команды
make setup-twenty
```

### Вариант 2: Полный путь
```bash
# Использовать полный путь к make.exe
"C:\Program Files (x86)\GnuWin32\bin\make.exe" setup-twenty
```

### Вариант 3: Создать alias в PowerShell
```powershell
# В профиле PowerShell добавить
Set-Alias -Name make -Value "C:\Program Files (x86)\GnuWin32\bin\make.exe"

# Теперь можно использовать
make setup-twenty
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

## 🧹 Полная очистка Twenty CRM

### Способ 1: Через Make (рекомендуется)

```bash
# 1. Создать alias для make (если не настроен)
Set-Alias -Name make -Value "C:\Program Files (x86)\GnuWin32\bin\make.exe"

# 2. Очистить контейнеры
make clean-containers

# 3. Очистить Docker volumes и кэш
docker volume prune -f
docker system prune -a -f

# 4. Перезапустить с чистого листа
make setup-twenty
```

### Способ 2: Ручная очистка

```bash
# 1. Остановить и удалить контейнеры
docker-compose -f packages/twenty-docker/docker-compose.yml down -v

# 2. Очистить все Docker ресурсы
docker system prune -a -f
docker volume prune -f
docker image prune -a -f

# 3. Очистить кэш Nx и yarn
npx nx reset
yarn cache clean

# 4. Перезапустить базу данных
docker-compose -f packages/twenty-docker/docker-compose.yml up -d db redis

# 5. Подождать 30-60 секунд и инициализировать БД
npx nx database:migrate twenty-server
```

### Что происходит при очистке:
- ✅ Все контейнеры останавливаются и удаляются
- ✅ Все Docker volumes удаляются (данные БД теряются)
- ✅ Все Docker образы удаляются
- ✅ Кэш Nx и yarn очищается
- ✅ База данных создается заново
- ✅ Redis кэш очищается
- ✅ Ошибка "User does not have access to this workspace" исчезает

### ⚠️ ВАЖНЫЕ ПРЕДУПРЕЖДЕНИЯ:
- **ВСЕ ДАННЫЕ БУДУТ ПОТЕРЯНЫ** - это полная очистка
- Убедитесь что у вас есть резервные копии важных данных
- При первом запуске потребуется заново создать workspace и пользователя
- Очистка занимает 2-5 минут в зависимости от размера Docker кэша

### 🚀 После очистки:
1. Запустите сервер: `npx nx start twenty-server`
2. В новом терминале запустите фронтенд: `npx nx start twenty-front`
3. Создайте новый workspace при первом входе
4. Наслаждайтесь чистым Twenty CRM!

## 📝 Примечания

- При первом запуске может появиться ошибка "User does not have access to this workspace" - это нормально
- Зарегистрируйтесь или войдите в систему для создания workspace
- Все данные сохраняются в Docker volumes
- Для полной очистки используйте `docker-compose down -v`

---

**Для подробной информации см. `LOCAL_DEPLOYMENT_CHECKLIST.md`**
