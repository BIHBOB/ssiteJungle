import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/components/admin/AdminDashboard";
import ProductsList from "@/components/admin/ProductsList";
import OrdersList from "@/components/admin/OrdersList";
import UsersList from "@/components/admin/UsersList";
import ReviewsList from "@/components/admin/ReviewsList";
import SettingsPage from "@/components/admin/SettingsPage";
import { PromoCodeManager } from "@/components/admin/PromoCodeManager";

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  
  // Parse URL params to get active tab
  useEffect(() => {
    const searchParams = new URLSearchParams(location.split("?")[1] || "");
    const tab = searchParams.get("tab");
    if (tab && ["dashboard", "products", "orders", "promocodes", "users", "reviews", "settings"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location]);

  // Redirect if not admin
  useEffect(() => {
    if (!isLoading && user && !user.isAdmin) {
      setLocation("/");
      toast({
        title: "Доступ запрещен",
        description: "У вас нет прав администратора",
        variant: "destructive",
      });
    } else if (!isLoading && !user) {
      setLocation("/auth");
      toast({
        title: "Требуется авторизация",
        description: "Пожалуйста, войдите в аккаунт",
        variant: "destructive",
      });
    }
  }, [user, isLoading, setLocation, toast]);

  // Loading state
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;
  }

  // If not admin, return null (useEffect will redirect)
  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "dashboard" && <AdminDashboard />}
      {activeTab === "products" && <ProductsList />}
      {activeTab === "orders" && <OrdersList />}
      {activeTab === "promocodes" && <PromoCodeManager />}
      {activeTab === "users" && <UsersList />}
      {activeTab === "reviews" && <ReviewsList />}
      {activeTab === "settings" && <SettingsPage />}
    </AdminLayout>
  );
}

// Missing admin components that need to be implemented elsewhere

// Компонент SettingsPage импортируется из @/components/admin/SettingsPage
