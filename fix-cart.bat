@echo off
chcp 65001 > nul
set TITLE=Исправление корзины
title %TITLE%

echo ===== Исправление отображения корзины и цен RusskiiPortal =====
echo.

echo Запуск скрипта исправления...
call npx tsx fix-cart.js

echo.
echo Скрипт выполнен.
pause 