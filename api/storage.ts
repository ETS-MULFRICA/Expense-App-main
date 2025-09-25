import { 
  users, type User, type InsertUser, 
  expenses, type Expense, type InsertExpense, type LegacyInsertExpense,
  expenseCategories, type ExpenseCategory, type InsertExpenseCategory,
  expenseSubcategories, type ExpenseSubcategory, type InsertExpenseSubcategory,
  incomeCategories, type IncomeCategory, type InsertIncomeCategory,
  incomeSubcategories, type IncomeSubcategory, type InsertIncomeSubcategory,
  incomes, type Income, type InsertIncome,
  budgets, type Budget, type InsertBudget,
  budgetAllocations, type BudgetAllocation, type InsertBudgetAllocation
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { pool } from "./db";

const MemoryStore = createMemoryStore(session);

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUserRole(userId: number): Promise<string>;
  setUserRole(userId: number, role: string): Promise<void>;
  updateUserSettings(userId: number, settings: { currency?: string }): Promise<User>;

  // Create default categories for a new user
  createDefaultCategories(userId: number): Promise<void>;
  // Expense Category operations
  getExpenseCategories(userId: number): Promise<ExpenseCategory[]>;
  getExpenseCategoryById(id: number): Promise<ExpenseCategory | undefined>;
  createExpenseCategory(userId: number, category: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: number, category: InsertExpenseCategory): Promise<ExpenseCategory>;
  deleteExpenseCategory(id: number): Promise<void>;

  // Expense Subcategory operations
  getExpenseSubcategories(categoryId: number): Promise<ExpenseSubcategory[]>;
  getExpenseSubcategoryById(id: number): Promise<ExpenseSubcategory | undefined>;
  createExpenseSubcategory(userId: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory>;
  updateExpenseSubcategory(id: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory>;
  deleteExpenseSubcategory(id: number): Promise<void>;

  // Income Category operations
  getIncomeCategories(userId: number): Promise<IncomeCategory[]>;
  getIncomeCategoryById(id: number): Promise<IncomeCategory | undefined>;
  createIncomeCategory(userId: number, category: InsertIncomeCategory): Promise<IncomeCategory>;
  updateIncomeCategory(id: number, category: InsertIncomeCategory): Promise<IncomeCategory>;
  deleteIncomeCategory(id: number): Promise<void>;

  // Income Subcategory operations
  getIncomeSubcategories(categoryId: number): Promise<IncomeSubcategory[]>;
  getIncomeSubcategoryById(id: number): Promise<IncomeSubcategory | undefined>;
  createIncomeSubcategory(userId: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory>;
  updateIncomeSubcategory(id: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory>;
  deleteIncomeSubcategory(id: number): Promise<void>;

  // Expense operations
  getExpensesByUserId(userId: number): Promise<Expense[]>;
  getExpenseById(id: number): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense & { userId: number }): Promise<Expense>;
  createLegacyExpense(expense: LegacyInsertExpense & { userId: number }): Promise<Expense>;
  updateExpense(id: number, expense: InsertExpense & { userId: number }): Promise<Expense>;
  updateLegacyExpense(id: number, expense: LegacyInsertExpense & { userId: number }): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;
  getAllExpenses(): Promise<Expense[]>;

  // Income operations
  getIncomesByUserId(userId: number): Promise<Income[]>;
  getIncomeById(id: number): Promise<Income | undefined>;
  createIncome(income: InsertIncome & { userId: number }): Promise<Income>;
  updateIncome(id: number, income: InsertIncome & { userId: number }): Promise<Income>;
  deleteIncome(id: number, userId: number): Promise<void>;

  getAllIncomes(): Promise<Income[]>;

  // Budget operations
  getBudgetsByUserId(userId: number): Promise<Budget[]>;
  getBudgetById(id: number): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget & { userId: number }): Promise<Budget>;
  updateBudget(id: number, budget: InsertBudget): Promise<Budget>;
  deleteBudget(id: number, userId: number): Promise<void>;

  // Budget Allocation operations
  getBudgetAllocations(budgetId: number): Promise<BudgetAllocation[]>;
  createBudgetAllocation(allocation: InsertBudgetAllocation): Promise<BudgetAllocation>;
  updateBudgetAllocation(id: number, allocation: InsertBudgetAllocation): Promise<BudgetAllocation>;
  deleteBudgetAllocation(id: number): Promise<void>;

  // Reports and analytics
  getMonthlyExpenseTotals(userId: number, year: number): Promise<{ month: number; total: number }[]>;
  getCategoryExpenseTotals(userId: number, startDate: Date, endDate: Date): Promise<{ category: string; total: number }[]>;
  getMonthlyIncomeTotals(userId: number, year: number): Promise<{ month: number; total: number }[]>;
  getCategoryIncomeTotals(userId: number, startDate: Date, endDate: Date): Promise<{ category: string; total: number }[]>;
  getBudgetPerformance(budgetId: number): Promise<{ 
    allocated: number; 
    spent: number; 
    remaining: number;
    categories: { categoryId: number; allocated: number; spent: number; remaining: number }[] 
  }>;

  // Session store
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private expenses: Map<number, Expense>;
  private incomes: Map<number, Income>;
  private expenseCategories: Map<number, ExpenseCategory>;
  private expenseSubcategories: Map<number, ExpenseSubcategory>;
  private incomeCategories: Map<number, IncomeCategory>;
  private incomeSubcategories: Map<number, IncomeSubcategory>;
  private budgets: Map<number, Budget>;
  private budgetAllocations: Map<number, BudgetAllocation>;
  
  private nextUserId: number;
  private nextExpenseId: number;
  private nextIncomeId: number;
  private nextExpenseCategoryId: number;
  private nextExpenseSubcategoryId: number;
  private nextIncomeCategoryId: number; 
  private nextIncomeSubcategoryId: number;
  private nextBudgetId: number;
  private nextBudgetAllocationId: number;
  
  sessionStore: session.Store;
  private userRoles: Map<number, string>;

  constructor() {
    this.users = new Map();
    this.expenses = new Map();
    this.incomes = new Map();
    this.expenseCategories = new Map();
    this.expenseSubcategories = new Map();
    this.incomeCategories = new Map();
    this.incomeSubcategories = new Map();
    this.budgets = new Map();
    this.budgetAllocations = new Map();
    
    this.nextUserId = 1;
    this.nextExpenseId = 1;
    this.nextIncomeId = 1;
    this.nextExpenseCategoryId = 1;
    this.nextExpenseSubcategoryId = 1;
    this.nextIncomeCategoryId = 1;
    this.nextIncomeSubcategoryId = 1;
    this.nextBudgetId = 1;
    this.nextBudgetAllocationId = 1;
    
    this.userRoles = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Create demo accounts if they don't exist
    this.createDemoAccounts();
  }
  
  // Helper method to create default categories based on the Excel file
  public async createDefaultCategories(userId: number) {
    // Create main expense categories with subcategories from analysis
    const categories = {
      "Children": ["Activities", "Allowance", "Medical", "Childcare", "Clothing", "School", "Toys"],
      "Debt": ["Credit cards", "Student loans", "Other loans", "Taxes (federal)", "Taxes (state)", "Other"],
      "Education": ["Tuition", "Books", "Music lessons", "Other"],
      "Entertainment": ["Books", "Concerts/shows", "Games", "Hobbies", "Movies", "Music", "Outdoor activities", "Photography", "Sports", "Theater/plays", "TV", "Other"],
      "Everyday": ["Groceries", "Restaurants", "Personal supplies", "Clothes", "Laundry/dry cleaning", "Hair/beauty", "Subscriptions", "Other"],
      "Gifts": ["Gifts", "Donations (charity)", "Other"],
      "Health/medical": ["Doctors/dental/vision", "Specialty care", "Pharmacy", "Emergency", "Other"],
      "Home": ["Rent/mortgage", "Property taxes", "Furnishings", "Lawn/garden", "Supplies", "Maintenance", "Improvements", "Moving", "Other"],
      "Insurance": ["Car", "Health", "Home", "Life", "Other"],
      "Pets": ["Food", "Vet/medical", "Toys", "Supplies", "Other"],
      "Technology": ["Domains & hosting", "Online services", "Hardware", "Software", "Other"],
      "Transportation": ["Fuel", "Car payments", "Repairs", "Registration/license", "Supplies", "Public transit", "Other"],
      "Travel": ["Airfare", "Hotels", "Food", "Transportation", "Entertainment", "Other"],
      "Utilities": ["Phone", "TV", "Internet", "Electricity", "Heat/gas", "Water", "Trash", "Other"]
    };
    
    // Create income categories
    const incomeCategories = {
      "Wages": ["Paycheck", "Tips", "Bonus", "Commission", "Other"],
      "Other": ["Transfer from savings", "Interest income", "Dividends", "Gifts", "Refunds", "Other"]
    };
    
    for (const [categoryName, subcategories] of Object.entries(categories)) {
      const category = await this.createExpenseCategory(userId, {
        name: categoryName,
        description: `${categoryName} expenses`,
      });
      
      for (const subcategoryName of subcategories) {
        await this.createExpenseSubcategory(userId, {
          categoryId: category.id,
          name: subcategoryName,
          description: `${subcategoryName} in ${categoryName}`,
        });
      }
    }
    
    for (const [categoryName, subcategories] of Object.entries(incomeCategories)) {
      const category = await this.createIncomeCategory(userId, {
        name: categoryName,
        description: `${categoryName} income`,
        isSystem: true,
      });
      
      for (const subcategoryName of subcategories) {
        await this.createIncomeSubcategory(userId, {
          categoryId: category.id,
          name: subcategoryName,
          description: `${subcategoryName} in ${categoryName}`,
        });
      }
      // Debug log: show created income category
      console.log('Created income category:', category);
    }
    // Debug log: show all income categories for user
    console.log('All income categories for user', userId, Array.from(this.incomeCategories.values()).filter(cat => cat.userId === userId));
  }
  
  // Helper method to create demo accounts
  private async createDemoAccounts() {
    // Create demo user if not exists
    const demoUser = await this.getUserByUsername('demo');
    if (!demoUser) {
      const user = await this.createUser({
        username: 'demo',
        password: 'b60287264acd6c301166a63a231983be7b1c50472d531f739418b9f98a0ead1fd7fb8e3c10a39b716d735e1d4e42c784796faf9efc594469683566841d44bd53.e3ecf42fb63c9aa37f8a3556ad42f42a', // 'password'
        name: 'Demo User',
        email: 'demo@example.com'
      });
      
      // Create default categories
      await this.createDefaultCategories(user.id);
      
      // Get some created categories for sample expenses
      const categories = await this.getExpenseCategories(user.id);
      const foodCategory = categories.find(c => c.name === "Everyday");
      const transportCategory = categories.find(c => c.name === "Transportation");
      const entertainmentCategory = categories.find(c => c.name === "Entertainment");
      
      // Get matching subcategories
      const groceriesSubcategory = foodCategory ? 
        (await this.getExpenseSubcategories(foodCategory.id)).find(s => s.name === "Groceries") : null;
      const fuelSubcategory = transportCategory ? 
        (await this.getExpenseSubcategories(transportCategory.id)).find(s => s.name === "Fuel") : null;
      const subscriptionsSubcategory = entertainmentCategory ? 
        (await this.getExpenseSubcategories(entertainmentCategory.id)).find(s => s.name === "Subscriptions") : null;
      
      // Add some sample expenses for the demo user
      const date = new Date();
      
      if (foodCategory && groceriesSubcategory) {
        await this.createExpense({
          userId: user.id,
          amount: 12500,
          description: 'Groceries',
          date: new Date(date.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          categoryId: foodCategory.id,
          subcategoryId: groceriesSubcategory.id,
          merchant: 'Supermarket',
          notes: 'Weekly shopping'
        });
      }
      
      if (transportCategory && fuelSubcategory) {
        await this.createExpense({
          userId: user.id,
          amount: 22000,
          description: 'Gas',
          date: new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          categoryId: transportCategory.id,
          subcategoryId: fuelSubcategory.id,
          merchant: 'Gas Station',
          notes: null
        });
      }
      
      if (entertainmentCategory && subscriptionsSubcategory) {
        await this.createExpense({
          userId: user.id,
          amount: 6500,
          description: 'Netflix subscription',
          date: new Date(date.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          categoryId: entertainmentCategory.id,
          subcategoryId: subscriptionsSubcategory.id,
          merchant: 'Netflix',
          notes: 'Monthly subscription'
        });
      }
      
      // Create sample income
      const incomeCategories = await this.getIncomeCategories(user.id);
      const wagesCategory = incomeCategories.find(c => c.name === "Wages");
      
      if (wagesCategory) {
        const paycheckSubcategory = (await this.getIncomeSubcategories(wagesCategory.id))
          .find(s => s.name === "Paycheck");
        
        if (paycheckSubcategory) {
          await this.createIncome({
            userId: user.id,
            amount: 150000,
            description: 'Monthly salary',
            date: new Date(date.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            categoryId: wagesCategory.id,
            subcategoryId: paycheckSubcategory.id,
            source: 'Employer',
            notes: 'Regular monthly payment'
          });
        }
      }
      
      // Create a sample budget
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0); 
      
      const budget = await this.createBudget({
        userId: user.id,
        name: 'Monthly Budget',
        startDate,
        endDate,
        amount: 300000,
        period: 'monthly',
        notes: null
      });
      
      // Add budget allocations
      if (foodCategory) {
        await this.createBudgetAllocation({
          budgetId: budget.id,
          categoryId: foodCategory.id,
          subcategoryId: null,
          amount: 50000
        });
      }
      
      if (transportCategory) {
        await this.createBudgetAllocation({
          budgetId: budget.id,
          categoryId: transportCategory.id,
          subcategoryId: null,
          amount: 30000
        });
      }
      
      if (entertainmentCategory) {
        await this.createBudgetAllocation({
          budgetId: budget.id,
          categoryId: entertainmentCategory.id,
          subcategoryId: null,
          amount: 20000
        });
      }
    }
    
    // Create admin user if not exists
    const adminUser = await this.getUserByUsername('admin');
    if (!adminUser) {
      const admin = await this.createUser({
        username: 'admin',
        password: 'b60287264acd6c301166a63a231983be7b1c50472d531f739418b9f98a0ead1fd7fb8e3c10a39b716d735e1d4e42c784796faf9efc594469683566841d44bd53.e3ecf42fb63c9aa37f8a3556ad42f42a', // 'password'
        name: 'Admin User',
        email: 'admin@example.com'
      });
      
      // Create default categories for admin too
      await this.createDefaultCategories(admin.id);
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextUserId++;
    
    // Determine role based on ID (admin for ID 2)
    const role = id === 2 ? 'admin' : 'user';
    
    const user: User = { 
      ...insertUser, 
      id,
      currency: 'XAF',
      role
    };
    
    this.users.set(id, user);
    this.userRoles.set(id, role);
    
    // Create default categories for new users
    await this.createDefaultCategories(user.id);
    
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getUserRole(userId: number): Promise<string> {
    return this.userRoles.get(userId) || 'user';
  }
  
  async setUserRole(userId: number, role: string): Promise<void> {
    this.userRoles.set(userId, role);
  }
  
  async updateUserSettings(userId: number, settings: { currency?: string }): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }
    
    const updatedUser = {
      ...user,
      currency: settings.currency || user.currency || 'XAF'
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  // Expense Category methods
  async getExpenseCategories(userId: number): Promise<ExpenseCategory[]> {
    return Array.from(this.expenseCategories.values()).filter(
      category => category.userId === userId
    );
  }
  
  async getExpenseCategoryById(id: number): Promise<ExpenseCategory | undefined> {
    return this.expenseCategories.get(id);
  }
  
  async createExpenseCategory(userId: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const id = this.nextExpenseCategoryId++;
    const newCategory: ExpenseCategory = {
      ...category,
      id,
      userId,
      isSystem: false,
      createdAt: new Date(),
      description: category.description || null
    };
    this.expenseCategories.set(id, newCategory);
    return newCategory;
  }
  
  async updateExpenseCategory(id: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const existingCategory = this.expenseCategories.get(id);
    if (!existingCategory) {
      throw new Error(`Category with id ${id} not found`);
    }
    
    const updatedCategory: ExpenseCategory = {
      ...existingCategory,
      name: category.name,
      description: category.description || existingCategory.description
    };
    
    this.expenseCategories.set(id, updatedCategory);
    return updatedCategory;
  }
  
  async deleteExpenseCategory(id: number): Promise<void> {
    // First check if the category has expenses
    const hasExpenses = Array.from(this.expenses.values()).some(
      expense => expense.categoryId === id
    );
    
    if (hasExpenses) {
      throw new Error(`Cannot delete category with existing expenses`);
    }
    
    // Also check if there are subcategories
    const hasSubcategories = Array.from(this.expenseSubcategories.values()).some(
      subcategory => subcategory.categoryId === id
    );
    
    if (hasSubcategories) {
      throw new Error(`Cannot delete category with existing subcategories`);
    }
    
    // Safe to delete
    this.expenseCategories.delete(id);
  }
  
  // Expense Subcategory methods
  async getExpenseSubcategories(categoryId: number): Promise<ExpenseSubcategory[]> {
    return Array.from(this.expenseSubcategories.values()).filter(
      subcategory => subcategory.categoryId === categoryId
    );
  }
  
  async getExpenseSubcategoryById(id: number): Promise<ExpenseSubcategory | undefined> {
    return this.expenseSubcategories.get(id);
  }
  
  async createExpenseSubcategory(userId: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory> {
    const id = this.nextExpenseSubcategoryId++;
    const newSubcategory: ExpenseSubcategory = {
      ...subcategory,
      id,
      userId,
      isSystem: false,
      createdAt: new Date(),
      description: subcategory.description || null
    };
    
    this.expenseSubcategories.set(id, newSubcategory);
    return newSubcategory;
  }
  
  async updateExpenseSubcategory(id: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory> {
    const existingSubcategory = this.expenseSubcategories.get(id);
    if (!existingSubcategory) {
      throw new Error(`Subcategory with id ${id} not found`);
    }
    
    const updatedSubcategory: ExpenseSubcategory = {
      ...existingSubcategory,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      description: subcategory.description || existingSubcategory.description
    };
    
    this.expenseSubcategories.set(id, updatedSubcategory);
    return updatedSubcategory;
  }
  
  async deleteExpenseSubcategory(id: number): Promise<void> {
    // First check if the subcategory has expenses
    const hasExpenses = Array.from(this.expenses.values()).some(
      expense => expense.subcategoryId === id
    );
    
    if (hasExpenses) {
      throw new Error(`Cannot delete subcategory with existing expenses`);
    }
    
    // Safe to delete
    this.expenseSubcategories.delete(id);
  }
  
  // Income Category methods
  async getIncomeCategories(userId: number): Promise<IncomeCategory[]> {
    return Array.from(this.incomeCategories.values()).filter(
      category => category.userId === userId
    );
  }
  
  async getIncomeCategoryById(id: number): Promise<IncomeCategory | undefined> {
    return this.incomeCategories.get(id);
  }
  
  async createIncomeCategory(userId: number, category: InsertIncomeCategory): Promise<IncomeCategory> {
    const id = this.nextIncomeCategoryId++;
    const newCategory: IncomeCategory = {
      ...category,
      id,
      userId,
      isSystem: category.isSystem ?? false,
      createdAt: new Date(),
      description: category.description || null
    };
    this.incomeCategories.set(id, newCategory);
    return newCategory;
  }
  
  async updateIncomeCategory(id: number, category: InsertIncomeCategory): Promise<IncomeCategory> {
    const existingCategory = this.incomeCategories.get(id);
    if (!existingCategory) {
      throw new Error(`Category with id ${id} not found`);
    }
    
    const updatedCategory: IncomeCategory = {
      ...existingCategory,
      name: category.name,
      description: category.description || existingCategory.description
    };
    
    this.incomeCategories.set(id, updatedCategory);
    return updatedCategory;
  }
  
  async deleteIncomeCategory(id: number): Promise<void> {
    // First check if the category has income entries
    const hasIncomes = Array.from(this.incomes.values()).some(
      income => income.categoryId === id
    );
    
    if (hasIncomes) {
      throw new Error(`Cannot delete category with existing income entries`);
    }
    
    // Also check if there are subcategories
    const hasSubcategories = Array.from(this.incomeSubcategories.values()).some(
      subcategory => subcategory.categoryId === id
    );
    
    if (hasSubcategories) {
      throw new Error(`Cannot delete category with existing subcategories`);
    }
    
    // Safe to delete
    this.incomeCategories.delete(id);
  }
  
  // Income Subcategory methods
  async getIncomeSubcategories(categoryId: number): Promise<IncomeSubcategory[]> {
    return Array.from(this.incomeSubcategories.values()).filter(
      subcategory => subcategory.categoryId === categoryId
    );
  }
  
  async getIncomeSubcategoryById(id: number): Promise<IncomeSubcategory | undefined> {
    return this.incomeSubcategories.get(id);
  }
  
  async createIncomeSubcategory(userId: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory> {
    const id = this.nextIncomeSubcategoryId++;
    const newSubcategory: IncomeSubcategory = {
      ...subcategory,
      id,
      userId,
      isSystem: false,
      createdAt: new Date(),
      description: subcategory.description || null
    };
    
    this.incomeSubcategories.set(id, newSubcategory);
    return newSubcategory;
  }
  
  async updateIncomeSubcategory(id: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory> {
    const existingSubcategory = this.incomeSubcategories.get(id);
    if (!existingSubcategory) {
      throw new Error(`Subcategory with id ${id} not found`);
    }
    
    const updatedSubcategory: IncomeSubcategory = {
      ...existingSubcategory,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      description: subcategory.description || existingSubcategory.description
    };
    
    this.incomeSubcategories.set(id, updatedSubcategory);
    return updatedSubcategory;
  }
  
  async deleteIncomeSubcategory(id: number): Promise<void> {
    // First check if the subcategory has income entries
    const hasIncomes = Array.from(this.incomes.values()).some(
      income => income.subcategoryId === id
    );
    
    if (hasIncomes) {
      throw new Error(`Cannot delete subcategory with existing income entries`);
    }
    
    // Safe to delete
    this.incomeSubcategories.delete(id);
  }

  // Expense methods
  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    return Array.from(this.expenses.values()).filter(
      (expense) => expense.userId === userId
    );
  }

  async getExpenseById(id: number): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(expenseData: InsertExpense & { userId: number }): Promise<Expense> {
    const id = this.nextExpenseId++;
    const expense: Expense = {
      ...expenseData,
      id,
      createdAt: new Date(),
      merchant: expenseData.merchant || null,
      notes: expenseData.notes || null,
      subcategoryId: expenseData.subcategoryId || null
    };
    this.expenses.set(id, expense);
    return expense;
  }
  
  // For backwards compatibility
  async createLegacyExpense(expenseData: LegacyInsertExpense & { userId: number }): Promise<Expense> {
    // Find or create a category that matches the string
    const { category: categoryName, ...rest } = expenseData;
    
    // Look for an existing category with this name
    let categoryId: number;
    let foundCategory = Array.from(this.expenseCategories.values()).find(
      c => c.userId === expenseData.userId && c.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (foundCategory) {
      categoryId = foundCategory.id;
    } else {
      // Create a new category
      const newCategory = await this.createExpenseCategory(expenseData.userId, {
        name: categoryName,
        description: `${categoryName} expenses`,
      });
      categoryId = newCategory.id;
    }
    
    // Now create the expense with the proper category ID
    return this.createExpense({
      ...rest,
      userId: expenseData.userId,
      categoryId
    });
  }

  async updateExpense(id: number, expenseData: InsertExpense & { userId: number }): Promise<Expense> {
    const existingExpense = this.expenses.get(id);
    
    if (!existingExpense) {
      throw new Error(`Expense with id ${id} not found`);
    }
    
    const updatedExpense: Expense = {
      ...existingExpense,
      ...expenseData,
      id,
      createdAt: existingExpense.createdAt,
      merchant: expenseData.merchant || null,
      notes: expenseData.notes || null,
      subcategoryId: expenseData.subcategoryId || null
    };
    
    this.expenses.set(id, updatedExpense);
    return updatedExpense;
  }
  
  // For backwards compatibility
  async updateLegacyExpense(id: number, expenseData: LegacyInsertExpense & { userId: number }): Promise<Expense> {
    const { category: categoryName, ...rest } = expenseData;
    
    // Look for an existing category with this name
    let categoryId: number;
    let foundCategory = Array.from(this.expenseCategories.values()).find(
      c => c.userId === expenseData.userId && c.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (foundCategory) {
      categoryId = foundCategory.id;
    } else {
      // Create a new category
      const newCategory = await this.createExpenseCategory(expenseData.userId, {
        name: categoryName,
        description: `${categoryName} expenses`,
      });
      categoryId = newCategory.id;
    }
    
    // Now update the expense with the proper category ID
    return this.updateExpense(id, {
      ...rest,
      userId: expenseData.userId,
      categoryId
    });
  }

  async deleteExpense(id: number): Promise<void> {
    if (!this.expenses.has(id)) {
      throw new Error(`Expense with id ${id} not found`);
    }
    
    this.expenses.delete(id);
  }
  
  async getAllExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values());
  }
  
  // Income methods
  async getIncomesByUserId(userId: number): Promise<Income[]> {
    return Array.from(this.incomes.values()).filter(
      (income) => income.userId === userId
    );
  }

  async getIncomeById(id: number): Promise<Income | undefined> {
    return this.incomes.get(id);
  }

  async createIncome(incomeData: InsertIncome & { userId: number }): Promise<Income> {
    const id = this.nextIncomeId++;
    const income: Income = {
      ...incomeData,
      id,
      createdAt: new Date(),
      source: incomeData.source || null,
      notes: incomeData.notes || null,
      subcategoryId: incomeData.subcategoryId || null
    };
    this.incomes.set(id, income);
    return income;
  }

  async updateIncome(id: number, incomeData: InsertIncome & { userId: number }): Promise<Income> {
    const existingIncome = this.incomes.get(id);
    
    if (!existingIncome) {
      throw new Error(`Income with id ${id} not found`);
    }
    
    const updatedIncome: Income = {
      ...existingIncome,
      ...incomeData,
      id,
      createdAt: existingIncome.createdAt,
      source: incomeData.source || null,
      notes: incomeData.notes || null,
      subcategoryId: incomeData.subcategoryId || null
    };
    
    this.incomes.set(id, updatedIncome);
    return updatedIncome;
  }

async deleteIncome(id: number, userId: number) {
  const res = await pool.query(
    `DELETE FROM incomes WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );

  if (res.rows.length === 0) {
    return null;
  }

  return res.rows[0]; // ✅ return deleted row
}



  
  async getAllIncomes(): Promise<Income[]> {
    return Array.from(this.incomes.values());
  }
  
  // Budget methods
  async getBudgetsByUserId(userId: number): Promise<Budget[]> {
    return Array.from(this.budgets.values()).filter(
      (budget) => budget.userId === userId
    );
  }

  async getBudgetById(id: number): Promise<Budget | undefined> {
    return this.budgets.get(id);
  }

  async createBudget(budgetData: InsertBudget & { userId: number }): Promise<Budget> {
    const id = this.nextBudgetId++;
    const budget: Budget = {
      ...budgetData,
      id,
      createdAt: new Date(),
      notes: budgetData.notes || null,
      period: budgetData.period || 'monthly'
    };
    this.budgets.set(id, budget);
    return budget;
  }

  async updateBudget(id: number, budgetData: InsertBudget): Promise<Budget> {
    const existingBudget = this.budgets.get(id);
    
    if (!existingBudget) {
      throw new Error(`Budget with id ${id} not found`);
    }
    
    const updatedBudget: Budget = {
      ...existingBudget,
      name: budgetData.name,
      startDate: budgetData.startDate,
      endDate: budgetData.endDate,
      amount: budgetData.amount,
      notes: budgetData.notes || null,
      period: budgetData.period || existingBudget.period
    };
    
    this.budgets.set(id, updatedBudget);
    return updatedBudget;
  }

  async deleteBudget(id: number): Promise<void> {
    if (!this.budgets.has(id)) {
      throw new Error(`Budget with id ${id} not found`);
    }
    
    // Delete all associated allocations
    const allocationsToDelete = Array.from(this.budgetAllocations.values())
      .filter(allocation => allocation.budgetId === id)
      .map(allocation => allocation.id);
      
    for (const allocationId of allocationsToDelete) {
      this.budgetAllocations.delete(allocationId);
    }
    
    // Delete the budget itself
    this.budgets.delete(id);
  }
  
  // Budget Allocation methods
  async getBudgetAllocations(budgetId: number): Promise<BudgetAllocation[]> {
    return Array.from(this.budgetAllocations.values()).filter(
      (allocation) => allocation.budgetId === budgetId
    );
  }

  async createBudgetAllocation(allocationData: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const id = this.nextBudgetAllocationId++;
    const allocation: BudgetAllocation = {
      ...allocationData,
      id,
      subcategoryId: allocationData.subcategoryId || null,
      createdAt: new Date()
    };
    this.budgetAllocations.set(id, allocation);
    return allocation;
  }

  async updateBudgetAllocation(id: number, allocationData: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const existingAllocation = this.budgetAllocations.get(id);
    
    if (!existingAllocation) {
      throw new Error(`Budget allocation with id ${id} not found`);
    }
    
    const updatedAllocation: BudgetAllocation = {
      ...existingAllocation,
      budgetId: allocationData.budgetId,
      categoryId: allocationData.categoryId,
      subcategoryId: allocationData.subcategoryId || null,
      amount: allocationData.amount
    };
    
    this.budgetAllocations.set(id, updatedAllocation);
    return updatedAllocation;
  }

  async deleteBudgetAllocation(id: number): Promise<void> {
    if (!this.budgetAllocations.has(id)) {
      throw new Error(`Budget allocation with id ${id} not found`);
    }
    
    this.budgetAllocations.delete(id);
  }
  
  // Reports and analytics
  async getMonthlyExpenseTotals(userId: number, year: number): Promise<{ month: number; total: number }[]> {
    const expenses = await this.getExpensesByUserId(userId);
    
    // Initialize result array with 12 months
    const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: 0
    }));
    
    // Sum expenses for each month in the specified year
    for (const expense of expenses) {
      const expenseDate = new Date(expense.date);
      if (expenseDate.getFullYear() === year) {
        const month = expenseDate.getMonth();
        monthlyTotals[month].total += expense.amount;
      }
    }
    
    return monthlyTotals;
  }

  async getCategoryExpenseTotals(userId: number, startDate: Date, endDate: Date): Promise<{ category: string; total: number }[]> {
    const expenses = await this.getExpensesByUserId(userId);
    const categories = await this.getExpenseCategories(userId);
    
    // Create a map for category ID to name lookups
    const categoryMap = new Map<number, string>();
    for (const category of categories) {
      categoryMap.set(category.id, category.name);
    }
    
    // Filter expenses for the date range and group by category
    const filteredExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= startDate && expenseDate <= endDate;
    });
    
    // Group expenses by category
    const categoryTotals = new Map<string, number>();
    
    for (const expense of filteredExpenses) {
      const categoryName = categoryMap.get(expense.categoryId) || 'Uncategorized';
      const currentTotal = categoryTotals.get(categoryName) || 0;
      categoryTotals.set(categoryName, currentTotal + expense.amount);
    }
    
    // Convert to array format
    return Array.from(categoryTotals.entries()).map(([category, total]) => ({
      category,
      total
    }));
  }
  
  async getMonthlyIncomeTotals(userId: number, year: number): Promise<{ month: number; total: number }[]> {
    const incomes = await this.getIncomesByUserId(userId);
    
    // Initialize result array with 12 months
    const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: 0
    }));
    
    // Sum incomes for each month in the specified year
    for (const income of incomes) {
      const incomeDate = new Date(income.date);
      if (incomeDate.getFullYear() === year) {
        const month = incomeDate.getMonth();
        monthlyTotals[month].total += income.amount;
      }
    }
    
    return monthlyTotals;
  }

  async getCategoryIncomeTotals(userId: number, startDate: Date, endDate: Date): Promise<{ category: string; total: number }[]> {
    const incomes = await this.getIncomesByUserId(userId);
    const categories = await this.getIncomeCategories(userId);
    
    // Create a map for category ID to name lookups
    const categoryMap = new Map<number, string>();
    for (const category of categories) {
      categoryMap.set(category.id, category.name);
    }
    
    // Filter incomes for the date range and group by category
    const filteredIncomes = incomes.filter(income => {
      const incomeDate = new Date(income.date);
      return incomeDate >= startDate && incomeDate <= endDate;
    });
    
    // Group incomes by category
    const categoryTotals = new Map<string, number>();
    
    for (const income of filteredIncomes) {
      const categoryName = categoryMap.get(income.categoryId) || 'Uncategorized';
      const currentTotal = categoryTotals.get(categoryName) || 0;
      categoryTotals.set(categoryName, currentTotal + income.amount);
    }
    
    // Convert to array format
    return Array.from(categoryTotals.entries()).map(([category, total]) => ({
      category,
      total
    }));
  }
  
  async getBudgetPerformance(budgetId: number): Promise<{ 
    allocated: number; 
    spent: number; 
    remaining: number;
    categories: { categoryId: number; allocated: number; spent: number; remaining: number }[] 
  }> {
    const budget = await this.getBudgetById(budgetId);
    if (!budget) {
      throw new Error(`Budget with id ${budgetId} not found`);
    }
    
    const allocations = await this.getBudgetAllocations(budgetId);
    const expenses = await this.getExpensesByUserId(budget.userId);
    
    // Filter expenses that fall within the budget period
    const budgetExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= budget.startDate && expenseDate <= budget.endDate;
    });
    
    // Calculate total allocated and spent
    const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    
    // Group expenses by category
    const categoryTotals = new Map<number, number>();
    for (const expense of budgetExpenses) {
      const currentTotal = categoryTotals.get(expense.categoryId) || 0;
      categoryTotals.set(expense.categoryId, currentTotal + expense.amount);
    }
    
    // Calculate per-category performance
    const categoryPerformance = allocations.map(allocation => {
      const spent = categoryTotals.get(allocation.categoryId) || 0;
      return {
        categoryId: allocation.categoryId,
        allocated: allocation.amount,
        spent,
        remaining: allocation.amount - spent
      };
    });
    
    // Calculate total spent and remaining
    const totalSpent = categoryPerformance.reduce((sum, cat) => sum + cat.spent, 0);
    const totalRemaining = totalAllocated - totalSpent;
    
    return {
      allocated: totalAllocated,
      spent: totalSpent,
      remaining: totalRemaining,
      categories: categoryPerformance
    };
  }
}

export const storage = new MemStorage();
