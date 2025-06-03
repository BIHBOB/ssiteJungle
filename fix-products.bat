@echo off
chcp 65001 > nul
set TITLE=Исправление товаров
title %TITLE%

echo ===== Исправление товаров в базе данных RusskiiPortal =====
echo.

echo Запуск скрипта исправления...
call npx tsx fix-products.js

echo.
echo Скрипт выполнен.
pause 