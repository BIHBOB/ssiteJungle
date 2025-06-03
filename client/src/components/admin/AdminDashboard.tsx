import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Users, ShoppingBag, FileText, MessageSquare } from "lucide-react";

export default function AdminDashboard() {
  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Ошибка загрузки товаров");
      return res.json();
    }
  });
  
  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки заказов");
      return res.json();
    }
  });
  
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки пользователей");
      return res.json();
    }
  });
  
  const { data: reviews, isLoading: isLoadingReviews } = useQuery({
    queryKey: ["/api/reviews"],
    queryFn: async () => {
      const res = await fetch("/api/reviews", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки отзывов");
      return res.json();
    }
  });
  
  const isLoading = isLoadingProducts || isLoadingOrders || isLoadingUsers || isLoadingReviews;
  
  // Подготовка данных для графиков
  const ordersByStatus = orders ? [
    { name: "В ожидании", value: orders.filter(o => o.orderStatus === "pending").length },
    { name: "Оплачено", value: orders.filter(o => o.orderStatus === "paid").length },
    { name: "Отправлено", value: orders.filter(o => o.orderStatus === "shipped").length },
    { name: "Доставлено", value: orders.filter(o => o.orderStatus === "delivered").length }
  ] : [];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
  
  // Данные для графика продаж по дням
  const salesData = orders ? Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateString = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    
    const dayOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate.getDate() === date.getDate() && 
             orderDate.getMonth() === date.getMonth() &&
             orderDate.getFullYear() === date.getFullYear();
    });
    
    const totalSales = dayOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
    
    return {
      name: dateString,
      sales: totalSales
    };
  }) : [];
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Панель управления</h2>
      
      {isLoading ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Загрузка данных...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Товары</CardTitle>
                <ShoppingBag className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{products?.length || 0}</div>
                <p className="text-xs text-gray-500">
                  В наличии: {products?.filter(p => p.isAvailable).length || 0}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Заказы</CardTitle>
                <FileText className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orders?.length || 0}</div>
                <p className="text-xs text-gray-500">
                  Ожидают: {orders?.filter(o => o.orderStatus === "pending").length || 0}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Пользователи</CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users?.length || 0}</div>
                <p className="text-xs text-gray-500">
                  Админы: {users?.filter(u => u.isAdmin).length || 0}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Отзывы</CardTitle>
                <MessageSquare className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reviews?.length || 0}</div>
                <p className="text-xs text-gray-500">
                  На модерации: {reviews?.filter(r => !r.isApproved).length || 0}
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Статусы заказов</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ordersByStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {ordersByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Продажи за неделю</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} ₽`, 'Продажи']} />
                      <Line 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#2E7D32" 
                        strokeWidth={2} 
                        activeDot={{ r: 8 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}