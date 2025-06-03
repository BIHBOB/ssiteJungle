import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, initAuth } from "./auth";
import { z } from "zod";
import { insertProductSchema, insertOrderSchema, insertReviewSchema, insertNotificationSchema, insertPaymentDetailsSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
// Import db для прямого доступа к базе данных
import { db } from "./db-sqlite";

// Get auth functions
const { comparePasswords, hashPassword } = initAuth(db);

// Configure multer storage
const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), "uploads");
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только изображения"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Sets up authentication routes
  setupAuth(app);
  
  // Serve static uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  
  // Product routes
  app.get("/api/products", async (req, res) => {
    const { category, available, preorder, search, minPrice, maxPrice, labels } = req.query;
    
    const filters: any = {};
    
    if (category) filters.category = category as string;
    if (available !== undefined) filters.available = available === "true";
    if (preorder !== undefined) filters.preorder = preorder === "true";
    if (search) filters.search = search as string;
    if (minPrice) filters.minPrice = parseFloat(minPrice as string);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);
    if (labels) filters.labels = (labels as string).split(",");
    
    const products = await storage.getAllProducts(filters);
    res.json(products);
  });
  
  app.get("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const product = await storage.getProduct(id);
    
    if (!product) {
      return res.status(404).json({ message: "Товар не найден" });
    }
    
    res.json(product);
  });
  
  app.post("/api/products", ensureAdmin, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      throw error;
    }
  });
  
  app.put("/api/products/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, productData);
      
      if (!product) {
        return res.status(404).json({ message: "Товар не найден" });
      }
      
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      throw error;
    }
  });
  
  app.delete("/api/products/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteProduct(id);
    
    if (!success) {
      return res.status(404).json({ message: "Товар не найден" });
    }
    
    res.status(204).end();
  });
  
  // Order routes
  app.get("/api/orders", ensureAuthenticated, async (req, res) => {
    if (req.user.isAdmin) {
      const orders = await storage.getAllOrders();
      return res.json(orders);
    }
    
    const orders = await storage.getOrdersByUser(req.user.id);
    res.json(orders);
  });
  
  // Get current user's orders
  app.get("/api/user/orders", ensureAuthenticated, async (req, res) => {
    try {
      const orders = await storage.getOrdersByUser(req.user.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      res.status(500).json({ message: "Не удалось получить заказы" });
    }
  });
  
  app.get("/api/orders/:id", ensureAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const order = await storage.getOrder(id);
    
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден" });
    }
    
    // Check if user has access to this order
    if (!req.user.isAdmin && order.userId !== req.user.id) {
      return res.status(403).json({ message: "Доступ запрещен" });
    }
    
    res.json(order);
  });
  
  app.post("/api/orders", ensureAuthenticated, async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const user = req.user as any; // Получаем пользователя из запроса
      
      // Ensure userId matches authenticated user
      if (orderData.userId !== user.id) {
        return res.status(403).json({ message: "Нельзя создать заказ от имени другого пользователя" });
      }
      
      // Добавляем начальный статус платежа
      const updatedOrderData = {
        ...orderData,
        paymentStatus: orderData.paymentMethod === "balance" ? "completed" : "pending",
        orderStatus: orderData.paymentMethod === "balance" ? "processing" : "pending"
      };
      
      // Проверяем метод оплаты "balance" и достаточный баланс
      if (orderData.paymentMethod === "balance") {
        try {
          // Получаем текущий баланс пользователя из БД для свежих данных
          const dbUser = await db.queryOne("SELECT * FROM users WHERE id = ?", [user.id]) as { 
            balance?: string 
          };

          // Проверяем баланс и сравниваем с суммой заказа
          const userBalance = dbUser && dbUser.balance ? parseFloat(dbUser.balance) : 0;
          const orderTotal = parseFloat(orderData.totalAmount);
          
          // Проверяем, достаточно ли средств
          if (userBalance < orderTotal) {
            return res.status(400).json({ 
              message: "Недостаточно средств на балансе", 
              requiredAmount: orderTotal,
              availableBalance: userBalance 
            });
          }
          
          // Списываем деньги с баланса
          const newBalance = (userBalance - orderTotal).toFixed(2);
          
          // Обновляем баланс пользователя в БД
          await db.run(
            "UPDATE users SET balance = ?, updated_at = ? WHERE id = ?",
            [newBalance, new Date().toISOString(), user.id]
          );
          
          // Обновляем баланс в сессии пользователя
          user.balance = newBalance;
          
          console.log(`Баланс пользователя ${user.id} обновлен: ${userBalance} -> ${newBalance}`);
          
        } catch (error) {
          console.error("Ошибка при проверке/обновлении баланса:", error);
          return res.status(500).json({ 
            message: "Ошибка при обработке платежа. Пожалуйста, попробуйте позже." 
          });
        }
      }
      
      const createdOrder = await storage.createOrder(updatedOrderData);
      res.json(createdOrder);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(400).json({ 
        message: "Failed to create order", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.put("/api/orders/:id", ensureAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const order = await storage.getOrder(id);
    
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден" });
    }
    
    // Regular users can only update their own orders and only specific fields
    if (!req.user.isAdmin) {
      if (order.userId !== req.user.id) {
        return res.status(403).json({ message: "Доступ запрещен" });
      }
      
      // Check if order is already shipped
      if (order.orderStatus === "shipped") {
        return res.status(400).json({ message: "Нельзя изменить заказ после отправки" });
      }
      
      // Regular users can only update specific fields
      const allowedFields = ["fullName", "address", "phone", "needStorage", "needInsulation"];
      const updatedData: any = {};
      
      for (const field of allowedFields) {
        if (field in req.body) {
          updatedData[field] = req.body[field];
        }
      }
      
      const updatedOrder = await storage.updateOrder(id, updatedData);
      return res.json(updatedOrder);
    }
    
    // Admin can update any field
    try {
      const updatedOrder = await storage.updateOrder(id, req.body);
      res.json(updatedOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      throw error;
    }
  });
  
  // Upload payment proof
  app.post("/api/orders/:id/payment-proof", ensureAuthenticated, upload.single("proof"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Файл не найден" });
    }
    
    const id = parseInt(req.params.id);
    const order = await storage.getOrder(id);
    
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден" });
    }
    
    // Check if user has access to this order
    if (!req.user.isAdmin && order.userId !== req.user.id) {
      return res.status(403).json({ message: "Доступ запрещен" });
    }
    
    const filePath = `/uploads/${req.file.filename}`;
    
    const updatedOrder = await storage.updateOrder(id, {
      paymentProofUrl: filePath,
      paymentStatus: "pending_verification"
    });
    
    res.json(updatedOrder);
  });
  
  // Review routes
  app.get("/api/reviews", async (req, res) => {
    const { approved, productId } = req.query;
    
    if (productId) {
      const reviews = await storage.getReviewsByProduct(parseInt(productId as string));
      return res.json(reviews);
    }
    
    // Если параметр approved задан и пользователь не админ, вернуть только одобренные отзывы
    if (approved !== undefined && (!req.isAuthenticated() || !req.user?.isAdmin)) {
      const reviews = await storage.getAllReviews(true); // Всегда возвращать только одобренные
      return res.json(reviews);
    }
    
    // Если пользователь админ или параметр approved не задан, вернуть все отзывы
    const reviews = await storage.getAllReviews(approved === "true");
    res.json(reviews);
  });
  
  app.post("/api/reviews", ensureAuthenticated, async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse(req.body);
      
      // Ensure userId matches authenticated user
      if (reviewData.userId !== req.user.id) {
        return res.status(403).json({ message: "Нельзя создать отзыв от имени другого пользователя" });
      }
      
      const review = await storage.createReview(reviewData);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      throw error;
    }
  });
  
  app.put("/api/reviews/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    
    try {
      const updatedReview = await storage.updateReview(id, req.body);
      
      if (!updatedReview) {
        return res.status(404).json({ message: "Отзыв не найден" });
      }
      
      res.json(updatedReview);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      throw error;
    }
  });
  
  app.delete("/api/reviews/:id", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteReview(id);
    
    if (!success) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }
    
    res.status(204).end();
  });
  
  // Get current user's reviews
  app.get("/api/user/reviews", ensureAuthenticated, async (req, res) => {
    try {
      const reviews = await storage.getReviewsByUser(req.user.id);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      res.status(500).json({ message: "Не удалось получить отзывы" });
    }
  });
  
  // Notification routes
  app.get("/api/notifications", ensureAuthenticated, async (req, res) => {
    const notifications = await storage.getNotificationsByUser(req.user.id);
    res.json(notifications);
  });
  
  // Get current user's notifications
  app.get("/api/user/notifications", ensureAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      res.status(500).json({ message: "Не удалось получить уведомления" });
    }
  });
  
  app.post("/api/notifications", ensureAuthenticated, async (req, res) => {
    try {
      const notificationData = insertNotificationSchema.parse(req.body);
      
      // Ensure userId matches authenticated user
      if (notificationData.userId !== req.user.id) {
        return res.status(403).json({ message: "Нельзя создать уведомление от имени другого пользователя" });
      }
      
      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      throw error;
    }
  });
  
  app.delete("/api/notifications/:id", ensureAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const notification = await storage.getNotification(id);
    
    if (!notification) {
      return res.status(404).json({ message: "Уведомление не найдено" });
    }
    
    // Users can only delete their own notifications
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ message: "Доступ запрещен" });
    }
    
    const success = await storage.deleteNotification(id);
    
    if (!success) {
      return res.status(404).json({ message: "Уведомление не найдено" });
    }
    
    res.status(204).end();
  });
  
  // Payment details routes
  app.get("/api/payment-details", async (req, res) => {
    const paymentDetails = await storage.getPaymentDetails();
    
    if (!paymentDetails) {
      return res.status(404).json({ message: "Реквизиты не найдены" });
    }
    
    res.json(paymentDetails);
  });
  
  app.put("/api/payment-details", ensureAdmin, async (req, res) => {
    try {
      const paymentDetailsData = insertPaymentDetailsSchema.parse(req.body);
      const paymentDetails = await storage.updatePaymentDetails(paymentDetailsData);
      res.json(paymentDetails);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      throw error;
    }
  });
  
  // User routes
  app.get("/api/users", ensureAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    
    // Remove passwords
    const safeUsers = users.map(({ password, ...user }) => user);
    
    res.json(safeUsers);
  });
  
  app.put("/api/users/:id", ensureAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    
    // Regular users can only update themselves
    if (!req.user.isAdmin && id !== req.user.id) {
      return res.status(403).json({ message: "Доступ запрещен" });
    }
    
    // Only admins can set admin status
    if (!req.user.isAdmin && req.body.isAdmin !== undefined) {
      return res.status(403).json({ message: "Доступ запрещен" });
    }
    
    // Only admins can update balance
    if (!req.user.isAdmin && req.body.balance !== undefined) {
      return res.status(403).json({ message: "Доступ запрещен" });
    }
    
    // Password updates require old password verification
    if (req.body.password && !req.user.isAdmin) {
      if (!req.body.oldPassword) {
        return res.status(400).json({ message: "Требуется текущий пароль" });
      }
      
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      const isValid = await comparePasswords(req.body.oldPassword, user.password);
      
      if (!isValid) {
        return res.status(400).json({ message: "Неверный текущий пароль" });
      }
      
      // Hash new password
      req.body.password = await hashPassword(req.body.password);
    }
    
    // Update user
    const updatedUser = await storage.updateUser(id, req.body);
    
    if (!updatedUser) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    
    res.json(userWithoutPassword);
  });
  
  // Специальный маршрут для начисления баланса пользователям (только для админов)
  app.post("/api/users/:id/add-balance", ensureAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { amount } = req.body;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Некорректный ID пользователя" });
      }
      
      if (typeof amount !== "string" || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Некорректная сумма для начисления" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      // Вычисляем новый баланс
      const currentBalance = user.balance ? parseFloat(user.balance) : 0;
      const newBalance = (currentBalance + parseFloat(amount)).toString();
      
      // Обновляем баланс пользователя
      const updatedUser = await storage.updateUser(userId, { balance: newBalance });
      
      // Убираем пароль из ответа
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  const httpServer = createServer(app);
  
  return httpServer;
}

// Middleware to ensure user is authenticated
function ensureAuthenticated(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  next();
}

// Middleware to ensure user is admin
function ensureAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Требуются права администратора" });
  }
  
  next();
}
