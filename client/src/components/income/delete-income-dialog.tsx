import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Income } from "@shared/schema";

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

interface DeleteIncomeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  income: Income | null;
}

export function DeleteIncomeDialog({
  isOpen,
  onClose,
  income,
}: DeleteIncomeDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!income) throw new Error("No income to delete");
      await apiRequest("DELETE", `/api/incomes/${income.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({
        title: "Income deleted",
        description: "The income record has been deleted successfully.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete income: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  if (!income) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the income record &quot;{income.description}&quot;. 
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}