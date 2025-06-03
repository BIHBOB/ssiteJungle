import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontsDir = path.join(__dirname, 'public', 'fonts');
const arialFontPath = path.join(fontsDir, 'arial.ttf');

// Пути к системным шрифтам Windows
const systemFontPaths = [
    'C:\\Windows\\Fonts\\arial.ttf',
    'C:\\Windows\\Fonts\\Arial.ttf',
    'C:\\Windows\\Fonts\\arial.TTF'
];

// Проверяем существование директории fonts
if (!fs.existsSync(fontsDir)) {
    console.log('Создание директории для шрифтов...');
    fs.mkdirSync(fontsDir, { recursive: true });
}

// Проверяем, установлен ли уже шрифт Arial в нашей директории
if (fs.existsSync(arialFontPath)) {
    console.log('Шрифт Arial уже установлен.');
    process.exit(0);
}

console.log('Поиск системного шрифта Arial...');

// Ищем системный шрифт Arial
const systemFontPath = systemFontPaths.find(fontPath => fs.existsSync(fontPath));

if (!systemFontPath) {
    console.error('Ошибка: Системный шрифт Arial не найден.');
    console.error('Пожалуйста, убедитесь, что шрифт Arial установлен в системе Windows.');
    process.exit(1);
}

try {
    console.log('Копирование системного шрифта Arial...');
    fs.copyFileSync(systemFontPath, arialFontPath);
    console.log('Шрифт Arial успешно установлен!');
    process.exit(0);
} catch (err) {
    console.error('Ошибка при копировании шрифта:', err.message);
    process.exit(1);
} 