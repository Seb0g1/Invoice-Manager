# ⚡ Быстрый старт

## Для разработки (локально)

```bash
# 1. Клонирование
git clone https://github.com/Seb0g1/Invoice-Manager.git
cd Invoice-Manager

# 2. Backend
cd backend
npm install
# Создайте .env файл (см. backend/.env.example)
npm run dev

# 3. Frontend (в новом терминале)

# Вариант 1: Использование скрипта (рекомендуется)
# Windows:
start-frontend.bat

# Linux/Mac:
chmod +x start-frontend.sh
./start-frontend.sh

# Вариант 2: Вручную
cd frontend
npm install
npm run dev
# Frontend будет доступен на http://localhost:3000
```

## Для production (Ubuntu Server)

```bash
# 1. Клонирование
git clone https://github.com/Seb0g1/Invoice-Manager.git
cd Invoice-Manager

# 2. Автоматическая установка
chmod +x setup.sh
./setup.sh

# 3. Настройка .env
cd backend
cp .env.example .env
nano .env  # Отредактируйте JWT_SECRET

# 4. Запуск с PM2
cd ..
pm2 start backend/dist/index.js --name invoice-backend
pm2 save

# 5. Настройка Nginx (см. DEPLOY.md)
```

## MongoDB Connection String

```
mongodb://gen_user:_*W%264xFfUJP9%2BO@147.45.175.217:27017/default_db?authSource=admin&directConnection=true
```

## Важные файлы

- `README.md` - Основная документация
- `DEPLOY.md` - Инструкция по развёртыванию
- `DEPLOY_UPDATE.md` - Инструкция по обновлению на сервере
- `GIT_SETUP.md` - Настройка Git
- `setup.sh` - Скрипт автоматической установки
- `start.sh` - Скрипт запуска приложения
- `start-frontend.bat` / `start-frontend.sh` - Скрипты запуска frontend
- `deploy.sh` - Скрипт обновления на сервере

