import {
  users, products, orders, reviews, notifications, paymentDetails,
  User, InsertUser, Product, InsertProduct, Order, InsertOrder,
  Review, InsertReview, Notification, InsertNotification,
  PaymentDetails, InsertPaymentDetails
} from "@shared/schema";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { IStorage } from "./storage";
import { db, pool } from "./db";
import { eq, like, and, between, gte, lte, desc, isNotNull, SQL, sql } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const user = await db.queryOne("SELECT * FROM users WHERE id = ?", [id]);
      return transformToUser(user);
    } catch (e) {
      console.error("Error getting user:", e);
      return undefined;
    }
  }

  async getUserById(id: string): Promise<User | undefined> {
    try {
      const user = await db.queryOne("SELECT * FROM users WHERE id = ?", [id]);
      return transformToUser(user);
    } catch (e) {
      console.error("Error getting user by ID:", e);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [createdUser] = await db.insert(users).values(user).returning();
    return createdUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }

  // Product operations
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getAllProducts(filters?: {
    category?: string;
    available?: boolean;
    preorder?: boolean;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    labels?: string[];
    rare?: boolean;
    easy?: boolean;
  }): Promise<Product[]> {
    const conditions: SQL[] = [];

    if (filters) {
      if (filters.category) {
        conditions.push(eq(products.category, filters.category));
      }
      
      if (filters.available === true) {
        conditions.push(eq(products.isAvailable, true));
      }
      
      if (filters.preorder === true) {
        conditions.push(eq(products.isPreorder, true));
      }
      
      if (filters.rare === true) {
        conditions.push(eq(products.isRare, true));
      }
      
      if (filters.easy === true) {
        conditions.push(eq(products.isEasyToCare, true));
      }
      
      if (filters.search) {
        conditions.push(
          sql`(${products.name} ILIKE ${'%' + filters.search + '%'} OR ${products.description} ILIKE ${'%' + filters.search + '%'})`
        );
      }
      
      if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
        conditions.push(between(products.price, filters.minPrice, filters.maxPrice));
      } else if (filters.minPrice !== undefined) {
        conditions.push(gte(products.price, filters.minPrice));
      } else if (filters.maxPrice !== undefined) {
        conditions.push(lte(products.price, filters.maxPrice));
      }
      
      if (filters.labels && filters.labels.length > 0) {
        // Check if any label is included in the product labels array
        const labelConditions = filters.labels.map(label => 
          sql`${products.labels} @> ARRAY[${label}]::text[]`
        );
        
        conditions.push(sql`(${labelConditions.join(' OR ')})`);
      }
    }
    
    if (conditions.length > 0) {
      return db.select().from(products).where(and(...conditions));
    }
    
    return db.select().from(products);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [createdProduct] = await db.insert(products).values(product).returning();
    return createdProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...productData, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount > 0;
  }

  // Order operations
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByUser(userId: number): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [createdOrder] = await db.insert(orders).values(order).returning();
    return createdOrder;
  }

  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order | undefined> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ ...orderData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    
    return updatedOrder;
  }

  // Review operations
  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async getReviewsByProduct(productId: number): Promise<Review[]> {
    return db
      .select()
      .from(reviews)
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));
  }

  async getReviewsByUser(userId: number): Promise<Review[]> {
    return db
      .select()
      .from(reviews)
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt));
  }

  async getAllReviews(approved?: boolean): Promise<Review[]> {
    if (approved !== undefined) {
      return db
        .select()
        .from(reviews)
        .where(eq(reviews.isApproved, approved))
        .orderBy(desc(reviews.createdAt));
    }
    
    return db
      .select()
      .from(reviews)
      .orderBy(desc(reviews.createdAt));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [createdReview] = await db.insert(reviews).values(review).returning();
    return createdReview;
  }

  async updateReview(id: number, reviewData: Partial<Review>): Promise<Review | undefined> {
    const [updatedReview] = await db
      .update(reviews)
      .set(reviewData)
      .where(eq(reviews.id, id))
      .returning();
    
    return updatedReview;
  }

  async deleteReview(id: number): Promise<boolean> {
    const result = await db.delete(reviews).where(eq(reviews.id, id));
    return result.rowCount > 0;
  }

  // Notification operations
  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getNotificationsByProduct(productId: number): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.productId, productId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [createdNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    
    return createdNotification;
  }

  async updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const [updatedNotification] = await db
      .update(notifications)
      .set(notificationData)
      .where(eq(notifications.id, id))
      .returning();
    
    return updatedNotification;
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id));
    return result.rowCount > 0;
  }

  // Payment details operations
  async getPaymentDetails(): Promise<PaymentDetails | undefined> {
    const [details] = await db.select().from(paymentDetails);
    return details;
  }

  async updatePaymentDetails(details: InsertPaymentDetails): Promise<PaymentDetails> {
    // Delete all existing records and insert new one
    await db.delete(paymentDetails);
    
    const [updatedDetails] = await db
      .insert(paymentDetails)
      .values(details)
      .returning();
    
    return updatedDetails;
  }
}