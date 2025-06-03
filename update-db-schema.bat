@echo off
chcp 65001 > nul
set TITLE=Обновление структуры БД
title %TITLE%

echo ===== Обновление структуры базы данных RusskiiPortal =====
echo.

echo Запуск скрипта обновления...
call npx tsx update-db-schema.js

echo.
echo Скрипт выполнен.
pause 