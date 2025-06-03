import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import ExternalLink from "@/components/ExternalLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sprout, User, ShoppingCart, Menu, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function Header() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get cart items count
  const { data: cartItems = [] } = useQuery({
    queryKey: ["/api/cart"],
    queryFn: () => {
      // For now, we'll use localStorage
      const storedCart = localStorage.getItem("cart");
      return storedCart ? JSON.parse(storedCart) : [];
    },
  });

  const cartItemsCount = cartItems.length;

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm">
      <nav className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            className="lg:hidden mr-3 text-neutral-dark" 
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <Link href="/" className="font-montserrat font-bold text-xl text-primary flex items-center">
            <Sprout className="mr-2 h-6 w-6" />
            <span>Jungle Plants</span>
          </Link>
        </div>
        
        <div className="hidden lg:flex items-center space-x-6 text-neutral-dark">
          <Link href="/catalog" className={`hover:text-primary transition-colors ${location === "/catalog" ? "text-primary" : ""}`}>
            Каталог
          </Link>
          <Link href="/faq" className={`hover:text-primary transition-colors ${location === "/faq" ? "text-primary" : ""}`}>
            Доставка
          </Link>
          <Link href="/faq" className={`hover:text-primary transition-colors ${location === "/faq" ? "text-primary" : ""}`}>
            Оплата
          </Link>
          <ExternalLink href="https://t.me/junglefeedback" className="hover:text-primary transition-colors">
            Отзывы
          </ExternalLink>
          <Link href="/faq" className={`hover:text-primary transition-colors ${location === "/faq" ? "text-primary" : ""}`}>
            FAQ
          </Link>
        </div>
        
        <div className="flex items-center">
          <Link href="/cart" className="text-neutral-dark hover:text-primary transition-colors relative mr-4">
            <ShoppingCart className="h-6 w-6" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-secondary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartItemsCount}
              </span>
            )}
          </Link>
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-neutral-dark hover:text-primary transition-colors">
                  <User className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">Профиль</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile?tab=orders">Мои заказы</Link>
                </DropdownMenuItem>
                {user.isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">Админ панель</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button variant="ghost" size="icon" className="text-neutral-dark hover:text-primary transition-colors">
                <User className="h-6 w-6" />
              </Button>
            </Link>
          )}
        </div>
      </nav>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="absolute top-0 left-0 w-full bg-white shadow-lg animate-slideDown">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <Link href="/" className="font-montserrat font-bold text-xl text-primary flex items-center" onClick={closeMobileMenu}>
                  <Sprout className="mr-2 h-6 w-6" />
                  <span>Jungle Plants</span>
                </Link>
                <button 
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors" 
                  onClick={closeMobileMenu}
                  aria-label="Закрыть меню"
                >
                  <X className="h-6 w-6 text-gray-600" />
                </button>
              </div>
              
              <nav className="flex flex-col space-y-1">
                <Link 
                  href="/catalog" 
                  onClick={closeMobileMenu} 
                  className={cn(
                    "px-4 py-3 rounded-lg text-base font-medium transition-colors",
                    location === "/catalog" 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  Каталог
                </Link>
                <Link 
                  href="/faq" 
                  onClick={closeMobileMenu} 
                  className={cn(
                    "px-4 py-3 rounded-lg text-base font-medium transition-colors",
                    location === "/faq" 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  Доставка
                </Link>
                <Link 
                  href="/faq" 
                  onClick={closeMobileMenu} 
                  className={cn(
                    "px-4 py-3 rounded-lg text-base font-medium transition-colors",
                    location === "/faq" 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  Оплата
                </Link>
                <ExternalLink 
                  href="https://t.me/junglefeedback" 
                  onClick={closeMobileMenu} 
                  className="px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Отзывы
                </ExternalLink>
                <Link 
                  href="/faq" 
                  onClick={closeMobileMenu} 
                  className={cn(
                    "px-4 py-3 rounded-lg text-base font-medium transition-colors",
                    location === "/faq" 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  FAQ
                </Link>
              </nav>

              <div className="mt-6 pt-6 border-t border-gray-200">
                {user ? (
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        handleLogout();
                        closeMobileMenu();
                      }}
                    >
                      Выйти
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-3">
                    <Link href="/auth" onClick={closeMobileMenu}>
                      <Button className="w-full" size="lg">
                        Войти
                      </Button>
                    </Link>
                    <Link href="/auth?register=true" onClick={closeMobileMenu}>
                      <Button variant="outline" className="w-full" size="lg">
                        Регистрация
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
