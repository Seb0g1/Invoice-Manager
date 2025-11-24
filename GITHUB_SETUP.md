# 🚀 Загрузка проекта на GitHub

## Шаг 1: Создание репозитория на GitHub

1. Перейдите на [GitHub.com](https://github.com) и войдите в свой аккаунт
2. Нажмите кнопку **"New"** или **"+"** → **"New repository"**
3. Заполните форму:
   - **Repository name**: `david-warehouse` (или любое другое имя)
   - **Description**: "Warehouse management system for david.sakoo.ru"
   - Выберите **Public** или **Private**
   - **НЕ** добавляйте README, .gitignore или лицензию (они уже есть в проекте)
4. Нажмите **"Create repository"**

## Шаг 2: Добавление remote и загрузка кода

После создания репозитория GitHub покажет инструкции. Выполните следующие команды:

### Если репозиторий называется `david-warehouse`:

```bash
git remote add origin https://github.com/ВАШ_USERNAME/david-warehouse.git
git branch -M main
git push -u origin main
```

### Если у вас другой username или название репозитория:

Замените `ВАШ_USERNAME` и `david-warehouse` на ваши значения.

## Шаг 3: Проверка

После успешной загрузки:
1. Обновите страницу репозитория на GitHub
2. Убедитесь, что все файлы загружены
3. Проверьте, что README.md отображается корректно

## Дополнительные команды

### Если нужно изменить URL remote:

```bash
git remote set-url origin https://github.com/ВАШ_USERNAME/david-warehouse.git
```

### Если нужно проверить текущий remote:

```bash
git remote -v
```

### Для последующих обновлений:

```bash
git add .
git commit -m "Описание изменений"
git push
```

## 🔐 Использование SSH (опционально)

Если вы настроили SSH ключи для GitHub, используйте SSH URL:

```bash
git remote add origin git@github.com:ВАШ_USERNAME/david-warehouse.git
```

## ⚠️ Важные замечания

1. **Не загружайте файлы с секретами:**
   - Убедитесь, что файл `.env` находится в `.gitignore`
   - Не коммитьте реальные JWT_SECRET или пароли

2. **Проверьте .gitignore:**
   - Файл уже настроен и исключает `node_modules`, `.env`, `dist`, и другие временные файлы

3. **Если возникли проблемы:**
   - Убедитесь, что вы авторизованы в Git: `git config --global user.name` и `git config --global user.email`
   - Проверьте права доступа к репозиторию на GitHub

