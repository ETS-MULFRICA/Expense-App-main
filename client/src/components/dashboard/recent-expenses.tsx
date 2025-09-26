import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreHorizontal } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Expense, ExpenseCategory } from "@shared/schema";
import { format } from "date-fns";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import EditExpenseDialog from "@/components/expense/edit-expense-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search } from "lucide-react";
import { formatCurrency } from "@/lib/currency-formatter";

// Map of category to icon color class (black and white only)
const categoryIconColors: Record<string, string> = {
  Groceries: "text-gray-600",
  Utilities: "text-gray-700",
  Entertainment: "text-gray-600",
  Housing: "text-gray-700",
  Shopping: "text-gray-600",
  Health: "text-gray-700",
  Transportation: "text-gray-600",
  Other: "text-gray-700"
};

// Map of category to badge color class (black and white only)
const categoryBadgeColors: Record<string, string> = {
  Groceries: "text-gray-800",
  Utilities: "text-gray-900",
  Entertainment: "text-gray-800",
  Housing: "text-gray-900",
  Shopping: "text-gray-800",
  Health: "text-gray-900",
  Transportation: "text-gray-800",
  Other: "text-gray-900"
};

// Map of category to icon (no MoreHorizontal/three-dot icon here!)
const categoryIcons: Record<string, React.ReactNode> = {
  Groceries: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Utilities: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Entertainment: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  ),
  Housing: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Shopping: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  Health: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  Transportation: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  )
  // Removed 'Other' SVG icon
};

interface RecentExpensesProps {
  expenses: Expense[];
  isLoading: boolean;
  showSearch?: boolean;
}

export default function RecentExpenses({
  expenses,
  isLoading,
  showSearch = true
}: RecentExpensesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [enrichedExpenses, setEnrichedExpenses] = useState<(Expense & { category: string })[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch categories for mapping
  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ['/api/expense-categories'],
    enabled: !!user
  });
  
  // Enrich expenses with category names
  useEffect(() => {
    if (expenses) {
      const newEnrichedExpenses = expenses.map(expense => ({
        ...expense,
        category: expense.category_name || 'Uncategorized'
      }));
      setEnrichedExpenses(newEnrichedExpenses);
    }
  }, [expenses]);
  
  const pageSize = 5;
  
  // Filter expenses based on search term
  const filteredExpenses = enrichedExpenses.filter(expense => 
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (expense.category_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Sort expenses by date (newest first)
  const sortedExpenses = [...filteredExpenses].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Paginate expenses
  const totalPages = Math.ceil(sortedExpenses.length / pageSize);
  const paginatedExpenses = sortedExpenses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
      toast({
        title: "Expense deleted",
        description: "The expense has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete expense",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingExpense(null);
  };

  return (
    <>
      <Card className="mt-8">
        <CardHeader className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <CardTitle>Recent Expenses</CardTitle>
            <CardDescription>
              A list of your recent expenses and transactions
            </CardDescription>
          </div>
          {showSearch && (
            <div>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search expenses..."
                  className="block w-full pl-10 pr-3"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="ml-4">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24 mt-1" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Skeleton className="h-4 w-24 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : paginatedExpenses.length > 0 ? (
                paginatedExpenses.map((expense) => {
                  const iconColorClass = categoryIconColors[expense.category] || categoryIconColors.Other;
                  const badgeColorClass = categoryBadgeColors[expense.category] || categoryBadgeColors.Other;
                  const icon = categoryIcons[expense.category] || categoryIcons.Other;
                  
                  return (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(expense.date), "MMM dd, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 relative">
                            <div className="flex items-center">
                              <div className={`flex-shrink-0 h-4 w-4 mr-3 ${iconColorClass}`}>
                                {icon}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {expense.description}
                                </div>
                                {expense.merchant && (
                                  <div className="text-sm text-gray-500">
                                    {expense.merchant}
                                  </div>
                                )}
                              </div>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="ml-2 flex-shrink-0 h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition" tabIndex={0}>
                                    <MoreHorizontal className="h-3 w-3 text-gray-600" />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-4" align="start">
                                  <div className="flex flex-col gap-2">
                                    <div className="font-semibold text-sm mb-1">Expense Notes</div>
                                    <div className="text-gray-700 text-sm min-h-[40px]">
                                      {expense.notes ? expense.notes : <span className="italic text-gray-400">No notes provided.</span>}
                                    </div>
                                    <Button variant="outline" size="sm" className="self-end mt-2" onClick={e => {
                                      const focusElement = (e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')?.parentElement?.querySelector('[tabindex="0"]') as HTMLElement;
                                      focusElement?.focus();
                                    }}>
                                      Close
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColorClass}`}>
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(expense.amount, user?.currency || 'XAF')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          className="text-primary hover:text-primary/90 mr-3"
                          onClick={() => handleEdit(expense)}
                        >
                          Edit
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              className="text-gray-700 hover:text-gray-900"
                            >
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this expense record. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(expense.id)}
                                className="bg-gray-800 hover:bg-gray-900"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    No expenses found. Add a new expense to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <CardFooter className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, sortedExpenses.length)}
                </span>{" "}
                of <span className="font-medium">{sortedExpenses.length}</span> results
              </p>
            </div>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(totalPages, 3) }).map((_, i) => {
                  const pageNumber = i + 1;
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink 
                        isActive={currentPage === pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                {totalPages > 3 && currentPage < totalPages - 1 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                
                {totalPages > 3 && (
                  <PaginationItem>
                    <PaginationLink
                      isActive={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        )}
      </Card>
      
      {editingExpense && (
        <EditExpenseDialog 
          expense={editingExpense}
          isOpen={isEditDialogOpen}
          onClose={handleCloseEditDialog}
        />
      )}
    </>
  );
}
