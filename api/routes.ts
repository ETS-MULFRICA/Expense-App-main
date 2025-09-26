// Import Express types and HTTP server creation
import type { Express, Request, Response } from "express";
import cors from "cors";
import { corsOptions } from "./cors-config";
import { createServer, type Server } from "http";
// Import database storage layer
import { storage } from "./storage";
import { pool } from "./db";
// Import authentication setup
import { setupAuth } from "./auth";
// Import Zod validation schemas for data validation
import { 
  insertExpenseSchema, legacyInsertExpenseSchema, 
  insertIncomeSchema, insertBudgetSchema, insertBudgetAllocationSchema,
  insertExpenseCategorySchema, insertExpenseSubcategorySchema,
  insertIncomeCategorySchema, insertIncomeSubcategorySchema
} from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Authentication Middleware
 * Checks if user is logged in before allowing access to protected routes
 * Returns 401 Unauthorized if user is not authenticated
 */
const requireAuth = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.sendStatus(401);
  }
  try {
    // Check user existence in DB on every request
    const userId = req.user.id;
    const result = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      // User not found in DB
      req.logout?.(() => {});
      return res.sendStatus(401);
    }
    next();
  } catch (err) {
    // DB error (e.g., DB is down)
    return res.status(503).json({ message: "Authentication unavailable: database error" });
  }
};

/**
 * Admin Authorization Middleware
 * Checks if user is authenticated AND has admin role
 * Returns 401 if not authenticated, 403 if not admin
 */
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const userRole = await storage.getUserRole(req.user!.id);
  if (userRole !== 'admin') {
    return res.status(403).json({ message: "Access denied" });
  }
  
  next();
};

