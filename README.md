# Russkii Portal

## Deployment Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm (v8 or higher)
- SQLite (for local development) or PostgreSQL (for production)

### Environment Variables
Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Session Configuration
SESSION_SECRET=your-secure-session-secret

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# File Upload Configuration
MAX_FILE_SIZE=5242880 # 5MB in bytes
UPLOAD_DIR=uploads

# Security
CORS_ORIGIN=http://localhost:3000
```

### Production Deployment Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd RusskiiPortal
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env`
- Update the values in `.env` with your production settings

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

### Windows Deployment
For Windows deployment, use the provided `start-prod.bat` script:
```bash
start-prod.bat
```

### Directory Structure
- `/dist` - Compiled production files
- `/uploads` - User uploaded files
- `/public` - Static assets
- `/client` - Frontend source code
- `/server` - Backend source code
- `/shared` - Shared code between frontend and backend

### Production Considerations
1. Always use HTTPS in production
2. Set up proper database backups
3. Configure proper logging
4. Set up monitoring
5. Use a process manager (PM2, etc.)
6. Configure proper security headers
7. Set up rate limiting
8. Configure proper CORS settings

### Troubleshooting
1. If you encounter permission issues with uploads directory:
```bash
chmod 755 uploads
```

2. If the server fails to start, check:
- Environment variables are properly set
- Database connection is working
- Required ports are available
- Node.js version is compatible

### Support
For support, please contact the development team.

## Запуск проекта на Windows с SQLite

Проект использует локальную базу данных SQLite, которая не требует дополнительной настройки.

### Режим разработки
1. Дважды кликните на файл `start.bat`
2. Приложение запустится в режиме разработки
3. База данных будет создана автоматически в папке `/db`
4. Доступ к сайту: http://localhost:5000

### Режим продакшн
1. Дважды кликните на файл `start-prod.bat`
2. Приложение соберется и запустится в продакшн режиме
3. База данных будет создана автоматически в папке `/db`
4. Доступ к сайту: http://localhost:5000

## Запуск на Linux/Mac
1. Сделайте файл запуска исполняемым: `chmod +x start.sh`
2. Запустите скрипт: `./start.sh`
3. Выберите режим запуска:
   - `dev` - для режима разработки (по умолчанию)
   - `prod` - для продакшн режима

## Ручной запуск c SQLite

### Установка зависимостей
```
npm install
```

### Запуск в режиме разработки
```
npm run dev:sqlite
```
или
```
set NODE_ENV=development
npx tsx server/index-sqlite.ts
```

### Сборка проекта
```
npm run build:sqlite
```

### Запуск в продакшн режиме
```
npm run start:sqlite
```
или
```
set NODE_ENV=production
node dist/index.js
```

## Структура базы данных

База данных SQLite создается автоматически в папке `/db/database.sqlite`. 
Все таблицы создаются при первом запуске приложения. 