import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency-formatter";
import { Loader2, PieChart, BarChart, User as UserIcon, Search, UserPlus, Trash2, Edit, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (user?.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin dashboard.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Fetch all users
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  // Fetch all expenses (for admin view)
  const { data: expenses, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ["/api/admin/expenses"],
    queryFn: async () => {
      const response = await fetch("/api/admin/expenses");
      if (!response.ok) {
        throw new Error("Failed to fetch expenses");
      }
      return response.json();
    },
    enabled: user?.role === "admin" && selectedTab === "expenses",
  });

  // Fetch all budgets (for admin view)
  const { data: budgets, isLoading: isLoadingBudgets } = useQuery({
    queryKey: ["/api/admin/budgets"],
    queryFn: async () => {
      const response = await fetch("/api/admin/budgets");
      if (!response.ok) {
        throw new Error("Failed to fetch budgets");
      }
      return response.json();
    },
    enabled: user?.role === "admin" && selectedTab === "budgets",
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Deleted",
        description: "The user has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        throw new Error("Failed to update user role");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Updated",
        description: "The user role has been updated successfully.",
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

  // Function to handle user role change
  const handleRoleChange = (userId: number, role: string) => {
    updateUserRoleMutation.mutate({ userId, role });
  };

  // Function to confirm user deletion
  const confirmDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  // Filter users based on search query
  const filteredUsers = users?.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (user?.role !== "admin") {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500">
              Please contact an administrator if you believe you should have access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/budgets"] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="users">
            <UserIcon className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <BarChart className="h-4 w-4 mr-2" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="budgets">
            <PieChart className="h-4 w-4 mr-2" />
            Budgets
          </TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                View and manage all users in the system
              </CardDescription>
              <div className="mt-4 flex space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Search users..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers && filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role || "user"}
                              onValueChange={(value) => handleRoleChange(user.id, value)}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>All Expenses</CardTitle>
              <CardDescription>
                View all expenses across all users in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingExpenses ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses && expenses.length > 0 ? (
                      expenses.map((expense: any) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{expense.userName || "Unknown"}</TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell>{expense.categoryName || "Uncategorized"}</TableCell>
                          <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                          No expenses found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {expenses && expenses.length > 0 && (
              <CardFooter className="border-t px-6 py-4">
                <div className="w-full flex justify-between">
                  <span className="font-medium">Total Expenses:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0)
                    )}
                  </span>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* BUDGETS TAB */}
        <TabsContent value="budgets">
          <Card>
            <CardHeader>
              <CardTitle>All Budgets</CardTitle>
              <CardDescription>
                View all budgets across all users in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBudgets ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Budget Name</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgets && budgets.length > 0 ? (
                      budgets.map((budget: any) => (
                        <TableRow key={budget.id}>
                          <TableCell className="font-medium">{budget.userName || "Unknown"}</TableCell>
                          <TableCell>{budget.name}</TableCell>
                          <TableCell>
                            {budget.period ? budget.period.charAt(0).toUpperCase() + budget.period.slice(1) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(budget.amount)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                          No budgets found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {budgets && budgets.length > 0 && (
              <CardFooter className="border-t px-6 py-4">
                <div className="w-full flex justify-between">
                  <span className="font-medium">Total Budget Amount:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      budgets.reduce((sum: number, budget: any) => sum + budget.amount, 0)
                    )}
                  </span>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account for "{selectedUser?.username}" and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
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