# 🔧 Исправление проблем сборки проекта на сервере

## Быстрая диагностика

Запустите скрипт диагностики на сервере:

```bash
cd /var/www/davidsklad
chmod +x check-build-errors.sh
./check-build-errors.sh
```

Скрипт проверит:
- ✅ Наличие директорий
- ✅ Установку Node.js и npm
- ✅ Установку зависимостей
- ✅ Попытку сборки с выводом ошибок

## Типичные проблемы и решения

### 1. Ошибка: `tsc: command not found` или `typescript not found`

**Причина:** TypeScript не установлен (devDependencies не установлены)

**Решение:**
```bash
cd /var/www/davidsklad/backend
npm install  # Убедитесь, что устанавливаются devDependencies
npm run build
```

### 2. Ошибка: `Cannot find module 'date-fns'` или другие модули

**Причина:** Зависимости не установлены или установлены не полностью

**Решение:**
```bash
cd /var/www/davidsklad/backend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 3. Ошибка: `JavaScript heap out of memory`

**Причина:** Недостаточно памяти для сборки

**Решение:** Скрипт сборки уже настроен с увеличенной памятью (`--max-old-space-size=4096`). Если ошибка сохраняется:

```bash
cd /var/www/davidsklad/backend
NODE_OPTIONS="--max-old-space-size=8192" npm run build
```

### 4. Ошибки TypeScript компиляции

**Причина:** Ошибки в коде TypeScript

**Решение:**
1. Проверьте вывод ошибок компиляции
2. Исправьте ошибки в коде
3. Или временно отключите строгие проверки в `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "strict": false,
       "noUnusedLocals": false,
       "noUnusedParameters": false
     }
   }
   ```

### 5. Ошибка: `Cannot find module '@types/...'`

**Причина:** Типы не установлены

**Решение:**
```bash
cd /var/www/davidsklad/backend
npm install --save-dev @types/node @types/express @types/bcrypt @types/cookie-parser @types/cors @types/jsonwebtoken @types/multer @types/xlsx
npm run build
```

### 6. Ошибка при сборке Frontend

**Причина:** Проблемы с зависимостями или TypeScript ошибки

**Решение:**
```bash
cd /var/www/davidsklad/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Полная переустановка зависимостей

Если ничего не помогает, выполните полную переустановку:

```bash
# Backend
cd /var/www/davidsklad/backend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build

# Frontend
cd /var/www/davidsklad/frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build
```

## Проверка версий Node.js и npm

Убедитесь, что версии соответствуют требованиям:

```bash
node -v  # Должно быть v18.x или выше
npm -v   # Должно быть 9.x или выше
```

Если версии старые, обновите Node.js:
```bash
# Используйте nvm для управления версиями Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

## Просмотр детальных логов сборки

Для детального вывода ошибок:

```bash
# Backend
cd /var/www/davidsklad/backend
npm run build 2>&1 | tee build.log
cat build.log

# Frontend
cd /var/www/davidsklad/frontend
npm run build 2>&1 | tee build.log
cat build.log
```

## Автоматическое исправление

Используйте скрипт для автоматического исправления:

```bash
cd /var/www/davidsklad
chmod +x fix-build.sh
./fix-build.sh
```

## Контакты для помощи

Если проблема не решается:
1. Сохраните полный лог ошибки: `npm run build > build-error.log 2>&1`
2. Проверьте версии: `node -v && npm -v`
3. Проверьте свободное место: `df -h`
4. Проверьте память: `free -h`

