import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { insertUserSchema } from "@shared/schema";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("login");

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      name: "",
      email: "",
    },
  });

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    const { confirmPassword, ...registrationData } = data;
    registerMutation.mutate(registrationData);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <div className="flex mb-2 items-center justify-center lg:justify-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 2H8.828a2 2 0 00-1.414.586L6.293 3.707A1 1 0 015.586 4H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              <h1 className="ml-2 text-3xl font-bold gradient-heading">ExpenseTrack</h1>
            </div>
            <p className="text-gray-600 text-lg">Smart expense management made simple.</p>
          </div>

          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Login to your account</CardTitle>
                  <CardDescription>
                    Enter your credentials to access your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter your password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full btn-gradient"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Login
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex flex-col items-center">
                  <div className="text-sm text-gray-500">
                    Don't have an account?{" "}
                    <button 
                      onClick={() => setActiveTab("register")}
                      className="text-black hover:text-gray-700 hover:underline font-medium"
                    >
                      Register
                    </button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create an account</CardTitle>
                  <CardDescription>
                    Enter your details to create a new account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your full name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Enter your email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Choose a username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Create a password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Confirm your password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full btn-gradient"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Register
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex flex-col items-center">
                  <div className="text-sm text-gray-500">
                    Already have an account?{" "}
                    <button 
                      onClick={() => setActiveTab("login")}
                      className="text-black hover:text-gray-700 hover:underline font-medium"
                    >
                      Login
                    </button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <div className="hidden lg:flex flex-1 bg-hero p-12 items-center justify-center">
        <div className="max-w-lg bg-white/90 p-8 rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold gradient-heading mb-4">Track Your Expenses Anywhere</h2>
          <p className="text-lg text-gray-600 mb-6">
            ExpenseTrack makes it easy to monitor your spending habits,
            categorize expenses, and gain insights into your financial health.
            Access your data from any device, anytime.
          </p>
          <ul className="space-y-4">
            <li className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Track expenses across multiple categories</span>
            </li>
            <li className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">View insightful reports and analytics</span>
            </li>
            <li className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Secure cloud-based storage for all your data</span>
            </li>
            <li className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Access from any device with internet connection</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