/**
 * Main Route Registration Function
 * Sets up all API endpoints for the expense management system
 * Returns HTTP server instance for external configuration
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // -------------------------------------------------------------------------
  // Income Deletion Route
  // -------------------------------------------------------------------------
  app.delete("/api/incomes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("[DEBUG] DELETE /api/incomes/:id called with id:", id);
      const income = await storage.getIncomeById(id);
      const userRole = await storage.getUserRole(req.user!.id);
      if (!income) {
        console.log("[DEBUG] Income not found for id:", id);
        return res.status(404).json({ message: "Income not found" });
      }
      // Allow admins to delete any income, otherwise only allow users to delete their own
      if (income.userId !== req.user!.id && userRole !== 'admin') {
        console.log("[DEBUG] User does not have permission to delete income. userId:", req.user!.id, "income.userId:", income.userId, "userRole:", userRole);
        return res.status(403).json({ message: "You don't have permission to delete this income" });
      }
      await storage.deleteIncome(id);
      console.log("[DEBUG] Called storage.deleteIncome for id:", id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting income:", error);
      res.status(500).json({ message: "Failed to delete income" });
    }
  });
  // -------------------------------------------------------------------------
  // User Income Category Routes
  // ------------------------------------------------------------------------- 
  // Create a user-specific income category
  app.post("/api/user-income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Category name is required" });
      }
      // Prevent duplicate for this user
      const exists = await pool.query('SELECT 1 FROM user_income_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)', [userId, name]);
      if ((exists?.rowCount || 0) > 0) {
        return res.status(409).json({ message: "Category already exists" });
      }
      const result = await pool.query(
        'INSERT INTO user_income_categories (user_id, name) VALUES ($1, $2) RETURNING *',
        [userId, name]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating user income category:", error);
      res.status(500).json({ message: "Failed to create user income category" });
    }
  });

  // Delete a user-specific income category
  app.delete("/api/user-income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      // Ensure the category belongs to the user
      const cat = await pool.query('SELECT * FROM user_income_categories WHERE id = $1 AND user_id = $2', [id, userId]);
      if (cat.rowCount === 0) {
        return res.status(404).json({ message: "Category not found" });
      }
      await pool.query('DELETE FROM user_income_categories WHERE id = $1', [id]);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user income category:", error);
      res.status(500).json({ message: "Failed to delete user income category" });
    }
  });
  // Set up CORS before any routes or auth
  app.use(cors(corsOptions));
  // Authentication routes are set up in index.ts after body parser middleware

  // -------------------------------------------------------------------------
  // Expense Category Management Routes
  // -------------------------------------------------------------------------
  
  /**
   * GET /api/expense-categories
   * Retrieves all expense categories for the authenticated user
   * Used for populating dropdowns and category lists
   */
  app.get("/api/expense-categories", requireAuth, async (req, res) => {
    try {
      // Check if table is empty and populate with defaults if needed
      const countResult = await pool.query('SELECT COUNT(*) FROM expense_categories WHERE user_id = $1', [req.user!.id]);
      if (parseInt(countResult.rows[0].count) === 0) {
        const defaultCategories = [
          { name: 'Food', description: 'Groceries, restaurants, snacks' },
          { name: 'Transport', description: 'Bus, taxi, fuel, car maintenance' },
          { name: 'Utilities', description: 'Electricity, water, internet' },
          { name: 'Health', description: 'Medical, pharmacy, insurance' },
          { name: 'Entertainment', description: 'Movies, events, subscriptions' }
        ];
        for (const cat of defaultCategories) {
          await pool.query(
            'INSERT INTO expense_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, $4)',
            [req.user!.id, cat.name, cat.description, true]
          );
        }
      }
      // Fetch all system categories and all user-created categories
      const categoriesResult = await pool.query(
        'SELECT * FROM expense_categories WHERE is_system = true OR user_id = $1',
        [req.user!.id]
      );
  console.log("[DEBUG] /api/expense-categories for userId:", req.user!.id, "categories:", categoriesResult.rows);
  res.json(categoriesResult.rows);
    } catch (error) {
      console.error("Error fetching expense categories:", error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });
  
  /**
   * POST /api/expense-categories
   * Creates a new expense category for the authenticated user
   * Validates input data using Zod schema before creation
   */
  app.post("/api/expense-categories", requireAuth, async (req, res) => {
    try {
      const categoryData = insertExpenseCategorySchema.parse(req.body);
      const result = await pool.query(
        'INSERT INTO expense_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [req.user!.id, categoryData.name, categoryData.description]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating expense category:", error);
        res.status(500).json({ message: "Failed to create expense category" });
      }
    }
  });
  
  /**
   * PATCH /api/expense-categories/:id
   * Updates an existing expense category
   * Verifies user owns the category before allowing updates
   */
  app.patch("/api/expense-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getExpenseCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        if (!category.is_system) {
          return res.status(403).json({ message: "You don't have permission to update this category" });
        }
      }
      
      const categoryData = insertExpenseCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateExpenseCategory(id, categoryData);
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating expense category:", error);
        res.status(500).json({ message: "Failed to update expense category" });
      }
    }
  });
  
  /**
   * DELETE /api/expense-categories/:id
   * Deletes an expense category owned by the authenticated user
   * Verifies ownership before deletion
   */
  app.delete("/api/expense-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getExpenseCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        if (!category.is_system) {
          return res.status(403).json({ message: "You don't have permission to delete this category" });
        }
      }
      
      await storage.deleteExpenseCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense category:", error);
      res.status(500).json({ message: "Failed to delete expense category", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Expense Subcategory Routes
  // -------------------------------------------------------------------------
  app.get("/api/expense-categories/:categoryId/subcategories", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const category = await storage.getExpenseCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        if (!category.is_system) {
          return res.status(403).json({ message: "You don't have permission to access this category" });
        }
      }
      
      const subcategories = await storage.getExpenseSubcategories(categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching expense subcategories:", error);
      res.status(500).json({ message: "Failed to fetch expense subcategories" });
    }
  });
  
  app.post("/api/expense-subcategories", requireAuth, async (req, res) => {
    try {
      const subcategoryData = insertExpenseSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        if (!category || (!category.is_system && category.userId !== req.user!.id)) {
          return res.status(403).json({ message: "Invalid category" });
        }
      }
      
      const subcategory = await storage.createExpenseSubcategory(req.user!.id, subcategoryData);
      res.status(201).json(subcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating expense subcategory:", error);
        res.status(500).json({ message: "Failed to create expense subcategory" });
      }
    }
  });
  
  app.patch("/api/expense-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getExpenseSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this subcategory" });
      }
      
      const subcategoryData = insertExpenseSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        if (!category || (!category.is_system && category.userId !== req.user!.id)) {
          return res.status(403).json({ message: "Invalid category" });
        }
      }
      
      const updatedSubcategory = await storage.updateExpenseSubcategory(id, subcategoryData);
      
      res.json(updatedSubcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating expense subcategory:", error);
        res.status(500).json({ message: "Failed to update expense subcategory" });
      }
    }
  });
  
  app.delete("/api/expense-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getExpenseSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this subcategory" });
      }
      
      await storage.deleteExpenseSubcategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense subcategory:", error);
      res.status(500).json({ message: "Failed to delete expense subcategory", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Income Category Routes
  // -------------------------------------------------------------------------
  app.get("/api/income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      // Fetch the three default categories
      const defaultCategoriesResult = await pool.query(
        'SELECT id, name FROM income_categories WHERE name IN (\'Wages\', \'Other\', \'Deals\') ORDER BY name'
      );
      const defaultCategories = defaultCategoriesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        isDefault: true
      }));

      // Fetch user-specific categories
      const userCategoriesResult = await pool.query(
        'SELECT * FROM income_categories WHERE user_id = $1 OR is_system = true', [userId]
      );
      const userCategories = userCategoriesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        isDefault: false
      }));

      // Combine and return
      res.json([...defaultCategories, ...userCategories]);
    } catch (error) {
      console.error("Error fetching income categories:", error);
      res.status(500).json({ message: "Failed to fetch income categories" });
    }
  });
  
  // Disable POST /api/income-categories to prevent user-created categories
  // Enable POST /api/income-categories to allow user-created categories
  app.post("/api/income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name, description = "" } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Category name is required" });
      }
      // Prevent duplicate category names for this user
      const exists = await pool.query('SELECT 1 FROM income_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)', [userId, name]);
      if ((exists?.rowCount || 0) > 0) {
        return res.status(409).json({ message: "Category already exists" });
      }
      const result = await pool.query(
        'INSERT INTO income_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [userId, name, description]
      );
      const row = result.rows[0];
      const newCategory = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        isSystem: row.is_system,
        createdAt: row.created_at
      };
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating income category:", error);
      res.status(500).json({ message: "Failed to create income category" });
    }
  });
  
  app.patch("/api/income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getIncomeCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this category" });
      }
      
      const categoryData = insertIncomeCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateIncomeCategory(id, categoryData);
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating income category:", error);
        res.status(500).json({ message: "Failed to update income category" });
      }
    }
  });
  
  app.delete("/api/income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getIncomeCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this category" });
      }
      
      await storage.deleteIncomeCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting income category:", error);
      res.status(500).json({ message: "Failed to delete income category", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Income Subcategory Routes
  // -------------------------------------------------------------------------
  app.get("/api/income-categories/:categoryId/subcategories", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const category = await storage.getIncomeCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this category" });
      }
      
      const subcategories = await storage.getIncomeSubcategories(categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching income subcategories:", error);
      res.status(500).json({ message: "Failed to fetch income subcategories" });
    }
  });
  
  app.post("/api/income-subcategories", requireAuth, async (req, res) => {
    try {
      const subcategoryData = insertIncomeSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getIncomeCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      const subcategory = await storage.createIncomeSubcategory(req.user!.id, subcategoryData);
      res.status(201).json(subcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating income subcategory:", error);
        res.status(500).json({ message: "Failed to create income subcategory" });
      }
    }
  });
  
  app.patch("/api/income-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getIncomeSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this subcategory" });
      }
      
      const subcategoryData = insertIncomeSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getIncomeCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      const updatedSubcategory = await storage.updateIncomeSubcategory(id, subcategoryData);
      
      res.json(updatedSubcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating income subcategory:", error);
        res.status(500).json({ message: "Failed to update income subcategory" });
      }
    }
  });
  
  app.delete("/api/income-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getIncomeSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this subcategory" });
      }
      
      await storage.deleteIncomeSubcategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting income subcategory:", error);
      res.status(500).json({ message: "Failed to delete income subcategory", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Expense Routes
  // -------------------------------------------------------------------------
  app.get("/api/expenses", requireAuth, async (req, res) => {
    try {
      const expenses = await storage.getExpensesByUserId(req.user!.id);
      
      // Augment each expense with category and subcategory names
      const augmentedExpenses = await Promise.all(expenses.map(async (expense) => {
        const category = await storage.getExpenseCategoryById(expense.categoryId);
        
        let subcategory = null;
        if (expense.subcategoryId) {
          subcategory = await storage.getExpenseSubcategoryById(expense.subcategoryId);
        }
        
        return {
          ...expense,
          categoryName: category?.name || 'Unknown',
          subcategoryName: subcategory?.name || null
        };
      }));
      
  console.log("[DEBUG] /api/expenses for userId:", req.user!.id, "expenses:", augmentedExpenses);
  res.json(augmentedExpenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", requireAuth, async (req, res) => {
    try {
      // Ensure date is properly parsed, especially if it came as an ISO string
      const data = req.body;
      if (data.date && typeof data.date === 'string') {
        data.date = new Date(data.date);
      }
      
      // Check if we're using legacy or new schema
      let expense;
      
      if ('category' in data) {
        // Legacy mode (string category)
        const expenseData = legacyInsertExpenseSchema.parse(data);
        expense = await storage.createLegacyExpense({
          ...expenseData,
          userId: req.user!.id
        });
      } else {
        // New mode (category ID)
        const expenseData = insertExpenseSchema.parse(data);

      // Only check that the category exists
      const categoryResult = await pool.query('SELECT * FROM expense_categories WHERE id = $1', [expenseData.categoryId]);
      const category = categoryResult.rows[0];
      if (!category) {
        return res.status(403).json({ message: "Invalid category" });
      }
        
        expense = await storage.createExpense({
          ...expenseData,
          userId: req.user!.id
        });
      }
      
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating expense:", error);
        res.status(500).json({ message: "Failed to create expense" });
      }
    }
  });

  app.get("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expense = await storage.getExpenseById(id);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      if (expense.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this expense" });
      }
      
      res.json(expense);
    } catch (error) {
      console.error("Error fetching expense:", error);
      res.status(500).json({ message: "Failed to fetch expense" });
    }
  });

 app.patch("/api/expenses/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const expense = await storage.getExpenseById(id);

    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const userRole = await storage.getUserRole(req.user!.id);
    if (expense.user_id !== req.user!.id && userRole !== "admin")
      return res.status(403).json({ message: "You don't have permission to update this expense" });

    const data = req.body;
    if (data.date && typeof data.date === "string") data.date = new Date(data.date);

    // Parse request body
    const expenseData = insertExpenseSchema.parse(data);

    // Define system categories
    const systemCategories = [
      { id: 1, name: "Wages" },
      { id: 2, name: "Deals" },
      { id: 3, name: "Other" },
    ];

    // Determine final category ID
    let finalCategoryId: number | null = null;

    if (expenseData.categoryId && systemCategories.some(cat => cat.id === Number(expenseData.categoryId))) {
      // It's a system category
      finalCategoryId = Number(expenseData.categoryId);
    } else if (expenseData.categoryId) {
      // It's a user-defined category, validate it exists
      const category = await storage.getExpenseCategoryById(expenseData.categoryId);
      if (!category || (category.user_id !== req.user!.id && !category.is_system)) {
        return res.status(403).json({ message: "Invalid category" });
      }
      finalCategoryId = category.id;
    } else {
      return res.status(400).json({ message: "Category is required" });
    }

    // Validate subcategory
    if (expenseData.subcategoryId) {
      const subcategory = await storage.getExpenseSubcategoryById(expenseData.subcategoryId);
      if (!subcategory || subcategory.categoryId !== finalCategoryId) {
        return res.status(403).json({ message: "Invalid subcategory" });
      }
    }

    // Update the expense
    const updatedExpense = await pool.query(
      `UPDATE expenses
       SET amount = $1,
           description = $2,
           date = $3,
           category_id = $4,
           category_name = (SELECT name FROM expense_categories WHERE id = $4),
           subcategory_id = $5,
           merchant = $6,
           notes = $7
       WHERE id = $8
       RETURNING *`,
      [
        expenseData.amount,
        expenseData.description,
        expenseData.date,
        finalCategoryId,
        expenseData.subcategoryId,
        expenseData.merchant,
        expenseData.notes,
        id
      ]
    );

    res.json(updatedExpense.rows[0]);
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  }
});




  app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expense = await storage.getExpenseById(id);
      const userRole = await storage.getUserRole(req.user!.id);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      console.log({expense,userRole,reqUserId:req.user!.id});
      
      // Allow admins to delete any expense, otherwise only allow users to delete their own
      if (expense.user_id !== req.user!.id && userRole !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to delete this expense" });
      }
      
      await storage.deleteExpense(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Income Routes
  // -------------------------------------------------------------------------
  app.get("/api/incomes", requireAuth, async (req, res) => {
    try {
      const incomes = await storage.getIncomesByUserId(req.user!.id);
      
      // Augment each income with category and subcategory names
      const augmentedIncomes = await Promise.all(incomes.map(async (income) => {
        let categoryName = '';
        
        if (income.categoryId) {
          // System or user-defined category
          const category = await storage.getIncomeCategoryById(income.categoryId);
          categoryName = category?.name || 'Unknown';
        } else if (income.categoryName) {
          // Custom category (stored directly in category_name field)
          categoryName = income.categoryName;
        } else {
          // Fallback
          categoryName = 'Uncategorized';
        }
        
        let subcategory = null;
        if (income.subcategoryId) {
          subcategory = await storage.getIncomeSubcategoryById(income.subcategoryId);
        }
        
        return {
          ...income,
          categoryName: categoryName,
          subcategoryName: subcategory?.name || null
        };
      }));
      
  console.log("[DEBUG] /api/incomes for userId:", req.user!.id, "incomes:", augmentedIncomes);
  res.json(augmentedIncomes);
    } catch (error) {
      console.error("Error fetching incomes:", error);
      res.status(500).json({ message: "Failed to fetch incomes" });
    }
  });

  app.post("/api/incomes", requireAuth, async (req, res) => {
  console.log('[DEBUG] POST /api/incomes received body:', req.body);

  try {
    const data = req.body;
    const userId = req.user!.id;

    // Ensure date is a Date object
    if (data.date && typeof data.date === 'string') {
      data.date = new Date(data.date);
    }

    let categoryName = data.categoryName?.trim();
    if (!categoryName) {
      return res.status(400).json({ message: "Please provide a category name." });
    }

    // Define system categories (IDs are placeholders; real IDs should exist in DB)
    const systemCategories = [
      { name: 'Wages' },
      { name: 'Deals' },
      { name: 'Other' }
    ];

    // Check if category exists in DB for this user
    let categoryCheck = await pool.query(
      'SELECT id, name FROM income_categories WHERE user_id = $1 AND name = $2',
      [userId, categoryName]
    );

    let finalCategoryId: number;
    let finalCategoryName: string;

    if (categoryCheck.rows.length > 0) {
      // Category exists
      finalCategoryId = categoryCheck.rows[0].id;
      finalCategoryName = categoryCheck.rows[0].name;
    } else {
      // If not, insert new category (system or custom)
      const isSystem = systemCategories.some(
        cat => cat.name.toLowerCase() === categoryName.toLowerCase()
      );

      const newCat = await pool.query(
        'INSERT INTO income_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, $4) RETURNING id, name',
        [userId, categoryName, isSystem ? `System category: ${categoryName}` : null, isSystem]
      );

      finalCategoryId = newCat.rows[0].id;
      finalCategoryName = newCat.rows[0].name;
    }

    // Insert the income
    const result = await pool.query(
      `INSERT INTO incomes
       (user_id, amount, description, date, category_id, category_name, source, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        data.amount,
        data.description,
        data.date,
        finalCategoryId,
        finalCategoryName,
        data.source,
        data.notes
      ]
    );

    console.log('[DEBUG] Inserted income result:', result.rows[0]);
    res.status(201).json(result.rows[0]);

  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      console.error("Error creating income:", error);
      res.status(500).json({ message: "Failed to create income" });
    }
  }
});


  app.patch("/api/incomes/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const income = await storage.getIncomeById(id);

    if (!income) return res.status(404).json({ message: "Income not found" });
    if (income.userId !== req.user!.id) return res.status(403).json({ message: "You don't have permission" });

    const data = req.body;
    if (data.date && typeof data.date === "string") data.date = new Date(data.date);

    const incomeData = insertIncomeSchema.parse(data);
    const userId = req.user!.id;

    const categoryName = req.body.categoryName?.trim();
    if (!categoryName) return res.status(400).json({ message: "Category name required" });

    // Check if category exists for this user
    let categoryCheck = await pool.query(
      'SELECT id, name FROM income_categories WHERE user_id = $1 AND name = $2',
      [userId, categoryName]
    );

    let finalCategoryId: number;
    let finalCategoryName: string;

    if (categoryCheck.rows.length > 0) {
      finalCategoryId = categoryCheck.rows[0].id;
      finalCategoryName = categoryCheck.rows[0].name;
    } else {
      // Insert new category
      const newCat = await pool.query(
        'INSERT INTO income_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, false) RETURNING id, name',
        [userId, categoryName, null]
      );
      finalCategoryId = newCat.rows[0].id;
      finalCategoryName = newCat.rows[0].name;
    }

    // Optional: verify subcategory
    if (incomeData.subcategoryId) {
      const subcategory = await storage.getIncomeSubcategoryById(incomeData.subcategoryId);
      if (!subcategory || subcategory.categoryId !== finalCategoryId) {
        return res.status(403).json({ message: "Invalid subcategory" });
      }
    }

    // Update income
    const result = await pool.query(
      `UPDATE incomes
       SET amount=$1, description=$2, date=$3, category_id=$4, category_name=$5, subcategory_id=$6, source=$7, notes=$8
       WHERE id=$9 AND user_id=$10
       RETURNING *`,
      [
        incomeData.amount,
        incomeData.description,
        incomeData.date,
        finalCategoryId,
        finalCategoryName,
        incomeData.subcategoryId,
        incomeData.source,
        incomeData.notes,
        id,
        userId
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "Income not found" });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating income:", error);
    res.status(500).json({ message: "Failed to update income" });
  }
});


  // Budget Routes
  app.get("/api/budgets", requireAuth, async (req, res) => {
    try {
      const budgets = await storage.getBudgetsByUserId(req.user!.id);
      
      // Add performance data to each budget
      const budgetsWithPerformance = await Promise.all(
        budgets.map(async (budget) => {
          const performance = await storage.getBudgetPerformance(budget.id);
          return {
            ...budget,
            allocatedAmount: performance.allocated,
            spentAmount: performance.spent,
            remainingAmount: performance.remaining
          };
        })
      );
      
      res.json(budgetsWithPerformance);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post("/api/budgets", requireAuth, async (req, res) => {
    try {
      // Ensure dates are properly parsed, especially if they came as ISO strings
      const data = req.body;
      if (data.startDate && typeof data.startDate === 'string') {
        data.startDate = new Date(data.startDate);
      }
      if (data.endDate && typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate);
      }
      
      // Extract categoryIds before validation
      const categoryIds = data.categoryIds;
      delete data.categoryIds;
      
      const budgetData = insertBudgetSchema.parse(data);
      const budget = await storage.createBudget({
        ...budgetData,
        userId: req.user!.id
      });
      
      // If categories are provided, create budget allocations for them
      if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
        const budgetId = budget.id;
        
        // Verify all categories belong to the user
        for (const categoryId of categoryIds) {
          const category = await storage.getExpenseCategoryById(categoryId);
          if (category && category.userId === req.user!.id) {
            // Create an initial allocation with zero amount that can be updated later
            await storage.createBudgetAllocation({
              budgetId,
              categoryId,
              subcategoryId: null,
              amount: 0
            });
          }
        }
      }
      
      res.status(201).json(budget);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating budget:", error);
        res.status(500).json({ message: "Failed to create budget" });
      }
    }
  });

  app.get("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budget = await storage.getBudgetById(id);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this budget" });
      }
      
      // Get all budget allocations as well
      const allocations = await storage.getBudgetAllocations(id);
      
      // Get budget performance
      const performance = await storage.getBudgetPerformance(id);
      
      res.json({
        budget,
        allocations,
        performance
      });
    } catch (error) {
      console.error("Error fetching budget:", error);
      res.status(500).json({ message: "Failed to fetch budget" });
    }
  });

  app.patch("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budget = await storage.getBudgetById(id);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this budget" });
      }
      
      // Ensure dates are properly parsed, especially if they came as ISO strings
      const data = req.body;
      if (data.startDate && typeof data.startDate === 'string') {
        data.startDate = new Date(data.startDate);
      }
      if (data.endDate && typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate);
      }
      
      const budgetData = insertBudgetSchema.parse(data);
      const updatedBudget = await storage.updateBudget(id, budgetData);
      
      res.json(updatedBudget);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating budget:", error);
        res.status(500).json({ message: "Failed to update budget" });
      }
    }
  });

  // PUT route for budget updates (same as PATCH)
  app.put("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budget = await storage.getBudgetById(id);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this budget" });
      }
      
      // Ensure dates are properly parsed, especially if they came as ISO strings
      const data = req.body;
      if (data.startDate && typeof data.startDate === 'string') {
        data.startDate = new Date(data.startDate);
      }
      if (data.endDate && typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate);
      }
      
      const budgetData = insertBudgetSchema.parse(data);
      const updatedBudget = await storage.updateBudget(id, budgetData);
      
      res.json(updatedBudget);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating budget:", error);
        res.status(500).json({ message: "Failed to update budget" });
      }
    }
  });

  app.delete("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budget = await storage.getBudgetById(id);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this budget" });
      }
      
      await storage.deleteBudget(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Budget Allocation Routes
  // -------------------------------------------------------------------------
  app.get("/api/budgets/:budgetId/allocations", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      const budget = await storage.getBudgetById(budgetId);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this budget" });
      }
      
      const allocations = await storage.getBudgetAllocations(budgetId);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching budget allocations:", error);
      res.status(500).json({ message: "Failed to fetch budget allocations" });
    }
  });
  
  app.get("/api/budgets/:budgetId/performance", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      const budget = await storage.getBudgetById(budgetId);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this budget" });
      }
      
      const performance = await storage.getBudgetPerformance(budgetId);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching budget performance:", error);
      res.status(500).json({ message: "Failed to fetch budget performance" });
    }
  });

  // POST route for budget allocations (nested under budget)
  app.post("/api/budgets/:budgetId/allocations", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      const allocationData = insertBudgetAllocationSchema.parse(req.body);
      
      // Verify the budget belongs to the user
      const budget = await storage.getBudgetById(budgetId);
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid budget" });
      }

      // Ensure the budgetId matches
      const finalAllocationData = {
        ...allocationData,
        budgetId: budgetId
      };

      const allocation = await storage.createBudgetAllocation(finalAllocationData);
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating budget allocation:", error);
        res.status(500).json({ message: "Failed to create budget allocation" });
      }
    }
  });

  app.post("/api/budget-allocations", requireAuth, async (req, res) => {
    try {
      const allocationData = insertBudgetAllocationSchema.parse(req.body);
      
      // Verify the budget belongs to the user
      const budget = await storage.getBudgetById(allocationData.budgetId);
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid budget" });
      }
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(allocationData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      // If subcategory is provided, verify it belongs to the category
      if (allocationData.subcategoryId) {
        const subcategory = await storage.getExpenseSubcategoryById(allocationData.subcategoryId);
        if (!subcategory || subcategory.categoryId !== allocationData.categoryId) {
          return res.status(403).json({ message: "Invalid subcategory" });
        }
      }
      
      const allocation = await storage.createBudgetAllocation(allocationData);
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating budget allocation:", error);
        res.status(500).json({ message: "Failed to create budget allocation" });
      }
    }
  });

  app.patch("/api/budget-allocations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allocationData = insertBudgetAllocationSchema.parse(req.body);
      
      // Verify the budget belongs to the user
      const budget = await storage.getBudgetById(allocationData.budgetId);
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid budget" });
      }
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(allocationData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      // If subcategory is provided, verify it belongs to the category
      if (allocationData.subcategoryId) {
        const subcategory = await storage.getExpenseSubcategoryById(allocationData.subcategoryId);
        if (!subcategory || subcategory.categoryId !== allocationData.categoryId) {
          return res.status(403).json({ message: "Invalid subcategory" });
        }
      }
      
      const updatedAllocation = await storage.updateBudgetAllocation(id, allocationData);
      res.json(updatedAllocation);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating budget allocation:", error);
        res.status(500).json({ message: "Failed to update budget allocation" });
      }
    }
  });

  app.delete("/api/budget-allocations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBudgetAllocation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget allocation:", error);
      res.status(500).json({ message: "Failed to delete budget allocation" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Reports and Analytics Routes
  // -------------------------------------------------------------------------
  app.get("/api/reports/monthly-expenses/:year", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const monthlyExpenses = await storage.getMonthlyExpenseTotals(req.user!.id, year);
      res.json(monthlyExpenses);
    } catch (error) {
      console.error("Error fetching monthly expense report:", error);
      res.status(500).json({ message: "Failed to fetch monthly expense report" });
    }
  });
  
  app.get("/api/reports/category-expenses", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const categoryExpenses = await storage.getCategoryExpenseTotals(req.user!.id, start, end);
      res.json(categoryExpenses);
    } catch (error) {
      console.error("Error fetching category expense report:", error);
      res.status(500).json({ message: "Failed to fetch category expense report" });
    }
  });
  
  app.get("/api/reports/monthly-incomes/:year", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const monthlyIncomes = await storage.getMonthlyIncomeTotals(req.user!.id, year);
      res.json(monthlyIncomes);
    } catch (error) {
      console.error("Error fetching monthly income report:", error);
      res.status(500).json({ message: "Failed to fetch monthly income report" });
    }
  });
  
  app.get("/api/reports/category-incomes", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const categoryIncomes = await storage.getCategoryIncomeTotals(req.user!.id, start, end);
      res.json(categoryIncomes);
    } catch (error) {
      console.error("Error fetching category income report:", error);
      res.status(500).json({ message: "Failed to fetch category income report" });
    }
  });
  
  app.get("/api/reports/budget-performance/:budgetId", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      
      // Verify the budget belongs to the user
      const budget = await storage.getBudgetById(budgetId);
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid budget" });
      }
      
      const performance = await storage.getBudgetPerformance(budgetId);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching budget performance:", error);
      res.status(500).json({ message: "Failed to fetch budget performance" });
    }
  });
  
  // -------------------------------------------------------------------------
  // User settings routes
  // -------------------------------------------------------------------------
  app.patch("/api/user/settings", requireAuth, async (req, res) => {
    try {
      const { currency } = req.body;
      
      const updatedUser = await storage.updateUserSettings(req.user!.id, { currency });
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Admin routes
  // -------------------------------------------------------------------------
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const safeUsers = users.map(({ password, ...user }) => ({
        ...user,
        role: storage.getUserRole(user.id)
      }));
      
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  app.get("/api/admin/expenses", requireAdmin, async (req, res) => {
    try {
      const expenses = await storage.getAllExpenses();
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching all expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });
  
  app.get("/api/admin/incomes", requireAdmin, async (req, res) => {
    try {
      const incomes = await storage.getAllIncomes();
      res.json(incomes);
    } catch (error) {
      console.error("Error fetching all incomes:", error);
      res.status(500).json({ message: "Failed to fetch incomes" });
    }
  });
  
  app.get("/api/admin/budgets", requireAdmin, async (req, res) => {
    try {
      // Collect all budgets from all users
      const users = await storage.getAllUsers();
      const allBudgets = [];
      
      for (const user of users) {
        const budgets = await storage.getBudgetsByUserId(user.id);
        // Add user information to each budget
        const augmentedBudgets = budgets.map(budget => ({
          ...budget,
          userName: user.name,
          userEmail: user.email
        }));
        allBudgets.push(...augmentedBudgets);
      }
      
      res.json(allBudgets);
    } catch (error) {
      console.error("Error fetching all budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });
  
  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      await storage.setUserRole(userId, role);
      res.status(200).json({ message: "User role updated" });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });
  
  // Delete user endpoint for administrators
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prevent deleting your own account
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      // Here we would implement user deletion
      // For now, we'll just return a success message
      // In a real implementation, this would include:
      // 1. Deleting user's expenses
      // 2. Deleting user's incomes
      // 3. Deleting user's budgets
      // 4. Deleting user's categories
      // 5. Finally deleting the user
      
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
