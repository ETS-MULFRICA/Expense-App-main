import { Budget as BaseBudget, BudgetAllocation as BaseBudgetAllocation } from "@shared/schema";

// Extend the Budget type to include computed/runtime properties
export interface Budget extends BaseBudget {
  // These are populated in the frontend or from API response
  categoryCount?: number;
  categoryNames?: string[];
  allocatedAmount?: number;
  spentAmount?: number;
}

// Extend BudgetAllocation to include category name for display
export interface BudgetAllocation extends BaseBudgetAllocation {
  categoryName?: string;
}

// Define the budget performance response type
export interface BudgetPerformance {
  allocated: number;
  spent: number;
  remaining: number;
  categories: {
    categoryId: number;
    allocated: number;
    spent: number;
    remaining: number;
  }[];
}