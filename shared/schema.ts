import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  socialType: text("social_type"),
  isAdmin: boolean("is_admin").default(false),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  isAdmin: true,
  balance: true,
  createdAt: true,
});

// Product schema
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  images: text("images").array().notNull(),
  quantity: integer("quantity").notNull().default(0),
  category: text("category").notNull(),
  isAvailable: boolean("is_available").default(true),
  isPreorder: boolean("is_preorder").default(false),
  isRare: boolean("is_rare").default(false),
  isEasyToCare: boolean("is_easy_to_care").default(false),
  labels: text("labels").array(),
  deliveryCost: decimal("delivery_cost", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

// Order schema
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  items: jsonb("items").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  deliveryAmount: decimal("delivery_amount", { precision: 10, scale: 2 }).notNull(),
  fullName: text("full_name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  socialNetwork: text("social_network"),
  socialUsername: text("social_username"),
  deliveryType: text("delivery_type").notNull(),
  deliverySpeed: text("delivery_speed").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  orderStatus: text("order_status").default("pending"),
  needStorage: boolean("need_storage").default(false),
  needInsulation: boolean("need_insulation").default(false),
  paymentProofUrl: text("payment_proof_url"),
  adminComment: text("admin_comment"),
  trackingNumber: text("tracking_number"),
  estimatedDeliveryDate: timestamp("estimated_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  receiptNumber: text("receipt_number"),
  receiptUrl: text("receipt_url"),
  receiptGeneratedAt: timestamp("receipt_generated_at"),
  lastStatusChangeAt: timestamp("last_status_change_at"),
  statusHistory: jsonb("status_history").default([]),
  productQuantitiesReduced: boolean("product_quantities_reduced").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOrderSchema = z.object({
  userId: z.string(),
  items: z.array(z.object({
    id: z.number(),
    quantity: z.number(),
    price: z.number()
  })),
  totalAmount: z.string(),
  deliveryAmount: z.number(),
  fullName: z.string(),
  address: z.string(),
  phone: z.string(),
  socialNetwork: z.enum(["telegram", "whatsapp"]).optional(),
  socialUsername: z.string().optional(),
  deliveryType: z.enum(["cdek", "russianPost"]),
  deliverySpeed: z.enum(["standard", "express"]),
  paymentMethod: z.enum(["yoomoney", "directTransfer", "balance"]),
  needStorage: z.boolean().default(false),
  needInsulation: z.boolean().default(false),
  comment: z.string().optional(),
  promoCode: z.string().nullable().optional(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

// Review schema
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id"),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  images: text("images").array(),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  isApproved: true,
  createdAt: true,
});

export type Review = typeof reviews.$inferSelect;

// Notification schema
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id"),
  type: text("type").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Payment Details schema
export const paymentDetails = pgTable("payment_details", {
  id: serial("id").primaryKey(),
  bankDetails: text("bank_details").notNull(),
  qrCodeUrl: text("qr_code_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentDetailsSchema = createInsertSchema(paymentDetails).omit({
  id: true,
  updatedAt: true,
});

// Define types for export
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type PaymentDetails = typeof paymentDetails.$inferSelect;
export type InsertPaymentDetails = z.infer<typeof insertPaymentDetailsSchema>;
