import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Budget } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import BudgetList from "@/components/budget/budget-list";
import CreateBudgetDialog from "@/components/budget/create-budget-dialog";
import MainLayout from "@/components/layout/main-layout";
import { ExportButton } from "@/components/ui/export-button";
import { exportBudgetsToCSV, exportBudgetsToPDF } from "@/lib/export-utils";
import { useToast } from "@/hooks/use-toast";

export default function BudgetsPage() {
  const { user } = useAuth();
  const [isCreateBudgetOpen, setIsCreateBudgetOpen] = useState(false);

  // Add event listener for opening create budget dialog
  useEffect(() => {
    const handleOpenCreateDialog = () => {
      setIsCreateBudgetOpen(true);
    };

    window.addEventListener('open-create-budget-dialog', handleOpenCreateDialog);
    
    return () => {
      window.removeEventListener('open-create-budget-dialog', handleOpenCreateDialog);
    };
  }, []);

  const { data: budgets, isLoading, error } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) {
        throw new Error("Failed to fetch budgets");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-red-500">Error loading budgets</p>
          <p className="text-sm text-gray-500 mt-1">{(error as Error).message}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold gradient-heading">Budget Management</h1>
        <div className="flex gap-2">
          <ExportButton 
            onExportPDF={() => exportBudgetsToPDF(budgets || [], user?.currency || 'XAF')}
            onExportCSV={() => exportBudgetsToCSV(budgets || [], user?.currency || 'XAF')}
            isLoading={isLoading}
            disabled={!budgets?.length}
            label="Export"
          />
          <Button onClick={() => setIsCreateBudgetOpen(true)} className="btn-gradient">
            <Plus className="h-4 w-4 mr-2" />
            New Budget
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-gray-600">
          Create and manage budgets to track your expenses by category.
        </p>
      </div>

      <BudgetList budgets={budgets || []} />

      <CreateBudgetDialog
        isOpen={isCreateBudgetOpen}
        onClose={() => setIsCreateBudgetOpen(false)}
      />
    </MainLayout>
  );
}