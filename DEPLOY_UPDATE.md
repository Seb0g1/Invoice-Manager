# 🔄 Инструкция по обновлению проекта на сервере

## Быстрое обновление

Если у вас уже настроен проект на сервере, используйте скрипт автоматического обновления:

```bash
# Сделайте скрипт исполняемым (один раз)
chmod +x deploy.sh

# Запустите обновление
./deploy.sh
```

Скрипт автоматически:
1. ✅ Проверит наличие обновлений на GitHub
2. ✅ Создаст резервную копию
3. ✅ Загрузит обновления
4. ✅ Установит зависимости
5. ✅ Соберёт backend и frontend
6. ✅ Перезапустит приложение (PM2 или systemd)
7. ✅ Перезагрузит Nginx

## Ручное обновление

Если нужно обновить вручную:

```bash
# 1. Перейдите в директорию проекта
cd /var/www/david-warehouse

# 2. Получите обновления с GitHub
git pull origin main

# 3. Обновите зависимости и соберите backend
cd backend
npm install
npm run build

# 4. Обновите зависимости и соберите frontend
cd ../frontend
npm install
npm run build

# 5. Перезапустите приложение

# Если используете PM2:
pm2 restart invoice-backend

# Если используете systemd:
sudo systemctl restart invoice-manager

# 6. Перезагрузите Nginx (если нужно)
sudo nginx -t
sudo systemctl reload nginx
```

## Проверка обновлений

Перед обновлением можно проверить, есть ли новые изменения:

```bash
cd /var/www/david-warehouse
git fetch origin
git log HEAD..origin/main --oneline
```

## Откат изменений

Если что-то пошло не так, можно откатиться к предыдущей версии:

```bash
cd /var/www/david-warehouse

# Посмотреть историю коммитов
git log --oneline -10

# Откатиться к конкретному коммиту
git reset --hard <commit-hash>

# Или откатиться на один коммит назад
git reset --hard HEAD~1

# Пересобрать проект
cd backend && npm run build
cd ../frontend && npm run build

# Перезапустить
pm2 restart invoice-backend
# или
sudo systemctl restart invoice-manager
```

## Автоматическое обновление через cron

Для автоматического обновления каждый день в 3:00 ночи:

```bash
# Откройте crontab
crontab -e

# Добавьте строку (замените путь на ваш)
0 3 * * * cd /var/www/david-warehouse && /bin/bash deploy.sh >> /var/log/david-warehouse-update.log 2>&1
```

## Важные замечания

⚠️ **Перед обновлением:**
- Убедитесь, что у вас есть резервная копия базы данных
- Проверьте, что файл `.env` не будет перезаписан
- Убедитесь, что нет активных пользователей (или предупредите их)

⚠️ **Если обновление не работает:**
1. Проверьте логи: `pm2 logs invoice-backend`
2. Проверьте статус: `pm2 status` или `sudo systemctl status invoice-manager`
3. Проверьте Nginx: `sudo nginx -t`
4. Проверьте права доступа к файлам

## Структура проекта на сервере

```
/var/www/david-warehouse/
├── backend/
│   ├── dist/          # Собранный backend
│   ├── .env           # Переменные окружения (НЕ в Git!)
│   └── ...
├── frontend/
│   └── dist/          # Собранный frontend
└── ...
```

## Полезные команды

```bash
# Проверить статус Git
git status

# Посмотреть последние коммиты
git log --oneline -5

# Проверить, какие файлы изменились
git diff HEAD origin/main

# Проверить статус PM2
pm2 status
pm2 logs invoice-backend

# Проверить статус systemd
sudo systemctl status invoice-manager
sudo journalctl -u invoice-manager -f

# Проверить Nginx
sudo nginx -t
sudo systemctl status nginx
```

