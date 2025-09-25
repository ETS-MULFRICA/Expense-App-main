import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { insertExpenseSchema, clientExpenseSchema, InsertExpense, Expense, ExpenseCategory } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Loader2, Save } from "lucide-react";
import { currencySymbols } from "@/lib/currency-formatter";

interface EditExpenseDialogProps {
  expense: Expense;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditExpenseDialog({ 
  expense, 
  isOpen, 
  onClose 
}: EditExpenseDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const currencySymbol = user?.currency ? currencySymbols[user.currency] : 'FCFA';
  
  const form = useForm<InsertExpense>({
    resolver: zodResolver(clientExpenseSchema),
    defaultValues: {
      description: expense.description,
      amount: expense.amount,
      date: new Date(expense.date),
      categoryId: expense.categoryId || 0,
      subcategoryId: expense.subcategoryId || null,
      merchant: expense.merchant || "",
      notes: expense.notes || ""
    }
  });
  
  const updateExpenseMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      // Ensure date is properly formatted for API
      const formattedData = {
        ...data,
        date: data.date instanceof Date ? data.date.toISOString() : data.date
      };
      
      const res = await apiRequest("PATCH", `/api/expenses/${expense.id}`, formattedData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
      toast({
        title: "Expense updated",
        description: "The expense has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update expense",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: InsertExpense) => {
    updateExpenseMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>
            Update the details of your expense.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="What did you spend on?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">{currencySymbol}</span>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          className="pl-7"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          field.onChange(date);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => {
                // Fetch categories
                const { data: categories } = useQuery<ExpenseCategory[]>({
                  queryKey: ['/api/expense-categories'],
                  enabled: !!user
                });
                
                return (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category: ExpenseCategory) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            
            <FormField
              control={form.control}
              name="merchant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merchant/Payee</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Where did you spend?" 
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details (optional)"
                      className="resize-none"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit"
                className="btn-gradient"
                disabled={updateExpenseMutation.isPending}
              >
                {updateExpenseMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Update Expense
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
