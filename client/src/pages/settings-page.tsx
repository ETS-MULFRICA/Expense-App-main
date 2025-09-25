import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import MobileNav from "@/components/layout/mobile-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [currency, setCurrency] = useState(user?.currency || "XAF");
  
  // Currency update mutation
  const updateCurrencyMutation = useMutation({
    mutationFn: async (currency: string) => {
      const res = await apiRequest("PATCH", "/api/user/settings", { currency });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Currency updated",
        description: "Your preferred currency has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update currency",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    updateCurrencyMutation.mutate(value);
  };
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Profile updated",
      description: "Your profile information has been saved.",
    });
  };
  
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Notification preferences saved",
      description: "Your notification settings have been updated.",
    });
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <MobileNav />
        <main className="flex-1 relative overflow-y-auto focus:outline-none pt-16 lg:pt-0">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>
              
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name</Label>
                          <Input 
                            id="fullName" 
                            defaultValue={user?.name} 
                            placeholder="Your full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input 
                            id="email" 
                            type="email" 
                            defaultValue={user?.email} 
                            placeholder="Your email address"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <Input 
                            id="username" 
                            defaultValue={user?.username} 
                            placeholder="Your username"
                            disabled
                          />
                        </div>
                      </div>
                      <Button type="submit" className="btn-gradient">
                        Save Changes
                      </Button>
                    </form>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Currency Settings</CardTitle>
                    <CardDescription>
                      Set your preferred currency for expense tracking
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currency">Preferred Currency</Label>
                        <Select
                          value={currency}
                          onValueChange={handleCurrencyChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="XAF">XAF - CFA Franc (FCFA)</SelectItem>
                            <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                            <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                            <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                            <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                            <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                            <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                            <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
                            <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-gray-500 mt-2">
                          This will update the currency symbol throughout the application.
                        </p>
                      </div>
                      <Button 
                        type="button"
                        className="btn-gradient"
                        disabled={updateCurrencyMutation.isPending}
                        onClick={() => updateCurrencyMutation.mutate(currency)}
                      >
                        {updateCurrencyMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Update Currency
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Settings</CardTitle>
                    <CardDescription>
                      Manage your notification preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveNotifications} className="space-y-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                            <p className="text-sm text-gray-500">Receive emails about your account activity</p>
                          </div>
                          <Switch defaultChecked id="email-notifications" />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Monthly Report</h3>
                            <p className="text-sm text-gray-500">Receive a monthly expense summary</p>
                          </div>
                          <Switch defaultChecked id="monthly-report" />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Budget Alerts</h3>
                            <p className="text-sm text-gray-500">Get notified when you're close to budget limits</p>
                          </div>
                          <Switch id="budget-alerts" />
                        </div>
                      </div>
                      <Button type="submit" className="btn-gradient">
                        Save Preferences
                      </Button>
                    </form>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Account Actions</CardTitle>
                    <CardDescription>
                      Actions related to your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button 
                        variant="destructive" 
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                      >
                        {logoutMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Logout
                      </Button>
                      <p className="text-sm text-gray-500">
                        This will sign you out of your account on this device.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
