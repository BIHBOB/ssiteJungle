import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { db } from "./db-sqlite";
import { Database } from 'better-sqlite3';
import { setupAuth, userRecordToSessionUser, type User, type UserRecord, updateUserSession } from "./auth-sqlite";
import { z } from "zod";
import { insertProductSchema, insertOrderSchema, insertReviewSchema, insertNotificationSchema, insertPaymentDetailsSchema } from "@shared/schema";
import PDFDocument from 'pdfkit';

// Определение интерфейсов
interface Product {
  id: number;
  quantity: number;
  name: string;
  price: number;
}

interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number | null;
  start_date: string;
  end_date: string;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: number;
  user_id: number;
  items: string;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  promo_code?: string;
  product_quantities_reduced?: boolean;
  comment?: string;
}

// Helper function for escaping CSV fields (if not already defined)
function escapeCSVField(field: string): string {
  if (!field) return '';
  if (field.includes(';') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Middleware for checking authentication
function ensureAuthenticated(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated()) {
    // Обновим данные пользователя перед продолжением
    updateUserSession(req);
    
    // Проверяем ID пользователя
    if (req.user && (req.user as any).id) {
      const userId = (req.user as any).id;
      
      // Проверим существование пользователя в базе
      const existingUser = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]);
      
      if (!existingUser) {
        console.error(`Ошибка авторизации: Пользователь с ID ${userId} не найден в базе данных`);
        req.logout(() => {
          res.status(401).json({ message: "Сессия недействительна. Пожалуйста, войдите снова." });
        });
        return;
      }
      
      console.log(`Пользователь ${userId} авторизован успешно. Баланс: ${(req.user as any).balance || '0'}`);
    return next();
  }
    
    console.error("Ошибка авторизации: ID пользователя не определен");
    res.status(401).json({ message: "Ошибка авторизации: ID пользователя не определен" });
    return;
  }
  
  res.status(401).json({ message: "Необходима авторизация" });
}

// Middleware для проверки прав администратора с обновлением сессии
function ensureAdmin(req: Request, res: Response, next: Function) {
  console.log("Проверка прав администратора:", req.user);
  
  if (req.isAuthenticated() && req.user) {
    // Обновим данные пользователя перед проверкой
    updateUserSession(req);
    
    const user = req.user as any;
    
    // Сначала проверяем кэш админов
    if (adminCache.has(user.id)) {
      console.log("🔑 Права администратора подтверждены из кэша для:", user.email);
      
      // Восстанавливаем права в объекте пользователя
      user.isAdmin = true;
      user.is_admin = 1;
      
    return next();
  }
    
    // Проверяем наличие прав администратора в базе данных
    try {
      // Проверяем, что пользователь действительно админ в базе данных и получаем свежие данные
      const dbUser = db.queryOne("SELECT * FROM users WHERE id = ?", [user.id]) as Record<string, any>;
      
      if (dbUser && (
          typeof dbUser === 'object' && 
          ('is_admin' in dbUser) && 
          (dbUser.is_admin === 1 || Boolean(dbUser.is_admin) === true)
        )) {
        // Обновляем сессию и добавляем в кэш админов
        user.isAdmin = true;
        user.is_admin = 1;
        adminCache.add(user.id);
        
        console.log("✓ Права администратора подтверждены для:", user.email);
        return next();
      } else {
        console.log("✗ Пользователь не имеет прав администратора в базе данных:", user.email);
      }
    } catch (error) {
      console.error("Ошибка при проверке прав администратора:", error);
    }
  }
  
  res.status(403).json({ message: "Недостаточно прав доступа" });
}

// Кэш для администраторов
const adminCache = new Set<string>();

// Импортируем функции хеширования из auth-sqlite
import { hashPassword, comparePasswords } from "./auth-sqlite";

// Настройка хранилища для загрузки файлов
const fileStorage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    const uploadDir = path.join(process.cwd(), "uploads");
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req: any, file: any, cb: any) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только изображения"));
    }
  },
});

