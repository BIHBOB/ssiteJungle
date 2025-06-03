@echo off
chcp 65001 > nul
set TITLE=Очистка товаров
title %TITLE%

echo ===== Очистка товаров в базе данных RusskiiPortal =====
echo.

echo Запуск скрипта очистки товаров...
call npx tsx clear-products.js

echo.
echo Скрипт выполнен.
pause 