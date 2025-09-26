import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Income, IncomeCategory, clientIncomeSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EditIncomeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  income: Income | null;
}

export function EditIncomeDialog({ isOpen, onClose, income }: EditIncomeDialogProps) {
  // System categories for dropdown
  const systemCategories = [
    { id: 1, name: 'Wages' },
    { id: 2, name: 'Deals' },
    { id: 3, name: 'Other' },
  ];
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Get income categories from API
  const { data: categories, isLoading: isCategoriesLoading } = useQuery<IncomeCategory[]>({
    queryKey: ["/api/income-categories"],
    enabled: isOpen, // Only fetch when dialog is open
  });

  type EditIncomeForm = {
    description: string;
    amount: number | null;
    date: Date | string;
    categoryId: number | null;
    categoryName: string;
    source?: string;
    notes?: string;
  };

  const form = useForm<EditIncomeForm>({
    resolver: zodResolver(clientIncomeSchema as any),
    defaultValues: {
      description: "",
      amount: null,
      date: new Date(),
      categoryId: null,
      categoryName: "",
      source: "",
      notes: "",
    },
  });

  // Update form when income data changes
  useEffect(() => {
    if (income && isOpen) {
      form.reset({
        description: income.description,
        amount: income.amount,
        date: new Date(income.date),
        categoryId: income.categoryId,
        categoryName: income.categoryName || "",
        source: income.source || "",
        notes: income.notes || "",
      });
    }
  }, [income, isOpen, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!income) throw new Error("No income to update");
      const resp = await apiRequest("PATCH", `/api/incomes/${income.id}`, data);
      return await resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({
        title: "Income updated successfully",
        description: "Your income record has been updated.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update income: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditIncomeForm) => {
    // Parse amount to number if it's a string
    let amount = data.amount;
    if (typeof amount === "string") {
      amount = parseFloat((amount as string).replace(/[^0-9.]/g, ""));
    }
    // Always get the latest value from form state
    const categoryName = form.getValues('categoryName');
    // Check if it's a system category
    const found = systemCategories.find(cat =>
      cat.name.trim().toLowerCase() === (categoryName || '').trim().toLowerCase()
    );
    let categoryId;
    if (found) {
      categoryId = found.id;
    } else {
      categoryId = 0;
    }
    updateMutation.mutate({
      ...data,
      amount,
      categoryId,
      categoryName,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center">
            Edit Income
            <Button
              className="ml-auto"
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description*</FormLabel>
                  <FormControl>
                    <Input placeholder="Salary, Bonus, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount* ({user?.currency || "XAF"})</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter amount"
                        value={field.value === undefined || field.value === null ? "" : String(field.value)}
                        onChange={(e) => {
                          let value = e.target.value.replace(/[^0-9.]/g, "");
                          // If empty, set null, else convert to number
                          if (value === "") {
                            form.setValue("amount", null, { shouldValidate: true });
                          } else {
                            form.setValue("amount", Number(value), { shouldValidate: true });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date*</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(new Date(field.value), "PPP")
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
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => 
                            field.onChange(date ? date.toISOString() : new Date().toISOString())
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category*</FormLabel>
                    <FormControl>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Select
                          onValueChange={value => {
                            form.setValue('categoryName', value, { shouldValidate: true });
                          }}
                          value={systemCategories.some(cat => cat.name === field.value) ? field.value : ''}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="System category" />
                          </SelectTrigger>
                          <SelectContent>
                            {systemCategories.map(cat => (
                              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Or type custom category"
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={e => {
                            form.setValue('categoryName', e.target.value, { shouldValidate: true });
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name, client, etc." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional details about this income" 
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
                className="mt-2"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="btn-gradient mt-2"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Update Income"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}