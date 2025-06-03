import { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminLayout({ 
  children, 
  activeTab, 
  onTabChange 
}: AdminLayoutProps) {
  const [, setLocation] = useLocation();
  const { logoutMutation } = useAuth();
  
  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setLocation(`/admin?tab=${tab}`);
  };
  
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation('/');
      }
    });
  };
  
  const navItems = [
    { 
      id: "dashboard", 
      label: "Дашборд", 
      icon: <LayoutDashboard className="w-5 h-5 mr-2" /> 
    },
    { 
      id: "products", 
      label: "Товары", 
      icon: <ShoppingBag className="w-5 h-5 mr-2" /> 
    },
    { 
      id: "orders", 
      label: "Заказы", 
      icon: <FileText className="w-5 h-5 mr-2" /> 
    },
    { 
      id: "promocodes", 
      label: "Промокоды", 
      icon: <Ticket className="w-5 h-5 mr-2" /> 
    },
    { 
      id: "users", 
      label: "Пользователи", 
      icon: <Users className="w-5 h-5 mr-2" /> 
    },
    { 
      id: "reviews", 
      label: "Отзывы", 
      icon: <MessageSquare className="w-5 h-5 mr-2" /> 
    },
    { 
      id: "settings", 
      label: "Настройки", 
      icon: <Settings className="w-5 h-5 mr-2" /> 
    },
  ];
  
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white shadow-md flex flex-col md:flex-shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-primary">Jungle Plants</h1>
          <p className="text-sm text-gray-500">Панель администратора</p>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center px-3 py-2 rounded-md transition-colors ${
                    activeTab === item.id
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-4 border-t mt-auto">
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Выйти
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 w-full">
        <main className="bg-gray-50 min-h-screen p-4">
          {children}
        </main>
      </div>
    </div>
  );
}