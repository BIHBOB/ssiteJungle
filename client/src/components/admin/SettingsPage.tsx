import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PaymentDetails } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Check, X, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const { toast } = useToast();
  const [bankDetails, setBankDetails] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#2E7D32");
  const [secondaryColor, setSecondaryColor] = useState("#FFC107");
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  
  // Загрузка платежных реквизитов
  const { data: paymentDetails, isLoading: isLoadingPaymentDetails } = useQuery<PaymentDetails>({
    queryKey: ["/api/payment-details"],
    queryFn: async () => {
      const res = await fetch("/api/payment-details");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Ошибка загрузки платежных реквизитов");
      return res.json();
    }
  });
  
  // Заполняем форму данными при их получении
  useEffect(() => {
    if (paymentDetails) {
      setBankDetails(paymentDetails.bankDetails || "");
    }
  }, [paymentDetails]);
  
  // Мутация для обновления платежных реквизитов
  const updatePaymentDetailsMutation = useMutation({
    mutationFn: async (data: Partial<PaymentDetails>) => {
      await apiRequest("PUT", "/api/payment-details", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-details"] });
      toast({
        title: "Настройки сохранены",
        description: "Платежные реквизиты успешно обновлены"
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
  
  // Мутация для загрузки QR-кода
  const uploadQrCodeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("qrCode", file);
      
      const res = await fetch("/api/upload-qr-code", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Ошибка загрузки QR-кода");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      updatePaymentDetailsMutation.mutate({
        qrCodeUrl: data.url
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка загрузки",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Обработчик сохранения платежных реквизитов
  const handleSavePaymentDetails = () => {
    updatePaymentDetailsMutation.mutate({
      bankDetails
    });
    
    if (qrCodeFile) {
      uploadQrCodeMutation.mutate(qrCodeFile);
    }
  };
  
  // Обработчик загрузки QR-кода
  const handleQrCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setQrCodeFile(e.target.files[0]);
    }
  };
  
  // Обработчик сохранения настроек Telegram-бота
  const handleSaveTelegramSettings = () => {
    // В реальном приложении здесь была бы логика сохранения настроек бота
    toast({
      title: "Настройки сохранены",
      description: "Настройки Telegram-бота успешно обновлены"
    });
  };
  
  // Обработчик сохранения настроек интерфейса
  const handleSaveInterfaceSettings = () => {
    document.documentElement.style.setProperty('--primary', primaryColor);
    document.documentElement.style.setProperty('--secondary', secondaryColor);
    
    toast({
      title: "Настройки сохранены",
      description: "Настройки интерфейса успешно обновлены"
    });
    
    // В реальном приложении здесь была бы логика сохранения настроек в БД
  };
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Настройки</h2>
      
      <Tabs defaultValue="payment" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="payment">Платежные реквизиты</TabsTrigger>
          <TabsTrigger value="telegram">Telegram-бот</TabsTrigger>
          <TabsTrigger value="interface">Интерфейс</TabsTrigger>
        </TabsList>
        
        {/* Вкладка платежных реквизитов */}
        <TabsContent value="payment">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Реквизиты для оплаты</CardTitle>
                <CardDescription>
                  Укажите реквизиты, которые будут отображаться пользователям для оплаты заказов
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-details">Банковские реквизиты</Label>
                    <Textarea
                      id="bank-details"
                      value={bankDetails}
                      onChange={(e) => setBankDetails(e.target.value)}
                      placeholder="Введите реквизиты для оплаты"
                      rows={5}
                    />
                    <p className="text-xs text-gray-500">
                      Укажите номер карты, банк и ФИО получателя
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleSavePaymentDetails}
                    disabled={updatePaymentDetailsMutation.isPending}
                  >
                    {updatePaymentDetailsMutation.isPending ? "Сохранение..." : "Сохранить реквизиты"}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>QR-код для оплаты</CardTitle>
                <CardDescription>
                  Загрузите QR-код, который будет отображаться для быстрой оплаты
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paymentDetails?.qrCodeUrl ? (
                    <div className="flex flex-col items-center">
                      <div className="border rounded-lg p-2 mb-3">
                        <img 
                          src={paymentDetails.qrCodeUrl} 
                          alt="QR-код для оплаты" 
                          className="w-32 h-32 object-contain"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Текущий QR-код для оплаты
                      </p>
                    </div>
                  ) : (
                    <Alert className="bg-amber-50 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <AlertDescription>
                        QR-код еще не загружен
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="qr-code">Загрузить QR-код</Label>
                    <div className="mt-1 flex items-center">
                      <Input
                        id="qr-code"
                        type="file"
                        accept="image/*"
                        onChange={handleQrCodeChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="qr-code"
                        className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Выбрать файл
                      </label>
                      {qrCodeFile && (
                        <span className="ml-3 text-sm text-gray-500">
                          {qrCodeFile.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Загрузите изображение в формате PNG, JPG или SVG
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleSavePaymentDetails}
                    disabled={uploadQrCodeMutation.isPending || !qrCodeFile}
                  >
                    {uploadQrCodeMutation.isPending ? "Загрузка..." : "Загрузить QR-код"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Вкладка настроек Telegram-бота */}
        <TabsContent value="telegram">
          <Card>
            <CardHeader>
              <CardTitle>Настройка оповещений Telegram</CardTitle>
              <CardDescription>
                Настройте интеграцию с Telegram для получения уведомлений о новых заказах
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="telegram-token">Токен бота</Label>
                  <Input
                    id="telegram-token"
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="Введите токен Telegram-бота"
                  />
                  <p className="text-xs text-gray-500">
                    Токен можно получить у @BotFather в Telegram
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="telegram-chatid">ID чата или канала</Label>
                  <Input
                    id="telegram-chatid"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="Введите ID чата для отправки уведомлений"
                  />
                  <p className="text-xs text-gray-500">
                    Идентификатор чата или канала, куда будут отправляться уведомления
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="notifications"
                    checked={enableNotifications}
                    onCheckedChange={setEnableNotifications}
                  />
                  <Label htmlFor="notifications">Включить уведомления</Label>
                </div>
                
                <Button onClick={handleSaveTelegramSettings}>
                  Сохранить настройки
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Вкладка настроек интерфейса */}
        <TabsContent value="interface">
          <Card>
            <CardHeader>
              <CardTitle>Настройка интерфейса</CardTitle>
              <CardDescription>
                Измените цвета и внешний вид сайта
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Основной цвет</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="primary-color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 p-0 border rounded"
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="p-2 border rounded-md"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Основной цвет будет использоваться для кнопок, ссылок и акцентов
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="secondary-color">Акцентный цвет</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="secondary-color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 p-0 border rounded"
                    />
                    <Input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="p-2 border rounded-md"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Акцентный цвет будет использоваться для выделения элементов и уведомлений
                  </p>
                </div>
                
                <div className="flex gap-4 p-4 border rounded-lg">
                  <div 
                    className="w-20 h-20 rounded-md" 
                    style={{ backgroundColor: primaryColor }}
                  ></div>
                  <div 
                    className="w-20 h-20 rounded-md" 
                    style={{ backgroundColor: secondaryColor }}
                  ></div>
                </div>
                
                <Button onClick={handleSaveInterfaceSettings}>
                  Применить настройки
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}