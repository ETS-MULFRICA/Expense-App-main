import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Clock, User, FileText, DollarSign, Settings, BarChart3, Eye, Trash2, AlertTriangle, ExternalLink, RefreshCw, Pause, Play, Search, Filter, X, Calendar } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface ActivityLog {
  id: number;
  userId: number;
  username?: string;
  userName?: string;
  actionType: string;
  resourceType: string;
  resourceId?: number;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  createdAt: string;
}

interface ActivityLogsResponse {
  logs: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  isAdmin: boolean;
  currentUserId: number;
}

export default function HistoryPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // Search and filter states
  const [inputValue, setInputValue] = useState(""); // What user types
  const [searchQuery, setSearchQuery] = useState(""); // What we actually search for
  const [actionType, setActionType] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Reset current page when non-search filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [actionType, resourceType, fromDate, toDate]);

  // Manual search trigger function
  const triggerSearch = useCallback(() => {
    setSearchQuery(inputValue.trim());
    setCurrentPage(1); // Reset to first page when searching
  }, [inputValue]);

  // Handle Enter key press to trigger search
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      triggerSearch();
    }
  }, [triggerSearch]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setInputValue("");
    setSearchQuery("");
    setActionType("");
    setResourceType("");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  }, []);

  // Check if any filters are active - memoized to prevent unnecessary re-renders
  const hasActiveFilters = useMemo(() => {
    return searchQuery.trim() || (actionType && actionType !== 'all') || (resourceType && resourceType !== 'all') || fromDate || toDate;
  }, [searchQuery, actionType, resourceType, fromDate, toDate]);

  // Memoize filter handlers to prevent unnecessary re-renders
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Update input value immediately for instant UI feedback
    setInputValue(value);
  }, []);

  const handleActionTypeChange = useCallback((value: string) => {
    setActionType(value || "");
  }, []);

  const handleResourceTypeChange = useCallback((value: string) => {
    setResourceType(value || "");
  }, []);

  const handleFromDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFromDate(e.target.value);
  }, []);

  const handleToDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setToDate(e.target.value);
  }, []);

  // Helper function to determine the appropriate route for navigation
  const getNavigationRoute = (log: ActivityLog) => {
    const { actionType, resourceType, resourceId, metadata } = log;
    
    switch (resourceType) {
      case 'BUDGET':
        if (actionType === 'VIEW' || actionType === 'UPDATE') {
          // For budget activities, navigate to budgets page with budget ID
          const budgetId = resourceId || metadata?.budgetId || metadata?.budget?.id;
          return budgetId ? `/budgets?budgetId=${budgetId}` : '/budgets';
        }
        return '/budgets';
        
      case 'BUDGET_ALLOCATION':
        // For budget allocation activities, navigate to budgets page with specific budget ID
        const budgetId = metadata?.budgetId || metadata?.budgetName;
        return budgetId ? `/budgets?budgetId=${budgetId}` : '/budgets';
        
      case 'EXPENSE':
        return '/expenses';
        
      case 'INCOME':
        return '/income';
        
      case 'USER':
        if (actionType === 'LOGIN') {
          return '/'; // Dashboard for login activities
        }
        return '/settings';
        
      case 'CATEGORY':
      case 'SETTINGS':
        return '/settings';
        
      case 'REPORT':
        return '/reports';
        
      default:
        return null; // No navigation for unknown types
    }
  };

  // Helper function to check if an activity is clickable
  const isClickable = (log: ActivityLog) => {
    return getNavigationRoute(log) !== null;
  };

  // Handle clicking on an activity item
  const handleActivityClick = (log: ActivityLog) => {
    const route = getNavigationRoute(log);
    if (route) {
      setLocation(route);
    }
  };

  const { data, isLoading, error, isFetching, refetch } = useQuery<ActivityLogsResponse>({
    queryKey: ["/api/activity-logs", user?.id, currentPage, limit, searchQuery, actionType && actionType !== 'all' ? actionType : '', resourceType && resourceType !== 'all' ? resourceType : '', fromDate, toDate], // Include filters in cache key
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      });
      
      // Add search and filter parameters
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (actionType && actionType !== 'all') params.append('actionType', actionType);
      if (resourceType && resourceType !== 'all') params.append('resourceType', resourceType);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      
      const response = await fetch(`/api/activity-logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }
      return response.json();
    },
    enabled: !!user, // Always enabled when user is available
    refetchInterval: false, // Completely disable auto-refresh
    refetchIntervalInBackground: false, // Disable background refresh
    staleTime: 5000, // Keep data fresh for 5 seconds
    gcTime: 15 * 60 * 1000, // Keep data in cache for 15 minutes
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchOnMount: true, // Only fetch once on mount
    refetchOnReconnect: false, // Disable refetch on reconnect
    retry: false, // Disable retries to prevent multiple requests
  });

  // Mutation for deleting individual activity log
  const deleteLogMutation = useMutation({
    mutationFn: async (logId: number) => {
      const response = await fetch(`/api/activity-logs/${logId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete activity log');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-logs", user?.id] });
      toast({
        title: "Success",
        description: "Activity log deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete activity log",
        variant: "destructive",
      });
    },
  });

  // Mutation for clearing all activity logs
  const clearAllLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/activity-logs', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to clear activity history');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-logs", user?.id] });
      toast({
        title: "Success",
        description: `All activity history cleared (${data.deletedCount} entries removed)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear activity history",
        variant: "destructive",
      });
    },
  });

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'CREATE': return 'bg-green-100 text-green-800 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      case 'LOGIN': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'LOGOUT': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'VIEW': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getResourceTypeIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'EXPENSE': return <DollarSign className="h-4 w-4 text-red-600" />;
      case 'INCOME': return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'BUDGET': return <BarChart3 className="h-4 w-4 text-blue-600" />;
      case 'CATEGORY': return <FileText className="h-4 w-4 text-orange-600" />;
      case 'USER': return <User className="h-4 w-4 text-purple-600" />;
      case 'REPORT': return <BarChart3 className="h-4 w-4 text-indigo-600" />;
      case 'SETTINGS': return <Settings className="h-4 w-4 text-gray-600" />;
      default: return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatUserAgent = (userAgent?: string) => {
    if (!userAgent) return 'Unknown device';
    
    // Simple parsing - you could use a library like ua-parser-js for more detailed parsing
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';
    if (userAgent.includes('Edge')) return 'Edge Browser';
    return 'Unknown Browser';
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata) return null;
    
    // Handle different types of metadata
    if (metadata.expense) {
      return (
        <div className="space-y-1">
          <div><span className="font-medium">Amount:</span> {metadata.expense.amount}</div>
          <div><span className="font-medium">Category:</span> {metadata.expense.category}</div>
          <div><span className="font-medium">Description:</span> {metadata.expense.description}</div>
        </div>
      );
    }
    
    if (metadata.income) {
      return (
        <div className="space-y-1">
          <div><span className="font-medium">Amount:</span> {metadata.income.amount}</div>
          <div><span className="font-medium">Category:</span> {metadata.income.category}</div>
          <div><span className="font-medium">Description:</span> {metadata.income.description}</div>
        </div>
      );
    }
    
    if (metadata.budget) {
      return (
        <div className="space-y-1">
          <div><span className="font-medium">Budget Name:</span> {metadata.budget.name}</div>
          <div><span className="font-medium">Total Amount:</span> {metadata.budget.totalAmount}</div>
        </div>
      );
    }
    
    if (metadata.category) {
      return (
        <div className="space-y-1">
          <div><span className="font-medium">Category Name:</span> {metadata.category.name}</div>
          <div><span className="font-medium">Type:</span> {metadata.category.type}</div>
        </div>
      );
    }
    
    // If it's an object but not one of the known types, show key-value pairs
    if (typeof metadata === 'object') {
      return (
        <div className="space-y-1">
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key}>
              <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>{' '}
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback to string representation
    return <div>{String(metadata)}</div>;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Activity History</h1>
          </div>
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading activity history...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Activity History</h1>
          </div>
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <p className="text-red-600 mb-4">Failed to load activity history</p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const { logs = [], pagination, isAdmin = false, currentUserId } = data || { 
    logs: [], 
    pagination: { page: 1, totalPages: 1, totalCount: 0, limit: 20 },
    isAdmin: false,
    currentUserId: 0
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">Activity History</h1>
                {isAdmin && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                    ADMIN VIEW
                  </Badge>
                )}
              </div>
              <p className="text-gray-600">
                {isAdmin ? "Track all actions across all users (Admin View)" : "Track all your actions and changes"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>
                {pagination.totalCount} 
                {hasActiveFilters ? ' filtered' : ' total'} activities
                {hasActiveFilters && logs.length !== pagination.totalCount && (
                  <span className="text-blue-600 ml-1">
                    (showing {logs.length} of {pagination.totalCount})
                  </span>
                )}
              </span>
              {isFetching && (
                <div className="flex items-center gap-1 text-blue-600">
                  <div className="animate-pulse rounded-full h-2 w-2 bg-blue-600"></div>
                  <span className="text-xs">Searching...</span>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {logs.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      Clear All Activity History?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently delete all your activity history ({pagination.totalCount} entries). 
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearAllLogsMutation.mutate()}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={clearAllLogsMutation.isPending}
                    >
                      {clearAllLogsMutation.isPending ? "Clearing..." : "Clear All History"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Search and Filter Section */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Type to search activities, then press Enter or click Search button..."
                    value={inputValue}
                    onChange={handleSearchChange}
                    onKeyPress={handleKeyPress}
                    className="pl-10 pr-20"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  {/* No loading indicator in input since search is manual */}
                </div>
                <Button 
                  onClick={triggerSearch}
                  variant="default"
                  size="sm"
                  disabled={!inputValue.trim() || isFetching}
                  className="flex items-center gap-2 min-w-[80px]"
                >
                  {isFetching ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span className="text-xs">...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
                <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filters
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                          {[
                            actionType && actionType !== 'all' ? actionType : null,
                            resourceType && resourceType !== 'all' ? resourceType : null,
                            fromDate,
                            toDate
                          ].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                      {/* Action Type Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="actionType">Action Type</Label>
                        <Select value={actionType || undefined} onValueChange={handleActionTypeChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="All actions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All actions</SelectItem>
                            <SelectItem value="CREATE">Create</SelectItem>
                            <SelectItem value="UPDATE">Update</SelectItem>
                            <SelectItem value="DELETE">Delete</SelectItem>
                            <SelectItem value="VIEW">View</SelectItem>
                            <SelectItem value="LOGIN">Login</SelectItem>
                            <SelectItem value="LOGOUT">Logout</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Resource Type Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="resourceType">Resource Type</Label>
                        <Select value={resourceType || undefined} onValueChange={handleResourceTypeChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="All resources" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All resources</SelectItem>
                            <SelectItem value="EXPENSE">Expenses</SelectItem>
                            <SelectItem value="INCOME">Income</SelectItem>
                            <SelectItem value="BUDGET">Budgets</SelectItem>
                            <SelectItem value="BUDGET_ALLOCATION">Budget Allocations</SelectItem>
                            <SelectItem value="CATEGORY">Categories</SelectItem>
                            <SelectItem value="USER">User</SelectItem>
                            <SelectItem value="SETTINGS">Settings</SelectItem>
                            <SelectItem value="REPORT">Reports</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* From Date Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="fromDate">From Date</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            id="fromDate"
                            type="date"
                            value={fromDate}
                            onChange={handleFromDateChange}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      {/* To Date Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="toDate">To Date</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            id="toDate"
                            type="date"
                            value={toDate}
                            onChange={handleToDateChange}
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Filter Actions */}
                    {hasActiveFilters && (
                      <div className="flex justify-end mt-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={clearAllFilters}
                          className="flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          Clear All Filters
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
              
              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500">Active filters:</span>
                  {searchQuery.trim() && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Search: "{searchQuery.trim()}"
                      <button 
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {actionType && actionType !== 'all' && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Action: {actionType}
                      <button 
                        onClick={() => setActionType("")}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {resourceType && resourceType !== 'all' && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Resource: {resourceType}
                      <button 
                        onClick={() => setResourceType("")}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {fromDate && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      From: {format(new Date(fromDate), 'MMM dd, yyyy')}
                      <button 
                        onClick={() => setFromDate("")}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {toDate && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      To: {format(new Date(toDate), 'MMM dd, yyyy')}
                      <button 
                        onClick={() => setToDate("")}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activities
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-xs">
                    {autoRefreshEnabled ? 'Auto-updating every 5s' : 'Auto-update paused'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  className="h-6 px-2 text-xs"
                >
                  {autoRefreshEnabled ? (
                    <>
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Click on any budget, expense, or income activity to navigate to the relevant page.
            </p>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                {hasActiveFilters ? (
                  <>
                    <p className="text-gray-500 mb-2">No activities found matching your filters</p>
                    <p className="text-sm text-gray-400 mb-4">Try adjusting your search criteria</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearAllFilters}
                      className="flex items-center gap-2 mx-auto"
                    >
                      <X className="h-4 w-4" />
                      Clear All Filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-gray-500">No activity history found</p>
                    <p className="text-sm text-gray-400">Your actions will appear here</p>
                  </>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {logs.map((log) => {
                    const clickable = isClickable(log);
                    return (
                      <div
                        key={log.id}
                        className={`flex items-start gap-4 p-4 border border-gray-200 rounded-lg transition-colors ${
                          clickable 
                            ? 'hover:bg-blue-50 hover:border-blue-200 cursor-pointer' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => clickable && handleActivityClick(log)}
                      >
                        <div className="flex-shrink-0 mt-1">
                          {getResourceTypeIcon(log.resourceType)}
                        </div>
                        
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge 
                                className={`${getActionTypeColor(log.actionType)} text-xs font-medium`}
                                variant="outline"
                              >
                                {log.actionType}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {log.resourceType}
                              </Badge>
                              {isAdmin && log.username && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                                  <User className="h-3 w-3 mr-1" />
                                  {log.userName || log.username}
                                </Badge>
                              )}
                              <span className="text-sm text-gray-500">
                                {format(new Date(log.createdAt), 'MMM dd, yyyy • HH:mm')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {clickable && (
                                <div className="flex items-center gap-1 text-blue-500">
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="text-xs">Navigate</span>
                                </div>
                              )}
                              {(!isAdmin || (isAdmin && log.userId === currentUserId)) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                                    onClick={(e) => e.stopPropagation()} // Prevent triggering navigation
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="h-5 w-5 text-red-600" />
                                      Delete Activity Entry?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this activity entry: "{log.description}". 
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteLogMutation.mutate(log.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                      disabled={deleteLogMutation.isPending}
                                    >
                                      {deleteLogMutation.isPending ? "Deleting..." : "Delete Entry"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            </div>
                          </div>
                          
                          <p className={`text-gray-900 mb-2 ${clickable ? 'hover:text-blue-700' : ''}`}>
                            {log.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {log.ipAddress && (
                              <span>IP: {log.ipAddress}</span>
                            )}
                            <span>{formatUserAgent(log.userAgent)}</span>
                          </div>
                          
                          {log.metadata && (
                            <details className="mt-2">
                              <summary 
                                className="text-xs text-gray-500 cursor-pointer hover:text-gray-700"
                                onClick={(e) => e.stopPropagation()} // Prevent triggering navigation
                              >
                                View details
                              </summary>
                              <div className="mt-2 text-sm bg-gray-50 p-3 rounded border">
                                {formatMetadata(log.metadata)}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}