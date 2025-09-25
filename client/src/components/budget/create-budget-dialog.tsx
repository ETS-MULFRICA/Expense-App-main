import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clientBudgetSchema } from "@shared/schema";
import { Budget } from "@/lib/models";
import { formatCurrency } from "@/lib/currency-formatter";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";


// Extend the schema to require all fields and at least one category
const formSchema = clientBudgetSchema;

type FormValues = z.infer<typeof formSchema>;

interface CreateBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateBudgetDialog({
  isOpen,
  onClose,
}: CreateBudgetDialogProps) {
  const [isPeriodCustom, setIsPeriodCustom] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [categoryError, setCategoryError] = useState<string>("");
  const { toast } = useToast();
  
  // Fetch expense categories
  const { data: categories, isLoading: isCategoriesLoading } = useQuery<{ id: number; name: string }[]>({
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      period: "monthly",
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      amount: 0,
      notes: "",
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create budget");
      }

      return response.json() as Promise<Budget>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Budget created",
        description: "Your budget has been created successfully.",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handlePeriodChange(value: string) {
    // Reset end date based on the selected period
    const startDate = form.getValues("startDate");
    let endDate = new Date(startDate);

    if (value === "custom") {
      setIsPeriodCustom(true);
      // Don't automatically set end date for custom
      return;
    }
    
    setIsPeriodCustom(false);
    
    switch (value) {
      case "weekly":
        endDate.setDate(startDate.getDate() + 7);
        break;
      case "monthly":
        endDate.setMonth(startDate.getMonth() + 1);
        break;
      case "quarterly":
        endDate.setMonth(startDate.getMonth() + 3);
        break;
      case "biannual":
        endDate.setMonth(startDate.getMonth() + 6);
        break;
      case "annual":
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
      default:
        // Default to monthly
        endDate.setMonth(startDate.getMonth() + 1);
    }

    form.setValue("endDate", endDate);
  }

  function handleStartDateChange(date: Date) {
    form.setValue("startDate", date);
    
    // Update end date based on the period
    const period = form.getValues("period");
    if (period !== "custom") {
      let endDate = new Date(date);
      
      switch (period) {
        case "weekly":
          endDate.setDate(date.getDate() + 7);
          break;
        case "monthly":
          endDate.setMonth(date.getMonth() + 1);
          break;
        case "quarterly":
          endDate.setMonth(date.getMonth() + 3);
          break;
        case "biannual":
          endDate.setMonth(date.getMonth() + 6);
          break;
        case "annual":
          endDate.setFullYear(date.getFullYear() + 1);
          break;
      }
      
      form.setValue("endDate", endDate);
    }
  }


  const onSubmit = (data: FormValues) => {
    if (selectedCategories.length === 0) {
      setCategoryError("Please select at least one category.");
      return;
    } else {
      setCategoryError("");
    }
    // Include the selected categories with the budget data
    const budgetData = {
      ...data,
      categoryIds: selectedCategories
    };
    createBudgetMutation.mutate(budgetData);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Budget</DialogTitle>
            <DialogDescription>
              Set up a new budget to track your expenses against financial goals.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Monthly Expenses, Q2 Budget" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          handlePeriodChange(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="biannual">Biannual</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
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
                      <FormLabel>Total Budget</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        This is the total amount you plan to spend during this period
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              if (date) {
                                handleStartDateChange(date);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={!isPeriodCustom}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => date && field.onChange(date)}
                            disabled={(date) => date < form.getValues("startDate")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                      {!isPeriodCustom && (
                        <FormDescription>
                          End date is automatically set based on the period
                        </FormDescription>
                      )}
                    </FormItem>
                  )}
                />
              </div>

              <FormItem>
                <FormLabel>Categories</FormLabel>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {isCategoriesLoading ? (
                    <div className="col-span-2 flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : categories && categories.length > 0 ? (
                    categories.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`category-${category.id}`}
                          checked={selectedCategories.includes(category.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, category.id]);
                            } else {
                              setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label
                          htmlFor={`category-${category.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {category.name}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 col-span-2">No categories available</p>
                  )}
                </div>
                {categoryError && (
                  <p className="text-sm text-red-500 mt-1">{categoryError}</p>
                )}
                <FormDescription
                  className={categoryError ? "text-red-500" : undefined}
                >
                  Select the categories this budget will track
                </FormDescription>
              </FormItem>
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any additional details about this budget..."
                        className="resize-none"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createBudgetMutation.isPending || selectedCategories.length === 0}
                >
                  {createBudgetMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Budget"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}