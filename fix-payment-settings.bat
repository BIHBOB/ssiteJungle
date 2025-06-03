@echo off
chcp 65001 > nul
set TITLE=Исправление настроек платежей
title %TITLE%

echo ===== Исправление настроек платежей RusskiiPortal =====
echo.

echo Запуск скрипта исправления...
call npx tsx fix-payment-settings.js

echo.
echo Скрипт выполнен.
pause 