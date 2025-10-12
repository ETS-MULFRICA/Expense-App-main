// Import routing components from wouter (lightweight React router)
import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "./hooks/use-auth";
// Import React Query client for server state management
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
// Import toast notification component
import { Toaster } from "@/components/ui/toaster";
// Import 404 Not Found page
import NotFound from "@/pages/not-found";
// Import authentication context provider
import { AuthProvider } from "./hooks/use-auth";
// Import route protection component
import { ProtectedRoute } from "./lib/protected-route";
// Import all page components
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ExpensesPage from "@/pages/expenses-page";
import IncomePage from "@/pages/income-page";
import ReportsPage from "@/pages/reports-page";
import SettingsPage from "@/pages/settings-page";
import HistoryPage from "@/pages/history-page";
import BudgetsPage from "@/pages/budgets-page";
import AdminPage from "@/pages/admin-page";
import AnnouncementsPage from "@/pages/announcements-page";

// Create a component that redirects admin users to /admin
function HomeRedirect() {
  const { user } = useAuth();
  
  if (user?.role === "admin") {
    return <Redirect to="/admin" />;
  }
  
  return <HomePage />;
}

/**
 * Router Component
 * Defines all the routes in the application and which component to render for each URL
 * - Uses Switch to render only the first matching route
 * - ProtectedRoute ensures user is authenticated before accessing certain pages
 * - /auth is public (login/signup page)
 * - /admin requires "admin" role
 * - All other routes require basic authentication
 */
function Router() {
  return (
    <Switch>
      {/* Dashboard/Home page - requires authentication, redirects admin users to /admin */}
      <ProtectedRoute path="/" component={HomeRedirect} />
      {/* Expense tracking page - requires authentication */}
      <ProtectedRoute path="/expenses" component={ExpensesPage} />
      {/* Income management page - requires authentication */}
      <ProtectedRoute path="/income" component={IncomePage} />
      {/* Budget planning page - requires authentication */}
      <ProtectedRoute path="/budgets" component={BudgetsPage} />
      {/* Reports/analytics page - requires authentication */}
      <ProtectedRoute path="/reports" component={ReportsPage} />
      {/* User settings page - requires authentication */}
      <ProtectedRoute path="/settings" component={SettingsPage} />
  {/* Announcements page - requires authentication */}
  <ProtectedRoute path="/announcements" component={AnnouncementsPage} />
      {/* Expense history page - requires authentication */}
      <ProtectedRoute path="/history" component={HistoryPage} />
  {/* Admin panel - allow admin role OR admin.access permission */}
  <ProtectedRoute path="/admin" component={AdminPage} requiredRole="admin" requiredPermission="admin.access" />
  {/* Admin nested routes fallback */}
  <ProtectedRoute path="/admin/:rest*" component={AdminPage} requiredRole="admin" requiredPermission="admin.access" />
      {/* Public authentication page (login/signup) */}
      <Route path="/auth" component={AuthPage} />
      {/* 404 fallback for unmatched routes */}
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Main App Component
 * Sets up the application with all necessary providers and global components
 * - QueryClientProvider: Enables server state management with React Query
 * - AuthProvider: Provides authentication context throughout the app
 * - Router: Handles all routing logic
 * - Toaster: Displays toast notifications globally
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;