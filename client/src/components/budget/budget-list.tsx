import { useState } from "react";
import { 
  PieChart,
  BarChart,
  Edit2,
  Trash2, 
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  EyeIcon
} from "lucide-react";
import { Budget } from "@/lib/models";
import { formatCurrency } from "@/lib/currency-formatter";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EditBudgetDialog from "./edit-budget-dialog";
import BudgetDetailsDialog from "./budget-details-dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CreateBudgetDialog from "./create-budget-dialog";

interface BudgetListProps {
  budgets: Budget[];
}

export default function BudgetList({ budgets }: BudgetListProps) {
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [expandedBudgetId, setExpandedBudgetId] = useState<number | null>(null);
  const { toast } = useToast();

  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/budgets/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete budget");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Budget deleted",
        description: "Budget has been successfully deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (budget: Budget) => {
    setSelectedBudget(budget);
    setIsEditDialogOpen(true);
  };

  const handleView = (budget: Budget) => {
    setSelectedBudget(budget);
    setIsDetailsDialogOpen(true);
  };

  const handleDelete = (budget: Budget) => {
    setSelectedBudget(budget);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = () => {
    if (selectedBudget) {
      deleteBudgetMutation.mutate(selectedBudget.id);
    }
    setIsDeleteAlertOpen(false);
  };

  const toggleExpand = (budgetId: number) => {
    if (expandedBudgetId === budgetId) {
      setExpandedBudgetId(null);
    } else {
      setExpandedBudgetId(budgetId);
    }
  };

  if (budgets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <PieChart className="h-12 w-12 text-gray-300" />
            <div>
              <h3 className="font-medium text-lg">No budgets yet</h3>
              <p className="text-sm text-gray-500 mt-1">
                Create your first budget to start tracking your expenses against your financial plan.
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                // This will be handled by the parent component
                // which will toggle the CreateBudgetDialog's open state
                window.dispatchEvent(new CustomEvent('open-create-budget-dialog'));
              }}
            >
              Create Budget
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {budgets.map((budget) => (
        <Card key={budget.id} className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-0">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-lg">{budget.name}</h3>
                  <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                    {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(budget.id)}
                    className="hidden md:flex"
                  >
                    {expandedBudgetId === budget.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(budget)}>
                        <EyeIcon className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(budget)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(budget)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm text-gray-500">Total Budget</div>
                  <div className="text-lg font-semibold mt-1">{formatCurrency(budget.amount)}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm text-gray-500">Period</div>
                  <div className="text-lg font-semibold mt-1">{budget.period}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm text-gray-500">Categories</div>
                  <div className="text-lg font-semibold mt-1">
                    {budget.categoryNames && budget.categoryNames.length > 0
                      ? budget.categoryNames.join(", ")
                      : "N/A"}
                  </div>
                </div>
              </div>

              {expandedBudgetId === budget.id && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <h4 className="font-medium">Budget Performance</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(budget)}
                      className="text-xs"
                    >
                      View Details
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div>
                      <div className="text-sm text-gray-500">Allocated</div>
                      <div className="font-medium">
                        {formatCurrency(
                          budget.allocatedAmount !== undefined 
                            ? budget.allocatedAmount 
                            : 0
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Spent</div>
                      <div className="font-medium">
                        {formatCurrency(
                          budget.spentAmount !== undefined 
                            ? budget.spentAmount 
                            : 0
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Remaining</div>
                      <div className="font-medium">
                        {formatCurrency(
                          (budget.allocatedAmount !== undefined ? budget.allocatedAmount : 0) - 
                          (budget.spentAmount !== undefined ? budget.spentAmount : 0)
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                    <div 
                      className="bg-gray-600 h-2.5 rounded-full" 
                      style={{ 
                        width: `${Math.min(100, 
                          ((budget.spentAmount !== undefined ? budget.spentAmount : 0) / 
                           (budget.allocatedAmount !== undefined ? budget.allocatedAmount : 1)) * 100
                        )}%` 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {selectedBudget && (
        <>
          <EditBudgetDialog
            isOpen={isEditDialogOpen}
            onClose={() => setIsEditDialogOpen(false)}
            budget={selectedBudget}
          />
          <BudgetDetailsDialog 
            isOpen={isDetailsDialogOpen}
            onClose={() => setIsDetailsDialogOpen(false)}
            budgetId={selectedBudget.id}
          />
        </>
      )}

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the budget "{selectedBudget?.name}" and all its allocations.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}