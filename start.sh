#!/bin/bash

echo "===== Запуск Russkii Portal ====="
echo "Проверка наличия node.js..."

if ! command -v node &> /dev/null; then
    echo "[ОШИБКА] Node.js не найден. Пожалуйста, установите Node.js и попробуйте снова."
    exit 1
fi

echo "Node.js найден!"
echo ""
echo "Установка зависимостей..."
npm install
if [ $? -ne 0 ]; then
    echo "[ОШИБКА] Не удалось установить зависимости."
    exit 1
fi

echo "Зависимости установлены!"
echo ""

# Проверяем существование папки dist
if [ ! -d "dist" ]; then
    echo "Сборка проекта..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "[ОШИБКА] Не удалось собрать проект."
        exit 1
    fi
    echo "Проект успешно собран!"
    echo ""
fi

echo "Запуск проекта..."
echo ""
echo "Для запуска в режиме разработки используйте: npm run dev"
echo "Для запуска в режиме продакшн используйте: npm run start"
echo ""

read -p "Выберите режим запуска (dev/prod) [dev]: " mode
mode=${mode:-dev}

if [ "$mode" = "dev" ]; then
    echo "Запуск в режиме разработки..."
    export NODE_ENV=development
    npx tsx server/index.ts
elif [ "$mode" = "prod" ]; then
    echo "Запуск в режиме продакшн..."
    export NODE_ENV=production
    node dist/index.js
else
    echo "[ОШИБКА] Неверный режим. Выберите 'dev' или 'prod'."
    exit 1
fi 