import { ReactNode } from "react";
import Sidebar from "./sidebar";
import MobileNav from "./mobile-nav";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <MobileNav />
        <main className="flex-1 relative overflow-y-auto focus:outline-none pt-16 lg:pt-0">
          <div className="py-6">
            <div className="responsive-container">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}