import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Expense } from "@shared/schema";
import StatCards from "@/components/dashboard/stat-cards";
import ExpenseChart from "@/components/dashboard/expense-chart";
import RecentExpenses from "@/components/dashboard/recent-expenses";
import AddExpenseDialog from "@/components/expense/add-expense-dialog";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const { user } = useAuth();

  const { data: expenses, isLoading: isLoadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: announcements } = useQuery<any[]>({
    queryKey: ["/api/announcements"],
  });

  useEffect(() => {
    // If user navigated via sidebar Announcements link (hash), scroll to it
    if (typeof window !== 'undefined' && window.location.hash === '#announcements') {
      const el = document.getElementById('announcements-card');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Debug logging
  useEffect(() => {
    if (expenses) {
      console.log("All expenses with categories:", expenses);
      
      // Calculate category totals for debugging
      const categoryTotals: Record<string, number> = {};
      expenses.forEach(expense => {
        // Use the category_name that comes from the backend
        const categoryName = expense.category_name || "Uncategorized";
        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
      });
      console.log("Category totals:", categoryTotals);
    }
  }, [expenses]);

  // Date filtering logic
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthExpenses = expenses?.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getFullYear() === currentYear && 
           expenseDate.getMonth() === currentMonth;
  }) || [];

  const lastMonthExpenses = expenses?.filter(expense => {
    const expenseDate = new Date(expense.date);
    const expenseYear = expenseDate.getFullYear();
    const expenseMonth = expenseDate.getMonth();
    
    if (currentMonth === 0) {
      return expenseYear === currentYear - 1 && expenseMonth === 11;
    } else {
      return expenseYear === currentYear && expenseMonth === currentMonth - 1;
    }
  }) || [];

  const totalCurrentMonth = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalLastMonth = lastMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  const percentChange = totalLastMonth === 0 
    ? totalCurrentMonth > 0 ? 100 : 0
    : ((totalCurrentMonth - totalLastMonth) / totalLastMonth) * 100;

  // FIXED: Use the category_name that already comes from the backend
  const categoryTotals: Record<string, number> = {};
  
  expenses?.forEach(expense => {
    // Use the category_name field that's already populated by your backend
    const categoryName = expense.category_name || "Uncategorized";
    categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
  });

  console.log("Final category totals:", categoryTotals);

  const highestCategory = Object.entries(categoryTotals).length > 0
    ? Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0][0]
    : "None";

  console.log("Highest category result:", highestCategory);

  const recentExpensesCount = expenses?.length || 0;

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-heading">Dashboard</h1>
          <p className="text-gray-500">Welcome back, {user?.name}!</p>
        </div>
        <button 
          onClick={() => setIsAddExpenseOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium btn-gradient"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Expense
        </button>
      </div>
      
      <StatCards 
        totalExpenses={totalCurrentMonth}
        percentChange={percentChange}
        highestCategory={highestCategory}
        recentEntriesCount={recentExpensesCount}
      />

      {announcements && announcements.length > 0 && (
        <Card className="mt-6" id="announcements-card">
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {announcements.slice(0,3).map(a => (
                <li key={a.id} className="border rounded p-3">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{a.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleString()} {a.author_name ? `• ${a.author_name}` : ''}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      
      <ExpenseChart expenses={expenses || []} />
      
      <RecentExpenses 
        expenses={expenses || []} 
        isLoading={isLoadingExpenses} 
      />

      <AddExpenseDialog 
        isOpen={isAddExpenseOpen} 
        onClose={() => setIsAddExpenseOpen(false)}
      />
    </MainLayout>
  );
} 