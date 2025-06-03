#!/bin/bash

# Создаем директорию для бэкапов, если её нет
BACKUP_DIR="/var/www/russkii-portal/backups"
mkdir -p "$BACKUP_DIR"

# Получаем текущую дату
DATE=$(date +%Y-%m-%d)
BACKUP_PATH="$BACKUP_DIR/$DATE"

# Создаем директорию для текущего бэкапа
mkdir -p "$BACKUP_PATH"

# Копируем базу данных
cp /var/www/russkii-portal/db/database.sqlite "$BACKUP_PATH/database.sqlite"

# Архивируем загруженные файлы
tar -czf "$BACKUP_PATH/uploads.tar.gz" -C /var/www/russkii-portal uploads

# Удаляем старые бэкапы (старше 7 дней)
find "$BACKUP_DIR" -type d -mtime +7 -exec rm -rf {} \;

echo "Backup completed successfully at $BACKUP_PATH" 