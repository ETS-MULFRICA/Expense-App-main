import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { 
  Home, 
  DollarSign, 
  BarChart2, 
  Settings, 
  LogOut,
  PieChart,
  ShieldAlert,
  CreditCard,
  TrendingUp
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  // Base navigation items for all users
  const baseNavigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Expenses", href: "/expenses", icon: CreditCard },
    { name: "Income", href: "/income", icon: TrendingUp },
    { name: "Budgets", href: "/budgets", icon: PieChart },
    { name: "Reports", href: "/reports", icon: BarChart2 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];
  
  // Admin-only navigation items
  const adminNavigation = [
    { name: "Admin Dashboard", href: "/admin", icon: ShieldAlert },
  ];
  
  // Combine navigation items based on user role
  const navigation = [
    ...baseNavigation,
    ...(user?.role === "admin" ? adminNavigation : []),
  ];

  return (
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-0 flex-1">
          <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 2H8.828a2 2 0 00-1.414.586L6.293 3.707A1 1 0 015.586 4H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <h1 className="ml-2 text-xl font-semibold text-gray-800">ExpenseTrack</h1>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    location === item.href
                      ? "text-primary bg-primary/5"
                      : "text-gray-600 hover:bg-gray-50",
                    "flex items-center px-3 py-2 rounded-md font-medium"
                  )}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              ))}
            </nav>
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  {user?.name.charAt(0)}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => logoutMutation.mutate()}
                className="mt-4 flex items-center text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-md font-medium w-full"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
