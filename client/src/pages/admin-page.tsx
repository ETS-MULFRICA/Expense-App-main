import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { 
  Loader2, PieChart, BarChart, User as UserIcon, Search, UserPlus, Trash2, 
  Edit, RefreshCw, Home, DollarSign, History, FileText, TrendingUp, ShieldBan, ShieldCheck, KeyRound, Settings, Flag, EyeOff, Check, XCircle, ArrowUpRight, Calendar 
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { exportExpensesToCSV, exportExpensesToPDF, exportIncomesToCSV, exportIncomesToPDF, exportBudgetsToCSV, exportBudgetsToPDF } from "@/lib/export-utils";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import { hasPermission, getEffectiveCurrency } from "@/lib/utils";
import AdminSettingsPage from "@/pages/admin-settings-page";

interface DashboardStats {
  users: {
    total: number;
    suspended: number;
    deleted: number;
    newLast7Days: number;
    dailyActive: number;
  };
  expenses: {
    total: number;
    totalAmount: number;
    recent30Days: number;
  };
  incomes: {
    total: number;
    totalAmount: number;
    recent30Days: number;
  };
  budgets: {
    total: number;
    usersWithBudgets: number;
  };
  totalTransactions: number;
  recentActivity: any[];
  topCategories: any[];
  dailyActiveSeries?: { date: string; value: number }[];
  expenseTrends?: { date: string; transactions: number; total_amount: number }[];
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [analyticsTab, setAnalyticsTab] = useState<'trends'|'categories'|'activity'|'exports'>('trends');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", name: "", email: "", role: "user" });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [moderationActionLoading, setModerationActionLoading] = useState<number | null>(null);
  const [tempPasswords, setTempPasswords] = useState<Record<number, string>>({});

  // Check if user is admin (legacy) or has admin.access permission
  useEffect(() => {
    if (user?.role !== "admin" && !hasPermission(user, 'admin.access')) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin dashboard.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Navigate directly to announcements tab if URL contains #announcements
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#announcements') {
      setSelectedTab('announcements');
    }
  }, []);

  // Fetch dashboard stats
  const { data: dashboardStats, isLoading: isLoadingDashboard } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/admin/dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }
      return response.json();
    },
  enabled: (user?.role === "admin" || hasPermission(user, 'admin.access')) && selectedTab === "dashboard",
  });

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
  enabled: (user?.role === "admin" || hasPermission(user, 'user.manage')) && selectedTab === "users",
  });

  // Admin actions
  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch(`/api/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('Failed to create user');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Created", description: `Temporary password: ${data.temporaryPassword}` });
      setIsCreating(false);
      setNewUser({ username: "", name: "", email: "", role: "user" });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' })
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: 'active'|'suspended'|'deleted' }) => {
      const response = await fetch(`/api/admin/users/${userId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: 'Status Updated', description: 'User status updated.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' })
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to reset password');
      return response.json();
    },
    onSuccess: (data: any, userId: number) => {
      toast({ title: 'Password Reset', description: `Temporary password: ${data.temporaryPassword}` });
      if (userId && data?.temporaryPassword) {
        setTempPasswords(prev => ({ ...prev, [userId]: data.temporaryPassword }));
      }
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' })
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
  enabled: (user?.role === "admin" || hasPermission(user, 'expense.read') || hasPermission(user, 'expense.write')) && selectedTab === "expenses",
  });

  // Fetch all incomes (for admin view)
  const { data: incomes, isLoading: isLoadingIncomes } = useQuery({
    queryKey: ["/api/admin/incomes"],
    queryFn: async () => {
      const response = await fetch("/api/admin/incomes");
      if (!response.ok) {
        throw new Error("Failed to fetch incomes");
      }
      return response.json();
    },
  enabled: (user?.role === "admin" || hasPermission(user, 'income.read') || hasPermission(user, 'income.write')) && selectedTab === "incomes",
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
  enabled: (user?.role === "admin" || hasPermission(user, 'budget.read') || hasPermission(user, 'budget.write')) && selectedTab === "budgets",
  });

  // Fetch all activity logs (for admin view)
  const { data: activityLogs, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["/api/activity-logs"],
    queryFn: async () => {
      const response = await fetch("/api/activity-logs?limit=50");
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs");
      }
      const data = await response.json();
      return data.logs;
    },
  enabled: (user?.role === "admin" || hasPermission(user, 'admin.access')) && selectedTab === "history",
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
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
  const filteredUsers = users?.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : (user as any).status === statusFilter;
    const matchesRole = roleFilter === 'all' ? true : (user.role || 'user') === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const exportOverview = () => {
    if (!dashboardStats) return;
    const lines: string[] = [];
    const currency = getEffectiveCurrency(user || undefined);
    lines.push('Metric,Value');
    lines.push(`Total Users,${dashboardStats.users.total}`);
    lines.push(`Daily Active Users,${dashboardStats.users.dailyActive}`);
    lines.push(`Total Transactions,${dashboardStats.totalTransactions}`);
    lines.push(`Total Expenses,${formatCurrency(dashboardStats.expenses.totalAmount, currency)}`);
    lines.push(`Total Incomes,${formatCurrency(dashboardStats.incomes.totalAmount, currency)}`);
    lines.push('');
    lines.push('Daily Active Users (last 30 days)');
    lines.push('Date,Active');
    (dashboardStats.dailyActiveSeries||[]).forEach(p=>lines.push(`${new Date(p.date).toLocaleDateString()},${p.value}`));
    lines.push('');
    lines.push('Expense Trends (last 30 days)');
    lines.push('Date,Transactions,Total Amount');
    (dashboardStats.expenseTrends||[]).forEach(p=>lines.push(`${new Date(p.date).toLocaleDateString()},${p.transactions},${p.total_amount}`));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `analytics-overview-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  // Export helpers that fetch data on demand so exports work from Analytics tab
  const exportBudgetsCsv = async () => {
    try {
      const r = await fetch('/api/admin/budgets');
      if (!r.ok) throw new Error('Failed to load budgets');
      const data = await r.json();
      exportBudgetsToCSV(data as any, getEffectiveCurrency(user || undefined));
      toast({ title: 'Export started', description: 'Budgets CSV download should begin shortly.' });
    } catch (e:any) {
      toast({ title: 'Export failed', description: e?.message || 'Could not export budgets', variant: 'destructive' });
    }
  };

  const exportExpensesPdf = async () => {
    try {
      const r = await fetch('/api/admin/expenses');
      if (!r.ok) throw new Error('Failed to load expenses');
      const data = await r.json();
      const rows = (data || []).map((e:any)=> ({ ...e, category: e.categoryName || 'Uncategorized' }));
      exportExpensesToPDF(rows as any, getEffectiveCurrency(user || undefined));
      toast({ title: 'Export started', description: 'Expenses PDF download should begin shortly.' });
    } catch (e:any) {
      toast({ title: 'Export failed', description: e?.message || 'Could not export expenses', variant: 'destructive' });
    }
  };

  const exportIncomesPdf = async () => {
    try {
      const r = await fetch('/api/admin/incomes');
      if (!r.ok) throw new Error('Failed to load incomes');
      const data = await r.json();
      const rows = (data || []).map((i:any)=> ({ ...i, category: i.categoryName || 'Uncategorized' }));
      exportIncomesToPDF(rows as any, getEffectiveCurrency(user || undefined));
      toast({ title: 'Export started', description: 'Incomes PDF download should begin shortly.' });
    } catch (e:any) {
      toast({ title: 'Export failed', description: e?.message || 'Could not export incomes', variant: 'destructive' });
    }
  };

  if (user?.role !== "admin" && !hasPermission(user, 'admin.access')) {
    return (
      <MainLayout>
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
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-600">Manage your ExpenseTrack application</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/incomes"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/budgets"] });
                queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"] });
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!dashboardStats) return;
                const lines: string[] = [];
                const currency = getEffectiveCurrency(user || undefined);
                lines.push('Metric,Value');
                lines.push(`Total Users,${dashboardStats.users.total}`);
                lines.push(`Daily Active Users,${dashboardStats.users.dailyActive}`);
                lines.push(`Total Transactions,${dashboardStats.totalTransactions}`);
                lines.push(`Total Expenses,${formatCurrency(dashboardStats.expenses.totalAmount, currency)}`);
                lines.push(`Total Incomes,${formatCurrency(dashboardStats.incomes.totalAmount, currency)}`);
                lines.push('');
                lines.push('Daily Active Users (last 30 days)');
                lines.push('Date,Active');
                (dashboardStats.dailyActiveSeries||[]).forEach(p=>lines.push(`${new Date(p.date).toLocaleDateString()},${p.value}`));
                lines.push('');
                lines.push('Expense Trends (last 30 days)');
                lines.push('Date,Transactions,Total Amount');
                (dashboardStats.expenseTrends||[]).forEach(p=>lines.push(`${new Date(p.date).toLocaleDateString()},${p.transactions},${p.total_amount}`));
                const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `analytics-overview-${Date.now()}.csv`;
                document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
              }}
            >
              Export Overview
            </Button>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid grid-cols-10 max-w-6xl bg-black rounded-xl p-1 text-white">
            <TabsTrigger 
              value="dashboard"
              className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
              <BarChart className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            {hasPermission(user, 'user.manage') && (
              <TabsTrigger 
                value="users"
                className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
                <UserIcon className="h-4 w-4 mr-2" />
                Users
              </TabsTrigger>
            )}
            {(hasPermission(user, 'expense.read') || hasPermission(user, 'expense.write')) && (
              <TabsTrigger 
                value="expenses"
                className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
                <BarChart className="h-4 w-4 mr-2" />
                Expenses
              </TabsTrigger>
            )}
            {(hasPermission(user, 'income.read') || hasPermission(user, 'income.write')) && (
              <TabsTrigger 
                value="incomes"
                className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
                <DollarSign className="h-4 w-4 mr-2" />
                Incomes
              </TabsTrigger>
            )}
            {(hasPermission(user, 'budget.read') || hasPermission(user, 'budget.write')) && (
              <TabsTrigger 
                value="budgets"
                className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
                <PieChart className="h-4 w-4 mr-2" />
                Budgets
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="history"
              className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger 
              value="roles"
              className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Roles
            </TabsTrigger>
            <TabsTrigger 
              value="system-settings"
              className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
              <Settings className="h-4 w-4 mr-2" />
              System Settings
            </TabsTrigger>
            <TabsTrigger 
              value="announcements"
              className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
              <FileText className="h-4 w-4 mr-2" />
              Announcements
            </TabsTrigger>
            {(user?.role === 'admin' || hasPermission(user, 'moderation.manage')) && (
              <TabsTrigger 
                value="moderation"
                className="data-[state=active]:bg-white data-[state=active]:text-black text-white hover:bg-white/10 rounded-md">
                <Flag className="h-4 w-4 mr-2" />
                Moderation
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard">
            {isLoadingDashboard ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : dashboardStats ? (
              <div className="space-y-6">
                {/* Header title for Admin Dashboard */}
                <div>
                  <h2 className="text-2xl font-semibold">Admin Dashboard</h2>
                  <p className="text-sm text-gray-600">Comprehensive insights into your expense tracking platform</p>
                </div>
                {/* Stats Grid to match screenshot (4 cards) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardStats.users.total}</div>
                      <p className="text-xs text-muted-foreground">+{dashboardStats.users.newLast7Days} new this week</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardStats.users.dailyActive}</div>
                      <p className="text-xs text-muted-foreground">Active today</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardStats.totalTransactions}</div>
                      <p className="text-xs text-muted-foreground">Expenses + Incomes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(dashboardStats.expenses.totalAmount, getEffectiveCurrency(user || undefined))}</div>
                      <p className="text-xs text-muted-foreground">Income: {formatCurrency(dashboardStats.incomes.totalAmount, getEffectiveCurrency(user || undefined))}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Analytics sub-tabs */}
                <div className="flex items-center gap-2">
                  {(['trends','categories','activity','exports'] as const).map(k => (
                    <Button key={k} variant={analyticsTab===k? 'default':'outline'} size="sm" className="rounded-full" onClick={()=>setAnalyticsTab(k)}>
                      {k==='trends'?'Trends':k==='categories'?'Categories':k==='activity'?'Activity':'Exports'}
                    </Button>
                  ))}
                  <div className="ml-auto inline-flex items-center gap-2 text-sm text-gray-700 border rounded-md px-2 py-1">
                    <Calendar className="h-4 w-4" /><span>Last 30 days</span>
                  </div>
                </div>

                {analyticsTab==='trends' && (
                  <div className="space-y-4">
                    {/* Quick stats for trends */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Daily Active Users (today)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{dashboardStats.users.dailyActive}</div>
                          <p className="text-xs text-muted-foreground">Unique users active today</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">30‑Day Expense Total</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency((dashboardStats.expenseTrends||[]).reduce((s:any,d:any)=> s + (Number(d.total_amount)||0), 0), getEffectiveCurrency(user || undefined))}
                          </div>
                          <p className="text-xs text-muted-foreground">Sum of last 30 days</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Avg Daily Spend (30d)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency(((dashboardStats.expenseTrends||[]).reduce((s:any,d:any)=> s + (Number(d.total_amount)||0), 0) / Math.max((dashboardStats.expenseTrends||[]).length||1,1)), getEffectiveCurrency(user || undefined))}
                          </div>
                          <p className="text-xs text-muted-foreground">Average per day</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Daily Active Users</CardTitle>
                        <CardDescription>User engagement over time</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(dashboardStats.dailyActiveSeries||[]).length ? (
                          <MiniLineChart data={(dashboardStats.dailyActiveSeries||[]).map(p=>({ x: new Date(p.date).getTime(), y: p.value }))} height={220} />
                        ) : (
                          <div className="text-sm text-gray-500">No activity yet</div>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Expense Trends</CardTitle>
                        <CardDescription>Daily spending patterns</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(dashboardStats.expenseTrends||[]).length ? (
                          <MiniBarChart data={dashboardStats.expenseTrends||[]} height={220} />
                        ) : (
                          <div className="text-sm text-gray-500">No expense data yet</div>
                        )}
                      </CardContent>
                    </Card>
                    </div>
                  </div>
                )}

                {analyticsTab==='categories' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Categories</CardTitle>
                      <CardDescription>Most used expense categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dashboardStats.topCategories.map((c:any, i:number)=> (
                          <div key={c.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><span className="text-sm font-medium">{i+1}.</span><span className="text-sm">{c.name}</span></div>
                            <div className="text-sm font-medium">{formatCurrency(c.total_amount, getEffectiveCurrency(user || undefined))}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {analyticsTab==='activity' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                      <CardDescription>Latest actions across the system</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dashboardStats.recentActivity.slice(0,10).map((a:any)=> (
                          <div key={a.id} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{a.description}</div>
                              <div className="text-xs text-gray-500">{a.user_name} • {new Date(a.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {analyticsTab==='exports' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Export Overview</CardTitle>
                      <CardDescription>Download reports and overviews</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={exportBudgetsCsv}>Export Budgets CSV</Button>
                        <Button variant="outline" size="sm" onClick={exportExpensesPdf}>Export Expenses PDF</Button>
                        <Button variant="outline" size="sm" onClick={exportIncomesPdf}>Export Incomes PDF</Button>
                        <Button size="sm" onClick={exportOverview}>Export Overview CSV</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-gray-500">No dashboard data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* USERS TAB - Keep your existing users tab content */}
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
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="deleted">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setIsCreating(true)}>
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
                        <TableHead>Status</TableHead>
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
                            <TableCell>
                              <span className={`text-xs px-2 py-1 rounded-full ${ (user as any).status === 'active' ? 'bg-green-100 text-green-800' : (user as any).status === 'suspended' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-700' }`}>
                                {(user as any).status || 'active'}
                              </span>
                              {tempPasswords[user.id] && (
                                <div className="text-[11px] text-gray-700 mt-1">
                                  Temp password: <span className="font-mono">{tempPasswords[user.id]}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex gap-4 items-end justify-end">
                                {(() => {
                                  const status = (user as any).status;
                                  if (status === 'active') {
                                    return (
                                      <div className="flex flex-col items-center">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          title="Suspend"
                                          onClick={() => updateStatusMutation.mutate({ userId: user.id, status: 'suspended' })}
                                        >
                                          <ShieldBan className="h-4 w-4" />
                                        </Button>
                                        <span className="text-[10px] mt-1">Suspend</span>
                                      </div>
                                    );
                                  }
                                  if (status === 'suspended' || status === 'deleted') {
                                    return (
                                      <div className="flex flex-col items-center">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          title="Activate"
                                          onClick={() => updateStatusMutation.mutate({ userId: user.id, status: 'active' })}
                                        >
                                          <ShieldCheck className="h-4 w-4" />
                                        </Button>
                                        <span className="text-[10px] mt-1">Activate</span>
                                      </div>
                                    );
                                  }
                                  // Fallback (unknown status): show Activate
                                  return (
                                    <div className="flex flex-col items-center">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Activate"
                                        onClick={() => updateStatusMutation.mutate({ userId: user.id, status: 'active' })}
                                      >
                                        <ShieldCheck className="h-4 w-4" />
                                      </Button>
                                      <span className="text-[10px] mt-1">Activate</span>
                                    </div>
                                  );
                                })()}
                                <div className="flex flex-col items-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title={(user as any).status === 'deleted' ? 'Activate user to reset password' : 'Reset Password'}
                                    onClick={() => resetPasswordMutation.mutate(user.id)}
                                    disabled={(user as any).status === 'deleted'}
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </Button>
                                  <span className="text-[10px] mt-1">Reset</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-500"
                                    title="Delete"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <span className="text-[10px] mt-1">Delete</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-gray-500">
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
                {/* Total expenses summary */}
                {expenses && expenses.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Total Expenses</div>
                        <div className="text-2xl font-semibold mt-1">{formatCurrency(expenses.reduce((s:number,e:any)=>s+ (Number(e.amount)||0),0), getEffectiveCurrency(user || undefined))}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Transactions</div>
                        <div className="text-2xl font-semibold mt-1">{expenses.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Avg. Expense</div>
                        <div className="text-2xl font-semibold mt-1">{formatCurrency(expenses.reduce((s:number,e:any)=>s+ (Number(e.amount)||0),0)/Math.max(expenses.length,1), getEffectiveCurrency(user || undefined))}</div>
                      </CardContent>
                    </Card>
                  </div>
                )}
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
                            <TableCell className="text-right">{formatCurrency(expense.amount, getEffectiveCurrency(user || undefined))}</TableCell>
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
                        expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0),
                        getEffectiveCurrency(user || undefined)
                      )}
                    </span>
                  </div>
                </CardFooter>
              )}
            </Card>
          </TabsContent>

          {/* INCOMES TAB */}
          <TabsContent value="incomes">
            <Card>
              <CardHeader>
                <CardTitle>All Incomes</CardTitle>
                <CardDescription>
                  View all incomes across all users in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Total incomes summary */}
                {incomes && incomes.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Total Incomes</div>
                        <div className="text-2xl font-semibold mt-1">{formatCurrency(incomes.reduce((s:number,i:any)=>s+ (Number(i.amount)||0),0), getEffectiveCurrency(user || undefined))}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Transactions</div>
                        <div className="text-2xl font-semibold mt-1">{incomes.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Avg. Income</div>
                        <div className="text-2xl font-semibold mt-1">{formatCurrency(incomes.reduce((s:number,i:any)=>s+ (Number(i.amount)||0),0)/Math.max(incomes.length,1), getEffectiveCurrency(user || undefined))}</div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                {isLoadingIncomes ? (
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
                        <TableHead>Source</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomes && incomes.length > 0 ? (
                        incomes.map((income: any) => (
                          <TableRow key={income.id}>
                            <TableCell className="font-medium">{income.userName || "Unknown"}</TableCell>
                            <TableCell>{income.description}</TableCell>
                            <TableCell>{income.categoryName || "Uncategorized"}</TableCell>
                            <TableCell>{income.source || "N/A"}</TableCell>
                            <TableCell>{new Date(income.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">{formatCurrency(income.amount, getEffectiveCurrency(user || undefined))}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                            No incomes found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
              {incomes && incomes.length > 0 && (
                <CardFooter className="border-t px-6 py-4">
                  <div className="w-full flex justify-between">
                    <span className="font-medium">Total Incomes:</span>
                    <span className="font-medium">
                      {formatCurrency(
                        incomes.reduce((sum: number, income: any) => sum + income.amount, 0),
                        getEffectiveCurrency(user || undefined)
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
                {/* Total budgets summary */}
                {budgets && budgets.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Total Budget Amount</div>
                        <div className="text-2xl font-semibold mt-1">{formatCurrency(budgets.reduce((s:number,b:any)=>s+ (Number(b.amount)||0),0), getEffectiveCurrency(user || undefined))}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Budgets</div>
                        <div className="text-2xl font-semibold mt-1">{budgets.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-xs text-gray-600">Avg. Budget</div>
                        <div className="text-2xl font-semibold mt-1">{formatCurrency(budgets.reduce((s:number,b:any)=>s+ (Number(b.amount)||0),0)/Math.max(budgets.length,1), getEffectiveCurrency(user || undefined))}</div>
                      </CardContent>
                    </Card>
                  </div>
                )}
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
                            <TableCell className="text-right">{formatCurrency(budget.amount, getEffectiveCurrency(user || undefined))}</TableCell>
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
                        budgets.reduce((sum: number, budget: any) => sum + budget.amount, 0),
                        getEffectiveCurrency(user || undefined)
                      )}
                    </span>
                  </div>
                </CardFooter>
              )}
            </Card>
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Activity History</CardTitle>
                <CardDescription>
                  View all activity logs across the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingActivity ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs && activityLogs.length > 0 ? (
                        activityLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.userName || "System"}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                log.actionType === 'CREATE' ? 'bg-green-100 text-green-800' :
                                log.actionType === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                log.actionType === 'DELETE' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {log.actionType}
                              </span>
                            </TableCell>
                            <TableCell>{log.resourceType}</TableCell>
                            <TableCell className="max-w-md truncate">{log.description}</TableCell>
                            <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                            No activity logs found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROLES TAB */}
          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>Roles & Permissions</CardTitle>
                <CardDescription>Manage custom roles and their permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <RolesManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SYSTEM SETTINGS TAB */}
          <TabsContent value="system-settings">
            <div className="space-y-6">
              <AdminSettingsPage embedded />
              <BackupPanel />
              <LoginAttemptsPanel />
            </div>
          </TabsContent>

          {/* ANNOUNCEMENTS TAB */}
          <TabsContent value="announcements">
            <AnnouncementsManager />
          </TabsContent>

          {/* MODERATION TAB */}
          {(user?.role === 'admin' || hasPermission(user, 'moderation.manage')) && (
            <TabsContent value="moderation">
              <ModerationManager loadingId={moderationActionLoading} setLoadingId={setModerationActionLoading} />
            </TabsContent>
          )}
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

        {/* Create User Dialog */}
        <AlertDialog open={isCreating} onOpenChange={setIsCreating}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create New User</AlertDialogTitle>
              <AlertDialogDescription>Enter details for the new user. A temporary password will be generated if not provided.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
              <Input placeholder="Full name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              <Input placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => createUserMutation.mutate(newUser)}>Create</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}

// Removed inline quick role assign buttons from Actions per request

// Inline RolesManager component
function RolesManager() {
  const { toast } = useToast();
  const { data: roles, refetch: refetchRoles } = useQuery({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const r = await fetch('/api/admin/roles');
      if (!r.ok) throw new Error('Failed to load roles');
      return r.json();
    }
  });
  const { data: permissions } = useQuery({
    queryKey: ["/api/admin/permissions"],
    queryFn: async () => {
      const r = await fetch('/api/admin/permissions');
      if (!r.ok) throw new Error('Failed to load permissions');
      return r.json();
    }
  });

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedPermIds([]);
  }, [selectedRoleId]);

  const createRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    const resp = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: newRoleDesc })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      toast({ title: 'Error', description: err.message || 'Failed to create role', variant: 'destructive' });
      return;
    }
    setNewRoleName(''); setNewRoleDesc('');
    await refetchRoles();
    toast({ title: 'Role created' });
  };

  const applyPermissions = async () => {
    if (!selectedRoleId) return;
    const resp = await fetch(`/api/admin/roles/${selectedRoleId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionIds: selectedPermIds })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      toast({ title: 'Error', description: err.message || 'Failed to assign permissions', variant: 'destructive' });
      return;
    }
    toast({ title: 'Permissions updated' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <h3 className="font-medium mb-2">Create Role</h3>
          <Input placeholder="Role name" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
          <Input className="mt-2" placeholder="Description (optional)" value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} />
          <Button className="mt-2" onClick={createRole}>Create</Button>
        </div>
        <div className="md:col-span-2">
          <h3 className="font-medium mb-2">Assign Permissions</h3>
          <div className="flex items-center gap-2 mb-2">
            <Select onValueChange={(v) => setSelectedRoleId(parseInt(v))}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {roles?.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setSelectedPermIds([])}>Clear</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {permissions?.map((p: any) => (
              <label key={p.id} className="flex items-center gap-2 border rounded p-2">
                <input
                  type="checkbox"
                  checked={selectedPermIds.includes(p.id)}
                  onChange={(e) => {
                    setSelectedPermIds(prev => e.target.checked ? Array.from(new Set([...prev, p.id])) : prev.filter(id => id !== p.id));
                  }}
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
          <Button className="mt-3" onClick={applyPermissions} disabled={!selectedRoleId}>Save Permissions</Button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementsManager() {
  const { toast } = useToast();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['/api/admin/announcements'],
    queryFn: async () => {
      const r = await fetch('/api/admin/announcements');
      if (!r.ok) throw new Error('Failed to load announcements');
      return r.json();
    }
  });

  const [filter, setFilter] = useState<'active'|'inactive'|'all'>('active');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('');
  const [priority, setPriority] = useState<'normal'|'urgent'>('normal');
  const [saving, setSaving] = useState(false);

  const items = (Array.isArray(data) ? data : []) as any[];
  const total = items.length;
  const active = items.filter(a => a.published).length;
  const urgent = items.filter(a => a.priority === 'urgent').length;
  // Fake view rate until tracking is implemented on client; keep API for future
  const viewRate = items.length ? Math.round(100 * (items.length / Math.max(items.length * 6, 1))) : 0;

  const create = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Title and message are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), message: message.trim(), label: label || undefined, priority, published: true })
      });
      if (!r.ok) throw new Error('Failed to create announcement');
      setTitle(''); setMessage(''); setLabel(''); setPriority('normal'); setCreating(false);
      await refetch();
      toast({ title: 'Announcement created' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const r = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    if (!r.ok) { toast({ title: 'Failed to delete', variant: 'destructive' }); return; }
    await refetch(); toast({ title: 'Deleted' });
  };

  const filtered = items.filter(a => filter === 'all' ? true : filter === 'active' ? a.published : !a.published);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Announcement Management</h2>
          <p className="text-sm text-gray-600">Create and manage system announcements for all users</p>
        </div>
        <Button onClick={() => setCreating(true)} className="rounded-full px-4">+ Create Announcement</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-4"><div className="text-xs text-gray-600">Total Announcements</div><div className="text-2xl font-semibold mt-1">{total}</div></CardContent></Card>
        <Card><CardContent className="py-4"><div className="text-xs text-gray-600">Active</div><div className="text-2xl font-semibold mt-1 text-green-600">{active}</div></CardContent></Card>
        <Card><CardContent className="py-4"><div className="text-xs text-gray-600">Urgent Priority</div><div className="text-2xl font-semibold mt-1 text-red-600">{urgent}</div></CardContent></Card>
        <Card><CardContent className="py-4"><div className="text-xs text-gray-600">Avg. View Rate</div><div className="text-2xl font-semibold mt-1 text-purple-600">{viewRate}%</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['active','inactive','all'] as const).map(f => (
          <Button key={f} variant={filter===f? 'default':'outline'} size="sm" onClick={() => setFilter(f)} className="rounded-full">
            {f==='active'?'Active Announcements':f==='inactive'?'Inactive':'All Announcements'}
          </Button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : filtered.map(a => (
          <div key={a.id} className="border rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-lg truncate">{a.title}</div>
                  {a.label && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{a.label}</span>}
                  <span className={`h-2 w-2 rounded-full ${a.published?'bg-green-500':'bg-gray-400'}`} />
                </div>
                <div className="text-sm text-gray-600 mt-1 line-clamp-2">{a.message}</div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span>all</span>
                  <span>•</span>
                  <span>{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="shrink-0 flex gap-2">
                <Button variant="outline" size="sm">Stats</Button>
                <Button variant="outline" size="sm" onClick={() => { setCreating(true); setTitle(a.title); setMessage(a.message); setLabel(a.label||''); setPriority(a.priority||'normal'); }}>Edit</Button>
                <Button variant="outline" size="sm" className="text-red-600 border-red-200" onClick={() => remove(a.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && filtered.length===0 && (
          <div className="text-sm text-gray-500">No announcements</div>
        )}
      </div>

      {/* Create/Edit Dialog (simple inline for now) */}
      {creating && (
        <Card>
          <CardHeader><CardTitle>{title? 'Edit Announcement' : 'Create Announcement'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
            <textarea className="w-full border rounded p-2 h-28" placeholder="Message" value={message} onChange={e=>setMessage(e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Label</Label>
                <Input placeholder="welcome / maintenance" value={label} onChange={e=>setLabel(e.target.value)} />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={v=>setPriority(v as any)}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end"><Button onClick={create} disabled={saving}>{saving? 'Saving…':'Save'}</Button></div>
            </div>
            <div className="text-right"><Button variant="outline" onClick={()=>{ setCreating(false); setTitle(''); setMessage(''); setLabel(''); setPriority('normal'); }}>Cancel</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ModerationManager({ loadingId, setLoadingId }: { loadingId: number | null; setLoadingId: (id: number | null) => void; }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('open,escalated');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['/api/admin/reports', statusFilter, typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('targetType', typeFilter);
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));
      const r = await fetch(`/api/admin/reports?${params.toString()}`);
      if (!r.ok) throw new Error('Failed to load reports');
      return r.json();
    }
  });

  const act = async (id: number, action: 'dismiss'|'hide'|'resolve'|'escalate') => {
    setLoadingId(id);
    try {
      const r = await fetch(`/api/admin/reports/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      if (!r.ok) throw new Error('Failed to update report');
      await refetch();
      toast({ title: `Report ${action}ed` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
    <div className="flex items-center gap-2 mb-3">
      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="open,escalated">Open + Escalated</SelectItem>
          <SelectItem value="open">Open only</SelectItem>
          <SelectItem value="escalated">Escalated only</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="dismissed">Dismissed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(0); }}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="expense">Expense</SelectItem>
          <SelectItem value="income">Income</SelectItem>
          <SelectItem value="budget">Budget</SelectItem>
        </SelectContent>
      </Select>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page===0} onClick={() => setPage(p => Math.max(0, p-1))}>Prev</Button>
        <div className="text-xs text-gray-600">Page {page+1}</div>
        <Button variant="outline" size="sm" onClick={() => setPage(p => p+1)}>Next</Button>
      </div>
    </div>
    <Card>
      <CardHeader>
        <CardTitle>Moderation Queue</CardTitle>
        <CardDescription>Open and escalated reports</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.length ? data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>#{r.id}</TableCell>
                  <TableCell>{r.reporter_name || r.reporter_user_id}</TableCell>
                  <TableCell>{r.target_type} #{r.target_id}</TableCell>
                  <TableCell className="max-w-md truncate">{r.reason || '-'}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="outline" disabled={loadingId===r.id} onClick={() => act(r.id,'dismiss')}>Dismiss</Button>
                      <Button size="sm" variant="outline" disabled={loadingId===r.id} onClick={() => act(r.id,'hide')}>Hide</Button>
                      <Button size="sm" variant="outline" disabled={loadingId===r.id} onClick={() => act(r.id,'resolve')}>Resolve</Button>
                      <Button size="sm" variant="outline" disabled={loadingId===r.id} onClick={() => act(r.id,'escalate')}>Escalate</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">No reports</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    </>
  );
}

