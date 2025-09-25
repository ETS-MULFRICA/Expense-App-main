// Import authentication hook and loading spinner
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

/**
 * ProtectedRoute Component
 * Wraps routes that require authentication and optionally specific roles
 * 
 * @param path - The URL path to protect
 * @param component - The React component to render if authorized
 * @param requiredRole - Optional role requirement (e.g., "admin")
 * 
 * Authentication Flow:
 * 1. Shows loading spinner while checking auth status
 * 2. Redirects to /auth if user not logged in
 * 3. Redirects to home if user lacks required role
 * 4. Renders component if all checks pass
 */
export function ProtectedRoute({
  path,
  component: Component,
  requiredRole,
}: {
  path: string;
  component: () => React.JSX.Element;
  requiredRole?: string;
}) {
  const { user, isLoading } = useAuth();

  /**
   * Loading State Handler
   * Shows spinner while authentication status is being determined
   */
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  /**
   * Authentication Check
   * Redirects unauthenticated users to login page
   */
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  /**
   * Role-Based Authorization Check
   * Redirects users without required role to home page
   * Used for admin-only routes
   */
  if (requiredRole && user.role !== requiredRole) {
    return (
      <Route path={path}>
        <Redirect to="/" />
      </Route>
    );
  }

  /**
   * Authorized Access
   * User is authenticated and has required role (if any)
   */
  return <Route path={path} component={Component} />;
}
