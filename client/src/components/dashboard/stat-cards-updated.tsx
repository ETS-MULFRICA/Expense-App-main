import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpDown, DollarSign, PieChart, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency-formatter";

interface StatCardsProps {
  totalExpenses: number;
  percentChange: number;
  highestCategory: string;
  recentEntriesCount: number;
}

export default function StatCards({
  totalExpenses,
  percentChange,
  highestCategory,
  recentEntriesCount
}: StatCardsProps) {
  const { user } = useAuth();
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-all">
        <CardContent className="p-5 card-gradient">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-slate-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-slate-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Expenses (This Month)
                </dt>
                <dd>
                  <div className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalExpenses, user?.currency || 'XAF')}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 px-5 py-3">
          <div className="text-sm">
            <Link href="/expenses" className="font-medium text-slate-600 hover:text-slate-700 flex items-center">
              View all
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </CardFooter>
      </Card>

      <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-all">
        <CardContent className="p-5 card-gradient">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-slate-100 p-3 rounded-full">
              <ArrowUpDown className="h-6 w-6 text-slate-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Compared to Last Month
                </dt>
                <dd>
                  <div className={cn(
                    "text-xl font-bold flex items-center",
                    percentChange < 0 ? "text-gray-700" : percentChange > 0 ? "text-gray-900" : "text-gray-500"
                  )}>
                    {percentChange < 0 ? <TrendingDown className="mr-1 h-5 w-5" /> : 
                     percentChange > 0 ? <TrendingUp className="mr-1 h-5 w-5" /> : null}
                    {Math.abs(percentChange).toFixed(1)}%
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 px-5 py-3">
          <div className="text-sm">
            <Link href="/reports" className="font-medium text-slate-600 hover:text-slate-700 flex items-center">
              View report
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </CardFooter>
      </Card>

      <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-all">
        <CardContent className="p-5 card-gradient">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-slate-100 p-3 rounded-full">
              <PieChart className="h-6 w-6 text-slate-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Highest Category
                </dt>
                <dd>
                  <div className="text-xl font-bold text-gray-900">
                    {highestCategory}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 px-5 py-3">
          <div className="text-sm">
            <Link href="/reports" className="font-medium text-slate-600 hover:text-slate-700 flex items-center">
              View details
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </CardFooter>
      </Card>

      <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-all">
        <CardContent className="p-5 card-gradient">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-slate-100 p-3 rounded-full">
              <Clock className="h-6 w-6 text-slate-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Recent Entries
                </dt>
                <dd>
                  <div className="text-xl font-bold text-gray-900">
                    {recentEntriesCount} expenses
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 px-5 py-3">
          <div className="text-sm">
            <Link href="/expenses" className="font-medium text-slate-600 hover:text-slate-700 flex items-center">
              View all
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}