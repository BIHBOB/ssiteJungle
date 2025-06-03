import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { FileDown } from "lucide-react";

// Определяем локальный тип Review
type Review = {
  id: number;
  userId: string | number;
  productId: number;
  rating: number;
  text: string;
  images?: string[];
  isApproved: boolean;
  createdAt: string | null;
  updatedAt?: string | null;
};

export default function ReviewsList() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const queryClient = useQueryClient();
  
  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews", { approved: activeTab === "approved" }],
    queryFn: async () => {
      const url = `/api/reviews?approved=${activeTab === "approved"}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки отзывов");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });
  
  const approveReviewMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const response = await apiRequest("PUT", `/api/reviews/${reviewId}`, { isApproved: true });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({
        title: "Отзыв опубликован",
        description: "Отзыв успешно опубликован и будет виден на сайте",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка публикации",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      await apiRequest("DELETE", `/api/reviews/${reviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({
        title: "Отзыв удален",
        description: "Отзыв успешно удален из системы",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка удаления",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleApprove = (reviewId: number) => {
    approveReviewMutation.mutate(reviewId);
  };
  
  const handleDelete = (reviewId: number) => {
    if (confirm("Вы уверены, что хотите удалить этот отзыв?")) {
      deleteReviewMutation.mutate(reviewId);
    }
  };
  
  const exportToExcel = async () => {
    try {
      console.log('Export: Starting export...');
      console.log('Export: Reviews data length:', reviews.length);
      
      const data = reviews.map(review => ({
        ID: review.id,
        'ID пользователя': review.userId,
        'ID товара': review.productId || '-',
        'Оценка': review.rating,
        'Текст отзыва': review.text,
        'Изображения': review.images?.join(', ') || '-',
        'Одобрен': review.isApproved ? 'Да' : 'Нет',
        'Дата создания': review.createdAt ? new Date(review.createdAt).toLocaleDateString('ru-RU') : '-',
      }));

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Отзывы');

      console.log('Export: Workbook and worksheet created.');

      // Добавляем заголовки
      worksheet.columns = Object.keys(data[0]).map(key => ({
        header: key,
        key: key,
        width: 20
      }));

      // Добавляем данные
      worksheet.addRows(data);

      console.log('Export: Data added to worksheet.');

      // Стилизация заголовков
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Генерируем файл
      const buffer = await workbook.xlsx.writeBuffer();
      
      console.log('Export: Workbook buffer generated. Buffer size:', buffer.byteLength);
      
      // Создаем blob и скачиваем файл
      console.log('Export: Creating blob...');
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      console.log('Export: Blob created.', blob);

      console.log('Export: Attempting to save file...');
      saveAs(blob, 'reviews.xlsx');

      console.log('Export: saveAs called.');

      toast({
        title: "Экспорт завершен",
        description: "Список отзывов экспортирован в reviews.xlsx",
      });
      console.log('Export: Export successful, toast shown.');
    } catch (error) {
      console.error('Export Error:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось экспортировать данные",
        variant: "destructive"
      });
    }
  };
  
  const renderReviews = () => {
    if (isLoading) {
      return (
        <div className="text-center py-10">
          <p className="text-gray-500">Загрузка отзывов...</p>
        </div>
      );
    }
    
    if (!reviews || reviews.length === 0) {
      return (
        <div className="text-center py-10">
          <p className="text-gray-500">
            {activeTab === "pending" 
              ? "Нет отзывов на модерации" 
              : "Нет опубликованных отзывов"}
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium">Пользователь ID: {review.userId}</span>
                  <Badge>{review.rating} / 5</Badge>
                </div>
                <div>
                  <h3 className="font-medium">{review.text}</h3>
                  <div className="flex items-center mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500">
                    {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Дата неизвестна'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {activeTab === "pending" && (
                  <Button 
                    size="sm" 
                    onClick={() => handleApprove(review.id)}
                    disabled={approveReviewMutation.isPending}
                  >
                    {approveReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Одобрить"}
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDelete(review.id)}
                  disabled={deleteReviewMutation.isPending}
                >
                  {deleteReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
                </Button>
              </div>
            </div>
            {review.images && review.images.length > 0 && (
              <div className="flex gap-2 mt-2">
                {review.images.map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    alt={`Фото ${index + 1}`}
                    className="w-16 h-16 object-cover rounded"
                  />
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    );
  };
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Управление отзывами</h2>
      
      <div className="flex justify-between items-center mb-6">
        <Tabs 
          defaultValue="pending" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full md:w-auto"
        >
          <TabsList>
            <TabsTrigger value="pending">На модерации</TabsTrigger>
            <TabsTrigger value="approved">Опубликованные</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            {renderReviews()}
          </TabsContent>

          <TabsContent value="approved">
            {renderReviews()}
          </TabsContent>
        </Tabs>

        <Button 
          variant="outline" 
          onClick={exportToExcel}
        >
          <FileDown className="w-4 h-4 mr-2" />
          Экспорт в Excel
        </Button>
      </div>
    </div>
  );
}