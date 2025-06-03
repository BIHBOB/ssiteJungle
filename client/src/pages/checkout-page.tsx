import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertOrderSchema, InsertOrder, PaymentDetails, Product } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Truck, 
  CreditCard, 
  ArrowLeftRight, 
  Wallet, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Upload, 
  Loader2
} from "lucide-react";

// Cart item type
type CartItem = {
  id: number;
  name: string;
  image: string;
  price: string | number;
  quantity: number;
};

// Checkout form schema
const checkoutSchema = z.object({
  fullName: z.string().min(3, "Введите ФИО"),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  address: z.string().min(5, "Введите адрес доставки"),
  deliveryType: z.enum(["cdek", "russianPost"], {
    required_error: "Выберите тип доставки"
  }),
  deliverySpeed: z.enum(["standard", "express"], {
    required_error: "Выберите скорость доставки"
  }),
  paymentMethod: z.enum(["yoomoney", "directTransfer", "balance"], {
    required_error: "Выберите способ оплаты"
  }),
  socialNetwork: z.enum(["telegram", "whatsapp"]).optional(),
  socialUsername: z.string().optional(),
  needStorage: z.boolean().default(false),
  needInsulation: z.boolean().default(false),
  comment: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, refreshUserData } = useAuth();
  const [step, setStep] = useState<"shipping" | "payment" | "questions" | "success">("shipping");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const queryClient = useQueryClient();
  
  // Get promo code from localStorage
  const [promoCodeInfo, setPromoCodeInfo] = useState<{
    code: string;
    discount: number;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  } | null>(() => {
    const stored = localStorage.getItem('appliedPromoCode');
    return stored ? JSON.parse(stored) : null;
  });
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      setLocation("/auth");
      toast({
        title: "Требуется авторизация",
        description: "Пожалуйста, войдите в аккаунт для оформления заказа",
        variant: "destructive"
      });
    }
  }, [user, setLocation, toast]);
  
  // Get cart items from localStorage (using useQuery for caching)
  const { data: cartItems = [] } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    queryFn: () => {
      const storedCart = localStorage.getItem("cart");
      return storedCart ? JSON.parse(storedCart) : [];
    },
  });
  
  // Получаем данные о продуктах для расчета доставки
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    // Включаем этот запрос только если есть товары в корзине, чтобы не делать лишних запросов
    enabled: cartItems.length > 0,
  });
  
  // Get payment details
  const { data: paymentDetails } = useQuery<PaymentDetails>({
    queryKey: ["/api/payment-details"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) throw new Error("Failed to fetch payment details");
      return res.json();
    },
    enabled: step === "payment",
  });
  
  // Form
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      address: user?.address || "",
      deliveryType: "cdek",
      deliverySpeed: "standard",
      paymentMethod: "yoomoney",
      socialNetwork: "telegram",
      socialUsername: "",
      needStorage: false,
      needInsulation: false,
      comment: "",
    },
  });
  
  // Calculate totals
  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      return total + (price * item.quantity);
    }, 0);
  };
  
  // Новая функция расчёта доставки
  const calculateDeliveryCost = () => {
    if (cartItems.length === 0 || products.length === 0) return 0;
    const deliveryType = form.watch("deliveryType");
    if (deliveryType === "cdek") {
      return 0;
    }
    // Почта России
    // Собираем массив deliveryCost для каждого товара (по количеству)
    let deliveryCosts: number[] = [];
    cartItems.forEach(item => {
      const product = products.find(p => p.id === item.id);
      const cost = product && product.deliveryCost != null ? parseFloat(product.deliveryCost.toString()) : 0;
      for (let i = 0; i < item.quantity; i++) {
        deliveryCosts.push(cost);
      }
    });
    if (deliveryCosts.length === 0) return 0;
    // Сортируем по убыванию
    deliveryCosts.sort((a, b) => b - a);
    // До 3 товаров — только максимальная стоимость
    if (deliveryCosts.length <= 3) {
      return deliveryCosts[0];
    }
    // 4 и более: макс + 200р за каждую единицу сверх 3
    const base = deliveryCosts[0];
    const extra = (deliveryCosts.length - 3) * 200;
    return base + extra;
  };
  
  // Пояснение для доставки
  const deliveryNote = () => {
    const deliveryType = form.watch("deliveryType");
    if (deliveryType === "cdek") {
      return "Доставка оплачивается самостоятельно при получении в пункте выдачи СДЭК.";
    }
    if (cartItems.length > 3) {
      return "Сумма доставки: максимальная стоимость среди всех растений + 200₽ за каждую единицу товара начиная с 4-й.";
    }
    return "Сумма доставки равна максимальной стоимости доставки среди всех растений в заказе.";
  };
  
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const deliveryCost = calculateDeliveryCost();
    const discount = promoCodeInfo?.discount || 0;
    return subtotal + deliveryCost - discount;
  };
  
  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };
  
  // Handle file change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      
      // Check file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Ошибка",
          description: "Файл слишком большой. Максимальный размер - 5 МБ",
          variant: "destructive"
        });
        return;
      }
      
      // Check file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Ошибка",
          description: "Разрешены только изображения",
          variant: "destructive"
        });
        return;
      }
      
      setPaymentProof(file);
      setProofUploaded(false);
      
      // Показать уведомление о успешном прикреплении файла
      toast({
        title: "Файл прикреплен",
        description: "Чек успешно прикреплен к заказу. Нажмите 'Загрузить чек' для отправки.",
        variant: "success"
      });
    }
  };
  
  // Upload payment proof mutation
  const uploadProofMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number, file: File }) => {
      const formData = new FormData();
      formData.append("proof", file);
      
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/orders/${id}/payment-proof`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || "Ошибка загрузки подтверждения оплаты");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // После успешной загрузки чека уведомляем пользователя и устанавливаем флаг
      setProofUploaded(true);
      
      toast({
        title: "Чек загружен",
        description: "Чек успешно загружен! Теперь нажмите 'Завершить заказ' для завершения заказа",
        variant: "success"
      });
      
      setIsUploading(false);
    },
    onError: (error: Error) => {
      setIsUploading(false);
      toast({
        title: "Ошибка загрузки",
        description: error.message || "Произошла ошибка при загрузке файла",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });
  
  // Final complete order after proof upload
  const completeOrderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/orders/${id}/complete`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || "Ошибка при завершении заказа");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // После финализации заказа обновляем данные пользователя и статус заказа
      queryClient.invalidateQueries({queryKey: ["/api/auth/user"]});
      queryClient.invalidateQueries({queryKey: ["/api/user/orders"]});
      queryClient.invalidateQueries({queryKey: ["/api/orders"]});
      
      // Явное обновление пользовательских данных для актуализации баланса
      refreshUserData();
      
      // Четкий переход на страницу успешного оформления
      setStep("success");
      
      // Clear cart
      localStorage.setItem("cart", "[]");
      queryClient.setQueryData(["/api/cart"], []);
      
      toast({
        title: "Заказ завершен",
        description: data.message || `Заказ #${orderId} успешно оформлен`,
        variant: "success"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка завершения заказа",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: InsertOrder) => {
      try {
        // Перед созданием заказа обновим данные пользователя
        await refreshUserData();
        
        const response = await apiRequest("POST", "/api/orders", data);
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || "Ошибка при создании заказа");
        }
        return response.json();
      } catch (error) {
        console.error("Ошибка при создании заказа:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Сохраняем ID заказа
      console.log("Заказ успешно создан:", data);
      console.log("Server order data:", data.order);
      setOrderId(data.id);
      
      // If payment method is YooMoney or balance, go directly to success
      const paymentMethod = form.getValues("paymentMethod");
      if (paymentMethod === "yoomoney") {
        setStep("success");
        
        // Clear cart
        localStorage.setItem("cart", "[]");
        queryClient.setQueryData(["/api/cart"], []);
        
        toast({
          title: "Заказ оформлен",
          description: `Заказ #${data.id} успешно оформлен и будет обработан после оплаты через ЮМани`,
          variant: "success"
        });
      } else if (paymentMethod === "balance") {
        // Обновление данных пользователя после оплаты с баланса
        queryClient.invalidateQueries({queryKey: ["/api/auth/user"]});
        queryClient.invalidateQueries({queryKey: ["/api/orders"]});
        queryClient.invalidateQueries({queryKey: ["/api/user/orders"]});
        
        // Принудительное обновление данных пользователя с небольшой задержкой
        setTimeout(async () => {
          await refreshUserData();
          
          // Показываем уведомление с актуальным балансом
          if (user) {
            toast({
              title: "Баланс обновлен",
              description: `Ваш текущий баланс: ${formatPrice(parseFloat(user.balance || "0"))} ₽`,
              variant: "default"
            });
          }
        }, 500);
        
        setStep("success");
        
        // Clear cart
        localStorage.setItem("cart", "[]");
        queryClient.setQueryData(["/api/cart"], []);
        
        toast({
          title: "Заказ оформлен",
          description: `Заказ #${data.id} успешно оформлен и оплачен с вашего баланса`,
          variant: "success"
        });
      } else {
        // Для прямого перевода переходим на этап загрузки подтверждения
        setStep("questions");
        
        toast({
          title: "Заказ создан",
          description: `Заказ #${data.id} создан. Пожалуйста, загрузите подтверждение оплаты`,
        });
      }
    },
    onError: (error: Error) => {
      console.error("Ошибка при создании заказа:", error);
      toast({
        title: "Ошибка оформления заказа",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (data: CheckoutFormValues) => {
    if (!user) return;
    
    if (step === "shipping") {
      setStep("payment");
      return;
    }
    
    if (step === "payment") {
      // Получаем метод оплаты
      const paymentMethod = form.getValues("paymentMethod");
      
      // Create order
      const orderData: InsertOrder = {
        userId: String(user.id),
        items: cartItems.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
        })),
        totalAmount: calculateTotal().toString(),
        deliveryAmount: calculateDeliveryCost(),
        fullName: data.fullName,
        address: data.address,
        phone: data.phone,
        socialNetwork: data.socialNetwork,
        socialUsername: data.socialUsername || undefined,
        deliveryType: data.deliveryType,
        deliverySpeed: data.deliverySpeed,
        paymentMethod: data.paymentMethod,
        needStorage: data.needStorage,
        needInsulation: data.needInsulation,
        comment: data.comment || undefined,
        promoCode: promoCodeInfo?.code || null,
      };
      
      console.log("Отправка данных заказа:", orderData);
      createOrderMutation.mutate(orderData);
    }
    
    if (step === "questions" && orderId) {
      if (data.paymentMethod === "directTransfer") {
        // Если файл еще не выбран
        if (!paymentProof && !proofUploaded) {
          toast({
            title: "Требуется подтверждение",
            description: "Пожалуйста, загрузите подтверждение платежа",
            variant: "destructive"
          });
          return;
        }
        
        // Если файл выбран, но еще не загружен на сервер
        if (paymentProof && !proofUploaded && !isUploading) {
          setIsUploading(true);
          uploadProofMutation.mutate({ id: orderId, file: paymentProof });
          return;
        }
        
        // Если файл уже загружен, финализируем заказ
        if (proofUploaded) {
          completeOrderMutation.mutate(orderId);
        }
      } else {
        setStep("success");
        
        // Clear cart
        localStorage.setItem("cart", "[]");
        queryClient.setQueryData(["/api/cart"], []);
      }
    }
  };
  
  // Handle back button
  const handleBack = () => {
    if (step === "payment") {
      setStep("shipping");
    } else if (step === "questions") {
      setStep("payment");
    } else if (step === "success") {
      setLocation("/");
    }
  };
  
  // If cart is empty, redirect to cart page
  useEffect(() => {
    if (cartItems.length === 0 && step !== "success") {
      setLocation("/cart");
      toast({
        title: "Корзина пуста",
        description: "Добавьте товары в корзину перед оформлением заказа",
        variant: "destructive"
      });
    }
  }, [cartItems, step, setLocation, toast]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-gray-600 hover:text-primary"
          onClick={handleBack}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {step === "success" ? "На главную" : "Назад"}
        </Button>
        
        <h1 className="heading font-montserrat font-bold text-xl md:text-2xl ml-4">
          {step === "success" ? "Заказ оформлен" : "Оформление заказа"}
        </h1>
      </div>
      
      {/* Progress bar */}
      {step !== "success" && (
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className={step === "shipping" ? "font-medium text-primary" : "text-gray-500"}>Доставка</span>
            <span className={step === "payment" ? "font-medium text-primary" : "text-gray-500"}>Оплата</span>
            <span className={step === "questions" ? "font-medium text-primary" : "text-gray-500"}>Дополнительно</span>
          </div>
          <div className="bg-gray-200 h-2 rounded-full">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ 
                width: step === "shipping" ? "33%" : step === "payment" ? "66%" : "100%" 
              }}
            ></div>
          </div>
        </div>
      )}
      
      {/* Checkout form */}
      {step !== "success" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Shipping step */}
                {step === "shipping" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Truck className="h-5 w-5 mr-2 text-primary" />
                        Информация о доставке
                      </CardTitle>
                      <CardDescription>
                        Введите информацию для доставки вашего заказа
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ФИО получателя</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Иванов Иван Иванович" 
                                {...field} 
                                className="form-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Телефон</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="+7XXXXXXXXXX" 
                                {...field} 
                                className="form-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Адрес доставки</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Полный адрес доставки, включая индекс" 
                                {...field} 
                                className="form-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="socialNetwork"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Соцсеть для уведомлений</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                                <FormControl>
                                  <SelectTrigger className="form-input">
                                    <SelectValue placeholder="Выберите соцсеть" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="telegram">Telegram</SelectItem>
                                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                              <div className="text-xs text-gray-500 mt-1">Подписка на уведомления временно недоступна</div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="socialUsername"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Имя пользователя</FormLabel>
                              <FormControl>
                                <Input placeholder="@username" {...field} disabled />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="deliveryType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Способ доставки</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="form-input">
                                    <SelectValue placeholder="Выберите способ доставки" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="cdek">CDEK</SelectItem>
                                  <SelectItem value="russianPost">Почта России</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="deliverySpeed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Скорость доставки</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="form-input">
                                    <SelectValue placeholder="Выберите скорость доставки" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="standard">Стандартная</SelectItem>
                                  <SelectItem value="express">Экспресс (+20%)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="comment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Комментарий к заказу</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Дополнительная информация для доставки" 
                                {...field} 
                                className="form-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button 
                        type="submit" 
                        className="bg-primary hover:bg-green-700 text-white"
                      >
                        Продолжить
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                )}
                
                {/* Payment step */}
                {step === "payment" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-2 text-primary" />
                        Способ оплаты
                      </CardTitle>
                      <CardDescription>
                        Выберите удобный способ оплаты
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="space-y-4"
                              >
                                {/* Оплата картой (YooMoney) - disabled */}
                                <div className="flex items-center space-x-2 border rounded-lg p-4 transition-colors opacity-60 cursor-not-allowed">
                                  <RadioGroupItem value="yoomoney" id="yoomoney" disabled />
                                  <Label htmlFor="yoomoney" className="flex items-center cursor-not-allowed">
                                    <CreditCard className="h-5 w-5 mr-2 text-blue-500" />
                                    <div>
                                      <div className="font-medium">Оплата картой</div>
                                      <div className="text-sm text-gray-500">YooMoney — временно недоступно</div>
                                    </div>
                                  </Label>
                                </div>
                                
                                <div className="flex items-center space-x-2 border rounded-lg p-4 transition-colors hover:bg-gray-50">
                                  <RadioGroupItem value="directTransfer" id="directTransfer" />
                                  <Label htmlFor="directTransfer" className="flex items-center cursor-pointer">
                                    <ArrowLeftRight className="h-5 w-5 mr-2 text-green-500" />
                                    <div>
                                      <div className="font-medium">Прямой перевод</div>
                                      <div className="text-sm text-gray-500">Перевод по реквизитам с подтверждением</div>
                                    </div>
                                  </Label>
                                </div>
                                
                                {/* Всегда показываем опцию баланса, но делаем её неактивной если он недостаточен */}
                                <div className={`flex items-center space-x-2 border rounded-lg p-4 transition-colors ${
                                  user?.balance && parseFloat(user.balance) >= calculateTotal() 
                                  ? "hover:bg-gray-50" 
                                  : "opacity-60 cursor-not-allowed"
                                }`}>
                                  <RadioGroupItem 
                                    value="balance" 
                                    id="balance" 
                                    disabled={!user?.balance || parseFloat(user.balance) < calculateTotal()}
                                  />
                                  <Label htmlFor="balance" className="flex items-center cursor-pointer">
                                    <Wallet className="h-5 w-5 mr-2 text-primary" />
                                    <div>
                                      <div className="font-medium">Баланс</div>
                                      <div className="text-sm text-gray-500">
                                        Ваш баланс: {formatPrice(user?.balance ? parseFloat(user.balance) : 0)} ₽
                                        {(!user?.balance || parseFloat(user.balance) < calculateTotal()) && (
                                          <span className="text-red-500 ml-2">
                                            (Недостаточно средств)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {form.watch("paymentMethod") === "directTransfer" && paymentDetails && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                          <h3 className="font-medium mb-2">Реквизиты для оплаты:</h3>
                          <pre className="whitespace-pre-wrap text-sm bg-white p-3 rounded border mb-3">
                            {paymentDetails.bankDetails}
                          </pre>
                          
                          {paymentDetails.qrCodeUrl && (
                            <div className="mt-4 text-center">
                              <p className="text-sm mb-2">QR-код для оплаты:</p>
                              <img 
                                src={paymentDetails.qrCodeUrl} 
                                alt="QR код для оплаты" 
                                className="mx-auto max-w-[200px] max-h-[200px]" 
                              />
                            </div>
                          )}
                          
                          <p className="text-sm text-gray-600 mt-4">
                            Важно! После оплаты сохраните чек. На следующем шаге вам потребуется загрузить подтверждение платежа.
                          </p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button 
                        type="submit" 
                        className="bg-primary hover:bg-green-700 text-white"
                      >
                        Продолжить
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                )}
                
                {/* Questions step */}
                {step === "questions" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Дополнительные вопросы</CardTitle>
                      <CardDescription>
                        Ответьте на несколько вопросов для улучшения обслуживания
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="needStorage"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Нужна ли передержка?</FormLabel>
                                <p className="text-sm text-gray-500">
                                  Мы можем сохранить ваши растения до весны, если в вашем регионе холодно
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="needInsulation"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Нужно ли утепление?</FormLabel>
                                <p className="text-sm text-gray-500">
                                  Мы дополнительно утеплим посылку для защиты растений от холода
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {form.watch("paymentMethod") === "directTransfer" && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-medium mb-2 flex items-center">
                            <Upload className="h-5 w-5 mr-2 text-primary" />
                            Загрузите подтверждение платежа
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            Прикрепите скриншот или фото чека для подтверждения оплаты
                          </p>
                          
                          <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {paymentProof ? (
                                  <div className="text-center">
                                    <CheckCircle2 className="mx-auto h-8 w-8 text-success mb-2" />
                                    <p className="mb-1 text-sm text-gray-600">Файл загружен</p>
                                    <p className="text-xs text-gray-500">{paymentProof.name}</p>
                                  </div>
                                ) : (
                                  <>
                                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                    <p className="mb-1 text-sm text-gray-600">
                                      <span className="font-medium">Нажмите для загрузки</span> или перетащите файл
                                    </p>
                                    <p className="text-xs text-gray-500">PNG, JPG до 5 МБ</p>
                                  </>
                                )}
                              </div>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFileChange}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button 
                        type="submit" 
                        className="bg-primary hover:bg-green-700 text-white"
                        disabled={isUploading || uploadProofMutation.isPending || completeOrderMutation.isPending}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Загрузка чека...
                          </>
                        ) : uploadProofMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Отправка чека...
                          </>
                        ) : completeOrderMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Завершение заказа...
                          </>
                        ) : proofUploaded ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Завершить заказ
                          </>
                        ) : paymentProof ? (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Загрузить чек
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Прикрепить чек
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                )}
              </form>
            </Form>
          </div>
          
          {/* Order summary */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Ваш заказ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="h-16 w-16 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Кол-во: {item.quantity} шт.</span>
                          <span>
                            {formatPrice(
                              (typeof item.price === 'string' ? parseFloat(item.price) : item.price) * item.quantity
                            )} ₽
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Товары:</span>
                    <span>{formatPrice(calculateSubtotal())} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Доставка:</span>
                    <span>{formatPrice(calculateDeliveryCost())} ₽</span>
                  </div>
                  {/* Пояснение по доставке */}
                  {deliveryNote() && (
                    <div className="text-xs text-gray-500 mt-1 mb-2">{deliveryNote()}</div>
                  )}
                  {promoCodeInfo && (
                    <div className="flex justify-between text-green-600">
                      <span>Скидка по промокоду:</span>
                      <span>-{formatPrice(promoCodeInfo.discount)} ₽</span>
                    </div>
                  )}
                  <Separator className="my-4" />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Итого:</span>
                    <span className="text-primary">{formatPrice(calculateTotal())} ₽</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-lg shadow-md">
          <div className="w-16 h-16 mx-auto bg-success bg-opacity-10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          
          <h2 className="heading font-montserrat font-bold text-2xl mb-2">Заказ успешно оформлен!</h2>
          <p className="text-gray-600 mb-6">
            Номер заказа: <span className="font-semibold">{orderId}</span>
          </p>
          
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-gray-50 p-4 rounded-lg text-left">
              <h3 className="font-medium mb-2">Что дальше?</h3>
              <p className="text-sm text-gray-600 mb-2">
                Мы уже получили ваш заказ и начали его обработку. Вы получите уведомление на email о статусе вашего заказа.
              </p>
              <p className="text-sm text-gray-600">
                Вы всегда можете проверить статус заказа в личном кабинете в разделе "Мои заказы".
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              className="bg-primary hover:bg-green-700 text-white"
              onClick={() => setLocation("/profile?tab=orders")}
            >
              Мои заказы
            </Button>
            <Button 
              variant="outline"
              onClick={() => setLocation("/")}
            >
              Вернуться на главную
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label {...props} className="flex-1">
      {children}
    </label>
  );
}
