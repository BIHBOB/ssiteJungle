# Инструкция по деплою на Ubuntu

## Подготовка сервера

1. Подключитесь к серверу через SSH:
```bash
ssh root@your-server-ip
```

2. Установите необходимые пакеты:
```bash
apt update
apt install -y git curl
```

## Деплой приложения

1. Создайте директорию для приложения:
```bash
mkdir -p /var/www/russkii-portal
cd /var/www/russkii-portal
```

2. Скопируйте файлы проекта на сервер:
```bash
# С локального компьютера
scp -r ./* root@your-server-ip:/var/www/russkii-portal/
```

3. Подключитесь к серверу и выполните:
```bash
chmod +x start-ubuntu.sh
chmod +x backup.sh
./start-ubuntu.sh
```

## Настройка Nginx (опционально)

1. Установите Nginx:
```bash
apt install -y nginx
```

2. Создайте конфигурацию сайта:
```bash
nano /etc/nginx/sites-available/russkii-portal
```

3. Добавьте следующую конфигурацию:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Активируйте конфигурацию:
```bash
ln -s /etc/nginx/sites-available/russkii-portal /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## Настройка SSL (опционально)

1. Установите Certbot:
```bash
apt install -y certbot python3-certbot-nginx
```

2. Получите SSL-сертификат:
```bash
certbot --nginx -d your-domain.com
```

## Управление приложением

- Проверка статуса: `pm2 status`
- Просмотр логов: `pm2 logs`
- Перезапуск: `pm2 restart russkii-portal`
- Остановка: `pm2 stop russkii-portal`

## Обновление приложения

1. Получите последние изменения:
```bash
git pull
```

2. Установите новые зависимости:
```bash
npm install
```

3. Пересоберите проект:
```bash
npm run build:prod
```

4. Перезапустите приложение:
```bash
pm2 restart russkii-portal
```

## Мониторинг

- Просмотр процессов: `pm2 monit`
- Просмотр логов: `pm2 logs`

## Резервное копирование

Рекомендуется настроить регулярное резервное копирование базы данных и загруженных файлов:

1. Создайте скрипт для бэкапа:
```bash
nano /var/www/russkii-portal/backup.sh
```

2. Добавьте в crontab:
```bash
crontab -e
# Добавьте строку:
0 0 * * * /var/www/russkii-portal/backup.sh
```

## Устранение неполадок

1. Если приложение не запускается:
   - Проверьте логи: `pm2 logs`
   - Проверьте права доступа к файлам
   - Убедитесь, что порт 5000 свободен

2. Если Nginx не работает:
   - Проверьте конфигурацию: `nginx -t`
   - Проверьте логи: `tail -f /var/log/nginx/error.log`

3. Если возникают проблемы с памятью:
   - Увеличьте лимит памяти в ecosystem.config.cjs
   - Проверьте использование памяти: `pm2 monit` 