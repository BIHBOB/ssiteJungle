@echo off
chcp 65001 > nul
set TITLE=Исправление отзывов
title %TITLE%

echo ===== Исправление отзывов в базе данных RusskiiPortal =====
echo.

echo Запуск скрипта исправления...
call npx tsx fix-reviews.js

echo.
echo Скрипт выполнен.
pause 