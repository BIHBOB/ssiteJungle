@echo off
chcp 65001 > nul
set TITLE=Исправление изображений
title %TITLE%

echo ===== Исправление изображений товаров RusskiiPortal =====
echo.

echo Запуск скрипта исправления...
call npx tsx fix-images.js

echo.
echo Скрипт выполнен.
pause 