#!/bin/bash

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js не установлен. Устанавливаем..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Проверяем наличие PM2
if ! command -v pm2 &> /dev/null; then
    echo "PM2 не установлен. Устанавливаем..."
    sudo npm install -g pm2
fi

# Создаем необходимые директории
mkdir -p uploads
mkdir -p dist
mkdir -p db

# Устанавливаем зависимости
npm install

# Собираем проект
npm run build:prod

# Устанавливаем права доступа
chmod 755 uploads
chmod 755 dist
chmod 644 db/database.sqlite

# Запускаем приложение
pm2 start ecosystem.config.cjs

# Сохраняем конфигурацию PM2
pm2 save

# Настраиваем автозапуск PM2
pm2 startup

echo "Приложение запущено!"
echo "Проверьте статус: pm2 status"
echo "Просмотр логов: pm2 logs" 