// Middleware для сохранения статуса администратора
function preserveAdminStatus(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated() && req.user) {
    const user = req.user as any;
    const userId = user.id;
    
    // Если пользователь уже в кэше админов
    if (adminCache.has(userId)) {
      console.log(`🔒 Восстановление прав админа для пользователя ${userId}`);
      user.isAdmin = true;
      user.is_admin = 1;
    }
    
    // Если пользователь имеет признак админа, добавляем в кэш
    if (user.isAdmin === true || user.is_admin === 1) {
      console.log(`✅ Кэширование прав админа для пользователя ${userId}`);
      adminCache.add(userId);
    }
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Sets up authentication routes
  setupAuth(app);
  
  // Добавляем middleware для сохранения статуса администратора
  app.use(preserveAdminStatus);
  
  // Serve static uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  
  // Удаляем статический маршрут для чеков
  // app.use("/receipts", express.static(path.join(process.cwd(), "public", "receipts")));
  
  // Upload image route
  app.post("/api/upload", ensureAdmin, upload.single("image"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Изображение не загружено" });
      }
      
      // Создаем URL к загруженному файлу
      const imageUrl = `/uploads/${req.file.filename}`;
      console.log(`Файл загружен: ${imageUrl}`);
      
      res.json({ 
        message: "Файл успешно загружен", 
        imageUrl: imageUrl,
        file: req.file
      });
    } catch (error) {
      console.error("Ошибка при загрузке файла:", error);
      res.status(500).json({ message: "Ошибка при загрузке файла" });
    }
  });
  
  // Добавляем новый маршрут для прямой загрузки нескольких изображений
  app.post("/api/upload-images", ensureAdmin, upload.array("images", 10), (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "Изображения не загружены" });
      }
      
      // Создаем URL к загруженным файлам
      const imageUrls: string[] = [];
      const files = req.files as Express.Multer.File[];
      
      files.forEach(file => {
        const imageUrl = `/uploads/${file.filename}`;
        imageUrls.push(imageUrl);
        console.log(`Файл загружен: ${imageUrl}`);
      });
      
      res.json({ 
        message: "Файлы успешно загружены", 
        imageUrls: imageUrls
      });
    } catch (error) {
      console.error("Ошибка при загрузке файлов:", error);
      res.status(500).json({ message: "Ошибка при загрузке файлов" });
    }
  });
  
  // Product routes
  app.get("/api/products", async (req, res) => {
    try {
      // Получаем все товары из базы данных
      const rawProducts = db.query("SELECT * FROM products");
      
      // Преобразуем данные из БД в формат, понятный клиенту
      const products = rawProducts.map(product => formatProductForClient(product));
      
      // Apply filters if specified in query params
      let filteredProducts = products.filter(Boolean); // Удаляем null значения
      
      // Filter by category
      if (req.query.category) {
        filteredProducts = filteredProducts.filter(
          product => product && product.category === req.query.category
        );
      }
      
      // Filter by availability
      if (req.query.available === "true") {
        filteredProducts = filteredProducts.filter(
          product => product && product.isAvailable && product.quantity > 0
        );
      }
      
      // Filter by preorder status
      if (req.query.preorder === "true") {
        filteredProducts = filteredProducts.filter(
          product => product && product.isPreorder
        );
      }
      
      // Filter by search term
      if (req.query.search) {
        const searchTerm = (req.query.search as string).toLowerCase();
        filteredProducts = filteredProducts.filter(
          product => 
            product && (
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm)
            )
        );
      }
      
      // Filter by price range
      if (req.query.minPrice) {
        const minPrice = parseFloat(req.query.minPrice as string);
        filteredProducts = filteredProducts.filter(
          product => product && product.price >= minPrice
        );
      }
      
      if (req.query.maxPrice) {
        const maxPrice = parseFloat(req.query.maxPrice as string);
        filteredProducts = filteredProducts.filter(
          product => product && product.price <= maxPrice
        );
      }
      
      res.json(filteredProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });
  
  // Get product by ID
  app.get("/api/products/:id", async (req, res) => {
    try {
      // Проверяем, что ID является числом
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Некорректный ID товара" });
      }
      
      const product = db.queryOne(
        "SELECT * FROM products WHERE id = ?",
        [productId]
      );
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Преобразуем данные для клиента
      const formattedProduct = formatProductForClient(product);
      
      res.json(formattedProduct);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });
  
  // Create new product
  app.post("/api/products", ensureAdmin, async (req, res) => {
    try {
      console.log("Creating product with data:", req.body);
      
      // Валидируем и трансформируем данные
      const productData = req.body;
      
      // Проверка обязательных полей
      if (!productData.name || !productData.price) {
        return res.status(400).json({ 
          message: "Не указаны обязательные поля: название и цена товара" 
        });
      }
      
      // Изображения должны быть массивом строк
      if (!productData.images) {
        productData.images = [];
      } else if (typeof productData.images === 'string') {
        productData.images = [productData.images];
      }
      
      // Проверяем, что все числовые значения преобразованы в числа
      try {
      productData.price = parseFloat(productData.price);
        if (isNaN(productData.price)) {
          return res.status(400).json({ message: "Некорректное значение цены" });
        }
        
      if (productData.originalPrice) {
        productData.originalPrice = parseFloat(productData.originalPrice);
          if (isNaN(productData.originalPrice)) {
            return res.status(400).json({ message: "Некорректное значение исходной цены" });
          }
        }
        
        productData.quantity = parseInt(productData.quantity || "0");
        if (isNaN(productData.quantity)) {
          return res.status(400).json({ message: "Некорректное значение количества" });
        }
        
      if (productData.deliveryCost) {
        productData.deliveryCost = parseFloat(productData.deliveryCost);
          if (isNaN(productData.deliveryCost)) {
            return res.status(400).json({ message: "Некорректное значение стоимости доставки" });
          }
        }
      } catch (error) {
        console.error("Error parsing numeric values:", error);
        return res.status(400).json({ message: "Ошибка при обработке числовых значений" });
      }
      
      // Добавляем флаги (булевы значения)
      productData.isAvailable = productData.isAvailable === true || productData.isAvailable === 'true';
      productData.isPreorder = productData.isPreorder === true || productData.isPreorder === 'true';
      productData.isRare = productData.isRare === true || productData.isRare === 'true';
      productData.isEasyToCare = productData.isEasyToCare === true || productData.isEasyToCare === 'true';
      
      // Создаем товар
      try {
        // Сначала проверим, что в таблице есть все необходимые столбцы
        try {
          const tableInfo = db.query("PRAGMA table_info(products)");
          const columns = tableInfo.map((col: any) => col.name);
          const requiredColumns = [
            'name', 'description', 'price', 'original_price', 'images', 'quantity', 
            'category', 'is_available', 'is_preorder', 'is_rare', 'is_easy_to_care',
            'labels', 'delivery_cost'
          ];
          
          const missingColumns = requiredColumns.filter(col => !columns.includes(col));
          
          if (missingColumns.length > 0) {
            console.error(`В таблице products отсутствуют столбцы: ${missingColumns.join(', ')}`);
            return res.status(500).json({ 
              message: "Структура базы данных не соответствует требуемой. Выполните команду update-db-schema.bat" 
            });
          }
        } catch (err) {
          console.error("Ошибка при проверке структуры таблицы:", err);
        }
      
      // Создаем товар
      const result = db.insert(
        `INSERT INTO products (
          name, description, price, original_price, 
          images, quantity, category, is_available, 
          is_preorder, is_rare, is_easy_to_care, 
          labels, delivery_cost, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productData.name, 
            productData.description || "", 
          productData.price, 
          productData.originalPrice || null, 
            JSON.stringify(productData.images || []), 
          productData.quantity || 0, 
            productData.category || "", 
          productData.isAvailable ? 1 : 0, 
          productData.isPreorder ? 1 : 0, 
          productData.isRare ? 1 : 0, 
          productData.isEasyToCare ? 1 : 0, 
          JSON.stringify(productData.labels || []), 
          productData.deliveryCost || 0,
          new Date().toISOString()
        ]
      );
      
        console.log("Product created successfully with result:", result);
        
        // Получаем созданный товар по его ID
        try {
          console.log("ID нового товара:", result);
          
          // Проверяем, что result - это число
          if (result === undefined || result === null) {
            console.error("Не удалось получить ID созданного товара");
            return res.status(500).json({ message: "Ошибка при создании товара: не получен ID" });
          }
          
          // Сразу получаем товар по ID
          const newProduct = db.queryOne(
        "SELECT * FROM products WHERE id = ?",
            [result]
          );
          
          if (!newProduct) {
            console.error(`Товар с ID ${result} не найден после создания`);
            
            // Пытаемся получить последний добавленный товар
            const lastProduct = db.queryOne(
              "SELECT * FROM products ORDER BY id DESC LIMIT 1"
            );
            
            if (lastProduct) {
              console.log("Найден последний товар:", lastProduct);
              const formattedProduct = formatProductForClient(lastProduct);
              return res.status(201).json(formattedProduct);
            } else {
              return res.status(500).json({ message: "Товар создан, но не удалось получить данные" });
            }
          }
          
          console.log("Новый товар успешно получен:", newProduct);
          
          // Преобразуем строку JSON в массив для images и labels
          const formattedProduct = formatProductForClient(newProduct);
          
          // Отправляем товар клиенту
          res.status(201).json(formattedProduct);
        } catch (queryError) {
          console.error("Ошибка при получении созданного товара:", queryError);
          return res.status(500).json({ message: "Товар создан, но не удалось получить данные" });
        }
      } catch (dbError) {
        console.error("Database error creating product:", dbError);
        return res.status(500).json({ message: "Ошибка базы данных при создании товара" });
      }
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product", error: String(error) });
    }
  });
  
  // Update product
  app.put("/api/products/:id", ensureAdmin, async (req, res) => {
    try {
      const productId = req.params.id;
      const productData = req.body;
      
      console.log("Обновление товара, полученные данные:", productData);
      
      // Изображения должны быть массивом строк
      if (!productData.images) {
        productData.images = [];
      } else if (typeof productData.images === 'string') {
        productData.images = [productData.images];
      }
      
      console.log("Изображения товара:", productData.images);
      
      // Проверяем существование товара
      const existingProduct = db.query(
        "SELECT * FROM products WHERE id = ?",
        [productId]
      );
      
      if (existingProduct.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Обновляем товар
      db.update(
        `UPDATE products SET
          name = ?,
          description = ?,
          price = ?,
          original_price = ?,
          images = ?,
          quantity = ?,
          category = ?,
          is_available = ?,
          is_preorder = ?,
          is_rare = ?,
          is_easy_to_care = ?,
          labels = ?,
          delivery_cost = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          productData.name, 
          productData.description, 
          parseFloat(productData.price), 
          productData.originalPrice ? parseFloat(productData.originalPrice) : null, 
          JSON.stringify(productData.images), 
          parseInt(productData.quantity) || 0, 
          productData.category, 
          productData.isAvailable === true || productData.isAvailable === 'true' ? 1 : 0, 
          productData.isPreorder === true || productData.isPreorder === 'true' ? 1 : 0, 
          productData.isRare === true || productData.isRare === 'true' ? 1 : 0, 
          productData.isEasyToCare === true || productData.isEasyToCare === 'true' ? 1 : 0, 
          JSON.stringify(productData.labels || []), 
          productData.deliveryCost ? parseFloat(productData.deliveryCost) : 0,
          new Date().toISOString(),
          productId
        ]
      );
      
      try {
      // Получаем обновленный товар
        const updatedProduct = db.queryOne(
        "SELECT * FROM products WHERE id = ?",
        [productId]
        );
        
        if (!updatedProduct) {
          return res.status(404).json({ message: "Товар не найден после обновления" });
        }
        
        console.log("Товар успешно обновлен:", updatedProduct);
        
        // Форматируем товар для клиента
        const formattedProduct = formatProductForClient(updatedProduct);
        
        res.json(formattedProduct);
      } catch (queryError) {
        console.error("Ошибка при получении обновленного товара:", queryError);
        return res.status(500).json({ message: "Товар обновлен, но не удалось получить данные" });
      }
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });
  
  // Delete product
  app.delete("/api/products/:id", ensureAdmin, async (req, res) => {
    try {
      const productId = req.params.id;
      
      // Проверяем, что ID является числом
      if (isNaN(parseInt(productId))) {
        return res.status(400).json({ message: "Некорректный ID товара" });
      }
      
      // Проверяем существование товара
      const existingProduct = db.query(
        "SELECT * FROM products WHERE id = ?",
        [productId]
      );
      
      if (existingProduct.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Удаляем товар
      db.delete(
        "DELETE FROM products WHERE id = ?",
        [productId]
      );
      
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });
  
  // Get unique categories
  app.get("/api/categories", async (req, res) => {
    try {
      const products = db.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ''");
      const categories = products.map((product: any) => product.category).filter(Boolean);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  
  // Маршруты для работы с платежными реквизитами
  app.get("/api/payment-details", async (req, res) => {
    try {
      // Получаем платежные реквизиты (берем только первую запись)
      const paymentDetails = db.queryOne("SELECT * FROM payment_details LIMIT 1") as {
        id: number;
        card_number: string;
        card_holder: string;
        bank_name: string;
        qr_code_url: string;
        instructions: string;
        created_at: string;
        updated_at: string;
      } | null;
      
      if (!paymentDetails) {
        return res.status(404).json({ message: "Платежные реквизиты не найдены" });
      }
      
      // Преобразуем в формат, ожидаемый клиентом
      const formattedDetails = {
        id: paymentDetails.id,
        bankDetails: `Номер карты: ${paymentDetails.card_number}
Получатель: ${paymentDetails.card_holder}
Банк: ${paymentDetails.bank_name}

${paymentDetails.instructions}`,
        qrCodeUrl: paymentDetails.qr_code_url,
        updatedAt: paymentDetails.updated_at
      };
      
      res.json(formattedDetails);
    } catch (error) {
      console.error("Error fetching payment details:", error);
      res.status(500).json({ message: "Failed to fetch payment details" });
    }
  });
  
  // Обновление платежных реквизитов
  app.put("/api/payment-details", ensureAdmin, async (req, res) => {
    try {
      console.log("Обновление платежных реквизитов:", req.body);
      const { bankDetails, cardNumber, cardHolder, bankName, instructions } = req.body;
      
      // Получаем текущие реквизиты
      const paymentDetails = db.queryOne("SELECT * FROM payment_details LIMIT 1") as {
        id: number;
        card_number: string;
        card_holder: string;
        bank_name: string;
        instructions: string;
        qr_code_url: string;
      } | null;
      
      // Если пришли данные в формате bankDetails, парсим их
      let cardNum = cardNumber;
      let holder = cardHolder;
      let bank = bankName;
      let instrText = instructions;
      
      if (bankDetails) {
        // Пытаемся извлечь данные из текстового поля bankDetails
        const lines = bankDetails.split('\n');
        const cardLineMatch = lines.find((l: string) => l.includes('Номер карты:'));
        const holderLineMatch = lines.find((l: string) => l.includes('Получатель:'));
        const bankLineMatch = lines.find((l: string) => l.includes('Банк:'));
        
        if (cardLineMatch) {
          cardNum = cardLineMatch.replace('Номер карты:', '').trim();
        }
        
        if (holderLineMatch) {
          holder = holderLineMatch.replace('Получатель:', '').trim();
        }
        
        if (bankLineMatch) {
          bank = bankLineMatch.replace('Банк:', '').trim();
        }
        
        // Извлекаем инструкции (всё, что после пустой строки)
        const emptyLineIndex = lines.findIndex((l: string) => l.trim() === '');
        if (emptyLineIndex !== -1 && emptyLineIndex < lines.length - 1) {
          instrText = lines.slice(emptyLineIndex + 1).join('\n');
        }
      }
      
      if (!paymentDetails) {
        // Создаем новую запись, если не существует
        console.log("Создание новых платежных реквизитов");
        const result = db.run(`
          INSERT INTO payment_details (
            card_number, card_holder, bank_name, instructions, qr_code_url
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          cardNum || '', 
          holder || '', 
          bank || '', 
          instrText || '',
          '/uploads/default-qr.png'
        ]);
        
        const newDetails = db.queryOne("SELECT * FROM payment_details LIMIT 1") as {
          id: number;
          card_number: string;
          card_holder: string;
          bank_name: string;
          qr_code_url: string;
          instructions: string;
        };

        // Преобразуем в формат, ожидаемый клиентом
        const formattedDetails = {
          id: newDetails.id,
          bankDetails: `Номер карты: ${newDetails.card_number}
Получатель: ${newDetails.card_holder}
Банк: ${newDetails.bank_name}

${newDetails.instructions}`,
          qrCodeUrl: newDetails.qr_code_url,
          updatedAt: new Date().toISOString()
        };
        
        return res.json(formattedDetails);
      }
      
      // Обновляем существующую запись
      console.log("Обновление существующих платежных реквизитов с данными:", {
        cardNum, holder, bank, instrText
      });
      
      const updateResult = db.run(`
        UPDATE payment_details SET 
        card_number = ?, 
        card_holder = ?, 
        bank_name = ?, 
        instructions = ?,
        updated_at = ?
        WHERE id = ?
      `, [
        cardNum || paymentDetails.card_number, 
        holder || paymentDetails.card_holder, 
        bank || paymentDetails.bank_name, 
        instrText || paymentDetails.instructions,
        new Date().toISOString(),
        paymentDetails.id
      ]);
      
      console.log("Обновлено записей:", updateResult.changes);
      
      const updatedDetails = db.queryOne("SELECT * FROM payment_details WHERE id = ?", [paymentDetails.id]) as {
        id: number;
        card_number: string;
        card_holder: string;
        bank_name: string;
        qr_code_url: string;
        instructions: string;
        updated_at: string;
      };
      
      // Преобразуем в формат, ожидаемый клиентом
      const formattedDetails = {
        id: updatedDetails.id,
        bankDetails: `Номер карты: ${updatedDetails.card_number}
Получатель: ${updatedDetails.card_holder}
Банк: ${updatedDetails.bank_name}

${updatedDetails.instructions}`,
        qrCodeUrl: updatedDetails.qr_code_url,
        updatedAt: updatedDetails.updated_at || new Date().toISOString()
      };
      
      res.json(formattedDetails);
    } catch (error) {
      console.error("Error updating payment details:", error);
      res.status(500).json({ message: "Failed to update payment details" });
    }
  });
  
  // Загрузка QR-кода для оплаты
  app.post("/api/upload-qr-code", ensureAdmin, upload.single("qrCode"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "QR-код не загружен" });
      }
      
      // Создаем URL к загруженному QR-коду
      const qrCodeUrl = `/uploads/${req.file.filename}`;
      console.log(`QR-код загружен: ${qrCodeUrl}`);
      
      // Обновляем URL QR-кода в базе данных
      const paymentDetails = db.queryOne("SELECT * FROM payment_details LIMIT 1") as {
        id: number;
      } | null;
      
      if (paymentDetails) {
        db.run(
          "UPDATE payment_details SET qr_code_url = ?, updated_at = ? WHERE id = ?",
          [qrCodeUrl, new Date().toISOString(), paymentDetails.id]
        );
      } else {
        // Создаем новую запись, если не существует
        db.run(`
          INSERT INTO payment_details (
            qr_code_url, card_number, card_holder, bank_name, instructions
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          qrCodeUrl, 
          '', 
          '', 
          '', 
          'Для оплаты отсканируйте QR-код или переведите деньги на указанную карту'
        ]);
      }
      
      res.json({ 
        message: "QR-код успешно загружен", 
        qrCodeUrl: qrCodeUrl
      });
    } catch (error) {
      console.error("Ошибка при загрузке QR-кода:", error);
      res.status(500).json({ message: "Ошибка при загрузке QR-кода" });
    }
  });
  
  // Маршруты для работы с настройками
  app.get("/api/settings", async (req, res) => {
    try {
      // Получаем все настройки
      const settings = db.query("SELECT * FROM settings") as Array<{key: string, value: string}>;
      
      // Преобразуем в объект для удобства использования
      const settingsObj: Record<string, string> = {};
      settings.forEach(setting => {
        settingsObj[setting.key] = setting.value;
      });
      
      res.json(settingsObj);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });
  
  // Tawk.to webhook handler
  app.post("/api/tawk-webhook", async (req, res) => {
    try {
      const { event, visitor } = req.body;
      
      // Обрабатываем только события начала чата
      if (event === "chat_started") {
        // Здесь можно добавить дополнительную логику, например:
        // - Сохранение информации о чате в базу данных
        // - Отправку уведомлений администраторам
        // - Логирование и т.д.
        console.log("Chat started with visitor:", visitor);
      }
      
      res.status(200).json({ message: "Webhook received" });
    } catch (error) {
      console.error("Error processing Tawk.to webhook:", error);
      res.status(500).json({ message: "Error processing webhook" });
    }
  });
  
  // Обновление настроек
  app.put("/api/settings", ensureAdmin, async (req, res) => {
    try {
      const updates = req.body;
      
      // Обновляем каждую настройку
      for (const [key, value] of Object.entries(updates)) {
        // Проверяем, существует ли настройка
        const existingSetting = db.queryOne("SELECT * FROM settings WHERE key = ?", [key]);
        
        if (existingSetting) {
          // Обновляем существующую настройку
          db.run(
            "UPDATE settings SET value = ?, updated_at = ? WHERE key = ?",
            [value, new Date().toISOString(), key]
          );
        } else {
          // Создаем новую настройку
          db.run(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            [key, value]
          );
        }
      }
      
      // Получаем обновленные настройки
      const settings = db.query("SELECT * FROM settings") as Array<{key: string, value: string}>;
      
      // Преобразуем в объект для удобства использования
      const settingsObj: Record<string, string> = {};
      settings.forEach(setting => {
        settingsObj[setting.key] = setting.value;
      });
      
      res.json(settingsObj);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
  
  // Минимальный набор маршрутов для тестирования
  app.get('/api/test', (req, res) => {
    res.json({ message: 'SQLite API is working!' });
  });

  // Добавляем маршруты для работы с отзывами
  app.get("/api/reviews", async (req, res) => {
    try {
      const { productId, approved } = req.query;
      
      if (productId) {
        // Получаем отзывы для конкретного товара (только одобренные для публичного доступа)
        const reviews = db.query(
          "SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC",
          [productId]
        ) as Array<{
          id: number;
          user_id: string | number;
          product_id: number;
          rating: number;
          text: string;
          is_approved: number;
          created_at: string;
          images: string;
        }>;
        
        // Форматируем отзывы для клиента
        const formattedReviews = reviews.map(review => ({
          id: review.id,
          userId: review.user_id,
          productId: review.product_id,
          rating: review.rating,
          text: review.text,
          isApproved: !!review.is_approved,
          createdAt: review.created_at,
          images: review.images ? JSON.parse(review.images) : []
        }));
        
        return res.json(formattedReviews);
      }
      
      // Получаем все отзывы (для админки)
      const reviews = db.query("SELECT * FROM reviews ORDER BY created_at DESC") as Array<{
        id: number;
        user_id: string | number;
        product_id: number;
        rating: number;
        text: string;
        is_approved: number;
        created_at: string;
        images: string;
      }>;
      
      // Форматируем отзывы для клиента
      const formattedReviews = reviews.map(review => ({
        id: review.id,
        userId: review.user_id,
        productId: review.product_id,
        rating: review.rating,
        text: review.text,
        isApproved: !!review.is_approved,
        createdAt: review.created_at,
        images: review.images ? JSON.parse(review.images) : []
      }));
      
      res.json(formattedReviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });
  
  // Добавляем маршрут для удаления отзыва
  app.delete("/api/reviews/:id", ensureAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Проверяем, существует ли отзыв
      const review = db.queryOne("SELECT * FROM reviews WHERE id = ?", [id]);
      
      if (!review) {
        return res.status(404).json({ message: "Отзыв не найден" });
      }
      
      // Удаляем отзыв
      db.run("DELETE FROM reviews WHERE id = ?", [id]);
      
      // Возвращаем успех
      return res.status(200).json({ message: "Отзыв успешно удален" });
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ message: "Failed to delete review" });
    }
  });

  // Добавляем маршрут для редактирования отзыва (admin)
  app.put("/api/reviews/:id", ensureAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isApproved } = req.body;
      
      // Проверяем, существует ли отзыв
      const review = db.queryOne("SELECT * FROM reviews WHERE id = ?", [id]) as {
        id: number;
        user_id: string | number;
        product_id: number;
        rating: number;
        text: string;
        is_approved: number;
        created_at: string;
        updated_at?: string;
        images?: string;
      } | null;
      
      if (!review) {
        return res.status(404).json({ message: "Отзыв не найден" });
      }
      
      console.log(`Обновление статуса отзыва #${id}: isApproved=${isApproved}`);
      
      // Обновляем статус отзыва
      db.run(
        "UPDATE reviews SET is_approved = ?, updated_at = ? WHERE id = ?",
        [isApproved ? 1 : 0, new Date().toISOString(), id]
      );
      
      // Получаем обновленный отзыв
      const updatedReview = db.queryOne("SELECT * FROM reviews WHERE id = ?", [id]) as {
        id: number;
        user_id: string | number;
        product_id: number;
        rating: number;
        text: string;
        is_approved: number;
        created_at: string;
        updated_at?: string;
        images?: string;
      };
      
      if (!updatedReview) {
        return res.status(404).json({ message: "Не удалось найти обновленный отзыв" });
      }
      
      console.log(`Отзыв #${id} обновлен. Новый статус: ${updatedReview.is_approved === 1 ? 'Одобрен' : 'Не одобрен'}`);
      
      // Форматируем отзыв для ответа
      const formattedReview = {
        id: updatedReview.id,
        userId: updatedReview.user_id,
        productId: updatedReview.product_id,
        rating: updatedReview.rating,
        text: updatedReview.text,
        images: updatedReview.images ? JSON.parse(updatedReview.images) : [],
        isApproved: updatedReview.is_approved === 1,
        createdAt: updatedReview.created_at,
        updatedAt: updatedReview.updated_at
      };
      
      res.json({
        message: isApproved ? "Отзыв успешно опубликован" : "Статус отзыва успешно обновлен",
        review: formattedReview
      });
    } catch (error) {
      console.error("Ошибка при обновлении отзыва:", error);
      res.status(500).json({ message: "Ошибка при обновлении отзыва" });
    }
  });

  // Добавляем маршрут для создания отзыва
  app.post("/api/reviews", ensureAuthenticated, async (req, res) => {
    try {
      const { productId, rating, text, images = [] } = req.body;
      
      // Проверяем, что пользователь авторизован
      if (!req.user) {
        return res.status(401).json({ message: "Необходима авторизация" });
      }
      
      // Проверка базовых данных
      if (!productId || !rating || !text) {
        return res.status(400).json({ message: "Не указаны обязательные поля" });
      }
      
      // Создаем отзыв
      const result = db.insert(
        `INSERT INTO reviews (
          user_id, product_id, rating, text, images, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          productId,
          rating,
          text,
          JSON.stringify(images || []),
          new Date().toISOString()
        ]
      );
      
      // Получаем созданный отзыв
      const review = db.queryOne(
        "SELECT * FROM reviews WHERE id = ?",
        [result]
      ) as {
        id: number;
        user_id: string | number;
        product_id: number;
        rating: number;
        text: string;
        is_approved: number;
        created_at: string;
        images: string;
      };
      
      // Форматируем отзыв для клиента
      const formattedReview = {
        id: review.id,
        userId: review.user_id,
        productId: review.product_id,
        rating: review.rating,
        text: review.text,
        isApproved: !!review.is_approved,
        createdAt: review.created_at,
        images: review.images ? JSON.parse(review.images) : []
      };
      
      res.status(201).json(formattedReview);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // User routes
  app.get("/api/users", ensureAdmin, async (req, res) => {
    try {
      // Получаем всех пользователей из базы данных с актуальными полями
      const users = db.query("SELECT id, username, email, full_name, phone, address, is_admin, balance, created_at FROM users") as Array<UserRecord>;
      
      console.log(`[DEBUG] Fetched ${users.length} users from database.`);
      
      // Форматируем пользователей и удаляем пароли (пароли уже не выбираются)
      const formattedUsers = users.map(user => ({
        id: user.id,
        username: user.username || user.email, // Использовать username или email как fallback
        email: user.email,
        fullName: user.full_name || '', // Использовать full_name напрямую
        phone: user.phone || '',
        address: user.address || '',
        isAdmin: !!user.is_admin,
        balance: user.balance || '0',
        createdAt: user.created_at
      }));
      
      res.json(formattedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Маршрут для начисления баланса пользователю
  app.post("/api/users/:id/add-balance", ensureAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { amount } = req.body;
      
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Некорректная сумма для начисления" });
      }
      
      // Проверяем, существует ли пользователь
      const user = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]) as UserRecord | null;
      
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      // Вычисляем новый баланс
      const currentBalance = user.balance ? parseFloat(user.balance) : 0;
      const newBalance = (currentBalance + parseFloat(amount)).toString();
      
      // Обновляем баланс пользователя
      db.run(
        "UPDATE users SET balance = ?, updated_at = ? WHERE id = ?",
        [newBalance, new Date().toISOString(), userId]
      );
      
      // Получаем обновленного пользователя
      const updatedUser = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]) as UserRecord;
      
      // Форматируем пользователя и удаляем пароль
      const formattedUser = {
        id: updatedUser.id,
        username: updatedUser.username || updatedUser.email,
        email: updatedUser.email,
        fullName: updatedUser.full_name || '',
        phone: updatedUser.phone || '',
        address: updatedUser.address || '',
        isAdmin: !!updatedUser.is_admin,
        balance: updatedUser.balance || '0',
        createdAt: updatedUser.created_at
      };
      
      res.json(formattedUser);
    } catch (error) {
      console.error("Error adding balance:", error);
      res.status(500).json({ message: "Failed to add balance" });
    }
  });

  // Маршрут для экспорта статистики в Excel
  app.get("/api/export/statistics", ensureAdmin, async (req, res) => {
    try {
      // Получаем статистику из базы данных
      const users = db.query("SELECT * FROM users") as Array<any>;
      const products = db.query("SELECT * FROM products") as Array<any>;
      const orders = db.query("SELECT * FROM orders") as Array<any>;
      
      // Генерируем CSV для статистики
      const csvContent = generateStatisticsCSV(users, products, orders);
      
      // Добавляем BOM для правильного отображения кириллицы
      const BOM = '\uFEFF';
      const csvContentWithBOM = BOM + csvContent;
      
      // Отправляем CSV файл
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="statistics.csv"');
      res.send(csvContentWithBOM);
    } catch (error) {
      console.error("Error exporting statistics:", error);
      res.status(500).json({ message: "Failed to export statistics" });
    }
  });

  // Маршрут для экспорта пользователей в Excel
  app.get("/api/export/users", ensureAdmin, async (req, res) => {
    try {
      // Получаем всех пользователей
      const users = db.query("SELECT * FROM users") as Array<{
        id: string;
        username: string;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        address: string | null;
        is_admin: number;
        balance: string | null;
        created_at: string;
      }>;
      
      // Генерируем CSV для пользователей
      const csvContent = generateUsersCSV(users);
      
      // Добавляем BOM для правильного отображения кириллицы
      const BOM = '\uFEFF';
      const csvContentWithBOM = BOM + csvContent;
      
      // Отправляем CSV файл
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      res.send(csvContentWithBOM);
    } catch (error) {
      console.error("Error exporting users:", error);
      res.status(500).json({ message: "Failed to export users" });
    }
  });

  // Маршрут для экспорта товаров в Excel
  app.get("/api/export/products", ensureAdmin, async (req, res) => {
    try {
      // Получаем все товары
      const products = db.query("SELECT * FROM products") as Array<{
        id: number;
        name: string;
        description: string;
        price: number;
        original_price: number | null;
        quantity: number;
        category: string;
        is_available: number;
        is_preorder: number;
        is_rare: number;
        is_easy_to_care: number;
        created_at: string;
      }>;
      
      // Генерируем CSV для товаров
      const csvContent = generateProductsCSV(products);
      
      // Добавляем BOM для правильного отображения кириллицы
      const BOM = '\uFEFF';
      const csvContentWithBOM = BOM + csvContent;
      
      // Отправляем CSV файл
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
      res.send(csvContentWithBOM);
    } catch (error) {
      console.error("Error exporting products:", error);
      res.status(500).json({ message: "Failed to export products" });
    }
  });

  // Маршрут для экспорта заказов в Excel
  app.get("/api/export/orders", ensureAdmin, async (req, res) => {
    try {
      // Получаем все заказы
      const orders = db.query("SELECT * FROM orders ORDER BY created_at DESC") as Array<{
        id: number;
        user_id: string;
        items: string;
        total_amount: string;
        delivery_amount: string;
        full_name: string;
        phone: string;
        address: string;
        delivery_type: string;
        payment_method: string;
        payment_status: string;
        order_status: string;
        created_at: string;
      }>;
      
      // Генерируем CSV для заказов
      const csvContent = generateOrdersCSV(orders);
      
      // Добавляем BOM для правильного отображения кириллицы
      const BOM = '\uFEFF';
      const csvContentWithBOM = BOM + csvContent;
      
      // Отправляем CSV файл
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
      res.send(csvContentWithBOM);
    } catch (error) {
      console.error("Error exporting orders:", error);
      res.status(500).json({ message: "Failed to export orders" });
    }
  });

  // Helper function для форматирования заказа
  function formatOrderForClient(order: any) {
    if (!order) return null;
    
    // Преобразуем JSON строку items в массив объектов
    let items;
    try {
      if (typeof order.items === 'string') {
        items = JSON.parse(order.items);
      } else if (Array.isArray(order.items)) {
        items = order.items;
      } else {
        items = [];
      }
    } catch (e) {
      console.error("Ошибка при парсинге списка товаров:", e);
      items = [];
    }

    // Вычисляем сумму товаров без доставки
    const itemsTotal = items.reduce((sum: number, item: any) => {
      const price = parseFloat(String(item.price || 0));
      const quantity = parseInt(String(item.quantity || 1));
      return sum + (price * quantity);
    }, 0);

    // Вычисляем скидку только от суммы товаров
    let promoCodeDiscount = null;
    if (order.promo_code_discount) {
      const discount = parseFloat(String(order.promo_code_discount));
      // Если скидка больше суммы товаров, ограничиваем её
      promoCodeDiscount = Math.min(discount, itemsTotal);
    }

    // Форматируем заказ для клиента
    return {
      id: order.id,
      userId: order.user_id || order.userId,
      items: items,
      itemsTotal: itemsTotal.toString(), // Добавляем сумму товаров без доставки
      totalAmount: order.total_amount,
      deliveryAmount: order.delivery_amount || order.deliveryAmount || "0",
      promoCode: order.promo_code || null,
      promoCodeDiscount: promoCodeDiscount ? promoCodeDiscount.toString() : null,
      fullName: order.full_name || order.fullName || "",
      address: order.address || "",
      phone: order.phone || "",
      socialNetwork: order.social_network || order.socialNetwork || null,
      socialUsername: order.social_username || order.socialUsername || null,
      comment: order.comment || "",
      deliveryType: order.delivery_type || order.deliveryType || "cdek",
      deliverySpeed: order.delivery_speed || order.deliverySpeed || 'standard',
      needInsulation: order.need_insulation === 1 || order.needInsulation === true,
      paymentMethod: order.payment_method || order.paymentMethod || "card",
      paymentStatus: order.payment_status || order.paymentStatus || "pending",
      orderStatus: order.order_status || order.orderStatus || "pending",
      paymentProofUrl: order.payment_proof_url ? 
        (order.payment_proof_url.startsWith('http') ? order.payment_proof_url : `${process.env.PUBLIC_URL || ''}${order.payment_proof_url}`) : 
        null,
      adminComment: order.admin_comment || order.adminComment || "",
      trackingNumber: order.tracking_number || order.trackingNumber || null,
      estimatedDeliveryDate: order.estimated_delivery_date || order.estimatedDeliveryDate || null,
      actualDeliveryDate: order.actual_delivery_date || order.actualDeliveryDate || null,
      lastStatusChangeAt: order.last_status_change_at || order.lastStatusChangeAt || null,
      statusHistory: order.status_history || order.statusHistory || null,
      createdAt: order.created_at || order.createdAt || new Date().toISOString(),
      updatedAt: order.updated_at || order.updatedAt || null
    };
  }

  // Маршрут для обработки загрузки подтверждения оплаты
  app.post("/api/orders/:id/payment-proof", ensureAuthenticated, upload.single("proof"), async (req, res) => {
    try {
      if (!req.file) {
        console.error("[PAYMENT] Ошибка загрузки чека: файл не найден");
        return res.status(400).json({ message: "Файл не найден" });
      }
      
      const id = parseInt(req.params.id);
      const orderId = id.toString();
      
      console.log(`[PAYMENT] Загрузка чека для заказа ID=${orderId}, файл: ${req.file.filename}`);
      console.log(`[PAYMENT] Полный путь к файлу: ${path.resolve(req.file.path)}`);
      
      // Проверяем существование заказа
      const order = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
      if (!order) {
        console.error(`[PAYMENT] Заказ с ID=${orderId} не найден`);
        return res.status(404).json({ message: "Заказ не найден" });
      }
      
      // Формируем путь для доступа к файлу - сделаем его относительно корня сайта
      const relativePath = `/uploads/${req.file.filename}`;
      console.log(`[PAYMENT] Относительный путь для веб-доступа: ${relativePath}`);
      
      // Обновляем запись в базе данных
      db.run(
        "UPDATE orders SET payment_proof_url = ?, payment_status = ?, updated_at = ? WHERE id = ?",
        [relativePath, "pending_verification", new Date().toISOString(), orderId]
      );
      
      console.log(`[PAYMENT] Информация о чеке сохранена для заказа #${orderId}`);
      
      // Получаем обновленный заказ
      const updatedOrder = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
      
      // Возвращаем успешный результат с данными заказа
      return res.status(200).json({
        success: true,
        message: "Чек успешно загружен",
        order: updatedOrder
      });
    } catch (error) {
      console.error("[PAYMENT] Ошибка загрузки чека:", error);
      return res.status(500).json({ 
        success: false,
        message: "Произошла ошибка при загрузке чека",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Новый маршрут для финализации заказа после загрузки чека
  app.post("/api/orders/:id/complete", ensureAuthenticated, async (req, res) => {
    try {
      const orderId = req.params.id;
      
      // Получаем заказ из БД с явной типизацией
      const order = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]) as Record<string, any> | null;
      
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }
      
      // Проверяем доступ пользователя к этому заказу
      const user = req.user as any;
      if (!user.isAdmin && order.user_id !== user.id && order.user_id !== String(user.id)) {
        return res.status(403).json({ message: "Доступ запрещен" });
      }
      
      // Если чек уже загружен, меняем статус на "завершен"
      if (order.payment_proof_url) {
        db.run(
          `UPDATE orders SET 
           payment_status = ?, 
           order_status = ?, 
           updated_at = ? 
           WHERE id = ?`,
          ["verification", "pending", new Date().toISOString(), orderId]
        );
        
        // Возвращаем обновленный заказ
        const updatedOrder = db.queryOne(`SELECT * FROM orders WHERE id = ?`, [orderId]);
        const formattedOrder = formatOrderForClient(updatedOrder);
        
        return res.json({
          success: true,
          message: "Заказ успешно завершен и ожидает проверки оплаты",
          order: formattedOrder
        });
      } else {
        return res.status(400).json({ message: "Отсутствует подтверждение оплаты" });
      }
    } catch (error) {
      console.error("Error completing order:", error);
      res.status(500).json({ message: "Ошибка при завершении заказа" });
    }
  });

  // Type definitions for order creation
  interface CreateOrderRequest {
    userId: number;
    items: Array<{
      id: number;
      quantity: number;
    }>;
    deliveryAmount: number;
    fullName: string;
    address: string;
    phone: string;
    socialNetwork?: string;
    socialUsername?: string;
    comment?: string;
    needInsulation: boolean;
    deliveryType: string;
    deliverySpeed?: string;
    paymentMethod: string;
    paymentProof?: string;
    promoCode?: string;
  }

  // Type definitions for database queries
  interface ProductQuery {
    id: number;
    name: string;
    price: number;
    quantity: number;
    images?: string;
    [key: string]: any;
  }

  interface PromoCodeQuery {
    id: number;
    code: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount: number | null;
    start_date: string;
    end_date: string;
    max_uses: number | null;
    current_uses: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  // POST /api/orders - Create new order
  app.post("/api/orders", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as Express.User;
      const orderData = req.body as CreateOrderRequest;
      
      console.log("Received order data:", orderData);
      
      // Ensure userId matches authenticated user or admin
      if (String(user.id) !== String(orderData.userId) && !user.isAdmin) {
        return res.status(403).json({ message: "Нельзя создать заказ от имени другого пользователя" });
      }
      
      // Validate required fields
      if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
        return res.status(400).json({ message: "Корзина пуста или имеет неверный формат" });
      }
      
      // Изменена проверка, чтобы пропускать 0 как валидное значение доставки
      if (orderData.deliveryAmount === undefined || orderData.deliveryAmount === null || typeof orderData.deliveryAmount !== 'number') {
        return res.status(400).json({ message: "Не указана стоимость доставки" });
      }

      // Validate and calculate items total
      let itemsTotal = 0;
      for (const item of orderData.items) {
        const product = db.queryOne(
          "SELECT * FROM products WHERE id = ?",
          [item.id]
        ) as ProductQuery | null;
        
        if (!product) {
          return res.status(400).json({ 
            message: `Товар с ID ${item.id} не найден` 
          });
        }
        
        if (product.quantity < item.quantity) {
          return res.status(400).json({ 
            message: `Недостаточное количество товара "${product.name}" в наличии (доступно: ${product.quantity})` 
          });
        }

        itemsTotal += product.price * item.quantity;
      }

      // Validate and calculate promo code discount
      let promoCodeDiscount = null;
      if (orderData.promoCode) {
        const promoCode = db.queryOne(
          `SELECT * FROM promo_codes 
           WHERE code = ? 
           AND is_active = 1 
           AND (start_date <= datetime('now') AND end_date >= datetime('now'))
           AND (max_uses IS NULL OR current_uses < max_uses)`,
          [orderData.promoCode.toUpperCase()]
        ) as PromoCodeQuery | null;

        if (promoCode) {
          // Check minimum order amount
          if (promoCode.min_order_amount && itemsTotal < promoCode.min_order_amount) {
            return res.status(400).json({ 
              message: `Минимальная сумма заказа для применения промокода: ${promoCode.min_order_amount} ₽` 
            });
          }

          // Calculate discount
          if (promoCode.discount_type === 'percentage') {
            promoCodeDiscount = Math.round(itemsTotal * (promoCode.discount_value / 100));
          } else {
            promoCodeDiscount = promoCode.discount_value;
          }

          // Ensure discount doesn't exceed order total
          promoCodeDiscount = Math.min(promoCodeDiscount, itemsTotal);
        } else {
          return res.status(400).json({ message: "Недействительный промокод" });
        }
      }

      // Calculate final total
      const totalAmount = itemsTotal - (promoCodeDiscount || 0) + orderData.deliveryAmount;

      // Prepare order data for saving
      const orderToSave = {
        user_id: orderData.userId,
        // Save full item details including name and price
        items: JSON.stringify(orderData.items.map((item: { id: number, quantity: number }) => {
          const product = db.queryOne("SELECT id, name, price FROM products WHERE id = ?", [item.id]) as ProductQuery | null;
          return {
            id: item.id,
            name: product?.name || "Unknown Product", // Use product name or fallback
            price: product?.price || 0, // Use product price or fallback
            quantity: item.quantity,
          };
        })),
        total_amount: totalAmount,
        delivery_amount: orderData.deliveryAmount,
        full_name: orderData.fullName,
        address: orderData.address,
        phone: orderData.phone,
        social_network: orderData.socialNetwork || null,
        social_username: orderData.socialUsername || null,
        comment: orderData.comment || null,
        need_insulation: orderData.needInsulation ? 1 : 0,
        delivery_type: orderData.deliveryType,
        delivery_speed: orderData.deliverySpeed || null,
        payment_method: orderData.paymentMethod,
        payment_status: orderData.paymentMethod === "balance" ? "completed" : "pending",
        order_status: orderData.paymentMethod === "balance" ? "processing" : "pending",
        payment_proof_url: orderData.paymentProof || null,
        admin_comment: null,
        promo_code: orderData.promoCode || null,
        promo_code_discount: promoCodeDiscount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Start transaction
      db.exec("BEGIN TRANSACTION");

      try {
        // Save order
      const result = db.run(
        `INSERT INTO orders (
          user_id, items, total_amount, delivery_amount, full_name, 
          address, phone, social_network, social_username, comment,
          need_insulation, delivery_type, delivery_speed,
          payment_method, payment_status, order_status,
          payment_proof_url, admin_comment, promo_code, promo_code_discount,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderToSave.user_id,
          orderToSave.items,
          orderToSave.total_amount,
          orderToSave.delivery_amount,
          orderToSave.full_name,
          orderToSave.address,
          orderToSave.phone,
          orderToSave.social_network,
          orderToSave.social_username,
          orderToSave.comment,
          orderToSave.need_insulation,
          orderToSave.delivery_type,
          orderToSave.delivery_speed,
          orderToSave.payment_method,
          orderToSave.payment_status,
          orderToSave.order_status,
          orderToSave.payment_proof_url,
          orderToSave.admin_comment,
          orderToSave.promo_code,
          orderToSave.promo_code_discount,
          orderToSave.created_at,
          orderToSave.updated_at
        ]
      );
      
      const orderId = result.lastInsertRowid;

        // Update promo code usage if applicable
        if (orderData.promoCode) {
          db.run(
            `UPDATE promo_codes 
             SET current_uses = current_uses + 1 
             WHERE code = ?`,
            [orderData.promoCode.toUpperCase()]
          );

          db.run(
            `INSERT INTO promo_code_uses (promo_code_id, user_id, order_id, discount_amount, used_at)
             SELECT id, ?, ?, ?, datetime('now')
             FROM promo_codes WHERE code = ?`,
            [orderData.userId, orderId, promoCodeDiscount, orderData.promoCode.toUpperCase()]
          );
        }

        // If payment is completed (balance or proof provided), reduce product quantities
        if (orderData.paymentMethod === "balance" || orderData.paymentProof) {
        for (const item of orderData.items) {
            db.run(
              `UPDATE products 
               SET quantity = quantity - ? 
               WHERE id = ?`,
              [item.quantity, item.id]
            );
          }

          // Mark order as having reduced quantities
            db.run(
            `UPDATE orders 
             SET product_quantities_reduced = 1 
             WHERE id = ?`,
            [orderId]
          );
        }

        // Commit transaction
        db.exec("COMMIT");

        // Get created order
        const createdOrder = db.queryOne(
          "SELECT * FROM orders WHERE id = ?",
          [orderId]
        ) as Order | null;

        if (!createdOrder) {
          throw new Error("Заказ не найден после создания");
        }

        res.status(201).json(formatOrderForClient(createdOrder));
      } catch (error) {
        // Rollback transaction on error
        db.exec("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Ошибка при создании заказа" });
    }
  });

  // Получение всех заказов (для админки)
  app.get("/api/orders", ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      let orders: Record<string, any>[];

      // TypeScript type assertion for user
      const user = req.user as Express.User;

      if (user.isAdmin) {
        // Admin gets all orders
        orders = db.query("SELECT * FROM orders ORDER BY created_at DESC") as Record<string, any>[];
      } else {
        // Regular users get only their orders
        orders = db.query("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [user.id]) as Record<string, any>[];
      }

      // Enrich orders with product information and format for client
      const formattedOrders = await Promise.all(orders.map(async (order) => {
        try {
          // Use formatOrderForClient to handle initial formatting and JSON parsing
          const formatted = formatOrderForClient(order);

          // If formatting failed, return the basic order
          if (!formatted) {
            return order; // Or handle appropriately, e.g., return null or error indicator
          }

          // Enrich items within the formatted order if needed
          const items = formatted.items || [];

          const enrichedItems = await Promise.all(items.map(async (item: any) => {
            // Check if product details are already present (added by formatOrderForClient)
            if (!item.productName || !item.productImage || item.price === undefined) {
               const product = db.queryOne("SELECT id, name, images, price FROM products WHERE id = ?", [item.id]) as {
                id: number;
                name: string;
                images: string;
                price: number;
                [key: string]: any;
              } | null;

              if (product) {
                const productImages = product.images ? JSON.parse(product.images) : [];
                const imageUrl = productImages && productImages.length > 0 ? productImages[0] : null;

                return {
                  ...item,
                  productName: item.productName || product.name, // Use existing or product name
                  productImage: item.productImage || imageUrl, // Use existing or product image
                  price: item.price !== undefined ? item.price : product.price // Use item price if defined, otherwise product price
                };
              }
            }
            return item; // Return item as is if product not found or already enriched
          }));

          return {
            ...formatted,
            items: enrichedItems // Use enriched items in the final formatted object
          };

        } catch (error) {
          console.error(`Ошибка при обработке заказа #${order.id} для списка:`, error);
          return formatOrderForClient(order); // Return basic formatted order on error
        }
      }));

      res.json(formattedOrders);
    } catch (error) {
      console.error("Ошибка при получении списка заказов:", error);
      res.status(500).json({ message: "Ошибка при получении списка заказов" });
    }
  });
  
  // Получение конкретного заказа
  app.get("/api/orders/:id", ensureAuthenticated, async (req, res) => {
    try {
      const orderId = req.params.id;
      
      // TypeScript type assertion for user
      const user = req.user as Express.User;
      
      let order: Record<string, any> | null;
      
      if (user.isAdmin) {
        // Admin can view any order
        order = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]) as Record<string, any> | null;
      } else {
        // Users can only view their own orders
        order = db.queryOne("SELECT * FROM orders WHERE id = ? AND user_id = ?", [orderId, user.id]) as Record<string, any> | null;
      }
      
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }
      
      console.log(`[DEBUG] GET /api/orders/${orderId} - Order fetched from DB:`, order);

      // Parse and enrich items
      try {
        const items = JSON.parse(order.items || "[]");
        
        // Enrich each item with product details
        const enrichedItems = await Promise.all(items.map(async (item: any) => {
          // Получаем данные о товаре из базы данных
          const product = db.queryOne("SELECT * FROM products WHERE id = ?", [item.id]) as {
            id: number;
            name: string;
            images: string;
            price: number;
            [key: string]: any;
          } | null;
          
          if (product) {
            const productImages = product.images ? JSON.parse(product.images) : [];
            const imageUrl = productImages && productImages.length > 0 ? productImages[0] : null;
            
            // Сохраняем данные о товаре в заказе
            return {
              ...item,
              productName: product.name,
              productImage: imageUrl,
              price: item.price || product.price
            };
          }
          return item;
        }));
        
        // Обновляем items в заказе
        order.items = enrichedItems;
      } catch (error) {
        console.error(`Error processing order ${order.id} items:`, error);
      }

      console.log(`[DEBUG] GET /api/orders/${orderId} - Returning order data:`, order);

      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Ошибка при получении данных заказа" });
    }
  });

  // Маршрут для обновления данных заказа
  app.put("/api/orders/:id", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
      const orderId = req.params.id;
      const { orderStatus, adminComment, trackingNumber, estimatedDeliveryDate } = req.body;
      
      console.log(`[ORDERS] Запрос на обновление статуса заказа #${orderId}:`, req.body);
      
      // Получаем текущий заказ
      const orderQuery = "SELECT * FROM orders WHERE id = ?";
      const currentOrder = db.queryOne(orderQuery, [orderId]) as Record<string, any>;
      
      if (!currentOrder) {
        return res.status(404).json({ message: "Заказ не найден" });
      }
      
      const prevStatus = currentOrder.order_status || 'unknown';
      console.log(`[ORDERS] Текущий статус заказа #${orderId}: ${prevStatus}`);
      
      // Формируем полный объект обновления с типизацией
      const updateData: Record<string, any> = {};
      
      // Обновляем статус если он передан
      if (orderStatus) {
        updateData.order_status = orderStatus;
        console.log(`[ORDERS] Новый статус заказа: ${orderStatus}`);
      }
      
      // Обновляем комментарий если он передан
      if (adminComment !== undefined) {
        updateData.admin_comment = adminComment;
        console.log(`[ORDERS] Обновлен комментарий админа`);
      }

      // Обновляем трек-номер если он передан
      if (trackingNumber !== undefined) {
        updateData.tracking_number = trackingNumber;
        console.log(`[ORDERS] Обновлен трек-номер: ${trackingNumber}`);
      }

      // Обновляем дату доставки если она передана
      if (estimatedDeliveryDate !== undefined) {
        updateData.estimated_delivery_date = estimatedDeliveryDate;
        console.log(`[ORDERS] Обновлена дата доставки: ${estimatedDeliveryDate}`);
      }
      
      // Добавляем дату обновления
      updateData.updated_at = new Date().toISOString();
      
      // Формируем SQL запрос и параметры
      const fields = Object.keys(updateData).map(key => `${key} = ?`).join(", ");
      const values = Object.values(updateData);
      values.push(orderId); // Добавляем ID для WHERE
      
      // Выполняем запрос на обновление
      db.run(`UPDATE orders SET ${fields} WHERE id = ?`, values);
      
      // Если заказ переходит в статус "оплачен" или "в обработке", уменьшаем количество товаров
      if (orderStatus && 
          (orderStatus === "paid" || orderStatus === "processing") &&
          prevStatus !== "paid" && 
          prevStatus !== "processing") {
        
        console.log(`[ORDERS] Заказ #${orderId} переходит в статус ${orderStatus}, требуется списание товаров`);
        
        try {
          // Получаем товары из заказа
          let items = [];
          
          try {
            // Безопасный парсинг JSON
            const itemsData = String(currentOrder?.items || "[]").trim();
            
            if (itemsData) {
              // Проверяем, является ли строка уже массивом (не строкой JSON)
              if (Array.isArray(currentOrder?.items)) {
                console.log(`[ORDERS] Данные товаров уже являются массивом`);
                items = currentOrder.items;
              } else {
                // Пробуем распарсить JSON
                try {
                  items = JSON.parse(itemsData);
                  
                  // Проверяем, что результат - массив
                  if (!Array.isArray(items)) {
                    console.error(`[ORDERS] Данные товаров после парсинга не являются массивом:`, items);
                    items = [];
                  }
                } catch (parseError) {
                  console.error(`[ORDERS] Ошибка при парсинге товаров:`, parseError, "Данные:", itemsData);
                  
                  // Дополнительная проверка на случай двойного экранирования JSON
                  if (itemsData.startsWith('"[') && itemsData.endsWith(']"')) {
                    try {
                      const unescaped = JSON.parse(itemsData);
                      items = JSON.parse(unescaped);
                      console.log(`[ORDERS] Успешно распарсены вложенные JSON-данные товаров`);
                    } catch (nestedError) {
                      console.error(`[ORDERS] Ошибка при парсинге вложенного JSON:`, nestedError);
                      items = [];
                    }
                  } else {
                    items = [];
                  }
                }
              }
            }
            
            console.log(`[ORDERS] Получены данные товаров:`, items.length > 0 ? `${items.length} позиций` : "нет товаров");
          } catch (error) {
            console.error(`[ORDERS] Критическая ошибка при обработке товаров:`, error);
            items = [];
          }
          
          // Вызываем функцию для списания товаров
          if (items.length > 0) {
            updateProductQuantities(orderId, items);
          } else {
            console.warn(`[ORDERS] Нет товаров для списания в заказе #${orderId}`);
          }
        } catch (error) {
          console.error(`[ORDERS] Ошибка при обработке списания товаров:`, error);
        }
      }
      
      // Получаем обновленный заказ
      const updatedOrder = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
      
      // Отправляем успешный ответ
      return res.status(200).json({
        success: true,
        message: "Заказ успешно обновлен",
        order: updatedOrder
      });
    } catch (error) {
      console.error(`[ORDERS] Ошибка при обновлении заказа:`, error);
      return res.status(500).json({ 
        success: false,
        message: "Произошла ошибка при обновлении заказа",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Маршрут для удаления заказа
  app.delete("/api/orders/:id", ensureAuthenticated, ensureAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const orderId = req.params.id;
      
      // Начинаем транзакцию
      db.exec("BEGIN TRANSACTION");
      
      try {
        // Проверяем наличие заказа
        const orderResult = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]) as Order | null;
        if (!orderResult) {
          db.exec("ROLLBACK");
          res.status(404).json({ message: `Заказ #${orderId} не найден` });
          return;
        }

        const order = orderResult as Order;

        // Если заказ использовал промокод, удаляем запись об использовании
        if (order.promo_code) {
          db.run(
            "DELETE FROM promo_code_uses WHERE order_id = ?",
            [orderId]
          );
          
          // Уменьшаем счетчик использований промокода
          db.run(
            "UPDATE promo_codes SET current_uses = current_uses - 1 WHERE code = ?",
            [order.promo_code]
          );
        }

        // Если товары были списаны, возвращаем их количество
        if (order.product_quantities_reduced) {
          try {
            const items = JSON.parse(order.items || "[]");
            for (const item of items) {
              if (item.id && item.quantity) {
                db.run(
                  "UPDATE products SET quantity = quantity + ? WHERE id = ?",
                  [item.quantity, item.id]
                );
              }
            }
          } catch (parseError) {
            console.error("Ошибка при возврате товаров:", parseError);
            // Продолжаем удаление заказа даже при ошибке возврата товаров
          }
        }

        // Удаляем заказ
        db.run("DELETE FROM orders WHERE id = ?", [orderId]);
        
        // Подтверждаем транзакцию
        db.exec("COMMIT");
        
        console.log(`Заказ #${orderId} успешно удален`);
        res.json({ success: true, message: `Заказ #${orderId} успешно удален` });
      } catch (transactionError) {
        // В случае ошибки откатываем транзакцию
        db.exec("ROLLBACK");
        throw transactionError;
      }
    } catch (error) {
      console.error("Ошибка при удалении заказа:", error);
      res.status(500).json({ 
        success: false,
        message: "Ошибка при удалении заказа",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Обновление пользователя
  app.put("/api/users/:id", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = req.user as Express.User;
      
      console.log(`[DEBUG] PUT /api/users/${userId} - Incoming body:`, req.body);
      
      // Проверка прав доступа: только админы или сам пользователь могут обновлять профиль
      const isOwnProfile = String(user.id) === String(userId);
      if (!isOwnProfile && !user.isAdmin) {
        return res.status(403).json({ message: "Доступ запрещен" });
      }
      
      // Получаем текущие данные пользователя
      const existingUser = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]) as UserRecord | null;
      if (!existingUser) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      // Формируем SQL запрос для обновления
      const updateFields = [];
      const updateValues = [];
      
      // Обрабатываем разные поля
      if (req.body.email && req.body.email !== existingUser.email) {
        // Проверка на уникальность email
        const emailExists = db.queryOne("SELECT * FROM users WHERE email = ? AND id != ?", [
          req.body.email.toLowerCase(), userId
        ]);
        
        if (emailExists) {
          return res.status(400).json({ message: "Email уже используется другим пользователем" });
        }
        
        updateFields.push("email = ?");
        updateValues.push(req.body.email.toLowerCase());
      }
      
      // Обновляем все поля, даже если они пустые
      updateFields.push("full_name = ?");
      updateValues.push(req.body.fullName || '');
      
      updateFields.push("phone = ?");
      updateValues.push(req.body.phone || '');
      
      updateFields.push("address = ?");
      updateValues.push(req.body.address || '');
      
      updateFields.push("username = ?");
      updateValues.push(req.body.username || req.body.email || existingUser.email);
      
      // Обработка поля is_admin (только для администраторов)
      if (user.isAdmin && req.body.isAdmin !== undefined) {
        updateFields.push("is_admin = ?");
        updateValues.push(req.body.isAdmin ? 1 : 0);
      }
      
      // Добавляем обновление даты
      updateFields.push("updated_at = ?");
      updateValues.push(new Date().toISOString());
      
      // ID пользователя для WHERE
      updateValues.push(userId);
      
      // Выполняем обновление
      const updateQuery = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
      console.log("[DEBUG] PUT /api/users/:id - Update query:", updateQuery);
      console.log("[DEBUG] PUT /api/users/:id - Update values:", updateValues);
      
      const updateResult = db.run(updateQuery, updateValues);
      console.log("[DEBUG] PUT /api/users/:id - Update result:", updateResult);
      
      // Получаем обновленного пользователя
      const updatedUser = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]) as UserRecord;
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Пользователь не найден после обновления" });
      }
      
      // Форматируем пользователя для ответа и сессии
      const formattedUser = userRecordToSessionUser(updatedUser);
      
      // Если пользователь обновлял свой профиль, обновляем данные в сессии
      if (isOwnProfile) {
        // Полностью обновляем объект пользователя в сессии
        Object.assign(user, formattedUser);
        
        // Принудительно обновляем сессию
        req.session.save((err) => {
          if (err) {
            console.error("Ошибка при сохранении сессии:", err);
          } else {
            console.log("Сессия успешно обновлена для пользователя:", user.email);
          }
        });
      }
      
      // Отправляем обновленные данные пользователя
      res.json({
        id: formattedUser.id,
        email: formattedUser.email,
        username: formattedUser.username,
        fullName: formattedUser.fullName,
        phone: formattedUser.phone,
        address: formattedUser.address,
        isAdmin: formattedUser.isAdmin,
        balance: formattedUser.balance
      });
      
    } catch (error) {
      console.error("Ошибка при обновлении профиля:", error);
      res.status(500).json({ message: "Ошибка сервера при обновлении профиля" });
    }
  });

  // Функция для списания товаров из заказа
  async function updateProductQuantities(orderId: string, items: any[]): Promise<boolean> {
    console.log(`[ORDERS] Списание товаров для заказа #${orderId}`);
    
    if (!orderId) {
      console.error(`[ORDERS] Ошибка: Не указан ID заказа для списания товаров`);
      return false;
    }
    
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`[ORDERS] Нет товаров для списания в заказе #${orderId}`);
      return false;
    }
    
    // Проверяем, существует ли колонка product_quantities_reduced
    try {
      const tableInfo = db.query("PRAGMA table_info(orders)");
      const hasColumn = tableInfo.some((col: any) => col.name === 'product_quantities_reduced');
      
      if (!hasColumn) {
        // Добавляем колонку, если её нет
        console.log(`[ORDERS] Добавление колонки product_quantities_reduced в таблицу orders`);
        try {
          db.exec("ALTER TABLE orders ADD COLUMN product_quantities_reduced INTEGER DEFAULT 0");
        } catch (e) {
          console.error(`[ORDERS] Ошибка при добавлении колонки:`, e);
          // Продолжаем работу даже если не удалось добавить колонку
        }
      }
    } catch (schemaError) {
      console.error(`[ORDERS] Ошибка при проверке схемы:`, schemaError);
    }
    
    // Проверяем, не списаны ли уже товары для этого заказа
    try {
      const orderRecord = db.queryOne(
        "SELECT * FROM orders WHERE id = ?", 
        [orderId]
      ) as Order | null;
      
      if (orderRecord && 
          typeof orderRecord === 'object' && 
          'product_quantities_reduced' in orderRecord && 
          orderRecord.product_quantities_reduced === true) {
        console.log(`[ORDERS] Товары для заказа #${orderId} уже были списаны ранее`);
        return true; // Считаем успешным, так как товары уже списаны
      }
    } catch (checkError) {
      console.error(`[ORDERS] Ошибка при проверке статуса списания:`, checkError);
      // Продолжаем, так как лучше попытаться списать товары, чем не списать
    }
    
    console.log(`[ORDERS] Начинаем списание ${items.length} товаров`);
    
    // Обработка списания в одной транзакции
    try {
      // Начинаем транзакцию
      db.exec("BEGIN TRANSACTION");
      let success = true;
      
      // Обрабатываем каждый товар
      for (const item of items) {
        try {
          if (!item || typeof item !== 'object') {
            console.warn(`[ORDERS] Пропуск невалидного товара:`, item);
            continue;
          }
          
          // Получаем ID товара
          const productId = item.id ? String(item.id) : null;
          if (!productId) {
            console.warn(`[ORDERS] Товар без ID:`, item);
            continue;
          }
          
          // Количество для списания
          let quantity = 0;
          try {
            quantity = parseInt(String(item.quantity || 0));
            if (isNaN(quantity) || quantity <= 0) {
              console.warn(`[ORDERS] Некорректное количество товара:`, item);
              continue;
            }
          } catch (quantityError) {
            console.error(`[ORDERS] Ошибка при обработке количества:`, quantityError);
            continue;
          }
          
          // Получаем текущий товар
          const product = db.queryOne(
            "SELECT * FROM products WHERE id = ?", 
            [productId]
          ) as Product | null;
          
          if (!product) {
            console.warn(`[ORDERS] Товар с ID=${productId} не найден в базе`);
            continue;
          }
          
          // Текущее количество товара
          let currentQuantity = 0;
          try {
            currentQuantity = parseInt(String(product.quantity || 0));
            if (isNaN(currentQuantity)) currentQuantity = 0;
          } catch (parseError) {
            console.error(`[ORDERS] Ошибка при парсинге текущего количества:`, parseError);
            currentQuantity = 0;
          }
          
          // Рассчитываем новое количество (не меньше нуля)
          const newQuantity = Math.max(0, currentQuantity - quantity);
          console.log(`[ORDERS] Обновление количества товара "${product.name}" (ID=${productId}): ${currentQuantity} → ${newQuantity}`);
          
          // Обновляем количество товара
          try {
            const updateResult = db.run(
              "UPDATE products SET quantity = ? WHERE id = ?",
              [newQuantity, productId]
            );
            
            if (!updateResult || updateResult.changes === 0) {
              console.error(`[ORDERS] Не удалось обновить количество товара ID=${productId}`);
              success = false;
            }
          } catch (updateError) {
            console.error(`[ORDERS] Ошибка при обновлении товара:`, updateError);
            success = false;
          }
        } catch (itemError) {
          console.error(`[ORDERS] Ошибка при обработке товара:`, itemError);
          success = false;
        }
      }
      
      // Если все товары обработаны успешно, помечаем заказ
      if (success) {
        try {
          // Помечаем заказ как обработанный
          const markResult = db.run(
            "UPDATE orders SET product_quantities_reduced = 1 WHERE id = ?",
            [orderId]
          );
          
          if (!markResult || markResult.changes === 0) {
            console.warn(`[ORDERS] Не удалось пометить заказ #${orderId} как обработанный`);
          }
          
          // Применяем транзакцию
          db.exec("COMMIT");
          console.log(`[ORDERS] Товары успешно списаны для заказа #${orderId}`);
          return true;
        } catch (markError) {
          console.error(`[ORDERS] Ошибка при обновлении статуса заказа:`, markError);
          db.exec("ROLLBACK");
          return false;
        }
      } else {
        // При ошибках в обработке товаров отменяем транзакцию
        console.error(`[ORDERS] Ошибки при списании товаров, отмена транзакции`);
        db.exec("ROLLBACK");
        return false;
      }
    } catch (transactionError) {
      console.error(`[ORDERS] Критическая ошибка в транзакции:`, transactionError);
      try {
        db.exec("ROLLBACK");
      } catch (rollbackError) {
        console.error(`[ORDERS] Ошибка при отмене транзакции:`, rollbackError);
      }
      return false;
    }
  }

  // Маршрут для обновления статуса заказа
  app.put("/api/orders/:id/status", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
      const orderId = req.params.id;
      const { orderStatus } = req.body;
      
      if (!orderStatus) {
        return res.status(400).json({ message: "Не указан новый статус заказа" });
      }
      
      console.log(`[ORDERS] Запрос на обновление статуса заказа #${orderId} на ${orderStatus}`);
      
      // Получаем текущий заказ
      const currentOrder = db.queryOne(
        "SELECT * FROM orders WHERE id = ?",
        [orderId]
      ) as Record<string, any> | null;
      
      if (!currentOrder) {
        console.error(`[ORDERS] Заказ #${orderId} не найден`);
        return res.status(404).json({ message: "Заказ не найден" });
      }
      
      // Определяем предыдущий статус
      const previousStatus = currentOrder.order_status || "pending";
      
      console.log(`[ORDERS] Изменение статуса заказа #${orderId}: ${previousStatus} -> ${orderStatus}`);
      
      // Обновляем статус заказа в базе данных
      db.run(
        "UPDATE orders SET order_status = ?, updated_at = ? WHERE id = ?",
        [orderStatus, new Date().toISOString(), orderId]
      );
      
      // Если заказ переходит в статус "оплачен" или "в обработке", уменьшаем количество товаров
      if ((orderStatus === "paid" || orderStatus === "processing") &&
          (previousStatus !== "paid" && previousStatus !== "processing")) {
        
        console.log(`[ORDERS] Заказ #${orderId} переведен в статус ${orderStatus}, требуется списание товаров`);
        
        try {
          // Получаем товары из заказа
          let items: any[] = [];
          
          try {
            // Обработка различных форматов items
            if (typeof currentOrder.items === 'string') {
              // Безопасный парсинг JSON
              const itemsText = String(currentOrder.items || "[]").trim();
              
              if (itemsText) {
                if (itemsText.startsWith('[') && itemsText.endsWith(']')) {
                  // Стандартный JSON массив
                  items = JSON.parse(itemsText);
                } else if (itemsText.startsWith('"[') && itemsText.endsWith(']"')) {
                  // Случай двойной сериализации
                  const unescaped = JSON.parse(itemsText);
                  items = JSON.parse(unescaped);
                } else {
                  console.error(`[ORDERS] Неизвестный формат items: ${itemsText.substring(0, 50)}...`);
                }
              }
            } else if (Array.isArray(currentOrder.items)) {
              // Если items уже является массивом
              items = currentOrder.items;
            }
          } catch (parseError) {
            console.error(`[ORDERS] Ошибка при парсинге товаров:`, parseError);
            
            // В случае ошибки парсинга, создаем запасной вариант с одним товаром
            if (currentOrder.total_amount) {
              items = [{
                id: 0, // Фиктивный ID
                quantity: 1,
                price: currentOrder.total_amount
              }];
              console.log(`[ORDERS] Создан запасной элемент заказа на сумму ${currentOrder.total_amount}`);
            }
          }
          
          if (items.length === 0) {
            console.log(`[ORDERS] Заказ #${orderId} не содержит товаров для списания`);
          } else {
            // Вызываем функцию для списания товаров
            const success = await updateProductQuantities(orderId, items);
            
            if (success) {
              console.log(`[ORDERS] Товары успешно списаны для заказа #${orderId}`);
            } else {
              console.error(`[ORDERS] Ошибка при списании товаров для заказа #${orderId}`);
            }
          }
        } catch (productError) {
          console.error(`[ORDERS] Ошибка при обработке списания товаров:`, productError);
          // Не прерываем обновление статуса при ошибке списания
        }
      } else {
        console.log(`[ORDERS] Заказ #${orderId} не требует списания товаров при переходе ${previousStatus} -> ${orderStatus}`);
      }
      
      // Возвращаем обновленный заказ
      const updatedOrder = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
      return res.json({ 
        success: true, 
        message: "Статус заказа успешно обновлен", 
        order: formatOrderForClient(updatedOrder) 
      });
      
    } catch (error) {
      console.error(`[ORDERS] Ошибка при обновлении статуса заказа:`, error);
      res.status(500).json({
        success: false,
        message: "Ошибка сервера при обновлении статуса заказа",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Маршрут для получения заказов пользователя
  app.get("/api/user/orders", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Получаем заказы пользователя из БД
      const orders = db.query(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", 
        [user.id]
      ) as Array<Record<string, any>>;
      
      // Форматируем заказы для клиента
      const formattedOrders = orders.map(order => formatOrderForClient(order));
      
      res.json(formattedOrders);
    } catch (error) {
      console.error("Ошибка при получении заказов пользователя:", error);
      res.status(500).json({ 
        message: "Не удалось загрузить заказы пользователя",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Маршрут для получения отзывов пользователя
  app.get("/api/user/reviews", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Получаем все отзывы пользователя из БД
      const reviews = db.query(
        "SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC", 
        [user.id]
      ) as Array<Record<string, any>>;
      
      // Форматируем отзывы
      const formattedReviews = reviews.map(review => ({
        id: review.id,
        userId: review.user_id,
        productId: review.product_id,
        rating: review.rating,
        text: review.text,
        images: review.images ? JSON.parse(review.images) : [],
        isApproved: review.is_approved === 1,
        createdAt: review.created_at,
      }));
      
      res.json(formattedReviews);
    } catch (error) {
      console.error("Ошибка при получении отзывов пользователя:", error);
      res.status(500).json({
        message: "Не удалось загрузить отзывы пользователя", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Маршрут для получения уведомлений пользователя
  app.get("/api/user/notifications", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Получаем все уведомления пользователя из БД
      const notifications = db.query(
        "SELECT n.*, p.name as product_name, p.image_url FROM notifications n LEFT JOIN products p ON n.product_id = p.id WHERE n.user_id = ? ORDER BY n.created_at DESC", 
        [user.id]
      ) as Array<Record<string, any>>;
      
      // Форматируем уведомления
      const formattedNotifications = notifications.map(notification => ({
        id: notification.id,
        userId: notification.user_id,
        productId: notification.product_id,
        type: notification.type,
        seen: notification.seen === 1,
        product: notification.product_name ? {
          id: notification.product_id,
          name: notification.product_name,
          imageUrl: notification.image_url
        } : null,
        createdAt: notification.created_at,
      }));
      
      res.json(formattedNotifications);
    } catch (error) {
      console.error("Ошибка при получении уведомлений пользователя:", error);
      res.status(500).json({ 
        message: "Не удалось загрузить уведомления пользователя",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Регистрация пользователя
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Валидация данных из запроса
      const { email, password, firstName, lastName, username, phone, address } = req.body;
      
      // Проверяем обязательные поля
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ 
          message: "Ошибка валидации", 
          errors: { 
            email: !email ? "Email обязателен" : null,
            password: !password ? "Пароль обязателен" : null,
            firstName: !firstName ? "Имя обязательно" : null,
            lastName: !lastName ? "Фамилия обязательна" : null
          }
        });
      }

      // Проверяем длину пароля
      if (password.length < 8) {
        return res.status(400).json({ 
          message: "Ошибка валидации", 
          errors: { password: "Пароль должен быть не менее 8 символов" }
        });
      }

      // Проверяем наличие заглавных букв и цифр в пароле
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ 
          message: "Ошибка валидации", 
          errors: { password: "Пароль должен содержать хотя бы одну заглавную букву" }
        });
      }
      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ 
          message: "Ошибка валидации", 
          errors: { password: "Пароль должен содержать хотя бы одну цифру" }
        });
      }

      // Проверяем существующего пользователя
      const existingUser = db.queryOne("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
      if (existingUser) {
        return res.status(400).json({
          message: "Пользователь с таким email уже существует",
          errors: { email: "Пользователь с таким email уже существует" }
        });
      }

      // Хешируем пароль используя pbkdf2
      const hashedPassword = hashPassword(password);

      // Создаем ID
      const userId = crypto.randomUUID();

      // Сохраняем пользователя
      db.run(
        `INSERT INTO users (
          id, email, password, username, first_name, last_name, phone, address, 
          balance, is_admin, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          email.toLowerCase(),
          hashedPassword,
          username || email.split('@')[0],
          firstName,
          lastName,
          phone || '',
          address || '',
          '0.00',
          0,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      // Получаем созданного пользователя
      const newUser = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]) as UserRecord | null;
      if (!newUser) {
        return res.status(500).json({ message: "Ошибка при создании пользователя" });
      }

      // Формируем пользователя для сессии
      const user = userRecordToSessionUser(newUser);

      // Автоматически авторизуем пользователя после регистрации
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Ошибка при автоматической авторизации после регистрации:", loginErr);
          return res.json({
            message: "Регистрация успешна, но требуется вход в систему",
            user
          });
        }
        res.json({
          message: "Регистрация успешна",
          user
        });
      });
    } catch (error) {
      console.error("Ошибка при регистрации:", error);
      res.status(500).json({ 
        message: "Внутренняя ошибка сервера при регистрации",
        error: error instanceof Error ? error.message : "Неизвестная ошибка"
      });
    }
  });

  // Маршрут для генерации чека заказа
  app.post("/api/orders/:id/receipt", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
      const orderId = req.params.id;
      
      // Получаем заказ
      const order = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]) as Record<string, any>;
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }

      // Генерируем уникальный номер чека
      const receiptNumber = `CHK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Формируем данные для чека
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const receiptData = {
        receiptNumber,
        orderId: order.id,
        date: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
        customer: {
          name: order.full_name,
          phone: order.phone,
          address: order.address
        },
        items: items.map((item: any) => ({
          name: item.productName || item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        })),
        subtotal: parseFloat(order.total_amount),
        delivery: parseFloat(order.delivery_amount),
        total: parseFloat(order.total_amount) + parseFloat(order.delivery_amount),
        paymentMethod: order.payment_method,
        deliveryType: order.delivery_type
      };

      // Создаем директорию для чеков, если её нет
      const receiptsDir = path.join(process.cwd(), 'public', 'receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }

      // Генерируем PDF чек
      const receiptFileName = `${receiptNumber}.pdf`;
      const receiptPath = path.join(receiptsDir, receiptFileName);
      await generateReceiptPDF(receiptData, receiptPath);

      // Обновляем информацию о чеке в базе данных
      const receiptGeneratedAt = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
      const receiptUrl = `/receipts/${receiptFileName}`; // Используем относительный путь
      
      console.log(`[RECEIPT] Генерация чека для заказа #${orderId}:`);
      console.log(`[RECEIPT] Путь к файлу: ${receiptPath}`);
      console.log(`[RECEIPT] URL для доступа: ${receiptUrl}`);

      db.run(
        `UPDATE orders SET 
          receipt_number = ?,
          receipt_url = ?,
          receipt_generated_at = ?
        WHERE id = ?`,
        [
          receiptNumber,
          receiptUrl,
          receiptGeneratedAt,
          orderId
        ]
      );

      res.json({
        receiptNumber,
        receiptUrl,
        receiptGeneratedAt
      });
    } catch (error) {
      console.error("Ошибка при генерации чека:", error);
      res.status(500).json({ message: "Ошибка при генерации чека" });
    }
  });

  // Функция для генерации PDF чека
  async function generateReceiptPDF(receiptData: any, outputPath: string) {
    // Создаем директорию для чеков, если её нет
    const receiptsDir = path.dirname(outputPath);
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    // Настройки макета чека
    const layoutSettings = {
      // Основные размеры и отступы
      page: {
        margin: 50,
        width: 595.28, // A4 ширина в пунктах
        height: 841.89 // A4 высота в пунктах
      },
      fonts: {
        title: { size: 24, family: 'Arial' },
        subtitle: { size: 16, family: 'Arial' },
        header: { size: 14, family: 'Arial' },
        normal: { size: 12, family: 'Arial' },
        small: { size: 10, family: 'Arial' },
        tiny: { size: 8, family: 'Arial' }
      },
      spacing: {
        lineHeight: 12,
        itemPadding: 4,
        sectionPadding: 8,
        minItemHeight: 16
      },
      table: {
        // Настройки ширины колонок (в процентах от общей ширины таблицы)
        columnWidths: {
          name: 0.35,     // 35% для названия (уменьшено для лучшей читаемости)
          category: 0.25,  // 25% для категории (увеличено)
          quantity: 0.10,  // 10% для количества
          price: 0.15,     // 15% для цены
          total: 0.15      // 15% для суммы
        },
        // Максимальное количество строк для названия товара
        maxNameLines: 3,
        // Максимальное количество строк для категории
        maxCategoryLines: 2,
        // Отступ для многострочного текста
        textIndent: 2
      },
      colors: {
        text: '#000000',
        header: '#333333',
        border: '#CCCCCC',
        highlight: '#666666'
      }
    };

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: layoutSettings.page.margin,
          bufferPages: true
        });

        // Путь к шрифту Arial
        const fontPath = path.join(process.cwd(), 'public', 'fonts', 'arial.ttf');
        
        // Проверяем существование шрифта
        if (!fs.existsSync(fontPath)) {
          throw new Error('Шрифт Arial не найден. Пожалуйста, запустите setup-fonts.js');
        }

        // Регистрируем шрифт с поддержкой кириллицы
        doc.registerFont('Arial', fontPath);

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Устанавливаем шрифт с поддержкой кириллицы по умолчанию
        doc.font(layoutSettings.fonts.normal.family);

        // Заголовок магазина
        doc.fontSize(layoutSettings.fonts.title.size)
           .fillColor(layoutSettings.colors.header)
           .text('Jungle Plants', { align: 'center' });
      
        doc.fontSize(layoutSettings.fonts.subtitle.size)
           .text('Чек заказа', { align: 'center' });
      
        doc.moveDown(1);

        // Информация о заказе и дата
        doc.fontSize(12);
        // Форматируем дату правильно
        let formattedDate;
        try {
          // Пробуем распарсить дату, если она в строковом формате
          const date = typeof receiptData.date === 'string' 
            ? new Date(receiptData.date)
            : receiptData.date;

          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }

          formattedDate = date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Moscow'
          });
        } catch (error) {
          console.error('Ошибка форматирования даты:', error);
          formattedDate = new Date().toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Moscow'
          });
        }
        doc.text(`Номер чека: ${receiptData.receiptNumber}`, { align: 'right' });
        doc.text(`Номер заказа: ${receiptData.orderId}`, { align: 'right' });
        doc.text(`Дата: ${formattedDate}`, { align: 'right' });
        doc.moveDown(1.5);

        // Информация о клиенте
        doc.fontSize(14).text('Информация о клиенте:', { underline: true });
        doc.fontSize(12);
        doc.text(`Имя: ${receiptData.customer.name || ''}`);
        doc.text(`Телефон: ${receiptData.customer.phone || ''}`);
        doc.text(`Адрес: ${receiptData.customer.address || ''}`);
        doc.moveDown(1.5);

        // Товары
        doc.fontSize(14).text('Товары:', { underline: true });
        doc.moveDown(0.5);

        // Таблица товаров
        const tableTop = doc.y;
        const tableLeft = 50;
        const tableWidth = doc.page.width - 100;
        const colWidths = {
          name: tableWidth * 0.4,    // 40% для названия
          category: tableWidth * 0.2, // 20% для категории
          quantity: tableWidth * 0.1, // 10% для количества
          price: tableWidth * 0.15,   // 15% для цены
          total: tableWidth * 0.15    // 15% для суммы
        };

        // Заголовки таблицы
        doc.fontSize(11).text('Наименование', tableLeft, doc.y, { width: colWidths.name });
        doc.text('Категория', tableLeft + colWidths.name, doc.y, { width: colWidths.category });
        doc.text('Кол-во', tableLeft + colWidths.name + colWidths.category, doc.y, { width: colWidths.quantity, align: 'center' });
        doc.text('Цена', tableLeft + colWidths.name + colWidths.category + colWidths.quantity, doc.y, { width: colWidths.price, align: 'right' });
        doc.text('Сумма', tableLeft + colWidths.name + colWidths.category + colWidths.quantity + colWidths.price, doc.y, { width: colWidths.total, align: 'right' });
        doc.moveDown(0.5);

        // Линия под заголовками
        doc.moveTo(tableLeft, doc.y - 2)
           .lineTo(tableLeft + tableWidth, doc.y - 2)
           .stroke();
        doc.moveDown(0.5);

        // Товары
        let y = doc.y; // Начальная Y координата для первого товара

        receiptData.items.forEach((item: any, index: number) => {
          // Проверяем, нужно ли добавить новую страницу
          // Учитываем высоту заголовков таблицы и итогов
          const headerHeight = 40; // Высота заголовков таблицы
          const footerHeight = 150; // Высота итогов и подписи
          const estimatedItemHeight = layoutSettings.spacing.minItemHeight * 2; // Увеличиваем оценку высоты элемента

          if (y + estimatedItemHeight > doc.page.height - (headerHeight + footerHeight)) {
            doc.addPage();
            y = layoutSettings.page.margin;
            
            // Перерисовываем заголовки на новой странице
            doc.fontSize(layoutSettings.fonts.small.size)
               .fillColor(layoutSettings.colors.header);
            
            const headerY = y;
            doc.text('Наименование', tableLeft, headerY, { width: layoutSettings.table.columnWidths.name });
            doc.text('Категория', tableLeft + layoutSettings.table.columnWidths.name, headerY, { width: layoutSettings.table.columnWidths.category });
            doc.text('Кол-во', tableLeft + layoutSettings.table.columnWidths.name + layoutSettings.table.columnWidths.category, headerY, { 
              width: layoutSettings.table.columnWidths.quantity, 
              align: 'center' 
            });
            doc.text('Цена', tableLeft + layoutSettings.table.columnWidths.name + layoutSettings.table.columnWidths.category + layoutSettings.table.columnWidths.quantity, headerY, { 
              width: layoutSettings.table.columnWidths.price, 
              align: 'right' 
            });
            doc.text('Сумма', tableLeft + layoutSettings.table.columnWidths.name + layoutSettings.table.columnWidths.category + layoutSettings.table.columnWidths.quantity + layoutSettings.table.columnWidths.price, headerY, { 
              width: layoutSettings.table.columnWidths.total, 
              align: 'right' 
            });
            
            // Линия под заголовками
            const headerBottomY = headerY + layoutSettings.spacing.lineHeight + layoutSettings.spacing.itemPadding;
            doc.strokeColor(layoutSettings.colors.border)
               .moveTo(tableLeft, headerBottomY)
               .lineTo(tableLeft + layoutSettings.page.width - layoutSettings.page.margin * 2, headerBottomY)
               .stroke();
            
            y = headerBottomY + layoutSettings.spacing.itemPadding; // Обновляем Y после заголовков
          }

          const name = item.productName || item.name || '';
          const category = item.category || 'Растение';
          const quantity = parseInt(item.quantity) || 0;
          const price = parseFloat(item.price) || 0;
          const total = quantity * price;

          // Обработка длинного названия товара
          doc.fontSize(layoutSettings.fonts.small.size);
          const nameOptions = {
            width: layoutSettings.table.columnWidths.name - layoutSettings.table.textIndent,
            align: 'left' as const,
            continued: false,
            ellipsis: '...' // Добавляем многоточие для обрезанного текста
          };

          // Проверяем, сколько строк займет название
          const nameHeight = doc.heightOfString(name, nameOptions);
          const maxNameHeight = layoutSettings.spacing.lineHeight * layoutSettings.table.maxNameLines;
          
          // Если название слишком длинное, обрезаем его
          let displayName = name;
          if (nameHeight > maxNameHeight) {
            // Находим позицию, где нужно обрезать текст
            let cutPosition = name.length;
            while (doc.heightOfString(name.substring(0, cutPosition) + '...', nameOptions) > maxNameHeight && cutPosition > 0) {
              cutPosition = Math.floor(cutPosition * 0.9); // Уменьшаем длину на 10%
            }
            displayName = name.substring(0, cutPosition) + '...';
          }

          // Аналогичная обработка для категории
          const categoryOptions = {
            width: layoutSettings.table.columnWidths.category - layoutSettings.table.textIndent,
            align: 'left' as const,
            continued: false,
            ellipsis: '...'
          };

          const categoryHeight = doc.heightOfString(category, categoryOptions);
          const maxCategoryHeight = layoutSettings.spacing.lineHeight * layoutSettings.table.maxCategoryLines;
          
          let displayCategory = category;
          if (categoryHeight > maxCategoryHeight) {
            let cutPosition = category.length;
            while (doc.heightOfString(category.substring(0, cutPosition) + '...', categoryOptions) > maxCategoryHeight && cutPosition > 0) {
              cutPosition = Math.floor(cutPosition * 0.9);
            }
            displayCategory = category.substring(0, cutPosition) + '...';
          }

          // Рассчитываем высоту для каждой колонки
          const quantityHeight = doc.heightOfString(quantity.toString(), { width: layoutSettings.table.columnWidths.quantity });
          const priceHeight = doc.heightOfString(`${price.toLocaleString('ru-RU')} ₽`, { width: layoutSettings.table.columnWidths.price });
          const totalHeight = doc.heightOfString(`${total.toLocaleString('ru-RU')} ₽`, { width: layoutSettings.table.columnWidths.total });

          // Находим максимальную высоту для строки
          const rowHeight = Math.max(
            doc.heightOfString(displayName, nameOptions),
            doc.heightOfString(displayCategory, categoryOptions),
            quantityHeight,
            priceHeight,
            totalHeight,
            layoutSettings.spacing.minItemHeight
          ) + layoutSettings.spacing.itemPadding * 2;

          // Выводим данные товара с правильным вертикальным выравниванием
          const itemY = y + layoutSettings.spacing.itemPadding;
          const verticalCenter = itemY + (rowHeight - layoutSettings.spacing.itemPadding * 2) / 2;

          // Наименование (с переносом строк и обрезкой)
          doc.fillColor(layoutSettings.colors.text)
             .text(displayName, tableLeft, itemY, nameOptions);

          // Категория (с переносом строк и обрезкой)
          doc.text(displayCategory, tableLeft + layoutSettings.table.columnWidths.name, itemY, categoryOptions);

          // Количество (по центру)
          const quantityY = verticalCenter - quantityHeight / 2;
          doc.text(quantity.toString(), tableLeft + layoutSettings.table.columnWidths.name + layoutSettings.table.columnWidths.category, quantityY, {
            width: layoutSettings.table.columnWidths.quantity,
            align: 'center'
          });

          // Цена (по правому краю)
          const priceY = verticalCenter - priceHeight / 2;
          doc.text(`${price.toLocaleString('ru-RU')} ₽`, tableLeft + layoutSettings.table.columnWidths.name + layoutSettings.table.columnWidths.category + layoutSettings.table.columnWidths.quantity, priceY, {
            width: layoutSettings.table.columnWidths.price,
            align: 'right'
          });

          // Сумма (по правому краю)
          const totalY = verticalCenter - totalHeight / 2;
          doc.text(`${total.toLocaleString('ru-RU')} ₽`, tableLeft + layoutSettings.table.columnWidths.name + layoutSettings.table.columnWidths.category + layoutSettings.table.columnWidths.quantity + layoutSettings.table.columnWidths.price, totalY, {
            width: layoutSettings.table.columnWidths.total,
            align: 'right'
          });

          // Дополнительная информация
          const details = [];
          if (item.hasOwnProperty('isRare') && item.isRare) details.push('Редкое растение');
          if (item.hasOwnProperty('isPreorder') && item.isPreorder) details.push('Предзаказ');
          if (item.hasOwnProperty('isEasyToCare') && item.isEasyToCare) details.push('Простой уход');

          let detailsHeight = 0;
          if (details.length > 0) {
            doc.fontSize(layoutSettings.fonts.tiny.size)
               .fillColor(layoutSettings.colors.highlight);
            
            const detailsText = `(${details.join(', ')})`;
            const detailsY = itemY + rowHeight - layoutSettings.spacing.itemPadding;
            doc.text(detailsText, tableLeft, detailsY, {
              width: layoutSettings.page.width - layoutSettings.page.margin * 2 - layoutSettings.table.textIndent,
              continued: false
            });
            detailsHeight = doc.heightOfString(detailsText, { width: layoutSettings.page.width - layoutSettings.page.margin * 2 - layoutSettings.table.textIndent }) + layoutSettings.spacing.itemPadding;
          }

          // Обновляем Y координату для следующего элемента
          y = itemY + rowHeight + detailsHeight;

          // Добавляем разделительную линию между товарами
          doc.strokeColor(layoutSettings.colors.border)
             .moveTo(tableLeft, y - layoutSettings.spacing.itemPadding)
             .lineTo(tableLeft + layoutSettings.page.width - layoutSettings.page.margin * 2, y - layoutSettings.spacing.itemPadding)
             .stroke();
        });

        // Линия после товаров
        doc.moveTo(tableLeft, y - 2) 
           .lineTo(tableLeft + layoutSettings.page.width - layoutSettings.page.margin * 2, y - 2)
           .stroke();

        doc.moveDown(1.5); 

        // Итоги
        const subtotal = parseFloat(receiptData.subtotal) || 0;
        const delivery = parseFloat(receiptData.delivery) || 0;
        const total = subtotal + delivery;

        doc.fontSize(layoutSettings.fonts.normal.size);
        // Выравниваем подытог и доставку по правому краю
        const totalsX = layoutSettings.page.width - layoutSettings.page.margin * 2 - layoutSettings.table.columnWidths.total; // Позиция для итогов (60% от ширины таблицы)
        const totalsWidth = layoutSettings.table.columnWidths.total; // Ширина колонки для итогов

        doc.text(`Подытог: ${subtotal.toLocaleString('ru-RU')} ₽`, totalsX, doc.y, { align: 'right', width: totalsWidth });
        doc.text(`Доставка: ${delivery.toLocaleString('ru-RU')} ₽`, totalsX, doc.y, { align: 'right', width: totalsWidth });
        doc.fontSize(layoutSettings.fonts.normal.size);
        doc.text(`Итого: ${total.toLocaleString('ru-RU')} ₽`, totalsX, doc.y, { align: 'right', width: totalsWidth });
        doc.moveDown(2);

        // Информация об оплате и доставке
        doc.fontSize(layoutSettings.fonts.small.size);
        const paymentMethodMap: Record<string, string> = {
          "yoomoney": "Онлайн оплата",
          "directTransfer": "Прямой перевод",
          "balance": "Баланс"
        };
        const deliveryTypeMap: Record<string, string> = {
          "cdek": "СДЭК",
          "post": "Почта России"
        };
        // Выводим способы оплаты и доставки
        doc.text(`Способ оплаты: ${paymentMethodMap[receiptData.paymentMethod] || receiptData.paymentMethod}`);
        doc.text(`Способ доставки: ${deliveryTypeMap[receiptData.deliveryType] || receiptData.deliveryType}`);
        doc.moveDown(3); 

        // Подпись
        doc.fontSize(layoutSettings.fonts.normal.size).text('Спасибо за покупку!', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(layoutSettings.fonts.normal.size).text('Jungle Plants', { align: 'center' });
        doc.fontSize(layoutSettings.fonts.small.size).text('Магазин комнатных растений', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(layoutSettings.fonts.tiny.size).text('www.jungleplants.ru', { align: 'center' });

        // Добавляем QR-код для проверки подлинности чека
        const qrCodePath = path.join(process.cwd(), 'public', 'receipts', `${receiptData.receiptNumber}.png`);
        if (fs.existsSync(qrCodePath)) {
          const qrSize = 100;
          const qrX = doc.page.width - qrSize - 50;
          const qrY = doc.page.height - qrSize - 50;
          // Проверяем, чтобы QR-код не накладывался на текст в конце страницы
          if (qrY > doc.y + 20) { 
             doc.image(qrCodePath, qrX, qrY, { width: qrSize });
             doc.fontSize(layoutSettings.fonts.tiny.size).text('QR-код для проверки подлинности', qrX, qrY + qrSize + 5, { width: qrSize, align: 'center' });
          }
        }

        doc.end();

        stream.on('finish', resolve);
        stream.on('error', (err) => {
          console.error('Ошибка при записи PDF:', err);
          reject(err);
        });
      } catch (error) {
        console.error('Ошибка при генерации PDF:', error);
        reject(error);
      }
    });
  }

  // Добавляем обработчик смены пароля
  app.put("/api/users/:id/password", async (req, res) => {
    try {
      const userId = req.params.id;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ 
          message: "Необходимо указать текущий и новый пароль" 
        });
      }

      // Получаем пользователя
      const user = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]) as UserRecord | null;
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      // Проверяем текущий пароль
      const isPasswordValid = comparePasswords(user.password, oldPassword);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Неверный текущий пароль" });
      }

      // Проверяем новый пароль
      if (newPassword.length < 8) {
        return res.status(400).json({ 
          message: "Новый пароль должен быть не менее 8 символов" 
        });
      }

      if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ 
          message: "Новый пароль должен содержать хотя бы одну заглавную букву" 
        });
      }

      if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({ 
          message: "Новый пароль должен содержать хотя бы одну цифру" 
        });
      }

      // Хешируем новый пароль
      const hashedPassword = hashPassword(newPassword);

      // Обновляем пароль в базе данных
      db.run(
        "UPDATE users SET password = ?, updated_at = ? WHERE id = ?",
        [hashedPassword, new Date().toISOString(), userId]
      );

      res.json({ message: "Пароль успешно изменен" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get("/api/debug/user-count", async (req, res) => {
    try {
      const count = db.queryOne("SELECT COUNT(*) as userCount FROM users");
      res.json({ userCount: count ? (count as any).userCount : 0 });
    } catch (error) {
      console.error("Error fetching user count:", error);
      res.status(500).json({ message: "Failed to fetch user count" });
    }
  });

  // Схема для валидации промокода
  const validatePromoCodeSchema = z.object({
    code: z.string().min(1),
    cartTotal: z.number().min(0)
  });

  // Схема для создания/обновления промокода
  const promoCodeSchema = z.object({
    code: z.string().min(1, "Введите код промокода"),
    description: z.string().optional(),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.number().min(0, "Значение скидки должно быть положительным"),
    minOrderAmount: z.number().min(0, "Минимальная сумма заказа должна быть положительной").optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    maxUses: z.number().min(1, "Максимальное количество использований должно быть положительным").optional(),
    isActive: z.boolean().default(true),
  });

  // Типы для промокодов
  interface PromoCode {
    id: number;
    code: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount: number | null;
    start_date: string;
    end_date: string;
    max_uses: number | null;
    current_uses: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  interface Order {
    id: string;
    user_id: number;
    total_amount: number;
    delivery_amount: number;
    promo_code: string | null;
    promo_code_discount: number | null;
    items: string;
    full_name: string;
    address: string;
    phone: string;
    social_network?: string;
    social_username?: string;
    comment?: string;
    need_insulation: boolean;
    delivery_type: string;
    delivery_speed?: string;
    payment_method: string;
    payment_status: string;
    order_status: string;
    payment_proof_url?: string;
    admin_comment?: string;
    tracking_number?: string;
    estimated_delivery_date?: string;
    actual_delivery_date?: string;
    last_status_change_at?: string;
    status_history?: string;
    product_quantities_reduced: boolean;
    created_at: string;
    updated_at: string;
  }

  // API для валидации промокода
  app.post("/api/promo-codes/validate", async (req, res) => {
    try {
      const { code, cartTotal } = validatePromoCodeSchema.parse(req.body);
      
      const promoCode = db.queryOne(`
        SELECT * FROM promo_codes 
        WHERE code = ? 
        AND is_active = 1 
        AND start_date <= datetime('now') 
        AND end_date >= datetime('now')
        AND (max_uses IS NULL OR current_uses < max_uses)
      `, [code.toUpperCase()]) as PromoCode | undefined;

      if (!promoCode) {
        return res.status(404).json({ 
          message: "Промокод не найден или недействителен" 
        });
      }

      if (promoCode.min_order_amount && cartTotal < promoCode.min_order_amount) {
        return res.status(400).json({ 
          message: `Минимальная сумма заказа для применения промокода: ${promoCode.min_order_amount} ₽` 
        });
      }

      let discount = 0;
      if (promoCode.discount_type === "percentage") {
        discount = Math.round(cartTotal * (promoCode.discount_value / 100));
      } else {
        discount = promoCode.discount_value;
      }

      discount = Math.min(discount, cartTotal);

      return res.json({
        code: promoCode.code,
        description: promoCode.description,
        discount,
        discountType: promoCode.discount_type,
        discountValue: promoCode.discount_value
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Неверные данные", 
          errors: error.errors 
        });
      }
      console.error("Ошибка при валидации промокода:", error);
      return res.status(500).json({ 
        message: "Ошибка при проверке промокода" 
      });
    }
  });

  // API для получения списка промокодов (только для админов)
  app.get("/api/promo-codes", ensureAdmin, async (req, res) => {
    try {
      const promoCodes = db.query("SELECT * FROM promo_codes ORDER BY created_at DESC");
      res.json(promoCodes);
    } catch (error) {
      console.error("Error fetching promo codes:", error);
      res.status(500).json({ message: "Внутренняя ошибка сервера" });
    }
  });

  // API для получения конкретного промокода (только для админов)
  app.get("/api/promo-codes/:id", ensureAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const promoCode = db.queryOne(
        "SELECT * FROM promo_codes WHERE id = ?",
        [id]
      ) as PromoCode | null;
      
      if (!promoCode) {
        return res.status(404).json({ 
          message: "Промокод не найден" 
        });
      }
      
      res.json(promoCode);
    } catch (error) {
      console.error("Error fetching promo code:", error);
      res.status(500).json({ message: "Внутренняя ошибка сервера" });
    }
  });

  // API для создания промокода (только для админов)
  app.post("/api/promo-codes", ensureAdmin, async (req, res) => {
    try {
      const data = promoCodeSchema.parse(req.body);
      
      // Проверяем, что код уникален
      const existingCode = db.queryOne(
        "SELECT id FROM promo_codes WHERE code = ?",
        [data.code.toUpperCase()]
      );
      
      if (existingCode) {
        return res.status(400).json({ 
          message: "Промокод с таким кодом уже существует" 
        });
      }
      
      // Создаем промокод
      const result = db.run(
        `INSERT INTO promo_codes (
          code, description, discount_type, discount_value,
          min_order_amount, start_date, end_date, max_uses,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          data.code.toUpperCase(),
          data.description || null,
          data.discountType,
          data.discountValue,
          data.minOrderAmount || null,
          data.startDate,
          data.endDate,
          data.maxUses || null,
          data.isActive ? 1 : 0
        ]
      );
      
      const newPromoCode = db.queryOne(
        "SELECT * FROM promo_codes WHERE id = ?",
        [result.lastInsertRowid]
      );
      
      res.status(201).json(newPromoCode);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Неверные данные", 
          errors: error.errors 
        });
      }
      console.error("Error creating promo code:", error);
      res.status(500).json({ message: "Внутренняя ошибка сервера" });
    }
  });

  // API для обновления промокода (только для админов)
  app.put("/api/promo-codes/:id", ensureAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const data = promoCodeSchema.parse(req.body);
      
      // Проверяем существование промокода
      const existingPromoCode = db.queryOne(
        "SELECT id FROM promo_codes WHERE id = ?",
        [id]
      );
      
      if (!existingPromoCode) {
        return res.status(404).json({ 
          message: "Промокод не найден" 
        });
      }
      
      // Проверяем уникальность кода
      const duplicateCode = db.queryOne(
        "SELECT id FROM promo_codes WHERE code = ? AND id != ?",
        [data.code.toUpperCase(), id]
      );
      
      if (duplicateCode) {
        return res.status(400).json({ 
          message: "Промокод с таким кодом уже существует" 
        });
      }
      
      // Обновляем промокод
      db.run(
        `UPDATE promo_codes SET
          code = ?,
          description = ?,
          discount_type = ?,
          discount_value = ?,
          min_order_amount = ?,
          start_date = ?,
          end_date = ?,
          max_uses = ?,
          is_active = ?,
          updated_at = datetime('now')
        WHERE id = ?`,
        [
          data.code.toUpperCase(),
          data.description || null,
          data.discountType,
          data.discountValue,
          data.minOrderAmount || null,
          data.startDate,
          data.endDate,
          data.maxUses || null,
          data.isActive ? 1 : 0,
          id
        ]
      );
      
      const updatedPromoCode = db.queryOne(
        "SELECT * FROM promo_codes WHERE id = ?",
        [id]
      );
      
      res.json(updatedPromoCode);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Неверные данные", 
          errors: error.errors 
        });
      }
      console.error("Error updating promo code:", error);
      res.status(500).json({ message: "Внутренняя ошибка сервера" });
    }
  });

  // API для удаления промокода (только для админов)
  app.delete("/api/promo-codes/:id", ensureAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Проверяем существование промокода
      const existingPromoCode = db.queryOne(
        "SELECT id FROM promo_codes WHERE id = ?",
        [id]
      );
      
      if (!existingPromoCode) {
        return res.status(404).json({ 
          message: "Промокод не найден" 
        });
      }
      
      // Удаляем промокод
      db.run("DELETE FROM promo_codes WHERE id = ?", [id]);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting promo code:", error);
      res.status(500).json({ message: "Внутренняя ошибка сервера" });
    }
  });

  // Применение промокода к заказу
  app.post("/api/orders/:orderId/apply-promo", ensureAuthenticated, async (req, res) => {
    const { orderId } = req.params;
    const { promoCode } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Пользователь не авторизован" });
    }

    try {
      // Получаем заказ
      const order = db.queryOne(
        "SELECT * FROM orders WHERE id = ?",
        [orderId]
      ) as Order | null;

      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }

      // Получаем промокод
      const promo = db.queryOne(
        "SELECT * FROM promo_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > datetime('now')) AND is_active = 1",
        [promoCode]
      ) as PromoCode | null;

      if (!promo) {
        return res.status(400).json({ message: "Недействительный промокод" });
      }

      // Проверяем минимальную сумму заказа
      if (promo.min_order_amount && order.total_amount < promo.min_order_amount) {
        return res.status(400).json({ 
          message: `Минимальная сумма заказа для этого промокода: ${promo.min_order_amount} ₽` 
        });
      }

      // Проверяем лимит использований
      if (promo.max_uses && promo.current_uses >= promo.max_uses) {
        return res.status(400).json({ message: "Достигнут лимит использований промокода" });
      }

      // Проверяем, не использовал ли пользователь этот промокод ранее
      const userUsage = db.queryOne(
        `SELECT id FROM promo_code_uses 
         WHERE promo_code_id = ? AND user_id = ?`,
        [promo.id, userId]
      );

      if (userUsage) {
        return res.status(400).json({ message: "Вы уже использовали этот промокод" });
      }

      // Рассчитываем скидку
      let discountAmount = 0;
      if (promo.discount_type === "percentage") {
        // Применяем скидку только к стоимости товаров, без доставки
        const itemsTotal = order.total_amount - order.delivery_amount;
        discountAmount = Math.round(itemsTotal * (promo.discount_value / 100));
      } else {
        discountAmount = promo.discount_value;
      }

      // Проверяем, что скидка не превышает стоимость товаров
      const itemsTotal = order.total_amount - order.delivery_amount;
      discountAmount = Math.min(discountAmount, itemsTotal);

      // Начинаем транзакцию
      db.exec("BEGIN TRANSACTION");

      try {
        // Обновляем заказ
        db.run(
          `UPDATE orders 
           SET promo_code = ?,
               promo_code_discount = ?,
               total_amount = total_amount - ?
           WHERE id = ?`,
          [promo.code, discountAmount, discountAmount, orderId]
        );

        // Увеличиваем счетчик использований промокода
        db.run(
          `UPDATE promo_codes 
           SET current_uses = current_uses + 1 
           WHERE id = ?`,
          [promo.id]
        );

        // Записываем использование промокода пользователем
        db.run(
          `INSERT INTO promo_code_uses (promo_code_id, user_id, order_id, discount_amount, used_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [promo.id, userId, orderId, discountAmount]
        );

        // Завершаем транзакцию
        db.exec("COMMIT");

        // Получаем обновленный заказ
        const updatedOrder = db.queryOne(
          `SELECT * FROM orders WHERE id = ?`,
          [orderId]
        );

        if (!updatedOrder) {
          throw new Error("Заказ не найден после обновления");
        }

        res.json(formatOrderForClient(updatedOrder));
      } catch (error) {
        // Откатываем транзакцию в случае ошибки
        db.exec("ROLLBACK");
        console.error("Error updating promo code:", error);
        res.status(500).json({ message: "Ошибка при обновлении промокода" });
      }
    } catch (error) {
      console.error("Error applying promo code:", error);
      res.status(500).json({ message: "Ошибка при применении промокода" });
    }
  });

  // Create HTTP server
  return createServer(app);
}

