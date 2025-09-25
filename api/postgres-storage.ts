import { pool } from './db';
import session from 'express-session';
import { IStorage } from './storage';
import { 
  User, InsertUser, ExpenseCategory, InsertExpenseCategory, Expense, InsertExpense, 
  ExpenseSubcategory, InsertExpenseSubcategory, IncomeCategory, InsertIncomeCategory, 
  IncomeSubcategory, InsertIncomeSubcategory, Income, InsertIncome, Budget, InsertBudget, 
  BudgetAllocation, InsertBudgetAllocation
} from '@shared/schema';

export class PostgresStorage implements IStorage {
  // Create default categories for a new user
  async createDefaultCategories(userId: number): Promise<void> {
    // Default expense categories and subcategories
    const expenseCategories = {
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

    // Default income categories and subcategories
    const incomeCategories = {
      "Wages": ["Paycheck", "Tips", "Bonus", "Commission", "Other"],
      "Other": ["Transfer from savings", "Interest income", "Dividends", "Gifts", "Refunds", "Other"]
    };

    // Insert expense categories and subcategories
    for (const [catName, subcats] of Object.entries(expenseCategories)) {
      const catRes = await pool.query(
        'INSERT INTO expense_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING id',
        [userId, catName, `${catName} expenses`]
      );
      const categoryId = catRes.rows[0].id;
      for (const subcatName of subcats) {
        await pool.query(
          'INSERT INTO expense_subcategories (category_id, user_id, name, description) VALUES ($1, $2, $3, $4)',
          [categoryId, userId, subcatName, `${subcatName} in ${catName}`]
        );
      }
    }

    // Insert income categories and subcategories
    for (const [catName, subcats] of Object.entries(incomeCategories)) {
      const catRes = await pool.query(
        'INSERT INTO income_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, catName, `${catName} income`, true]
      );
      const categoryId = catRes.rows[0].id;
      console.log('Created income category:', catName, 'for user', userId, 'with id', categoryId);
      for (const subcatName of subcats) {
        await pool.query(
          'INSERT INTO income_subcategories (category_id, user_id, name, description) VALUES ($1, $2, $3, $4)',
          [categoryId, userId, subcatName, `${subcatName} in ${catName}`]
        );
      }
    }
    // Debug log: show all income categories for user
    const allCats = await pool.query('SELECT * FROM income_categories WHERE user_id = $1', [userId]);
    console.log('All income categories for user', userId, allCats.rows);
  }
  sessionStore: session.Store;

  constructor(sessionStore: session.Store) {
    this.sessionStore = sessionStore;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await pool.query(
      'INSERT INTO users (username, password, name, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [user.username, user.password, user.name, user.email]
    );
    return result.rows[0];
  }

    // Legacy expense methods (for backward compatibility)
    async createLegacyExpense(data: any) {
      // For now, treat as normal expense creation
      return this.createExpense(data);
    }

    async updateLegacyExpense(id: number, data: any) {
      // For now, treat as normal expense update
      return this.updateExpense(id, data);
    }

    // Analytics/reporting methods
    async getMonthlyExpenseTotals(userId: number, year: number) {
      const result = await pool.query(
        `SELECT EXTRACT(MONTH FROM date) AS month, SUM(amount) AS total
         FROM expenses WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2
         GROUP BY month ORDER BY month`,
        [userId, year]
      );
      return result.rows;
    }

    async getCategoryExpenseTotals(userId: number, start: Date, end: Date) {
      const result = await pool.query(
        `SELECT category_id, SUM(amount) AS total
         FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3
         GROUP BY category_id`,
        [userId, start, end]
      );
      return result.rows;
    }

    async getMonthlyIncomeTotals(userId: number, year: number) {
      const result = await pool.query(
        `SELECT EXTRACT(MONTH FROM date) AS month, SUM(amount) AS total
         FROM incomes WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2
         GROUP BY month ORDER BY month`,
        [userId, year]
      );
      return result.rows;
    }

    async getCategoryIncomeTotals(userId: number, start: Date, end: Date) {
      const result = await pool.query(
        `SELECT category_id, SUM(amount) AS total
         FROM incomes WHERE user_id = $1 AND date >= $2 AND date <= $3
         GROUP BY category_id`,
        [userId, start, end]
      );
      return result.rows;
    }

    async getBudgetPerformance(budgetId: number) {
      // Return object with allocated, spent, remaining, categories
      // Example stub: you should implement real logic here
      return {
        allocated: 0,
        spent: 0,
        remaining: 0,
        categories: []
      };
    }

    // Admin methods
    async getAllExpenses() {
      const result = await pool.query('SELECT * FROM expenses');
      return result.rows;
    }

    async getAllIncomes() {
      const result = await pool.query('SELECT * FROM incomes');
      return result.rows;
    }
  async getAllUsers(): Promise<User[]> {
    const result = await pool.query('SELECT * FROM users');
    return result.rows;
  }

  async getUserRole(userId: number): Promise<string> {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.role || 'user';
  }

  async setUserRole(userId: number, role: string): Promise<void> {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
  }

  async updateUserSettings(userId: number, settings: { currency?: string }): Promise<User> {
    const result = await pool.query(
      'UPDATE users SET currency = $1 WHERE id = $2 RETURNING *',
      [settings.currency, userId]
    );
    return result.rows[0];
  }

  // Expense Category operations
  async getExpenseCategories(userId: number): Promise<ExpenseCategory[]> {
    const result = await pool.query('SELECT * FROM expense_categories WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async getExpenseCategoryById(id: number): Promise<any> {
    const result = await pool.query('SELECT * FROM expense_categories WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createExpenseCategory(userId: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const result = await pool.query(
      'INSERT INTO expense_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [userId, category.name, category.description]
    );
    return result.rows[0];
  }

  async updateExpenseCategory(id: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const result = await pool.query(
      'UPDATE expense_categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [category.name, category.description, id]
    );
    return result.rows[0];
  }

  async deleteExpenseCategory(id: number): Promise<void> {
    await pool.query('DELETE FROM expense_categories WHERE id = $1', [id]);
  }

  // Expense Subcategory operations
  async getExpenseSubcategories(categoryId: number): Promise<ExpenseSubcategory[]> {
    const result = await pool.query('SELECT * FROM expense_subcategories WHERE category_id = $1', [categoryId]);
    return result.rows;
  }

  async getExpenseSubcategoryById(id: number): Promise<ExpenseSubcategory | undefined> {
    const result = await pool.query('SELECT * FROM expense_subcategories WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createExpenseSubcategory(userId: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory> {
    const result = await pool.query(
      'INSERT INTO expense_subcategories (user_id, category_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, subcategory.categoryId, subcategory.name, subcategory.description]
    );
    return result.rows[0];
  }

  async updateExpenseSubcategory(id: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory> {
    const result = await pool.query(
      'UPDATE expense_subcategories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [subcategory.name, subcategory.description, id]
    );
    return result.rows[0];
  }

  async deleteExpenseSubcategory(id: number): Promise<void> {
    await pool.query('DELETE FROM expense_subcategories WHERE id = $1', [id]);
  }

  // Income Category operations
  async getIncomeCategories(userId: number): Promise<IncomeCategory[]> {
    const result = await pool.query('SELECT * FROM income_categories WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async getIncomeCategoryById(id: number): Promise<IncomeCategory | undefined> {
    const result = await pool.query('SELECT * FROM income_categories WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    // Map snake_case to camelCase for TS compatibility
    return {
      id: row.id,
      name: row.name,
      userId: row.user_id,
      description: row.description,
      isSystem: row.is_system,
      createdAt: row.created_at
    };
  }

  async createIncomeCategory(userId: number, category: InsertIncomeCategory): Promise<IncomeCategory> {
    const result = await pool.query(
      'INSERT INTO income_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [userId, category.name, category.description]
    );
    return result.rows[0];
  }

  async updateIncomeCategory(id: number, category: InsertIncomeCategory): Promise<IncomeCategory> {
    const result = await pool.query(
      'UPDATE income_categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [category.name, category.description, id]
    );
    return result.rows[0];
  }

  async deleteIncomeCategory(id: number): Promise<void> {
    await pool.query('DELETE FROM income_categories WHERE id = $1', [id]);
  }

  // Income Subcategory operations
  async getIncomeSubcategories(categoryId: number): Promise<IncomeSubcategory[]> {
    const result = await pool.query('SELECT * FROM income_subcategories WHERE category_id = $1', [categoryId]);
    return result.rows;
  }

  async getIncomeSubcategoryById(id: number): Promise<IncomeSubcategory | undefined> {
    const result = await pool.query('SELECT * FROM income_subcategories WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createIncomeSubcategory(userId: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory> {
    const result = await pool.query(
      'INSERT INTO income_subcategories (user_id, category_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, subcategory.categoryId, subcategory.name, subcategory.description]
    );
    return result.rows[0];
  }

  async updateIncomeSubcategory(id: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory> {
    const result = await pool.query(
      'UPDATE income_subcategories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [subcategory.name, subcategory.description, id]
    );
    return result.rows[0];
  }

  async deleteIncomeSubcategory(id: number): Promise<void> {
    await pool.query('DELETE FROM income_subcategories WHERE id = $1', [id]);
  }

  // Expense operations
  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    // Join with expense_categories to get category name
    const result = await pool.query(`
      SELECT e.*, c.name AS category_name
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.user_id = $1
    `, [userId]);
    return result.rows;
  }

  async getExpenseById(id: number): Promise<any> {
    const result = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createExpense(expense: InsertExpense & { userId: number }): Promise<Expense> {
  const result = await pool.query(
    `INSERT INTO expenses 
      (user_id, amount, description, date, category_id, subcategory_id, merchant, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      expense.userId,
      expense.amount,
      expense.description,
      expense.date,
      expense.categoryId,
      expense.subcategoryId || null,
      expense.merchant || null,
      expense.notes || null
    ]
  );
  return result.rows[0];
}

async updateExpense(id: number, expense: InsertExpense & { userId: number }): Promise<Expense> {
  const result = await pool.query(
    `UPDATE expenses 
     SET amount = $1, description = $2, date = $3, category_id = $4, subcategory_id = $5, merchant = $6, notes = $7
     WHERE id = $8 AND user_id = $9 RETURNING *`,
    [
      expense.amount,
      expense.description,
      expense.date,
      expense.categoryId,
      expense.subcategoryId,
      expense.merchant,
      expense.notes,
      id,
      expense.userId
    ]
  );

  if (result.rows.length === 0) {
    throw new Error("No expense to update");
  }

  return result.rows[0];
}



  async deleteExpense(id: number): Promise<void> {
    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
  }

  // Income operations
  async getIncomesByUserId(userId: number): Promise<Income[]> {
  const result = await pool.query(`
    SELECT i.*, 
           c.name AS category_name,
           sc.name AS subcategory_name
    FROM incomes i
    LEFT JOIN income_categories c ON i.category_id = c.id
    LEFT JOIN income_subcategories sc ON i.subcategory_id = sc.id
    WHERE i.user_id = $1
    ORDER BY i.date DESC
  `, [userId]);

  // Map to camelCase like frontend expects
  return result.rows.map(row => ({
    ...row,
    categoryName: row.category_name !== null ? row.category_name : "Uncategorised",
    subcategoryName: row.subcategory_name !== null ? row.subcategory_name : null,
  }));

}


  async getIncomeById(id: number): Promise<Income | undefined> {
    const result = await pool.query('SELECT * FROM incomes WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    // Map snake_case to camelCase for compatibility with route checks
    return {
      ...row,
      userId: row.user_id,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // add other mappings as needed
    };
  }

  async createIncome(income: InsertIncome & { userId: number }): Promise<Income> {
  const result = await pool.query(
    `INSERT INTO incomes 
     (user_id, amount, description, date, category_id, subcategory_id, source, notes) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [income.userId, income.amount, income.description, income.date, income.categoryId, income.subcategoryId, income.source, income.notes]
  );

  // Map category name correctly for frontend
  if (income.categoryId) {
    const catRes = await pool.query('SELECT name FROM income_categories WHERE id = $1', [income.categoryId]);
    result.rows[0].categoryName = catRes.rows[0]?.name || null;
  } else {
    result.rows[0].categoryName = null;
  }

  return result.rows[0];
}



  async updateIncome(id: number, income: InsertIncome & { userId: number }): Promise<Income> {
  let categoryName: string | null = null;

  if (income.categoryId) {
    const catRes = await pool.query('SELECT name FROM income_categories WHERE id = $1', [income.categoryId]);
    categoryName = catRes.rows[0]?.name || null;
  }

  const result = await pool.query(
    `UPDATE incomes 
     SET amount = $1, description = $2, date = $3, category_id = $4, subcategory_id = $5, source = $6, notes = $7, category_name = $8
     WHERE id = $9 RETURNING *`,
    [income.amount, income.description, income.date, income.categoryId, income.subcategoryId, income.source, income.notes, categoryName, id]
  );

  return {
    ...result.rows[0],
    categoryName: categoryName,
  };
}


  async deleteIncome(id: number, userId: number) {
  console.log('[DEBUG] deleteIncome called with:', { id, userId });
  const res = await pool.query(
    `DELETE FROM incomes WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );

  if (res.rows.length === 0) {
    console.log('[DEBUG] No income found to delete for:', { id, userId });
    return null;
  }

  console.log('[DEBUG] Deleted income:', res.rows[0]);
  return res.rows[0]; // ✅ return deleted row
}



  // Budget operations
  async getBudgetsByUserId(userId: number): Promise<Budget[]> {
    const result = await pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async getBudgetById(id: number): Promise<Budget | undefined> {    
    const result = await pool.query('SELECT * FROM budgets WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    // Map snake_case to camelCase for compatibility with route checks
    return {
      ...row,
      userId: row.user_id,
      startDate: row.start_date,
      endDate: row.end_date,
      // add other mappings as needed
    };
  }

  async createBudget(budget: InsertBudget & { userId: number }): Promise<Budget> {
    const result = await pool.query(
      'INSERT INTO budgets (user_id, name, start_date, end_date, amount, period, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [budget.userId, budget.name, budget.startDate, budget.endDate, budget.amount, budget.period, budget.notes]
    );
    return result.rows[0];
  }

  async updateBudget(
  id: number,
  budgetData: { name: string; startDate: Date; endDate: Date; amount: number; period?: string; notes?: string | null; userId: number }
) {
  const result = await pool.query(
    `UPDATE budgets
     SET name=$1, start_date=$2, end_date=$3, amount=$4, period=$5, notes=$6
     WHERE id=$7 AND user_id=$8
     RETURNING *`,
    [
      budgetData.name,
      budgetData.startDate,
      budgetData.endDate,
      budgetData.amount,
      budgetData.period,
      budgetData.notes,
      id,
      budgetData.userId, // ✅ ensures only the owner can update
    ]
  );

  if (result.rows.length === 0) throw new Error("No budget to update");
  return result.rows[0];
}



async deleteBudget(id: number, userId: number): Promise<void> {
  const result = await pool.query(
    'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );

  if (result.rows.length === 0) throw new Error("No budget to delete");
}



  


  // Budget Allocation operations
  async getBudgetAllocations(budgetId: number): Promise<BudgetAllocation[]> {
    const result = await pool.query('SELECT * FROM budget_allocations WHERE budget_id = $1', [budgetId]);
    return result.rows;
  }

  async createBudgetAllocation(allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const result = await pool.query(
      'INSERT INTO budget_allocations (budget_id, category_id, subcategory_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [allocation.budgetId, allocation.categoryId, allocation.subcategoryId, allocation.amount]
    );
    return result.rows[0];
  }

  async updateBudgetAllocation(id: number, allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const result = await pool.query(
      'UPDATE budget_allocations SET budget_id = $1, category_id = $2, subcategory_id = $3, amount = $4 WHERE id = $5 RETURNING *',
      [allocation.budgetId, allocation.categoryId, allocation.subcategoryId, allocation.amount, id]
    );
    return result.rows[0];
  }

  async deleteBudgetAllocation(id: number): Promise<void> {
    await pool.query('DELETE FROM budget_allocations WHERE id = $1', [id]);
  }

  // Reports and analytics methods can be implemented similarly using SQL queries
}
