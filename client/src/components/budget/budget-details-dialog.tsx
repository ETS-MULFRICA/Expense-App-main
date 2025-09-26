import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Budget, BudgetAllocation, BudgetPerformance } from "@/lib/models";
import { insertBudgetAllocationSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatCurrency } from "@/lib/currency-formatter";
import { format } from "date-fns";
import { 
  Loader2, 
  Plus, 
  Trash2,
  PieChart,
  BarChart
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BudgetDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  budgetId: number;
}

const allocationFormSchema = insertBudgetAllocationSchema.omit({ budgetId: true });

type AllocationFormValues = z.infer<typeof allocationFormSchema>;

export default function BudgetDetailsDialog({ 
  isOpen, 
  onClose, 
  budgetId 
}: BudgetDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState("allocations");
  const { toast } = useToast();

  // Fetch the budget (with allocations and performance)
  const {
    data: budgetData,
    isLoading: isBudgetLoading,
    error: budgetError
  } = useQuery({
    queryKey: [`/api/budgets/${budgetId}`],
    queryFn: async () => {
      const response = await fetch(`/api/budgets/${budgetId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch budget details");
      }
      return response.json();
    },
    enabled: isOpen && budgetId > 0,
  });

  const budget = budgetData?.budget;
  const allocations = budgetData?.allocations;
  const performance = budgetData?.performance;

  // Remove separate allocations query (now comes from budgetData)

  // Fetch expense categories
  const { 
    data: categories, 
    isLoading: isCategoriesLoading 
  } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/expense-categories"],
    queryFn: async () => {
      const response = await fetch("/api/expense-categories");
      if (!response.ok) {
        throw new Error("Failed to fetch expense categories");
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Remove separate performance query (now comes from budgetData)

  // Form for adding a new allocation
  const form = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      categoryId: 0,
      subcategoryId: null,
      amount: 0,
    },
  });

  // Create allocation mutation
  const createAllocationMutation = useMutation({
    mutationFn: async (data: AllocationFormValues) => {
      const response = await fetch(`/api/budgets/${budgetId}/allocations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          budgetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create allocation");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/allocations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/performance`] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Allocation added",
        description: "Budget allocation has been added successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete allocation mutation
  const deleteAllocationMutation = useMutation({
    mutationFn: async (allocationId: number) => {
      const response = await fetch(`/api/budget-allocations/${allocationId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete allocation");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/allocations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}/performance`] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Allocation deleted",
        description: "Budget allocation has been deleted successfully.",
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

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset();
      setActiveTab("allocations");
    }
  }, [isOpen, form]);

  // Handle form submission
  const onSubmit = (data: AllocationFormValues) => {
    createAllocationMutation.mutate(data);
  };

  // Handle allocation deletion
  const handleDeleteAllocation = (allocationId: number) => {
    if (confirm("Are you sure you want to delete this allocation?")) {
      deleteAllocationMutation.mutate(allocationId);
    }
  };

  // Find category name by id
  const getCategoryName = (categoryId: number) => {
    if (!categories) return "Unknown";
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : "Unknown";
  };

  // Loading state
  if (isBudgetLoading || isCategoriesLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Error state
  if (budgetError) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="text-center py-12">
            <p className="text-red-500">Error loading budget details</p>
            <p className="text-sm text-gray-500 mt-1">
              {(budgetError as Error)?.message}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{budget?.name || "Budget Details"}</DialogTitle>
          <DialogDescription>
            {budget && (
              <>
                <span className="block text-sm text-gray-500 mt-1">
                  Period: {budget.period ? budget.period.charAt(0).toUpperCase() + budget.period.slice(1) : 'N/A'}
                </span>
                <span className="block text-sm text-gray-500">
                  {(() => {
                    const start = new Date(budget.startDate);
                    const end = new Date(budget.endDate);
                    const isValidDate = (d: Date) => d instanceof Date && !isNaN(d.getTime());
                    return isValidDate(start) && isValidDate(end)
                      ? `${format(start, "PP")} - ${format(end, "PP")}`
                      : "Invalid date";
                  })()}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="allocations" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="allocations">Budget Allocations</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* ALLOCATIONS TAB */}
          <TabsContent value="allocations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New Allocation</CardTitle>
                <CardDescription>
                  Allocate portions of your budget to different expense categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(Number(value))}
                              value={field.value.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories?.map(category => (
                                  <SelectItem key={category.id} value={category.id.toString()}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="subcategoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subcategory (Optional)</FormLabel>
                            <Select
                              onValueChange={(value) => 
                                field.onChange(value === "null" ? null : Number(value))
                              }
                              value={field.value === null ? "null" : field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a subcategory" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="null">None</SelectItem>
                                {/* Subcategories would be listed here */}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit"
                      disabled={createAllocationMutation.isPending}
                      className="mt-2"
                    >
                      {createAllocationMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Allocation
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Allocations</CardTitle>
                <CardDescription>
                  Manage how your budget is distributed across categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(allocations ?? []).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(allocations ?? []).map((allocation: import("@/lib/models").BudgetAllocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>
                            {allocation.categoryName || getCategoryName(allocation.categoryId)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(allocation.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAllocation(allocation.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No allocations yet.</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add an allocation above to get started.
                    </p>
                  </div>
                )}
              </CardContent>
              {(allocations ?? []).length > 0 && (
                <CardFooter className="border-t px-6 py-4">
                  <div className="w-full flex justify-between">
                    <span className="font-medium">Total Allocated:</span>
                    <span className="font-medium">
                      {formatCurrency(
                        (allocations ?? []).reduce((sum: number, item: import("@/lib/models").BudgetAllocation) => sum + item.amount, 0)
                      )}
                    </span>
                  </div>
                </CardFooter>
              )}
            </Card>
          </TabsContent>

          {/* PERFORMANCE TAB */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Budget Overview</CardTitle>
                <CardDescription>
                  Track how your spending compares to your budget allocations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="text-sm text-gray-500">Total Budget</div>
                    <div className="text-xl font-semibold mt-1">
                      {budget ? formatCurrency(budget.amount) : "--"}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="text-sm text-gray-500">Total Spent</div>
                    <div className="text-xl font-semibold mt-1">
                      {performance ? formatCurrency(performance.spent) : "--"}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="text-sm text-gray-500">Remaining</div>
                    <div className="text-xl font-semibold mt-1">
                      {performance ? formatCurrency(performance.remaining) : "--"}
                    </div>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mb-8">
                  <div 
                    className={`h-4 rounded-full ${
                      performance && performance.spent > performance.allocated 
                        ? "bg-red-500" 
                        : "bg-gray-600"
                    }`}
                    style={{ 
                      width: `${performance 
                        ? Math.min(100, ((performance.spent / (budget?.amount || 1)) * 100)) 
                        : 0}%` 
                    }}
                  />
                </div>

                <h3 className="text-lg font-medium mb-4">Category Breakdown</h3>

                {performance && performance.categories.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.categories.map((category: {
                        categoryId: number;
                        allocated: number;
                        spent: number;
                        remaining: number;
                      }) => (
                        <TableRow key={category.categoryId}>
                          <TableCell>{getCategoryName(category.categoryId)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(category.allocated)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(category.spent)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(category.remaining)}
                          </TableCell>
                          <TableCell className="w-[100px]">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  category.spent > category.allocated 
                                    ? "bg-red-500" 
                                    : "bg-gray-600"
                                }`}
                                style={{ 
                                  width: `${Math.min(
                                    100, 
                                    ((category.spent / (category.allocated || 1)) * 100)
                                  )}%` 
                                }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 border rounded-md">
                    <div className="flex justify-center mb-2">
                      <PieChart className="h-12 w-12 text-gray-300" />
                    </div>
                    <p className="text-gray-500">No performance data available.</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add allocations and record expenses to see performance details.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}