// Функция для генерации CSV для пользователей
function generateUsersCSV(users: Array<any>): string {
  const headers = [
    'ID',
    'Email',
    'Имя пользователя',
    'Полное имя',
    'Телефон',
    'Адрес',
    'Роль',
    'Баланс',
    'Дата регистрации'
  ];

  const rows = users.map(user => {
    const fullName = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    return [
      user.id,
      user.email,
      user.username || '',
      escapeCSVField(fullName),
      escapeCSVField(user.phone || ''),
      escapeCSVField(user.address || ''),
      user.is_admin ? 'Администратор' : 'Пользователь',
      `${user.balance || '0'} ₽`,
      new Date(user.created_at).toLocaleDateString('ru-RU')
    ];
  });

  return [headers, ...rows]
    .map(row => row.map(field => escapeCSVField(field.toString())).join(';'))
    .join('\n');
}

// Функция для генерации CSV для статистики
function generateStatisticsCSV(users: Array<any>, products: Array<any>, orders: Array<any>): string {
  const headers = ['Метрика', 'Значение'];
  
  const totalAmount = orders.reduce((sum, order) => {
    const amount = parseFloat(order.total_amount || '0');
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const rows = [
    ['Всего пользователей', users.length.toString()],
    ['Всего товаров', products.length.toString()],
    ['Всего заказов', orders.length.toString()],
    ['Активные заказы', orders.filter(o => o.order_status !== 'cancelled').length.toString()],
    ['Отмененные заказы', orders.filter(o => o.order_status === 'cancelled').length.toString()],
    ['Общая сумма заказов', `${totalAmount.toLocaleString('ru-RU')} ₽`]
  ];

  return [headers, ...rows]
    .map(row => row.map(field => escapeCSVField(field.toString())).join(';'))
    .join('\n');
}

// Функция для форматирования данных товара для клиента
function formatProductForClient(product: any) {
  if (!product) return null;
  
  // Преобразуем строку JSON в массив для images и labels
  let images = [];
  if (product.images) {
    try {
      images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
    } catch (e) {
      console.error("Ошибка при парсинге JSON images:", e);
    }
  }
  
  let labels = [];
  if (product.labels) {
    try {
      labels = typeof product.labels === 'string' ? JSON.parse(product.labels) : product.labels;
    } catch (e) {
      console.error("Ошибка при парсинге JSON labels:", e);
    }
  }
  
  // Формируем объект товара с правильными именами полей
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    originalPrice: product.original_price,
    images: images,
    quantity: product.quantity,
    category: product.category,
    isAvailable: Boolean(product.is_available),
    isPreorder: Boolean(product.is_preorder),
    isRare: Boolean(product.is_rare),
    isEasyToCare: Boolean(product.is_easy_to_care),
    labels: labels,
    deliveryCost: product.delivery_cost,
    createdAt: product.created_at,
    updatedAt: product.updated_at
  };
}

// Функция для генерации CSV для товаров
function generateProductsCSV(products: Array<any>): string {
  const headers = [
    "ID", "Название", "Описание", "Цена", "Исходная цена", 
    "Количество", "Категория", "Доступен", "Предзаказ", 
    "Редкий", "Простой уход", "Дата создания"
  ];

  let csvContent = headers.join(';') + '\n';
  
  products.forEach(product => {
    const row = [
      product.id,
      escapeCSVField(product.name || ''),
      escapeCSVField(product.description || ''),
      product.price ? product.price.toString().replace('.', ',') : '0',
      product.original_price ? product.original_price.toString().replace('.', ',') : '',
      product.quantity || '0',
      escapeCSVField(product.category || ''),
      product.is_available ? "Да" : "Нет",
      product.is_preorder ? "Да" : "Нет",
      product.is_rare ? "Да" : "Нет",
      product.is_easy_to_care ? "Да" : "Нет",
      new Date(product.created_at).toLocaleDateString('ru-RU')
    ];
    
    csvContent += row.join(';') + '\n';
  });
  
  return csvContent;
}

// Функция для генерации CSV для заказов
function generateOrdersCSV(orders: Array<any>): string {
  const headers = [
    'ID',
    'Клиент',
    'Телефон',
    'Адрес',
    'Сумма',
    'Доставка',
    'Способ оплаты',
    'Статус оплаты',
    'Статус заказа',
    'Дата создания'
  ];

  const paymentMethodMap: Record<string, string> = {
    'yoomoney': 'Онлайн оплата',
    'directTransfer': 'Прямой перевод',
    'balance': 'Баланс'
  };

  const paymentStatusMap: Record<string, string> = {
    'pending': 'Ожидает оплаты',
    'completed': 'Оплачен',
    'failed': 'Ошибка оплаты'
  };

  const orderStatusMap: Record<string, string> = {
    'pending': 'В ожидании',
    'processing': 'В обработке',
    'shipped': 'Отправлен',
    'completed': 'Завершен',
    'cancelled': 'Отменен'
  };

  const rows = orders.map(order => [
    order.id,
    escapeCSVField(order.full_name || ''),
    escapeCSVField(order.phone || ''),
    escapeCSVField(order.address || ''),
    `${parseFloat(order.total_amount || '0').toLocaleString('ru-RU')} ₽`,
    order.delivery_type === 'cdek' ? 'СДЭК' : 'Почта России',
    paymentMethodMap[order.payment_method] || order.payment_method,
    paymentStatusMap[order.payment_status] || order.payment_status,
    orderStatusMap[order.order_status] || order.order_status,
    new Date(order.created_at).toLocaleDateString('ru-RU')
  ]);

  return [headers, ...rows]
    .map(row => row.map(field => escapeCSVField(field.toString())).join(';'))
    .join('\n');
}