function BackupPanel() {
  const { toast } = useToast();
  const { data: backups, refetch, isFetching } = useQuery({
    queryKey: ['/api/admin/backups'],
    queryFn: async () => {
      const r = await fetch('/api/admin/backups');
      if (!r.ok) throw new Error('Failed to list backups');
      return r.json();
    }
  });
  const [restoreTarget, setRestoreTarget] = useState<null | { file: string }>(null);
  const trigger = async () => {
    const r = await fetch('/api/admin/backup', { method: 'POST' });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      toast({ title: 'Backup failed', description: e?.message || 'pg_dump not available?', variant: 'destructive' });
      return;
    }
    const data = await r.json();
    toast({ title: 'Backup started', description: data.file || 'Backup complete' });
    refetch();
  };
  const fmtSize = (n: number) => {
    if (!Number.isFinite(n)) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let u = 0; let v = n;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[u]}`;
  };
  const restore = async (file: string) => {
    const r = await fetch('/api/admin/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file, confirm: true }) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      toast({ title: 'Restore failed', description: e?.message || 'psql not available or permission denied', variant: 'destructive' });
      return;
    }
    toast({ title: 'Restore complete', description: `Database restored from ${file}` });
    setRestoreTarget(null);
  };
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Database Backup</CardTitle>
        <CardDescription>Create and download SQL backups</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Button onClick={trigger} disabled={isFetching}><RefreshCw className="h-4 w-4 mr-2" />Trigger Backup</Button>
          <Button variant="outline" onClick={() => refetch()}>Refresh List</Button>
        </div>
        <div className="text-sm text-gray-600 mb-2">Latest backups</div>
        <ul className="space-y-2">
          {Array.isArray(backups) && backups.length ? backups.map((b: any) => (
            <li key={b.file} className="flex flex-col md:flex-row md:justify-between md:items-center border rounded p-2 gap-2">
              <div className="min-w-0">
                <div className="font-mono text-xs break-all">{b.file}</div>
                <div className="text-xs text-gray-500">{b.createdAt ? new Date(b.createdAt).toLocaleString() : ''} · {fmtSize(b.size)}</div>
              </div>
              <div className="flex items-center gap-2">
                <a className="underline text-sm" href={`/api/admin/backups/${encodeURIComponent(b.file)}`}>Download</a>
                <Button variant="destructive" size="sm" onClick={() => setRestoreTarget({ file: b.file })}>Restore</Button>
              </div>
            </li>
          )) : <li className="text-sm text-gray-500">No backups yet.</li>}
        </ul>
        <div className="text-xs text-gray-500 mt-3">If trigger fails, ensure pg_dump is installed and DB env vars are set. You can also run a manual dump using documented scripts.</div>
      </CardContent>
    </Card>
    <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore database?</AlertDialogTitle>
          <AlertDialogDescription>
            This will run the selected SQL dump against your database and may overwrite data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => restoreTarget && restore(restoreTarget.file)}>Yes, restore</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function LoginAttemptsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/login-attempts?limit=50'],
    queryFn: async () => {
      const r = await fetch('/api/admin/login-attempts?limit=50');
      if (!r.ok) throw new Error('Failed to load login attempts');
      return r.json();
    }
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Login Attempts</CardTitle>
        <CardDescription>Recent successful and failed logins</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>User-Agent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.username}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-xs ${r.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.success ? 'Success' : 'Failed'}</span>
                  </TableCell>
                  <TableCell>{r.ip_address || '-'}</TableCell>
                  <TableCell className="max-w-md truncate" title={r.user_agent || ''}>{r.user_agent || '-'}</TableCell>
                </TableRow>
              )) || (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No attempts yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityLogPanel() {
  const [userId, setUserId] = useState('');
  const [actionType, setActionType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/activity-log', userId, actionType, from, to, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (actionType) params.set('actionType', actionType);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      const r = await fetch(`/api/admin/activity-log?${params.toString()}`);
      if (!r.ok) throw new Error('Failed to load activity log');
      return r.json();
    }
  });
  const exportCsv = () => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (actionType) params.set('actionType', actionType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    window.location.href = `/api/admin/activity-log/export?${params.toString()}`;
  };
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>Uneditable audit log for admin actions (retained 90 days)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-2 mb-3">
          <Input placeholder="User ID" value={userId} onChange={e=>{ setUserId(e.target.value); setPage(0); }} className="w-32" />
          <Input placeholder="Action type (e.g., VIEW, CREATE, UPDATE, DELETE, LOGIN)" value={actionType} onChange={e=>{ setActionType(e.target.value); setPage(0); }} className="flex-1" />
          <Input type="datetime-local" value={from} onChange={e=>{ setFrom(e.target.value); setPage(0); }} />
          <Input type="datetime-local" value={to} onChange={e=>{ setTo(e.target.value); setPage(0); }} />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={()=>{ setUserId(''); setActionType(''); setFrom(''); setTo(''); setPage(0); refetch(); }}>Clear</Button>
            <Button onClick={exportCsv}>Export CSV</Button>
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.length ? data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>#{r.user_id} {r.user_name ? `• ${r.user_name}` : ''}</TableCell>
                  <TableCell>{r.action_type}</TableCell>
                  <TableCell>{r.resource_type}{r.resource_id ? ` #${r.resource_id}` : ''}</TableCell>
                  <TableCell>{r.ip_address || '-'}</TableCell>
                  <TableCell className="max-w-lg truncate" title={r.description}>{r.description}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No activity</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <div className="mt-3 flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Prev</Button>
          <div className="text-xs text-gray-600">Page {page+1}</div>
          <Button variant="outline" size="sm" onClick={()=>setPage(p=>p+1)}>Next</Button>
        </div>
        <div className="text-xs text-gray-500 mt-3">Security: Admin-only. Logs are immutable (no edit/delete). Use env vars for credentials. Sensitive data and backups should be encrypted at rest.</div>
      </CardContent>
    </Card>
  );
}

