# 🚀 Быстрая загрузка на GitHub

## ⚠️ ВАЖНО: Git должен быть в директории проекта!

Если git был инициализирован в домашней папке, сначала исправьте это:

```powershell
# 1. Удалите .git из домашней директории (если есть)
Remove-Item -Path "$env:USERPROFILE\.git" -Recurse -Force -ErrorAction SilentlyContinue

# 2. Перейдите в директорию проекта
cd "C:\Users\Хуйню придумал\Downloads\david-warehouse"

# 3. Удалите старый .git если он есть
Remove-Item -Path ".git" -Recurse -Force -ErrorAction SilentlyContinue

# 4. Инициализируйте git правильно
git init

# 5. Добавьте файлы проекта
git add .

# 6. Создайте коммит
git commit -m "Initial commit: David Warehouse"
```

## 📤 Загрузка на GitHub

### Шаг 1: Создайте репозиторий на GitHub
1. Перейдите на https://github.com/new
2. Название: `david-warehouse`
3. НЕ создавайте README, .gitignore (они уже есть)
4. Нажмите "Create repository"

### Шаг 2: Подключите и загрузите

```powershell
# Замените YOUR_USERNAME на ваш GitHub username
git remote add origin https://github.com/YOUR_USERNAME/david-warehouse.git
git branch -M main
git push -u origin main
```

## ✅ Готово!

Ваш проект теперь на GitHub! 🎉

---

**Подробная инструкция:** `GITHUB_SETUP.md`

