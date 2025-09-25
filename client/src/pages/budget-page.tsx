import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Budget, BudgetAllocation, ExpenseCategory } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { exportBudgetsToCSV, exportBudgetsToPDF } from "@/lib/export-utils";
import { AddBudgetDialog } from "@/components/budget/add-budget-dialog";
import { EditBudgetDialog } from "@/components/budget/edit-budget-dialog";
import { DeleteBudgetDialog } from "@/components/budget/delete-budget-dialog";

export default function BudgetPage() {
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [isDeleteBudgetOpen, setIsDeleteBudgetOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const { user } = useAuth();

  const { data: budgets, isLoading: isLoadingBudgets } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
    enabled: !!user
  });

  // Handlers for CRUD actions
  const handleAddBudget = (budget: { name: string; amount: number }) => {
    // TODO: Implement API call to add budget
    setIsAddBudgetOpen(false);
  };

  const handleEditBudget = (budget: { id: number; name: string; amount: number }) => {
    // TODO: Implement API call to edit budget
    setIsEditBudgetOpen(false);
    setSelectedBudget(null);
  };

  const handleDeleteBudget = () => {
    // TODO: Implement API call to delete budget
    setIsDeleteBudgetOpen(false);
    setSelectedBudget(null);
  };

  return (
    <MainLayout>
      <h1>Budgets</h1>
      <Button onClick={() => setIsAddBudgetOpen(true)}>Add Budget</Button>
      <table className="min-w-full mt-6 border">
        <thead>
          <tr>
            <th className="px-4 py-2 border">Name</th>
            <th className="px-4 py-2 border">Amount</th>
            <th className="px-4 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {budgets?.map((budget) => (
            <tr key={budget.id}>
              <td className="px-4 py-2 border">{budget.name}</td>
              <td className="px-4 py-2 border">{budget.amount}</td>
              <td className="px-4 py-2 border">
                <Button size="sm" variant="outline" onClick={() => { setSelectedBudget(budget); setIsEditBudgetOpen(true); }}>Edit</Button>
                <Button size="sm" variant="destructive" className="ml-2" onClick={() => { setSelectedBudget(budget); setIsDeleteBudgetOpen(true); }}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Dialogs for CRUD operations */}
      <AddBudgetDialog
        isOpen={isAddBudgetOpen}
        onClose={() => setIsAddBudgetOpen(false)}
        onAdd={handleAddBudget}
      />
      <EditBudgetDialog
        isOpen={isEditBudgetOpen}
        onClose={() => { setIsEditBudgetOpen(false); setSelectedBudget(null); }}
        budget={selectedBudget}
        onEdit={handleEditBudget}
      />
      <DeleteBudgetDialog
        isOpen={isDeleteBudgetOpen}
        onClose={() => { setIsDeleteBudgetOpen(false); setSelectedBudget(null); }}
        onDelete={handleDeleteBudget}
      />
    </MainLayout>
  );
}
