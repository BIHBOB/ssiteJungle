import { Link, useLocation } from "wouter";
import { Home, Search, ShoppingCart, User, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function MobileNavbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    { href: "/", icon: Home, label: "Главная" },
    { href: "/catalog", icon: Search, label: "Каталог" },
    { href: "/cart", icon: ShoppingCart, label: "Корзина" },
    { href: user ? "/profile" : "/auth", icon: User, label: user ? "Профиль" : "Войти" }
  ];
  
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-[4.5rem] bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:hidden">
      <div className="grid h-full max-w-lg grid-cols-4 mx-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative inline-flex flex-col items-center justify-center px-1 py-2 group transition-colors",
                "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 after:transition-transform after:duration-200",
                isActive && "text-primary after:scale-x-100",
                !isActive && "text-gray-600 hover:text-primary hover:after:scale-x-100",
                "flex flex-col items-center justify-center"
              )}
            >
              <Icon 
                className={cn(
                  "w-6 h-6 mb-1 transition-transform duration-200",
                  "group-hover:scale-110 group-active:scale-95"
                )} 
              />
              <span className={cn(
                "text-xs font-medium transition-colors duration-200",
                isActive ? "text-primary" : "text-gray-600 group-hover:text-primary"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default MobileNavbar;