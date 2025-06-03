@echo off
chcp 65001 > nul
set TITLE=Создание изображений
title %TITLE%

echo ===== Создание изображений для RusskiiPortal =====
echo.

echo Запуск скрипта...
call npx tsx fix-empty-images.js

echo.
echo Скрипт выполнен.
pause 