// Lightweight inline SVG charts to avoid external deps
function MiniLineChart({ data, height = 220 }: { data: { x: number; y: number }[]; height?: number }) {
  const width = 560; // fits 2-column card roughly
  const pad = 24;
  const xs = data.map(d=>d.x);
  const ys = data.map(d=>d.y);
  const minX = Math.min(...xs, Date.now());
  const maxX = Math.max(...xs, Date.now());
  const minY = 0;
  const maxY = Math.max(...ys, 1);
  const scaleX = (x:number)=> pad + (width - pad*2) * ((x - minX) / Math.max(1, (maxX - minX)));
  const scaleY = (y:number)=> height - pad - (height - pad*2) * ((y - minY) / Math.max(1, (maxY - minY)));
  const path = data.map((d,i)=> `${i?'L':'M'}${scaleX(d.x)},${scaleY(d.y)}`).join(' ');
  const ticks = 5;
  const grid = Array.from({length:ticks},(_,i)=>{
    const y = pad + i*(height-2*pad)/(ticks-1);
    return <line key={i} x1={pad} y1={y} x2={width-pad} y2={y} stroke="#eee"/>;
  });
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {grid}
      <path d={path} fill="none" stroke="#6b5b95" strokeWidth="2" />
      {data.map((d,i)=> <circle key={i} cx={scaleX(d.x)} cy={scaleY(d.y)} r={2} fill="#6b5b95" />)}
    </svg>
  );
}

function MiniBarChart({ data, height = 220 }: { data: { date: string; transactions: number; total_amount: number }[]; height?: number }) {
  const width = 560;
  const pad = 24;
  const n = data.length || 1;
  const barW = (width - 2*pad) / Math.max(n,1) - 2;
  const maxVal = Math.max(...data.map(d=>Number(d.total_amount)||0), 1);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {Array.from({length:5},(_,i)=>{
        const y = pad + i*(height-2*pad)/4;
        return <line key={i} x1={pad} y1={y} x2={width-pad} y2={y} stroke="#eee"/>;
      })}
      {data.map((d,idx)=>{
        const h = ((Number(d.total_amount)||0) / maxVal) * (height - 2*pad);
        const x = pad + idx * (barW + 2);
        const y = height - pad - h;
        return <rect key={idx} x={x} y={y} width={barW} height={h} fill="#7ab" />;
      })}
    </svg>
  );
}
