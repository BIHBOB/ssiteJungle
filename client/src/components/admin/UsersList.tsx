import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Edit, CreditCard, User as UserIcon, FileDown } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';

function s2ab(s: string) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
  return buf;
}

export default function UsersList() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editAdminStatus, setEditAdminStatus] = useState(false);
  
  // Состояние для начисления баланса
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("0");
  
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки пользователей");
      return res.json();
    }
  });
  
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number, userData: Partial<User> }) => {
      await apiRequest("PUT", `/api/users/${data.id}`, data.userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowUserDialog(false);
      setShowBalanceDialog(false);
      toast({
        title: "Пользователь обновлен",
        description: "Данные пользователя успешно обновлены"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка обновления",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditAdminStatus(user.isAdmin || false);
    setShowUserDialog(true);
  };
  
  const handleUpdateUser = () => {
    if (!selectedUser) return;
    
    updateUserMutation.mutate({
      id: selectedUser.id,
      userData: {
        isAdmin: editAdminStatus
      }
    });
  };
  
  const addBalanceMutation = useMutation({
    mutationFn: async (data: { id: number, amount: string }) => {
      await apiRequest("POST", `/api/users/${data.id}/add-balance`, { amount: data.amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowBalanceDialog(false);
      toast({
        title: "Баланс обновлен",
        description: "Баланс пользователя успешно пополнен"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка начисления",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleAddBalance = () => {
    if (!selectedUser) return;
    
    // Конвертируем в число и проверяем валидность
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Некорректная сумма",
        description: "Введите положительную сумму для начисления",
        variant: "destructive"
      });
      return;
    }
    
    // Вызываем специальный API для начисления баланса
    addBalanceMutation.mutate({
      id: selectedUser.id,
      amount: balanceAmount
    });
  };
  
  const handleOpenBalanceDialog = (user: User) => {
    setSelectedUser(user);
    setBalanceAmount("0");
    setShowBalanceDialog(true);
  };
  
  const filteredUsers = users?.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.fullName && user.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  // Функция для экспорта пользователей в Excel
  const exportToExcel = async () => {
    try {
      const data = users.map(user => ({
        ID: user.id,
        'Имя пользователя': user.username,
        'Email': user.email,
        'ФИО': user.fullName,
        'Телефон': user.phone,
        'Адрес': user.address,
        'Тип соцсети': user.socialType || '-',
        'Баланс': user.balance,
        'Дата регистрации': new Date(user.createdAt).toLocaleDateString('ru-RU'),
      }));

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Пользователи');

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
      saveAs(blob, 'users.xlsx');

      toast({
        title: "Экспорт завершен",
        description: "Список пользователей экспортирован в users.xlsx",
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
      <h2 className="text-2xl font-bold mb-6">Управление пользователями</h2>
      
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Поиск пользователей по имени, email или профилю"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              onClick={exportToExcel} 
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isLoading || !users || users.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Экспорт в Excel
            </Button>
          </div>
        </div>
      </Card>
      
      {isLoading ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Загрузка пользователей...</p>
        </div>
      ) : !filteredUsers || filteredUsers.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {searchQuery 
              ? "Нет пользователей, соответствующих поисковому запросу" 
              : "Нет доступных пользователей"
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Баланс</TableHead>
                <TableHead>Дата регистрации</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                      <span className="font-medium">{user.username}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{user.fullName}</div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.isAdmin ? (
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                        Администратор
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                        Пользователь
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.balance ? parseFloat(user.balance).toLocaleString() : "0"} ₽
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt || Date.now()).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-blue-500 hover:text-blue-700"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-green-500 hover:text-green-700"
                        onClick={() => handleOpenBalanceDialog(user)}
                      >
                        <CreditCard className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Диалог редактирования пользователя */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактирование пользователя</DialogTitle>
            <DialogDescription>
              {selectedUser ? `ID: ${selectedUser.id} - ${selectedUser.username}` : ""}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Имя пользователя</p>
                  <p className="text-sm text-gray-500">{selectedUser.username}</p>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="admin-mode"
                    checked={editAdminStatus}
                    onCheckedChange={setEditAdminStatus}
                  />
                  <Label htmlFor="admin-mode">Права администратора</Label>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Администраторы имеют полный доступ к панели управления и всем функциям сайта
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowUserDialog(false)}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Диалог начисления баланса */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Начисление баланса</DialogTitle>
            <DialogDescription>
              {selectedUser ? `Пользователь: ${selectedUser.username} (${selectedUser.email})` : ""}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Текущий баланс</p>
                <p className="text-lg font-bold">
                  {selectedUser.balance ? parseFloat(selectedUser.balance).toLocaleString() : "0"} ₽
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="balance-amount">Сумма для начисления (₽)</Label>
                <Input
                  id="balance-amount"
                  type="number"
                  min="0"
                  step="100"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="Введите сумму"
                />
                <p className="text-xs text-gray-500">
                  Введите положительную сумму для начисления на баланс пользователя
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowBalanceDialog(false)}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleAddBalance}
              disabled={addBalanceMutation.isPending}
            >
              {addBalanceMutation.isPending ? "Начисление..." : "Начислить на баланс"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}