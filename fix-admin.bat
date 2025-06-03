@echo off
chcp 65001 > nul
set TITLE=Исправление прав администратора
title %TITLE%

echo ===== Исправление прав администратора для RusskiiPortal =====
echo.

echo Запуск скрипта...
call npx tsx fix-admin.js

echo.
echo Скрипт выполнен.
pause 