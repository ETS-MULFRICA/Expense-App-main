import { useState, useEffect, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subMonths, compareAsc } from 'date-fns';
import { Expense, ExpenseCategory } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency-formatter";
import { useQuery } from "@tanstack/react-query";

interface ExpenseChartProps {
  expenses: Expense[];
}

type ProcessedData = {
  month: string;
  [category: string]: string | number;
};

// Extended expense type with category name
interface ExtendedExpense extends Expense {
  categoryName: string;
}

export default function ExpenseChart({ expenses }: ExpenseChartProps) {
  // Get data for the last 6 months
  const today = new Date();
  const sixMonthsAgo = subMonths(today, 6);
  const { user } = useAuth();
  const [enrichedExpenses, setEnrichedExpenses] = useState<ExtendedExpense[]>([]);
  
  // Fetch all categories to map IDs to names
  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ['/api/expense-categories'],
    enabled: !!user
  });
  
  // Enrich expenses with category names
  useEffect(() => {
    if (expenses && categories) {
      const newEnrichedExpenses = expenses.map(expense => {
        const category = categories.find(c => c.id === expense.categoryId);
        return {
          ...expense,
          categoryName: category?.name || 'Uncategorized'
        };
      });
      setEnrichedExpenses(newEnrichedExpenses);
    }
  }, [expenses, categories]);
  
  const filteredExpenses = enrichedExpenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return compareAsc(expenseDate, sixMonthsAgo) >= 0;
  });

  // Get unique category names
  const categoryNames = Array.from(new Set(filteredExpenses.map(expense => expense.categoryName)));
  
  // Prepare data for chart
  const chartData = useMemo(() => {
    const months: Record<string, ProcessedData> = {};
    
    // Initialize empty data for each month in the last 6 months
    for (let i = 0; i < 6; i++) {
      const date = subMonths(today, i);
      const monthKey = format(date, 'MMM');
      
      months[monthKey] = {
        month: monthKey,
      };
      
      // Initialize all categories with 0
      categoryNames.forEach(category => {
        months[monthKey][category] = 0;
      });
    }
    
    // Fill in actual data
    filteredExpenses.forEach(expense => {
      const expenseDate = new Date(expense.date);
      const monthKey = format(expenseDate, 'MMM');
      
      if (months[monthKey]) {
        months[monthKey][expense.categoryName] = 
          (months[monthKey][expense.categoryName] as number || 0) + expense.amount;
      }
    });
    
    // Convert to array and sort by month
    return Object.values(months).sort((a, b) => {
      const monthA = new Date(`${a.month} 1, 2000`).getMonth();
      const monthB = new Date(`${b.month} 1, 2000`).getMonth();
      return monthA - monthB;
    });
  }, [filteredExpenses, categoryNames, today]);

  // Colors for the different categories using grayscale/black palette
  const categoryColors: Record<string, string> = {
    Everyday: "#000000",     // Black
    Utilities: "#333333",    // Dark gray
    Entertainment: "#555555", // Medium-dark gray
    Home: "#777777",         // Medium gray
    Health: "#999999",       // Medium-light gray
    Transportation: "#BBBBBB", // Light gray
    Travel: "#DDDDDD",       // Very light gray
    Other: "#444444"         // Darker gray
  };

  // Generate colors for any other categories
  categoryNames.forEach((category, index) => {
    if (!categoryColors[category]) {
      const grayscaleColors = [
        "#000000", "#333333", "#555555", "#777777", 
        "#999999", "#BBBBBB", "#DDDDDD", "#444444"
      ];
      categoryColors[category] = grayscaleColors[index % grayscaleColors.length];
    }
  });

  // If no data, show empty state
  if (categoryNames.length === 0) {
    return (
      <Card className="mt-8">
        <CardHeader className="px-5 py-4 border-b border-border">
          <CardTitle>Expense Trends</CardTitle>
          <CardDescription>
            Last 6 months of expenses by category
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 flex items-center justify-center h-72">
          <p className="text-gray-500">No expense data available for the last 6 months</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader className="px-5 py-4 border-b border-border">
        <CardTitle>Expense Trends</CardTitle>
        <CardDescription>
          Last 6 months of expenses by category
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value, user?.currency || 'XAF'), 'Amount']} 
              />
              <Legend />
              {categoryNames.map((category) => (
                <Bar 
                  key={category}
                  dataKey={category} 
                  stackId="a" 
                  fill={categoryColors[category]} 
                  name={category}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-4">
          {categoryNames.map((category) => (
            <div key={category} className="flex items-center">
              <div 
                className="w-4 h-4 rounded mr-2" 
                style={{ backgroundColor: categoryColors[category] }}
              ></div>
              <span className="text-sm text-gray-600">{category}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
