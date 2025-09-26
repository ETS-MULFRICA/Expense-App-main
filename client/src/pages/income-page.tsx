import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Income, IncomeCategory } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Search, Plus } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { ExportButton } from "@/components/ui/export-button";
import { exportIncomesToCSV, exportIncomesToPDF } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { AddIncomeDialog } from "@/components/income/add-income-dialog";
import { EditIncomeDialog } from "@/components/income/edit-income-dialog";
import { DeleteIncomeDialog } from "@/components/income/delete-income-dialog";

export default function IncomePage() {
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [isEditIncomeOpen, setIsEditIncomeOpen] = useState(false);
  const [isDeleteIncomeOpen, setIsDeleteIncomeOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { user } = useAuth();

  const { data: incomes, isLoading: isLoadingIncomes } = useQuery<Income[]>({
    queryKey: ["/api/incomes"],
  });

  const { data: categoryData } = useQuery<IncomeCategory[]>({
    queryKey: ['/api/income-categories'],
    enabled: !!user
  });
  
  const [enrichedIncomes, setEnrichedIncomes] = useState<(Income & { category: string })[]>([]);
  
  // Enrich incomes with category names
 useEffect(() => {
  if (incomes && categoryData) {
    const newEnrichedIncomes = incomes.map(income => {
      const category = categoryData.find(c => String(c.id) === String(income.categoryId));
      let categoryLabel = '';
      if (category) {
        categoryLabel = category.name;
      } else if (income.categoryName) {
        categoryLabel = income.categoryName;
      } else {
        categoryLabel = 'Uncategorized';
      }
      return {
        ...income,
        category: categoryLabel
      };
    });
    setEnrichedIncomes(newEnrichedIncomes);
  }
}, [incomes, categoryData]);

  // Get unique category names for filter
  const categoryNames = Array.from(new Set(enrichedIncomes.map(income => income.category)));
  
  // Filter enriched incomes
  const filteredEnrichedIncomes = enrichedIncomes.filter(income => {
    const matchesSearch = search === "" || 
      income.description.toLowerCase().includes(search.toLowerCase()) ||
      income.source?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || income.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <h1 className="text-2xl font-bold gradient-heading mb-4 sm:mb-0">Income</h1>
        <div className="flex gap-2">
          <ExportButton 
            onExportPDF={() => exportIncomesToPDF(filteredEnrichedIncomes, user?.currency || 'XAF')}
            onExportCSV={() => exportIncomesToCSV(filteredEnrichedIncomes, user?.currency || 'XAF')}
            isLoading={isLoadingIncomes}
            disabled={!filteredEnrichedIncomes?.length}
            label="Export"
          />
          <Button 
            onClick={() => setIsAddIncomeOpen(true)}
            className="btn-gradient"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Income
          </Button>
        </div>
      </div>
      
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            placeholder="Search income..."
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
      
      {/* Income list - we need to create this component */}
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm">
        {isLoadingIncomes ? (
          <p className="text-center py-10">Loading income data...</p>
        ) : filteredEnrichedIncomes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 mb-2">No income records found.</p>
            <Button onClick={() => setIsAddIncomeOpen(true)} variant="outline" className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add your first income record
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-zinc-700">
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Description</th>
                  <th className="text-left py-3 px-4 font-semibold">Category</th>
                  <th className="text-left py-3 px-4 font-semibold">Source</th>
                  <th className="text-right py-3 px-4 font-semibold">Amount</th>
                  <th className="text-right py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrichedIncomes.map((income) => {
                  const date = new Date(income.date);
                  return (
                    <tr key={income.id} className="border-b dark:border-zinc-700">
                      <td className="py-3 px-4">
                        {date.toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{income.description}</td>
                      <td className="py-3 px-4">{income.category}</td>
                      <td className="py-3 px-4">{income.source || "-"}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {new Intl.NumberFormat('en-US', { 
                          style: 'currency', 
                          currency: user?.currency || 'XAF',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(income.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mr-1"
                          onClick={() => {
                            // Find the original income object (not the enriched one)
                            const originalIncome = incomes?.find(i => i.id === income.id) || null;
                            setSelectedIncome(originalIncome);
                            setIsEditIncomeOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500"
                          onClick={() => {
                            // Find the original income object (not the enriched one)
                            const originalIncome = incomes?.find(i => i.id === income.id) || null;
                            setSelectedIncome(originalIncome);
                            setIsDeleteIncomeOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <AddIncomeDialog 
        isOpen={isAddIncomeOpen} 
        onClose={() => setIsAddIncomeOpen(false)}
      />
      
      <EditIncomeDialog 
        isOpen={isEditIncomeOpen} 
        onClose={() => {
          setIsEditIncomeOpen(false);
          setSelectedIncome(null);
        }}
        income={selectedIncome}
      />
      
      <DeleteIncomeDialog 
        isOpen={isDeleteIncomeOpen} 
        onClose={() => {
          setIsDeleteIncomeOpen(false);
          setSelectedIncome(null);
        }}
        income={selectedIncome}
      />
    </MainLayout>
  );
}