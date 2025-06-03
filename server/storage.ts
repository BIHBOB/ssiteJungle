import {
  users, products, orders, reviews, notifications, paymentDetails,
  User, InsertUser, Product, InsertProduct, Order, InsertOrder,
  Review, InsertReview, Notification, InsertNotification,
  PaymentDetails, InsertPaymentDetails
} from "@shared/schema";
import session from "express-session";
import { DatabaseStorage } from "./storage-db";

// Define the storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  
  // Product operations
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(filters?: {
    category?: string;
    available?: boolean;
    preorder?: boolean;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    labels?: string[];
  }): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Order operations
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByUser(userId: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order | undefined>;
  
  // Review operations
  getReview(id: number): Promise<Review | undefined>;
  getReviewsByProduct(productId: number): Promise<Review[]>;
  getReviewsByUser(userId: number): Promise<Review[]>;
  getAllReviews(approved?: boolean): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: number, review: Partial<Review>): Promise<Review | undefined>;
  deleteReview(id: number): Promise<boolean>;
  
  // Notification operations
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  getNotificationsByProduct(productId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notification: Partial<Notification>): Promise<Notification | undefined>;
  deleteNotification(id: number): Promise<boolean>;
  
  // Payment details operations
  getPaymentDetails(): Promise<PaymentDetails | undefined>;
  updatePaymentDetails(details: InsertPaymentDetails): Promise<PaymentDetails>;
  
  // Session store
  sessionStore: session.Store;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private reviews: Map<number, Review>;
  private notifications: Map<number, Notification>;
  private paymentDetails: PaymentDetails | undefined;
  
  sessionStore: session.Store;
  
  private userIdCounter: number;
  private productIdCounter: number;
  private orderIdCounter: number;
  private reviewIdCounter: number;
  private notificationIdCounter: number;
  
  constructor() {
    // Initialize maps
    this.users = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.reviews = new Map();
    this.notifications = new Map();
    
    // Initialize counters
    this.userIdCounter = 1;
    this.productIdCounter = 1;
    this.orderIdCounter = 1;
    this.reviewIdCounter = 1;
    this.notificationIdCounter = 1;
    
    // Initialize session store
    const MemoryStore = memorystore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Initialize payment details
    this.paymentDetails = {
      id: 1,
      bankDetails: "Сбербанк 1234 5678 9012 3456\nПолучатель: Иванов Иван Иванович",
      qrCodeUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyOTAgMjkwIj48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNMCAwaDI5MHYyOTBIMHoiLz48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yNCAyNGgyNDJ2MjQySDI0eiIvPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTU0IDU0aDE4MnYxODJINTR6Ii8+PHBhdGggZD0iTTU0IDU0aDIydjIySDU0em0yMiAwaDIydjIySDc2em0yMiAwaDIydjIySDk4em0yMiAwaDIydjIyaC0yMnptMjIgMGgyMnYyMmgtMjJ6bTIyIDBoMjJ2MjJoLTIyem0yMiAwaDIydjIyaC0yMnpNNTQgNzZoMjJ2MjJINTR6bTExMCAwaDIydjIyaC0yMnptNjYgMGgyMnYyMmgtMjJ6TTU0IDk4aDIydjIySDU0em0yMiAwaDIydjIySDc2em0yMiAwaDIydjIySDk4em0yMiAwaDIydjIyaC0yMnptMjIgMGgyMnYyMmgtMjJ6bTIyIDBoMjJ2MjJoLTIyem0yMiAwaDIydjIyaC0yMnpNNTQgMTIwaDIydjIySDU0em0xMTAgMGgyMnYyMmgtMjJ6bTIyIDBoMjJ2MjJoLTIyem0yMiAwaDIydjIyaC0yMnpNNTQgMTQyaDIydjIySDU0em0yMiAwaDIydjIySDc2em0yMiAwaDIydjIySDk4em0yMiAwaDIydjIyaC0yMnptNDQgMGgyMnYyMmgtMjJ6bTIyIDBoMjJ2MjJoLTIyem0yMiAwaDIydjIyaC0yMnpNNTQgMTY0aDIydjIySDU0em01NSAwaDIydjIyaC0yMnptMjIgMGgyMnYyMmgtMjJ6bTIyIDBoMjJ2MjJoLTIyem0yMiAwaDIydjIyaC0yMnptNDQgMGgyMnYyMmgtMjJ6TTU0IDE4NmgyMnYyMkg1NHptMjIgMGgyMnYyMkg3NnptMjIgMGgyMnYyMkg5OHptMjIgMGgyMnYyMmgtMjJ6bTIyIDBoMjJ2MjJoLTIyem0yMiAwaDIydjIyaC0yMnptMjIgMGgyMnYyMmgtMjJ6TTU0IDIwOGgyMnYyMkg1NHptMTEwIDBoMjJ2MjJoLTIyem0yMiAwaDIydjIyaC0yMnptMjIgMGgyMnYyMmgtMjJ6Ii8+PC9zdmc+",
      updatedAt: new Date()
    };
    
    // Add sample products
    this.createInitialProducts();
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserById(id: string): Promise<User | undefined> {
    const numericId = parseInt(id);
    if (isNaN(numericId)) return undefined;
    return this.getUser(numericId);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username.toLowerCase() === username.toLowerCase());
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email.toLowerCase() === email.toLowerCase());
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = {
      ...user,
      id,
      isAdmin: this.users.size === 0, // First user is admin
      balance: "0",
      createdAt: new Date()
    };
    this.users.set(id, newUser);
    return newUser;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // Product operations
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  async getAllProducts(filters?: {
    category?: string;
    available?: boolean;
    preorder?: boolean;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    labels?: string[];
  }): Promise<Product[]> {
    let products = Array.from(this.products.values());
    
    if (filters) {
      if (filters.category) {
        products = products.filter(p => p.category === filters.category);
      }
      
      if (filters.available !== undefined) {
        products = products.filter(p => p.isAvailable === filters.available);
      }
      
      if (filters.preorder !== undefined) {
        products = products.filter(p => p.isPreorder === filters.preorder);
      }
      
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        products = products.filter(p => 
          p.name.toLowerCase().includes(searchTerm) || 
          p.description.toLowerCase().includes(searchTerm)
        );
      }
      
      if (filters.minPrice !== undefined) {
        products = products.filter(p => parseFloat(p.price.toString()) >= filters.minPrice!);
      }
      
      if (filters.maxPrice !== undefined) {
        products = products.filter(p => parseFloat(p.price.toString()) <= filters.maxPrice!);
      }
      
      if (filters.labels && filters.labels.length > 0) {
        products = products.filter(p => 
          p.labels && filters.labels!.some(label => p.labels!.includes(label))
        );
      }
    }
    
    return products;
  }
  
  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    const newProduct: Product = {
      ...product,
      id,
      createdAt: new Date()
    };
    this.products.set(id, newProduct);
    return newProduct;
  }
  
  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updatedProduct = { ...product, ...productData };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }
  
  // Order operations
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }
  
  async getOrdersByUser(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.userId === userId);
  }
  
  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }
  
  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.orderIdCounter++;
    const newOrder: Order = {
      ...order,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }
  
  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updatedOrder = { ...order, ...orderData, updatedAt: new Date() };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }
  
  // Review operations
  async getReview(id: number): Promise<Review | undefined> {
    return this.reviews.get(id);
  }
  
  async getReviewsByProduct(productId: number): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.productId === productId && review.isApproved);
  }
  
  async getReviewsByUser(userId: number): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(review => review.userId === userId);
  }
  
  async getAllReviews(approved?: boolean): Promise<Review[]> {
    const reviews = Array.from(this.reviews.values());
    if (approved !== undefined) {
      return reviews.filter(review => review.isApproved === approved);
    }
    return reviews;
  }
  
  async createReview(review: InsertReview): Promise<Review> {
    const id = this.reviewIdCounter++;
    const newReview: Review = {
      ...review,
      id,
      isApproved: false,
      createdAt: new Date()
    };
    this.reviews.set(id, newReview);
    return newReview;
  }
  
  async updateReview(id: number, reviewData: Partial<Review>): Promise<Review | undefined> {
    const review = this.reviews.get(id);
    if (!review) return undefined;
    
    const updatedReview = { ...review, ...reviewData };
    this.reviews.set(id, updatedReview);
    return updatedReview;
  }
  
  async deleteReview(id: number): Promise<boolean> {
    return this.reviews.delete(id);
  }
  
  // Notification operations
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }
  
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(notification => notification.userId === userId);
  }
  
  async getNotificationsByProduct(productId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      notification => notification.productId === productId && notification.isActive
    );
  }
  
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: new Date()
    };
    this.notifications.set(id, newNotification);
    return newNotification;
  }
  
  async updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification = { ...notification, ...notificationData };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  async deleteNotification(id: number): Promise<boolean> {
    return this.notifications.delete(id);
  }
  
  // Payment details operations
  async getPaymentDetails(): Promise<PaymentDetails | undefined> {
    return this.paymentDetails;
  }
  
  async updatePaymentDetails(details: InsertPaymentDetails): Promise<PaymentDetails> {
    if (this.paymentDetails) {
      this.paymentDetails = {
        ...this.paymentDetails,
        ...details,
        updatedAt: new Date()
      };
    } else {
      this.paymentDetails = {
        id: 1,
        ...details,
        updatedAt: new Date()
      };
    }
    
    return this.paymentDetails;
  }
  
  // Create initial products
  private async createInitialProducts() {
    const products: InsertProduct[] = [
      {
        name: "Монстера Делициоза",
        description: "Монстера Делициоза - популярное комнатное растение с характерными большими резными листьями. Отличается быстрым ростом и неприхотливостью в уходе.",
        price: "2550",
        originalPrice: "3000",
        images: [
          "https://pixabay.com/get/g2b099bb54b8b0ed73174958cd5b5bc2f0a2161c80ece3fa679d031836c4a4734fa43569e0e4a394c5b94bb2c584c801c2d517d800bfc917b5a3848327c826779_1280.jpg"
        ],
        quantity: 10,
        category: "Крупнолистные",
        isAvailable: true,
        isPreorder: false,
        labels: ["Скидка"],
        deliveryCost: "350"
      },
      {
        name: "Фикус Лировидный",
        description: "Фикус Лировидный (Ficus Lyrata) - эффектное растение с крупными скрипкообразными листьями темно-зеленого цвета с выраженными прожилками.",
        price: "3200",
        images: [
          "https://pixabay.com/get/g4a73641b46cf44eeafb79695fc0576bab7ed13b9ff9479621b31d037022041cdaa762c89bceaf7128a46a6a5621c28d36aefe2268785a771df5e2b3de166fe11_1280.jpg"
        ],
        quantity: 5,
        category: "Фикусы",
        isAvailable: true,
        isPreorder: false,
        labels: ["Растение с фото"],
        deliveryCost: "350"
      },
      {
        name: "Калатея Орбифолия",
        description: "Калатея Орбифолия - изящное растение с крупными округлыми листьями светло-зеленого цвета с серебристыми полосами.",
        price: "1800",
        images: [
          "https://pixabay.com/get/g48a364a5e26116023325bb1406888a8854752b60c5834ca370455ba8b20c547e958ee5c999064cbb0c05f548df642d5d4cc6186fc3d8dbb572fb97ba24973e3e_1280.jpg"
        ],
        quantity: 8,
        category: "Декоративно-лиственные",
        isAvailable: true,
        isPreorder: false,
        labels: ["Без выбора"],
        deliveryCost: "300"
      },
      {
        name: "Филодендрон Биркин",
        description: "Филодендрон Биркин - компактное растение с зелеными сердцевидными листьями, украшенными белыми или кремовыми полосами.",
        price: "2900",
        images: [
          "https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&h=400"
        ],
        quantity: 0,
        category: "Филодендроны",
        isAvailable: false,
        isPreorder: true,
        labels: ["Нет в наличии"],
        deliveryCost: "350"
      },
      {
        name: "Сансевиерия Трифасциата",
        description: "Сансевиерия Трифасциата (Щучий хвост) - неприхотливое растение с жесткими вертикальными листьями с желтыми полосами по краю.",
        price: "1450",
        images: [
          "https://pixabay.com/get/g285e61004927e66ecdc0e5d422e06810cd48951cb0b4ad5f0ab3c050ba8ee8417b61095a94b6c8383fa28d21b9820926d0b934c0563b0c95ae6534ff5615aace_1280.jpg"
        ],
        quantity: 15,
        category: "Суккуленты",
        isAvailable: true,
        isPreorder: false,
        labels: [],
        deliveryCost: "300"
      },
      {
        name: "Эпипремнум Ауреум",
        description: "Эпипремнум Ауреум (Золотой потос) - вьющееся растение с сердцевидными зелеными листьями с золотистыми или мраморными вкраплениями.",
        price: "990",
        originalPrice: "1100",
        images: [
          "https://pixabay.com/get/g0a5d86e717df6053546c61a19dc24f9891a5b55f60011b9d27db046a93872b9bf97556a53600d9fe2c906724d7fce4421cd49060ff591010a9d17166b133ce7a_1280.jpg"
        ],
        quantity: 20,
        category: "Вьющиеся",
        isAvailable: true,
        isPreorder: false,
        labels: ["Скидка"],
        deliveryCost: "300"
      }
    ];
    
    for (const product of products) {
      await this.createProduct(product);
    }
  }
}

export const storage = new DatabaseStorage();
