# 📦 Invoice Manager - Система учёта накладных

Полнофункциональное веб-приложение для учёта накладных от поставщиков с системой ролей пользователей (Директор и Сборщик).

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)

## 🚀 Быстрый старт

### Требования

- **Node.js** v18 или выше
- **MongoDB** (локально или удалённый сервер)
- **npm** или **yarn**

### Установка и запуск на Ubuntu Server

#### 1. Клонирование репозитория

```bash
git clone https://github.com/Seb0g1/Invoice-Manager.git
cd Invoice-Manager
```

#### 2. Установка зависимостей

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

#### 3. Настройка переменных окружения

Создайте файл `.env` в директории `backend` (скопируйте из `.env.example`):

```env
MONGO_URI=mongodb://gen_user:_*W%264xFfUJP9%2BO@147.45.175.217:27017/default_db?authSource=admin&directConnection=true
JWT_SECRET=your-secret-key-change-in-production-min-32-chars
PORT=5000
FRONTEND_URL=https://david.sakoo.ru
NODE_ENV=production
```

**Важно:** 
- Замените `JWT_SECRET` на случайную строку минимум 32 символа для безопасности!
- MongoDB URI уже настроен, но вы можете изменить его при необходимости

#### 4. Сборка проекта

```bash
# Сборка backend
cd backend
npm run build

# Сборка frontend
cd ../frontend
npm run build
```

#### 5. Запуск приложения

**Вариант 1: Использование PM2 (рекомендуется)**

**Быстрая настройка:**
```bash
cd /var/www/david-warehouse
chmod +x setup-pm2.sh
./setup-pm2.sh
```

**Или вручную:**
```bash
# Установка PM2
sudo npm install -g pm2

# Запуск backend
cd backend
pm2 start dist/index.js --name invoice-backend

# Настройка автозапуска (выполните команду, которую покажет PM2)
pm2 startup
pm2 save
```

**Подробная инструкция:** См. `PM2_SETUP.md`

**Вариант 2: Использование systemd**

Создайте файл `/etc/systemd/system/invoice-manager.service`:

```ini
[Unit]
Description=Invoice Manager Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/Invoice-Manager/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable invoice-manager
sudo systemctl start invoice-manager
```

#### 6. Настройка домена david.sakoo.ru

**Быстрая настройка:** См. `SETUP_DOMAIN.md`

**Подробная инструкция:** См. `NGINX_SETUP.md`

Создайте файл `/etc/nginx/sites-available/david-warehouse`:

```nginx
server {
    listen 80;
    server_name david.sakoo.ru;

    # Frontend
    location / {
        root /var/www/david-warehouse/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Загрузка файлов
    location /uploads {
        proxy_pass http://localhost:5000;
    }
}
```

Активируйте конфигурацию:

```bash
# Используйте готовую конфигурацию из проекта
sudo cp nginx-david.sakoo.ru.conf /etc/nginx/sites-available/david-warehouse

# Активируйте
sudo ln -s /etc/nginx/sites-available/david-warehouse /etc/nginx/sites-enabled/

# Проверьте и перезагрузите
sudo nginx -t
sudo systemctl reload nginx
```

**Важно:** Убедитесь, что в `backend/.env` указан правильный `FRONTEND_URL`:
```env
FRONTEND_URL=http://david.sakoo.ru
```

## 📋 Автоматическая установка (скрипт)

Создайте файл `setup.sh` в корне проекта:

```bash
#!/bin/bash

echo "🚀 Начало установки Invoice Manager..."

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js v18 или выше."
    exit 1
fi

# Установка зависимостей
echo "📦 Установка зависимостей backend..."
cd backend
npm install

echo "📦 Установка зависимостей frontend..."
cd ../frontend
npm install

# Сборка
echo "🔨 Сборка backend..."
cd ../backend
npm run build

echo "🔨 Сборка frontend..."
cd ../frontend
npm run build

echo "✅ Установка завершена!"
echo "📝 Не забудьте создать файл .env в директории backend с настройками MongoDB"
```

Сделайте скрипт исполняемым и запустите:

```bash
chmod +x setup.sh
./setup.sh
```

## 🛠️ Технологический стек

### Backend
- **Node.js** + **Express** - серверная платформа
- **MongoDB** + **Mongoose** - база данных
- **TypeScript** - типизированный JavaScript
- **JWT** - авторизация через httpOnly cookies
- **Multer** - загрузка файлов
- **Bcrypt** - хэширование паролей

### Frontend
- **React** + **Vite** + **TypeScript** - современный фреймворк
- **Material-UI (MUI v5)** - компоненты интерфейса
- **Recharts** - графики и визуализация данных
- **React Router v6** - маршрутизация
- **Axios** - HTTP-запросы
- **Zustand** - управление состоянием
- **React Hot Toast** - уведомления

## ✨ Основной функционал

### Роли пользователей

