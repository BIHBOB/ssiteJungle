import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProductForm from "./ProductForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, FileDown } from "lucide-react";
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

export default function ProductsList() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Ошибка загрузки товаров");
      return res.json();
    }
  });
  
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await apiRequest("DELETE", `/api/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Товар удален",
        description: "Товар успешно удален из каталога"
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
  
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };
  
  const handleDelete = (productId: number) => {
    if (confirm("Вы уверены, что хотите удалить этот товар?")) {
      deleteProductMutation.mutate(productId);
    }
  };
  
  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingProduct(null);
  };
  
  const filteredProducts = products?.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const exportToExcel = async () => {
    try {
      const data = products.map(product => ({
        ID: product.id,
        'Название': product.name,
        'Описание': product.description,
        'Цена': product.price,
        'Старая цена': product.originalPrice || '-',
        'Количество': product.quantity,
        'Категория': product.category,
        'Доступен': product.isAvailable ? 'Да' : 'Нет',
        'Предзаказ': product.isPreorder ? 'Да' : 'Нет',
        'Редкий': product.isRare ? 'Да' : 'Нет',
        'Легкий уход': product.isEasyToCare ? 'Да' : 'Нет',
        'Метки': product.labels?.join(', ') || '-',
        'Стоимость доставки': product.deliveryCost || '0',
        'Дата создания': new Date(product.createdAt).toLocaleDateString('ru-RU'),
        'Дата обновления': product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('ru-RU') : '-',
      }));

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Товары');

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
      saveAs(blob, 'products.xlsx');

      toast({
        title: "Экспорт завершен",
        description: "Список товаров экспортирован в products.xlsx",
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
  
  if (showForm) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {editingProduct ? "Редактировать товар" : "Добавить новый товар"}
          </h2>
          <Button variant="outline" onClick={() => {
            setShowForm(false);
            setEditingProduct(null);
          }}>
            Вернуться к списку
          </Button>
        </div>
        
        <ProductForm 
          product={editingProduct || undefined} 
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingProduct(null);
          }}
        />
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Управление товарами</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel}>
            <FileDown className="w-4 h-4 mr-2" />
            Экспорт в Excel
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить товар
          </Button>
        </div>
      </div>
      
      <Card className="mb-6">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Поиск товаров по названию, описанию или категории"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>
      
      {isLoading ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Загрузка товаров...</p>
        </div>
      ) : !filteredProducts || filteredProducts.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {searchQuery 
              ? "Нет товаров, соответствующих поисковому запросу" 
              : "Нет доступных товаров"
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Изображение</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Наличие</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.id}</TableCell>
                  <TableCell>
                    {product.images && product.images.length > 0 ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                        Нет
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {product.name}
                  </TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>
                    {parseFloat(product.price).toLocaleString()} ₽
                    {product.originalPrice && (
                      <span className="text-xs text-gray-400 line-through ml-2">
                        {parseFloat(product.originalPrice).toLocaleString()} ₽
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.isAvailable ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                        В наличии ({product.quantity})
                      </Badge>
                    ) : product.isPreorder ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                        Предзаказ
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200">
                        Нет в наличии
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(product.id)}
                        disabled={deleteProductMutation.isPending}
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
      )}
    </div>
  );
}