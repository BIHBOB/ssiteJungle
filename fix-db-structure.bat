@echo off
chcp 65001 > nul
set TITLE=Исправление структуры БД
title %TITLE%

echo ===== Исправление структуры базы данных RusskiiPortal =====
echo.

echo Запуск скрипта исправления...
call npx tsx fix-db-structure.js

echo.
echo Скрипт выполнен.
pause 