#### 👔 Директор
- Полный доступ ко всем функциям
- Управление поставщиками и накладными
- Просмотр и управление балансами
- Оплата накладных (отдельно, несколько или все)
- Просмотр графиков изменения баланса
- Управление пользователями
- Настройка прав доступа для ролей
- Интеграции с OZON и Yandex Market

#### 📦 Сборщик
- Добавление новых накладных
- Работа с листами сборки
- Управление складом
- Ограниченный доступ (настраивается в настройках)

### Основные возможности

- ✅ **Управление накладными** - загрузка фото, фильтрация, поиск
- ✅ **Управление поставщиками** - балансы, история платежей, графики
- ✅ **Листы сборки** - создание, редактирование, отслеживание прогресса
- ✅ **Склад** - управление товарами, импорт из Excel
- ✅ **Интеграции** - OZON Seller API, Yandex Market API
- ✅ **Настройки** - управление правами доступа, темы, уведомления
- ✅ **Адаптивный дизайн** - полная поддержка мобильных устройств
- ✅ **Безопасность** - JWT авторизация, ролевая система доступа

## 📁 Структура проекта

```
Invoice-Manager/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Контроллеры для обработки запросов
│   │   ├── middleware/      # Middleware для авторизации
│   │   ├── models/          # Mongoose модели
│   │   ├── routes/          # Express роуты
│   │   ├── services/        # Бизнес-логика и интеграции
│   │   └── index.ts         # Точка входа
│   ├── uploads/             # Загруженные файлы
│   ├── dist/                # Собранный код (после build)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React компоненты
│   │   ├── pages/           # Страницы приложения
│   │   ├── store/           # Zustand stores
│   │   ├── services/        # API сервисы
│   │   └── types/           # TypeScript типы
│   ├── dist/                # Собранный frontend (после build)
│   └── package.json
└── README.md
```

## 🔧 Разработка

### Backend

```bash
cd backend
npm run dev    # Запуск с nodemon (автоперезагрузка)
npm run build  # Сборка TypeScript
npm start      # Запуск собранного проекта
```

### Frontend

```bash
cd frontend
npm run dev      # Запуск dev-сервера (http://localhost:3000)
npm run build    # Сборка для production
npm run preview  # Просмотр production сборки
```

**Или используйте готовый скрипт:**
```bash
# Windows
start-frontend.bat

# Linux/Mac
chmod +x start-frontend.sh
./start-frontend.sh
```

## 🔐 Безопасность

- JWT токены хранятся в httpOnly cookies
- Пароли хэшируются с помощью bcrypt
- Ролевая система доступа
- Валидация входных данных
- Защита от CSRF

## 📝 API Endpoints

### Авторизация
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/logout` - Выход
- `GET /api/auth/me` - Получить текущего пользователя

### Поставщики
- `GET /api/suppliers` - Список поставщиков
- `GET /api/suppliers/:id` - Детали поставщика
- `POST /api/suppliers` - Создать поставщика
- `PUT /api/suppliers/:id/pay` - Оплатить накладные

### Накладные
- `GET /api/invoices` - Список накладных
- `POST /api/invoices` - Добавить накладную

### Пользователи
- `GET /api/users` - Список пользователей
- `POST /api/users` - Создать пользователя
- `PUT /api/users/:id` - Обновить пользователя
- `DELETE /api/users/:id` - Удалить пользователя

## 🐛 Решение проблем

### Проблемы с подключением к MongoDB

Убедитесь, что:
- MongoDB URI правильный и доступен
- Пароль в URI правильно закодирован (URL encoding)
- Firewall разрешает подключение к порту 27017

### Проблемы с запуском

1. Проверьте версию Node.js: `node --version` (должна быть >= 18)
2. Убедитесь, что все зависимости установлены: `npm install`
3. Проверьте файл `.env` в директории `backend`

### Проблемы с правами доступа

Если страницы не отображаются:
1. Перейдите в Настройки → Права доступа ролей
2. Настройте видимые страницы и доступные маршруты для каждой роли
3. Сохраните настройки

## 📄 Лицензия

ISC

## 👥 Авторы

- Разработка: Seb0g1

## 🤝 Вклад в проект

Приветствуются любые улучшения! Создавайте issues и pull requests.

---

## 📚 Дополнительная документация

- **[DEPLOY.md](DEPLOY.md)** - Подробная инструкция по развёртыванию на Ubuntu Server
- **[GIT_SETUP.md](GIT_SETUP.md)** - Инструкция по настройке Git репозитория

## 🔗 Полезные ссылки

- [GitHub Repository](https://github.com/Seb0g1/Invoice-Manager)
- [Node.js Documentation](https://nodejs.org/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [React Documentation](https://react.dev/)

---

**Примечание:** При первом запуске backend автоматически создаёт дефолтных пользователей. Не забудьте изменить пароли в production!
