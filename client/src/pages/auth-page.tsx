import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sprout, User, Mail, Key, Phone, Home, AtSign, Instagram, Facebook, Twitter } from "lucide-react";

// Login schema
const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

// Registration schema (extending the insert schema)
const registerSchema = z.object({
  username: z.string().min(1, "Введите имя пользователя"),
  email: z.string()
    .email("Введите корректный email")
    .min(5, "Email должен содержать минимум 5 символов")
    .max(100, "Email должен содержать максимум 100 символов")
    .transform(email => email.toLowerCase().trim()),
  password: z.string()
    .min(8, "Пароль должен быть минимум 8 символов")
    .max(100, "Пароль должен содержать максимум 100 символов")
    .regex(/[A-Z]/, "Пароль должен содержать хотя бы одну заглавную букву")
    .regex(/[0-9]/, "Пароль должен содержать хотя бы одну цифру"),
  confirmPassword: z.string().min(1, "Подтвердите пароль"),
  fullName: z.string()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(50, "Имя должно содержать максимум 50 символов")
    .regex(/^[a-zA-Zа-яА-ЯёЁ\s]+$/, "Имя должно содержать только буквы и пробелы"),
  phone: z.string().optional(),
  address: z.string().optional(),
  socialType: z.string().optional(),
  socialUser: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Login form
  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      phone: "",
      address: "",
      socialType: "Instagram",
      socialUser: "",
    },
  });

  // Login function
  const onLoginSubmit = (data: LoginValues) => {
    loginMutation.mutate(data);
  };

  // Register function
  const onRegisterSubmit = (data: RegisterValues) => {
    try {
      // Remove confirmPassword as it's not part of the API schema
      const { confirmPassword, socialUser, ...registerData } = data;
      
      // Разделяем fullName на first_name и last_name
      const nameParts = registerData.fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Формируем данные для отправки
      const userData = {
        ...registerData,
        firstName,
        lastName,
        username: registerData.username || registerData.email.split('@')[0],
        phone: registerData.phone || '',
        address: registerData.address || '',
      };
      
      console.log("Регистрационные данные:", userData);
      registerMutation.mutate(userData);
    } catch (error) {
      console.error("Ошибка при подготовке данных регистрации:", error);
    }
  };

  return (
    <div className="py-10 md:py-16 bg-neutral-medium min-h-screen">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto">
          {/* Auth Forms */}
          <div className="md:w-1/2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="register">Регистрация</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <Card>
                  <CardHeader>
                    <CardTitle>Вход в аккаунт</CardTitle>
                    <CardDescription>
                      Введите ваш email или имя пользователя и пароль для входа
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                  <Input
                                    {...field}
                                    className="pl-10 form-input"
                                    placeholder="Введите email"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Пароль</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Key className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                  <Input
                                    {...field}
                                    type="password"
                                    className="pl-10 form-input"
                                    placeholder="Введите пароль"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full bg-secondary hover:bg-yellow-500 text-white"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? "Вход..." : "Войти"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-2">
                    <div className="text-sm text-gray-500">
                      Еще нет аккаунта?{" "}
                      <button 
                        onClick={() => setActiveTab("register")}
                        className="text-primary hover:underline"
                      >
                        Зарегистрируйтесь
                      </button>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="register">
                <Card>
                  <CardHeader>
                    <CardTitle>Регистрация</CardTitle>
                    <CardDescription>
                      Создайте новый аккаунт для заказа растений
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Имя пользователя</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <AtSign className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                  <Input
                                    {...field}
                                    className="pl-10 form-input"
                                    placeholder="Введите имя пользователя"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                  <Input
                                    {...field}
                                    type="email"
                                    className="pl-10 form-input"
                                    placeholder="Введите email"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Пароль</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Key className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                    <Input
                                      {...field}
                                      type="password"
                                      className="pl-10 form-input"
                                      placeholder="Введите пароль"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Подтверждение пароля</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Key className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                    <Input
                                      {...field}
                                      type="password"
                                      className="pl-10 form-input"
                                      placeholder="Подтвердите пароль"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={registerForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ФИО</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <User className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                  <Input
                                    {...field}
                                    className="pl-10 form-input"
                                    placeholder="Введите полное имя"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Телефон</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Phone className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                    <Input
                                      {...field}
                                      className="pl-10 form-input"
                                      placeholder="+7XXXXXXXXXX"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="socialType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Соцсеть</FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  defaultValue={field.value || "Instagram"}
                                >
                                  <FormControl>
                                    <SelectTrigger className="form-input">
                                      <SelectValue placeholder="Выберите соцсеть" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Telegram">Telegram</SelectItem>
                                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="socialUser"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Аккаунт в соцсети</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    {registerForm.watch("socialType") === "Instagram" && (
                                      <Instagram className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                    )}
                                    {registerForm.watch("socialType") === "Facebook" && (
                                      <Facebook className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                    )}
                                    {(registerForm.watch("socialType") === "Telegram" || 
                                      registerForm.watch("socialType") === "WhatsApp" || 
                                      registerForm.watch("socialType") === "VK" || 
                                      registerForm.watch("socialType") === "None") && (
                                      <AtSign className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                    )}
                                    <Input
                                      {...field}
                                      className="pl-10 form-input"
                                      placeholder={
                                        registerForm.watch("socialType") === "None" 
                                          ? "Не указывать" 
                                          : registerForm.watch("socialType") === "WhatsApp"
                                          ? "Ваш номер телефона в WhatsApp"
                                          : `Ваш аккаунт в ${registerForm.watch("socialType")}`
                                      }
                                      disabled={registerForm.watch("socialType") === "None"}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={registerForm.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Адрес</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Home className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                  <Input
                                    {...field}
                                    className="pl-10 form-input"
                                    placeholder="Введите адрес доставки"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full bg-secondary hover:bg-yellow-500 text-white"
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? "Регистрация..." : "Зарегистрироваться"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-2">
                    <div className="text-sm text-gray-500">
                      Уже есть аккаунт?{" "}
                      <button 
                        onClick={() => setActiveTab("login")}
                        className="text-primary hover:underline"
                      >
                        Войдите
                      </button>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Hero Section */}
          <div className="md:w-1/2 hidden md:block">
            <div className="bg-primary rounded-lg p-10 h-full text-white relative overflow-hidden">
              <div 
                className="absolute inset-0 opacity-20" 
                style={{
                  backgroundImage: "url('https://images.unsplash.com/photo-1545241047-6083a3684587?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&q=80')",
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              ></div>
              <div className="relative z-10">
                <div className="flex items-center mb-6">
                  <Sprout className="h-8 w-8 mr-2" />
                  <h2 className="font-montserrat font-bold text-2xl">Jungle Plants</h2>
                </div>
                
                <h3 className="font-montserrat font-bold text-3xl mb-4">
                  Добро пожаловать в мир комнатных растений
                </h3>
                
                <p className="mb-6 text-lg opacity-90">
                  Создайте аккаунт, чтобы получить доступ к редким и экзотическим растениям с доставкой по всей России.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-white bg-opacity-20 p-2 rounded-full mr-3">
                      <Sprout className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Уникальная коллекция</h4>
                      <p className="opacity-80">Редкие и экзотические растения со всего мира</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-white bg-opacity-20 p-2 rounded-full mr-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold">Сообщество любителей растений</h4>
                      <p className="opacity-80">Присоединяйтесь к нашему растущему сообществу</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-white bg-opacity-20 p-2 rounded-full mr-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold">Уведомления о наличии</h4>
                      <p className="opacity-80">Получайте уведомления когда редкие растения снова в наличии</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
