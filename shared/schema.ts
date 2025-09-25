import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  currency: text("currency").default('XAF'),
  role: text("role").default('user'),
});

// Main categories table
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Subcategories table
export const expenseSubcategories = pgTable("expense_subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Income categories table
export const incomeCategories = pgTable("income_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Income subcategories table
export const incomeSubcategories = pgTable("income_subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => incomeCategories.id),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Updated expenses table with category/subcategory references
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  subcategoryId: integer("subcategory_id").references(() => expenseSubcategories.id),
  merchant: text("merchant"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Income table
export const incomes = pgTable("incomes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  categoryId: integer("category_id").notNull().references(() => incomeCategories.id),
  subcategoryId: integer("subcategory_id").references(() => incomeSubcategories.id),
  source: text("source"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Budget planning table
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  period: text("period").notNull().default("monthly"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  amount: doublePrecision("amount").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Budget category allocations
export const budgetAllocations = pgTable("budget_allocations", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id").notNull().references(() => budgets.id),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  subcategoryId: integer("subcategory_id").references(() => expenseSubcategories.id),
  amount: doublePrecision("amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
});

// Category schemas
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).pick({
  name: true,
  description: true,
});

export const insertExpenseSubcategorySchema = createInsertSchema(expenseSubcategories).pick({
  categoryId: true,
  name: true,
  description: true,
});

export const insertIncomeCategorySchema = createInsertSchema(incomeCategories).pick({
  name: true,
  description: true,
  isSystem: true,
});

export const insertIncomeSubcategorySchema = createInsertSchema(incomeSubcategories).pick({
  categoryId: true,
  name: true,
  description: true,
});

// For backward compatibility with existing app
export const legacyInsertExpenseSchema = createInsertSchema(expenses)
  .pick({
    amount: true,
    description: true,
    date: true,
    merchant: true,
    notes: true,
  })
  .extend({
    category: z.string(), // For backward compatibility
  });

// New expense schema that uses proper category relationships
export const insertExpenseSchema = createInsertSchema(expenses)
  .pick({
    amount: true,
    description: true,
    date: true,
    categoryId: true,
    subcategoryId: true,
    merchant: true,
    notes: true,
  });

// Income schema
export const insertIncomeSchema = createInsertSchema(incomes)
  .pick({
    amount: true,
    description: true,
    date: true,
    categoryId: true,
    subcategoryId: true,
    source: true,
    notes: true,
  });

// Budget schemas
export const insertBudgetSchema = createInsertSchema(budgets)
  .pick({
    name: true,
    period: true,
    startDate: true,
    endDate: true,
    amount: true,
    notes: true,
  });

export const insertBudgetAllocationSchema = createInsertSchema(budgetAllocations)
  .pick({
    budgetId: true,
    categoryId: true,
    subcategoryId: true,
    amount: true,
  });

// Client-side validation schemas
export const clientExpenseSchema = insertExpenseSchema.extend({
  amount: z.number().positive({ message: 'Amount is required and must be positive' }),
  description: z.string().min(1, { message: 'Description is required' }),
  date: z.union([z.date(), z.string().min(1).pipe(z.coerce.date())]),
  categoryId: z.number().int().positive({ message: 'Category is required' }),
  merchant: z.string().min(1, { message: 'Merchant/Payee is required' }),
  // subcategoryId can be null or a positive number, so we allow null or positive int
  subcategoryId: z.union([z.number().int().positive(), z.null()]),
  notes: z.string().optional(),
});

export const clientIncomeSchema = insertIncomeSchema.extend({
  date: z.union([z.date(), z.string().min(1).pipe(z.coerce.date())])
});

export const clientBudgetSchema = insertBudgetSchema.extend({
  name: z.string().min(1, { message: 'Budget name is required' }),
  period: z.string().min(1, { message: 'Period is required' }),
  startDate: z.union([z.date(), z.string().min(1).pipe(z.coerce.date())]),
  endDate: z.union([z.date(), z.string().min(1).pipe(z.coerce.date())]),
  amount: z.number().positive({ message: 'Total budget is required and must be positive' }),
  notes: z.string().optional(),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseSubcategory = typeof expenseSubcategories.$inferSelect;
export type InsertExpenseSubcategory = z.infer<typeof insertExpenseSubcategorySchema>;

export type IncomeCategory = typeof incomeCategories.$inferSelect;
export type InsertIncomeCategory = z.infer<typeof insertIncomeCategorySchema>;
export type IncomeSubcategory = typeof incomeSubcategories.$inferSelect;
export type InsertIncomeSubcategory = z.infer<typeof insertIncomeSubcategorySchema>;

export type Expense = typeof expenses.$inferSelect & { category_name?: string };
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type LegacyInsertExpense = z.infer<typeof legacyInsertExpenseSchema>;

export type Income = typeof incomes.$inferSelect & {
  categoryName?: string | null;
  subcategoryName?: string | null;
};

export type InsertIncome = z.infer<typeof insertIncomeSchema>;

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type BudgetAllocation = typeof budgetAllocations.$inferSelect;
export type InsertBudgetAllocation = z.infer<typeof insertBudgetAllocationSchema>;
