import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { cn, hasPermission } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
  TrendingUp,
  Clock,
  Sun,
  Moon,
  Monitor
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [siteName, setSiteName] = useState('ExpenseTrack');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<'system'|'light'|'dark'>(() => {
  try { return (localStorage.getItem('app:theme-mode') as any) || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(s => {
      if (s) {
        if (s.site_name) setSiteName(s.site_name);
        if (s.logo_data_url) setLogoUrl(s.logo_data_url);
      }
    }).catch(() => {});
  }, []);

  const applyTheme = (mode: 'system'|'light'|'dark') => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  };

  useEffect(() => {
    applyTheme(themeMode);
    try { localStorage.setItem('app:theme-mode', themeMode); } catch {}
    let mql: MediaQueryList | null = null;
    const handle = () => applyTheme('system');
    if (themeMode === 'system' && window.matchMedia) {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handle);
      else if (typeof (mql as any).addListener === 'function') (mql as any).addListener(handle);
    }
    return () => {
      if (mql) {
        if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', handle);
        else if (typeof (mql as any).removeListener === 'function') (mql as any).removeListener(handle);
      }
    };
  }, [themeMode]);

  const cycleTheme = () => {
    setThemeMode(prev => prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system');
  };

  // Base navigation items for regular users
  const regularUserNavigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Expenses", href: "/expenses", icon: CreditCard },
    { name: "Income", href: "/income", icon: TrendingUp },
    { name: "Budgets", href: "/budgets", icon: PieChart },
    { name: "Reports", href: "/reports", icon: BarChart2 },
    { name: "History", href: "/history", icon: Clock },
    { name: "Settings", href: "/settings", icon: Settings },
  ];
  
  // Admin-only navigation items (Admin Dashboard at the top)
  const adminNavigation = [
    { name: "Admin Dashboard", href: "/admin", icon: ShieldAlert },
    { name: "Expenses", href: "/expenses", icon: CreditCard },
    { name: "Income", href: "/income", icon: TrendingUp },
    { name: "Budgets", href: "/budgets", icon: PieChart },
    { name: "Reports", href: "/reports", icon: BarChart2 },
    { name: "History", href: "/history", icon: Clock },
    { name: "Settings", href: "/settings", icon: Settings },
  ];
  
  // Fetch unread announcements count
  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ['/api/announcements/unread-count'],
    enabled: !!user,
  });

  // Use admin navigation for admin users, regular navigation for others, and add Announcements link after Settings
  const isAdminish = (user?.role === "admin" || hasPermission(user, 'admin.access'));
  const baseNav = isAdminish ? adminNavigation : regularUserNavigation;
  const announcementsHref = "/announcements";
  const navigation = [
    ...baseNav,
    { name: "Announcements", href: announcementsHref, icon: ShieldAlert },
  ];

  return (
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <div className="flex flex-col h-0 flex-1">
          <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 border-b border-gray-200 dark:border-gray-800">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 2H8.828a2 2 0 00-1.414.586L6.293 3.707A1 1 0 015.586 4H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            )}
            <div className="flex items-center gap-2">
              <h1 className="ml-2 text-xl font-semibold text-gray-800 dark:text-gray-200">{siteName}</h1>
              <button
                onClick={cycleTheme}
                title={`Theme: ${themeMode}`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {themeMode === 'light' ? <Sun className="h-4 w-4" /> : themeMode === 'dark' ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={async () => {
                    if (item.name === 'Announcements') {
                      // Mark announcements as read and refresh unread count badge
                      try {
                        await fetch('/api/announcements/mark-read', { method: 'POST' });
                      } catch {}
                      queryClient.invalidateQueries({ queryKey: ['/api/announcements/unread-count'] });
                    }
                  }}
                  className={cn(
                    location === item.href
                      ? "text-primary bg-primary/5 dark:bg-primary/10"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
                    "flex items-center px-3 py-2 rounded-md font-medium"
                  )}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  <span className="flex-1">{item.name}</span>
                  {item.name === 'Announcements' && (unread?.count ?? 0) > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center text-xs h-5 min-w-5 px-1 rounded-full bg-red-500 text-white">
                      {(unread!.count) > 99 ? '99+' : unread!.count}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="border-t border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  {user?.name.charAt(0)}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  {user?.role === "admin" && (
                    <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => logoutMutation.mutate()}
                className="mt-4 flex items-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 py-2 rounded-md font-medium w-full"
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