import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Order } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, FileText, Eye, Image, Download, FileDown, Trash, Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Receipt as ReceiptIcon, Download as DownloadIcon, Loader2 } from "lucide-react";
import { normalizeImageUrl } from "@/lib/utils";
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';

function s2ab(s: string) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
  return buf;
}

const ORDER_STATUSES = [
  { value: "pending", label: "В ожидании", color: "bg-amber-100 text-amber-800" },
  { value: "pending_payment", label: "Ожидает оплаты", color: "bg-blue-100 text-blue-800" },
  { value: "paid", label: "Оплачен", color: "bg-green-100 text-green-800" },
  { value: "processing", label: "В обработке", color: "bg-indigo-100 text-indigo-800" },
  { value: "shipped", label: "Отправлен", color: "bg-purple-100 text-purple-800" },
  { value: "delivered", label: "Доставлен", color: "bg-gray-100 text-gray-800" },
  { value: "cancelled", label: "Отменен", color: "bg-red-100 text-red-800" },
];

// Обновляем тип Order с новыми полями
type OrderWithTypedFields = {
  id: number;
  userId: number;
  items: Array<{
    id: number;
    quantity: number;
    price: number;
    productName: string;
    productImage: string;
    totalPrice: number;
  }>;
  totalAmount: string;
  deliveryAmount: string;
  promoCode: string | null;
  promoCodeDiscount: number | null;
  fullName: string;
  phone: string;
  address: string;
  socialNetwork: string | null;
  socialUsername: string | null;
  deliveryType: string;
  deliverySpeed: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  needStorage: boolean;
  needInsulation: boolean;
  paymentProofUrl: string | null;
  adminComment: string | null;
  trackingNumber: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  lastStatusChangeAt: string | null;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    comment?: string;
  }>;
  productQuantitiesReduced: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export default function OrdersList() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithTypedFields | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  
  const { data: orders = [], isLoading, refetch } = useQuery<OrderWithTypedFields[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки заказов");
      return res.json();
    }
  });
  
  const { data: users = [] } = useQuery<{ id: string; email: string; }[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/users", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch (error) {
        console.error("Ошибка загрузки пользователей:", error);
        return [];
      }
    },
    enabled: true
  });
  
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number, status: string }) => {
      console.log(`Обновление статуса заказа #${orderId} на ${status}`);
      const response = await apiRequest("PUT", `/api/orders/${orderId}/status`, { 
        orderStatus: status 
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при обновлении статуса");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("Статус заказа успешно обновлен:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      refetch(); // Явно вызываем обновление данных
      toast({
        title: "Статус обновлен",
        description: "Статус заказа успешно обновлен",
        variant: "success"
      });
    },
    onError: (error: Error) => {
      console.error("Ошибка обновления статуса:", error);
      toast({
        title: "Ошибка обновления",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const updateOrderCommentMutation = useMutation({
    mutationFn: async ({ orderId, comment }: { orderId: number, comment: string }) => {
      await apiRequest("PUT", `/api/orders/${orderId}`, { adminComment: comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      refetch(); // Явно вызываем обновление данных
      toast({
        title: "Комментарий сохранен",
        description: "Комментарий к заказу успешно сохранен",
        variant: "success"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка сохранения",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest("DELETE", `/api/orders/${orderId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Ошибка при удалении заказа");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      refetch(); // Явно вызываем обновление данных
      toast({
        title: "Заказ удален",
        description: data.message || "Заказ успешно удален из системы",
        variant: "success"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка удаления",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleStatusChange = (orderId: number, status: string) => {
    if (confirm(`Вы уверены, что хотите изменить статус заказа на "${ORDER_STATUSES.find(s => s.value === status)?.label || status}"?`)) {
    updateOrderStatusMutation.mutate({ orderId, status });
    }
  };
  
  const handleViewOrder = (order: OrderWithTypedFields) => {
    // Убедимся, что items - это массив
    const processedOrder = {
      ...order,
      items: order.items && typeof order.items === 'string' 
        ? JSON.parse(order.items) 
        : Array.isArray(order.items) ? order.items : []
    };
    setSelectedOrder(processedOrder);
    setAdminComment(processedOrder.adminComment || "");
    setShowOrderDetails(true);
  };
  
  const handleSaveComment = () => {
    if (selectedOrder) {
      updateOrderCommentMutation.mutate({
        orderId: selectedOrder.id,
        comment: adminComment
      });
      setShowOrderDetails(false);
    }
  };

  const handleDeleteOrder = (orderId: number) => {
    if (confirm("Вы уверены, что хотите удалить этот заказ? Это действие нельзя отменить.")) {
      deleteOrderMutation.mutate(orderId);
    }
  };
  
  const getStatusBadge = (status: string) => {
    const statusInfo = ORDER_STATUSES.find(s => s.value === status);
    return (
      <Badge className={statusInfo?.color || "bg-gray-100 text-gray-800"}>
        {statusInfo?.label || status}
      </Badge>
    );
  };
  
  const filteredOrders = orders?.filter(order => {
    // Фильтр по статусу
    if (statusFilter && order.orderStatus !== statusFilter) {
      return false;
    }
    
    // Поиск по ID, имени, телефону или адресу
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.id.toString().includes(query) ||
        order.fullName.toLowerCase().includes(query) ||
        order.phone.toLowerCase().includes(query) ||
        order.address.toLowerCase().includes(query)
      );
    }
    
    return true;
  });
  
  // Форматирование суммы
  const formatPrice = (price: number | string | null | undefined): string => {
    if (!price) return "0";
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return numPrice.toLocaleString("ru-RU");
  };
  
  // Функция для экспорта заказов в Excel
  const exportToExcel = async () => {
    try {
      const data = orders.map(order => ({
        ID: order.id,
        'ФИО': order.fullName,
        'Телефон': order.phone,
        'Адрес': order.address,
        'Соцсеть': order.socialNetwork || '-',
        'Имя пользователя': order.socialUsername || '-',
        'Способ доставки': order.deliveryType === 'cdek' ? 'CDEK' : 'Почта России',
        'Скорость доставки': order.deliverySpeed === 'standard' ? 'Стандартная' : 'Экспресс',
        'Способ оплаты': order.paymentMethod === 'yoomoney' ? 'YooMoney' : 
                        order.paymentMethod === 'directTransfer' ? 'Прямой перевод' : 'Баланс',
        'Статус оплаты': order.paymentStatus,
        'Статус заказа': order.orderStatus,
        'Сумма заказа': order.totalAmount,
        'Стоимость доставки': order.deliveryAmount,
        'Дата создания': new Date(order.createdAt).toLocaleDateString('ru-RU'),
        'Трек-номер': order.trackingNumber || '-',
      }));

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Заказы');

      // Добавляем заголовки
      worksheet.columns = Object.keys(data[0]).map(key => ({
        header: key,
        key: key,
        width: 20
      }));

      // Добавляем данные
      worksheet.addRows(data);

      // Стилизация заголовков
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Генерируем файл
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Создаем blob и скачиваем файл
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      saveAs(blob, 'orders.xlsx');

      toast({
        title: "Экспорт завершен",
        description: "Список заказов экспортирован в orders.xlsx",
      });
    } catch (error) {
      console.error('Ошибка при экспорте:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось экспортировать данные",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Управление заказами</h2>
      
      <Card className="mb-6">
        <div className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Поиск заказов по ID, имени, телефону или адресу"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select 
            value={statusFilter === null ? "all" : statusFilter} 
            onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {ORDER_STATUSES.map(status => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={exportToExcel} 
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={isLoading || !orders || orders.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Экспорт в Excel
          </Button>
        </div>
      </Card>
      
      {isLoading ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Загрузка заказов...</p>
        </div>
      ) : !filteredOrders || filteredOrders.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {searchQuery || statusFilter
              ? "Нет заказов, соответствующих фильтрам"
              : "Нет доступных заказов"
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Доставка</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.id}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.fullName}</div>
                      <div className="text-sm text-gray-500">{order.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {parseFloat(order.totalAmount).toLocaleString()} ₽
                  </TableCell>
                  <TableCell>
                    <div>
                      <div>{order.deliveryType === "cdek" ? "СДЭК" : "Почта России"}</div>
                      <div className="text-sm text-gray-500">
                        {order.deliverySpeed === "express" ? "Экспресс" : "Стандарт"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.orderStatus}
                      onValueChange={(value) => handleStatusChange(order.id, value)}
                      disabled={updateOrderStatusMutation.isPending}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue>{getStatusBadge(order.orderStatus)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map(status => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {new Date(order.createdAt || Date.now()).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleViewOrder(order)}
                        title="Просмотреть детали"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteOrder(order.id)}
                        title="Удалить заказ"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      {showOrderDetails && selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder}
          onClose={() => setShowOrderDetails(false)}
          onUpdate={(variables) => updateOrderStatusMutation.mutate(variables)}
          getStatusBadge={getStatusBadge}
        />
      )}
    </div>
  );
}

// Обновляем компонент отображения деталей заказа
const OrderDetailsDialog = ({ 
  order, 
  onClose, 
  onUpdate,
  getStatusBadge 
}: { 
  order: OrderWithTypedFields; 
  onClose: () => void;
  onUpdate: (variables: { orderId: number; status: string }) => void;
  getStatusBadge: (status: string) => JSX.Element;
}) => {
  const { toast } = useToast();
  const [localOrder, setLocalOrder] = useState<OrderWithTypedFields>(order);
  const [newStatus, setNewStatus] = useState(order.orderStatus);
  const [comment, setComment] = useState(order.adminComment || '');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(order.estimatedDeliveryDate || '');
  const queryClient = useQueryClient();

  // Используем getStatusBadge из пропсов
  const statusBadge = getStatusBadge(localOrder.orderStatus);

  const updateOrderDetailsMutation = useMutation({
    mutationFn: async (variables: {
      orderId: number;
      status: string;
      adminComment?: string;
      trackingNumber?: string;
      estimatedDeliveryDate?: string;
    }) => {
      const response = await fetch(`/api/orders/${variables.orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderStatus: variables.status,
          adminComment: variables.adminComment,
          trackingNumber: variables.trackingNumber,
          estimatedDeliveryDate: variables.estimatedDeliveryDate
        })
      });
      if (!response.ok) throw new Error('Не удалось обновить заказ');
      return response.json();
    },
    onSuccess: (data) => {
      // Обновляем локальное состояние
      setLocalOrder(prev => ({
        ...prev,
        orderStatus: data.order.orderStatus,
        adminComment: data.order.comment,
        trackingNumber: data.order.trackingNumber,
        estimatedDeliveryDate: data.order.estimatedDeliveryDate,
        lastStatusChangeAt: data.order.lastStatusChangeAt,
        statusHistory: data.order.statusHistory
      }));
      
      // Обновляем кэш запросов
      queryClient.setQueryData(['orders'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((o: OrderWithTypedFields) => 
          o.id === data.order.id ? { 
            ...o, 
            ...data.order,
            adminComment: data.order.comment
          } : o
        );
      });

      toast({
        title: "Успех",
        description: "Заказ успешно обновлен",
        variant: "success"
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Ошибка при обновлении заказа",
        variant: "destructive"
      });
      console.error('Ошибка обновления заказа:', error);
    }
  });

  const handleSaveChanges = async () => {
    try {
      await updateOrderDetailsMutation.mutateAsync({
        orderId: order.id,
        status: newStatus,
        adminComment: comment,
        trackingNumber,
        estimatedDeliveryDate
      });
    } catch (error) {
      console.error('Ошибка при сохранении изменений:', error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Заказ #{order.id}</DialogTitle>
          <DialogDescription>
            Статус: {ORDER_STATUSES.find(s => s.value === order.orderStatus)?.label || order.orderStatus}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Детали</TabsTrigger>
            <TabsTrigger value="items">Товары</TabsTrigger>
            <TabsTrigger value="status">Статус</TabsTrigger>
            <TabsTrigger value="payment">Оплата</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Информация о клиенте</h3>
                <p>Имя: {order.fullName}</p>
                <p>Телефон: {order.phone}</p>
                <p>Адрес: {order.address}</p>
                {order.socialNetwork && (
                  <p>Соц. сеть: {order.socialNetwork} ({order.socialUsername})</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Информация о доставке</h3>
                <p>Тип доставки: {order.deliveryType}</p>
                <p>Скорость доставки: {order.deliverySpeed}</p>
                <p>Стоимость доставки: {order.deliveryAmount} ₽</p>
                {order.trackingNumber && (
                  <p>Трек-номер: {order.trackingNumber}</p>
                )}
                {order.estimatedDeliveryDate && (
                  <p>Ожидаемая дата доставки: {new Date(order.estimatedDeliveryDate).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="items">
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                  {item.productImage && (
                    <img 
                      src={item.productImage} 
                      alt={item.productName}
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold">{item.productName}</h4>
                    <p>Количество: {item.quantity}</p>
                    <p>Цена: {item.price} ₽</p>
                    <p>Итого: {item.totalPrice} ₽</p>
                  </div>
                </div>
              ))}
              <div className="space-y-2 text-right">
                {order.promoCode && (
                  <div className="text-green-600">
                    Промокод: {order.promoCode}
                    {order.promoCodeDiscount && (
                      <span className="ml-2">
                        (Скидка: -{order.promoCodeDiscount} ₽)
                      </span>
                    )}
                  </div>
                )}
                <div className="font-semibold">
                  Общая сумма: {order.totalAmount} ₽
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">История статусов</h3>
                <div className="space-y-2">
                  {order.statusHistory?.map((status, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <Badge className={ORDER_STATUSES.find(s => s.value === status.status)?.color}>
                        {ORDER_STATUSES.find(s => s.value === status.status)?.label || status.status}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(status.timestamp).toLocaleString()}
                      </span>
                      {status.comment && (
                        <span className="text-sm text-gray-600">- {status.comment}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Новый статус</label>
                  <Select
                    value={newStatus}
                    onValueChange={(value) => setNewStatus(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Комментарий</label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Введите комментарий к изменению статуса"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Трек-номер</label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Введите трек-номер"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ожидаемая дата доставки</label>
                  <Input
                    type="date"
                    value={estimatedDeliveryDate}
                    onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payment">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Статус оплаты</h3>
                <p>Способ оплаты: {
                  {
                    "yoomoney": "Онлайн оплата",
                    "directTransfer": "Прямой перевод",
                    "balance": "Баланс"
                  }[localOrder.paymentMethod] || localOrder.paymentMethod
                }</p>
                <p>Статус: {
                  {
                    "pending": "Ожидает оплаты",
                    "completed": "Оплачен",
                    "failed": "Ошибка оплаты"
                  }[localOrder.paymentStatus] || localOrder.paymentStatus
                }</p>
              </div>

              {localOrder.paymentProofUrl && (
                <div>
                  <h3 className="font-semibold mb-2">Подтверждение оплаты</h3>
                  <div className="relative group">
                    <img 
                      src={normalizeImageUrl(localOrder.paymentProofUrl)} 
                      alt="Подтверждение оплаты" 
                      className="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(normalizeImageUrl(localOrder.paymentProofUrl), '_blank')}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => window.open(normalizeImageUrl(localOrder.paymentProofUrl), '_blank')}
                      >
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Открыть в полном размере
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Нажмите на изображение для просмотра в полном размере
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
          <Button 
            onClick={handleSaveChanges}
          >
            Сохранить изменения
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};