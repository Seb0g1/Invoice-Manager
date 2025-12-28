@echo off
echo Building backend...
cd backend
call npm run build
if %errorlevel% neq 0 (
    echo Backend build failed!
    exit /b %errorlevel%
)
cd ..

echo Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    exit /b %errorlevel%
)
cd ..

echo Build completed successfully!









