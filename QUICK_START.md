# 🚀 Быстрый запуск Twenty

## ⚠️ ВАЖНО: Перед началом работы (Windows)

**Если вы используете Windows с GnuWin32 Make, ОБЯЗАТЕЛЬНО создайте alias в PowerShell:**

```powershell
# Выполните эту команду в PowerShell ПЕРЕД любыми make командами
Set-Alias -Name make -Value "C:\Program Files (x86)\GnuWin32\bin\make.exe"

# Проверьте что alias работает
make --version
```

**Этот alias нужно создавать в каждой новой сессии PowerShell!**

---

## Минимальные требования
- Node.js 24.5.0+
- Yarn 4.0.2+
- Docker & Docker Compose
- Git

## 🪟 Windows с GnuWin32 Make

### ⚠️ ВАЖНО: Создание alias перед началом работы

Перед использованием любых make команд ОБЯЗАТЕЛЬНО создайте alias в PowerShell:

```powershell
# Создать alias для make команды (ОБЯЗАТЕЛЬНО!)
Set-Alias -Name make -Value "C:\Program Files (x86)\GnuWin32\bin\make.exe"

# Проверить что alias работает
make --version
```

**Этот alias необходимо создавать в каждой новой сессии PowerShell!**

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

## 🚀 Быстрый старт через Make (Рекомендуемый способ)

### 1. Создание alias (ОБЯЗАТЕЛЬНЫЙ ШАГ)
```powershell
# ВАЖНО: Создать alias для make команды перед началом работы
Set-Alias -Name make -Value "C:\Program Files (x86)\GnuWin32\bin\make.exe"

# Проверить что alias работает
make --version
```

### 2. Полная настройка через make
```bash
# Один команда для полной настройки
make setup-twenty
```

Эта команда автоматически:
- Останавливает существующие контейнеры
- Создает Docker network
- Запускает PostgreSQL и Redis
- Создает базы данных
- Настраивает схему core

### 3. Миграция базы данных
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

## Быстрый старт (5 шагов)

### 🚨 Шаг 0: Создание make alias (ОБЯЗАТЕЛЬНО)
```powershell
# Создать alias для make команды
Set-Alias -Name make -Value "C:\Program Files (x86)\GnuWin32\bin\make.exe"

# Проверить что alias работает
make --version
```

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

### Вариант 3: Создать alias в PowerShell (РЕКОМЕНДУЕМЫЙ)
```powershell
# ОБЯЗАТЕЛЬНО: Создать alias для make команды
Set-Alias -Name make -Value "C:\Program Files (x86)\GnuWin32\bin\make.exe"

# Проверить что alias работает
make --version

# Теперь можно использовать
make setup-twenty
```

**Примечание:** Этот alias действует только в текущей сессии PowerShell. Для постоянного alias добавьте команду в профиль PowerShell.

## ✅ Проверка запуска

- **Сервер API**: http://localhost:3000
- **Фронтенд**: http://localhost:3001
- **База данных**: PostgreSQL на порту 5432
- **Redis**: на порту 6379

## 🔧 Решение проблем

### Проблема: "User does not have access to this workspace"
```bash
# Полная очистка и перезапуск через make
make setup-twenty

# Или ручная очистка
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
# Очистить все данные и перезапустить через make
make setup-twenty

# Или ручная очистка
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
- **Рекомендуется использовать `make setup-twenty` для быстрой настройки**

---

**Для подробной информации см. `LOCAL_DEPLOYMENT_CHECKLIST.md`**
