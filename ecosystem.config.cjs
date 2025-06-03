module.exports = {
  apps: [{
    name: 'russkii-portal',
    script: './dist/index.js',
    cwd: process.cwd(),
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      SESSION_SECRET: 'russkii-portal-secret-key-2024',
      DATABASE_URL: 'file:db/database.sqlite'
    }
  }]
} 