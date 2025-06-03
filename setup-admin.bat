@echo off
echo Создание пользователя-администратора...
node --experimental-modules --es-module-specifier-resolution=node setup-admin.js
echo Готово!
pause 