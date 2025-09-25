import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Expense, ExpenseCategory } from "@shared/schema";
import RecentExpenses from "@/components/dashboard/recent-expenses";
import AddExpenseDialog from "@/components/expense/add-expense-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Search } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { ExportButton } from "@/components/ui/export-button";
import { exportExpensesToCSV, exportExpensesToPDF } from "@/lib/export-utils";
import { useToast } from "@/hooks/use-toast";

export default function ExpensesPage() {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { user } = useAuth();

  const { data: expenses, isLoading: isLoadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: categoryData } = useQuery<ExpenseCategory[]>({
    queryKey: ['/api/expense-categories'],
    enabled: !!user
  });
  
  const [enrichedExpenses, setEnrichedExpenses] = useState<(Expense & { category: string })[]>([]);
  
  // Enrich expenses with category names
  useEffect(() => {
    if (expenses && categoryData) {
      const newEnrichedExpenses = expenses.map(expense => {
        const category = categoryData.find(c => c.id === expense.categoryId);
        return {
          ...expense,
          category: category?.name || 'Uncategorized'
        };
      });
      setEnrichedExpenses(newEnrichedExpenses);
    }
  }, [expenses, categoryData]);

  // Get unique category names for filter
  const categoryNames = Array.from(new Set(enrichedExpenses.map(expense => expense.category)));
  
  // Filter enriched expenses
  const filteredEnrichedExpenses = enrichedExpenses.filter(expense => {
    const matchesSearch = search === "" || 
      expense.description.toLowerCase().includes(search.toLowerCase()) ||
      expense.merchant?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <h1 className="text-2xl font-bold gradient-heading mb-4 sm:mb-0">Expenses</h1>
        <div className="flex gap-2">
          <ExportButton 
            onExportPDF={() => exportExpensesToPDF(filteredEnrichedExpenses, user?.currency || 'XAF')}
            onExportCSV={() => exportExpensesToCSV(filteredEnrichedExpenses, user?.currency || 'XAF')}
            isLoading={isLoadingExpenses}
            disabled={!filteredEnrichedExpenses?.length}
            label="Export"
          />
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
      </div>
      
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="w-full sm:w-48">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryNames.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <RecentExpenses 
        expenses={filteredEnrichedExpenses} 
        isLoading={isLoadingExpenses} 
        showSearch={false}
      />
      
      <AddExpenseDialog 
        isOpen={isAddExpenseOpen} 
        onClose={() => setIsAddExpenseOpen(false)}
      />
    </MainLayout>
  );
}
