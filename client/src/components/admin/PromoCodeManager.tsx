import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiRequest';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { useMutation } from '@tanstack/react-query';

interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number | null;
  start_date: string;
  end_date: string;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PromoCodeFormData {
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  startDate: string;
  endDate: string;
  maxUses?: number;
  isActive: boolean;
}

interface FormData {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  minOrderAmount: string;
  startDate: string;
  endDate: string;
  maxUses: string;
  isActive: boolean;
}

export function PromoCodeManager() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [formData, setFormData] = useState<FormData>({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderAmount: '',
    startDate: '',
    endDate: '',
    maxUses: '',
    isActive: true
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deletePromoCodeMutation = useMutation({
    mutationFn: async (promoCodeId: number) => {
      console.log('Attempting to deactivate promo code with ID:', promoCodeId);
      try {
        // Fetch the existing promo code data first
        console.log('Fetching existing promo code data...');
        const existingPromoCode = await apiRequest<PromoCode>("GET", `/api/promo-codes/${promoCodeId}`);
        console.log('Existing promo code data:', existingPromoCode);
        
        // Преобразуем данные в формат, ожидаемый сервером
        const updatedPromoCode = {
          code: existingPromoCode.code,
          description: existingPromoCode.description || undefined,
          discountType: existingPromoCode.discount_type,
          discountValue: existingPromoCode.discount_value,
          minOrderAmount: existingPromoCode.min_order_amount || undefined,
          startDate: existingPromoCode.start_date,
          endDate: existingPromoCode.end_date,
          maxUses: existingPromoCode.max_uses || undefined,
          isActive: false
        };
        
        console.log('Sending PUT data to deactivate:', updatedPromoCode);

        // Send the updated object to the server
        const result = await apiRequest<PromoCode>("PUT", `/api/promo-codes/${promoCodeId}`, updatedPromoCode);
        return result;
      } catch (error) {
        console.error('Deactivation error:', error);
        toast({
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Не удалось деактивировать промокод",
          variant: "destructive"
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      toast({
        title: "Успех",
        description: "Промокод деактивирован успешно"
      });
      console.log('Deactivation successful, toast shown.');
    },
    onError: (error: unknown) => {
      console.error('Deactivation error:', error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось деактивировать промокод",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const response = await fetch('/api/promo-codes');
      if (!response.ok) throw new Error('Failed to fetch promo codes');
      const data = await response.json();
      setPromoCodes(data);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить промокоды",
        variant: "destructive"
      });
    }
  };

  const exportToExcel = async () => {
    try {
      const data = promoCodes.map(promo => ({
        ID: promo.id,
        'Код': promo.code,
        'Тип скидки': promo.discount_type === 'percentage' ? 'Процент' : 'Фиксированная сумма',
        'Значение скидки': promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${promo.discount_value} ₽`,
        'Минимальная сумма': promo.min_order_amount ? `${promo.min_order_amount} ₽` : '-',
        'Максимальная скидка': promo.max_uses ? `${promo.max_uses} ₽` : '-',
        'Количество использований': promo.max_uses ? `${promo.current_uses} / ${promo.max_uses}` : 'Без ограничений',
        'Использовано раз': promo.current_uses.toString(),
        'Действует до': promo.end_date ? new Date(promo.end_date).toLocaleDateString('ru-RU') : 'Бессрочно',
        'Активен': promo.is_active ? 'Да' : 'Нет',
        'Дата создания': new Date(promo.created_at).toLocaleDateString('ru-RU'),
      }));

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Промокоды');

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
      saveAs(blob, 'promocodes.xlsx');

      toast({
        title: "Экспорт завершен",
        description: "Список промокодов экспортирован в promocodes.xlsx",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Преобразуем даты в формат ISO с временем
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      // Устанавливаем время на начало и конец дня соответственно
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const formDataToSubmit: PromoCodeFormData = {
        code: formData.code,
        description: formData.description || undefined,
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
        isActive: formData.isActive
      };

      console.log('Отправляемые данные:', JSON.stringify(formDataToSubmit, null, 2));

      if (editingPromo) {
        await handleUpdatePromoCode(editingPromo.id, formDataToSubmit);
      } else {
        const response = await fetch('/api/promo-codes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formDataToSubmit),
        });

        const responseData = await response.json();
        console.log('Ответ сервера:', JSON.stringify(responseData, null, 2));

        if (!response.ok) {
          if (responseData.errors) {
            // Показываем ошибки валидации
            const errorMessages = responseData.errors.map((err: any) => {
              const field = err.path.join('.');
              const message = err.message;
              console.error(`Ошибка в поле ${field}: ${message}`);
              return `${field}: ${message}`;
            }).join('\n');
            
            toast({
              title: "Ошибка валидации",
              description: errorMessages,
              variant: "destructive"
            });
          } else {
            toast({
              title: "Ошибка",
              description: responseData.message || "Не удалось создать промокод",
              variant: "destructive"
            });
          }
          return;
        }

        await handleCreatePromoCode(formDataToSubmit);
      }

      setIsDialogOpen(false);
      setEditingPromo(null);
      resetForm();
      fetchPromoCodes();
    } catch (error) {
      console.error('Ошибка при отправке формы:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить промокод",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите деактивировать этот промокод?')) return;

    try {
      deletePromoCodeMutation.mutate(id);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось деактивировать промокод",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (promo: PromoCode) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code,
      description: promo.description || '',
      discountType: promo.discount_type,
      discountValue: promo.discount_value.toString(),
      minOrderAmount: promo.min_order_amount?.toString() || '',
      startDate: promo.start_date.split('T')[0],
      endDate: promo.end_date.split('T')[0],
      maxUses: promo.max_uses?.toString() || '',
      isActive: promo.is_active
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minOrderAmount: '',
      startDate: '',
      endDate: '',
      maxUses: '',
      isActive: true
    });
  };

  const formSchema = z.object({
    code: z.string().min(3, "Код должен содержать минимум 3 символа"),
    description: z.string().optional(),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.number().min(0, "Скидка должна быть положительной"),
    minOrderAmount: z.number().min(0, "Минимальная сумма должна быть положительной").optional(),
    startDate: z.string(),
    endDate: z.string(),
    maxUses: z.number().min(0, "Максимальное количество использований должно быть положительным").optional(),
    isActive: z.boolean()
  });

  const handleCreatePromoCode = async (data: PromoCodeFormData) => {
    try {
      const response = await apiRequest<PromoCode>('POST', '/api/promo-codes', data);
      if (response) {
        toast({
          title: "Успех",
          description: "Промокод успешно создан",
          variant: "success"
        });
        queryClient.invalidateQueries({ queryKey: ['promoCodes'] });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось создать промокод",
        variant: "destructive"
      });
    }
  };

  const handleUpdatePromoCode = async (id: number, data: PromoCodeFormData) => {
    try {
      const response = await apiRequest<PromoCode>('PUT', `/api/promo-codes/${id}`, data);
      if (response) {
        toast({
          title: "Успех",
          description: "Промокод успешно обновлен",
          variant: "success"
        });
        queryClient.invalidateQueries({ queryKey: ['promoCodes'] });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить промокод",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Управление промокодами</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingPromo(null);
              resetForm();
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить промокод
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPromo ? 'Редактировать промокод' : 'Новый промокод'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Код</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountType">Тип скидки</Label>
                  <Select
                    value={formData.discountType}
                    onValueChange={(value: 'percentage' | 'fixed') => 
                      setFormData({...formData, discountType: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Процент</SelectItem>
                      <SelectItem value="fixed">Фиксированная сумма</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountValue">
                    {formData.discountType === 'percentage' ? 'Процент скидки' : 'Сумма скидки'}
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    min="0"
                    max={formData.discountType === 'percentage' ? "100" : undefined}
                    step={formData.discountType === 'percentage' ? "1" : "0.01"}
                    value={formData.discountValue}
                    onChange={e => setFormData({...formData, discountValue: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minOrderAmount">Мин. сумма заказа</Label>
                  <Input
                    id="minOrderAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minOrderAmount}
                    onChange={e => setFormData({...formData, minOrderAmount: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Дата начала</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Дата окончания</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxUses">Макс. количество использований (необязательно)</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="0"
                  value={formData.maxUses}
                  onChange={e => setFormData({...formData, maxUses: e.target.value})}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive">Активен</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingPromo(null);
                    resetForm();
                  }}
                >
                  Отмена
                </Button>
                <Button type="submit">
                  {editingPromo ? 'Сохранить' : 'Создать'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Код</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Скидка</TableHead>
              <TableHead>Мин. сумма</TableHead>
              <TableHead>Период действия</TableHead>
              <TableHead>Использования</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promoCodes.map((promo) => (
              <TableRow key={promo.id}>
                <TableCell className="font-medium">{promo.code}</TableCell>
                <TableCell>{promo.description}</TableCell>
                <TableCell>
                  {promo.discount_type === 'percentage' 
                    ? `${promo.discount_value}%`
                    : `${promo.discount_value} ₽`}
                </TableCell>
                <TableCell>{promo.min_order_amount} ₽</TableCell>
                <TableCell>
                  {format(new Date(promo.start_date), 'dd.MM.yyyy', { locale: ru })} - {' '}
                  {format(new Date(promo.end_date), 'dd.MM.yyyy', { locale: ru })}
                </TableCell>
                <TableCell>
                  {promo.current_uses}
                  {promo.max_uses ? ` / ${promo.max_uses}` : ''}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    promo.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {promo.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(promo)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(promo.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end mt-4">
        <Button variant="outline" onClick={exportToExcel}>
          Экспорт в Excel
        </Button>
      </div>
    </div>
  );
} 