import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, InsertUser } from "@shared/schema";
import { useToast } from "./use-toast";

// Определяем идентификатор для логирования
const LOG_PREFIX = "[AUTH]";

// Глобальная переменная для хранения состояния авторизации
const globalAuthState: {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  sessionChecked: boolean;
  lastUpdated: number;
} = {
  isAuthenticated: false,
  isAdmin: false,
  user: null,
  sessionChecked: false,
  lastUpdated: Date.now()
};

// Функция-хелпер для логирования
const logAuth = (message: string, data?: any) => {
  if (data) {
    console.log(`${LOG_PREFIX} ${message}`, data);
  } else {
    console.log(`${LOG_PREFIX} ${message}`);
  }
};

// Функция для безопасного сохранения и восстановления состояния авторизации
const persistAuthState = {
  save: () => {
    try {
      // Сохраняем только необходимый минимум данных
      const authToSave = {
        isAuthenticated: globalAuthState.isAuthenticated,
        isAdmin: globalAuthState.isAdmin,
        userId: globalAuthState.user?.id || null,
        timestamp: Date.now()
      };
      localStorage.setItem("authState", JSON.stringify(authToSave));
      logAuth("Состояние авторизации сохранено");
    } catch (e) {
      logAuth("Ошибка при сохранении состояния авторизации", e);
    }
  },
  
  restore: (): boolean => {
    try {
      const savedData = localStorage.getItem("authState");
      if (!savedData) return false;
      
      const authData = JSON.parse(savedData);
      
      // Проверяем, не устарели ли данные (старше 24 часов)
      const expirationTime = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
      if (Date.now() - (authData.timestamp || 0) > expirationTime) {
        logAuth("Сохраненное состояние авторизации устарело");
        localStorage.removeItem("authState");
        return false;
      }
      
      // Восстанавливаем базовые флаги
      if (authData.isAdmin) {
        globalAuthState.isAdmin = true;
        localStorage.setItem("isAdmin", "true");
      }
      
      globalAuthState.isAuthenticated = !!authData.isAuthenticated;
      logAuth("Восстановлено состояние авторизации", { isAdmin: authData.isAdmin, isAuthenticated: authData.isAuthenticated });
      
      return true;
    } catch (e) {
      logAuth("Ошибка при восстановлении состояния авторизации", e);
      return false;
    }
  }
};

// Типы для контекста авторизации
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  loginMutation: any;
  registerMutation: any;
  logoutMutation: any;
  refreshUserData: () => Promise<any>;
  setUser: (user: User) => void;
}

// Тип данных для входа
interface LoginData {
  email: string;
  password: string;
}

// Создаем контекст
export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
  isAdmin: false,
  isAuthenticated: false,
  loginMutation: null,
  registerMutation: null,
  logoutMutation: null,
  refreshUserData: async () => null,
  setUser: () => {},
});

// Провайдер для контекста авторизации
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  logAuth("Инициализация AuthProvider");
  
  const { toast } = useToast();
  const adminStateRef = useRef<boolean>(localStorage.getItem("isAdmin") === "true");
  const [userState, setUserState] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Хелпер для прямого API-запроса
  const directApiRequest = async (url: string, options: RequestInit = {}) => {
    const fullOptions = {
      ...options,
      credentials: 'include' as RequestCredentials,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
    };
    
    logAuth(`Выполняем прямой API-запрос: ${url}`, fullOptions);
    
    try {
      const response = await fetch(url, fullOptions);
      logAuth(`Получен ответ от ${url}, статус: ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          logAuth("Отклонено из-за неавторизованного доступа (401)");
          return null;
        }
        
        const errorText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        
        logAuth(`Ошибка API: ${errorData.message || 'Неизвестная ошибка'}`);
        throw new Error(errorData.message || 'Ошибка выполнения запроса');
      }
      
      const data = await response.json();
      logAuth(`Данные получены успешно:`, data);
      return data;
    } catch (error) {
      logAuth(`Ошибка запроса:`, error);
      throw error;
    }
  };

  // Проверяем авторизацию пользователя
  const {
    data: userData,
    error,
    isLoading,
    refetch: refetchUserData,
  } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      logAuth("Запрос данных пользователя");
      try {
        // Если у нас уже есть проверенные данные в глобальном состоянии, используем их
        if (globalAuthState.sessionChecked && globalAuthState.user) {
          logAuth("Используем кэшированные данные пользователя", globalAuthState.user);
          return { user: globalAuthState.user };
        }
        
        const data = await directApiRequest("/api/auth/user");
        
        if (data && data.user) {
          logAuth("Пользователь авторизован", data.user);
          globalAuthState.isAuthenticated = true;
          globalAuthState.user = data.user;
          globalAuthState.isAdmin = data.user.isAdmin === true;
          globalAuthState.sessionChecked = true;
          
          // Сохраняем статус админа в localStorage для постоянства
          if (data.user.isAdmin) {
            logAuth("Пользователь является администратором");
            localStorage.setItem("isAdmin", "true");
            adminStateRef.current = true;
          }
        } else {
          logAuth("Пользователь не авторизован");
          globalAuthState.isAuthenticated = false;
          globalAuthState.user = null;
          globalAuthState.sessionChecked = true;
        }
        
        return data;
      } catch (error) {
        logAuth("Ошибка при получении данных пользователя", error);
        return null;
      } finally {
        if (!authChecked) {
          setAuthChecked(true);
        }
      }
    },
    refetchInterval: 30000, // Обновляем каждые 30 секунд
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 3,
    retryDelay: 1000,
    staleTime: 10000, // Данные считаются свежими в течение 10 секунд
  });

  // Реагируем на ошибки
  useEffect(() => {
    if (error) {
      logAuth("Ошибка в хуке useQuery", error);
      // Не делаем автоматический выход при ошибках
    }
  }, [error]);

  // Обновляем локальное состояние при получении данных
  useEffect(() => {
    logAuth("Изменение данных пользователя", userData);
    
    if (userData && userData.user) {
      logAuth("Обновляем состояние пользователя", userData.user);
      setUserState(userData.user);
      
      // Обновляем глобальное состояние
      globalAuthState.user = userData.user;
      globalAuthState.isAuthenticated = true;
      
      if (userData.user.isAdmin) {
        logAuth("Пользователь имеет права администратора");
        adminStateRef.current = true;
        localStorage.setItem("isAdmin", "true");
        globalAuthState.isAdmin = true;
      }
    }
  }, [userData]);

  // Вход в систему
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      logAuth("Вход в систему с учетными данными", credentials);
      
      try {
        const data = await directApiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(credentials),
        });
        
        return data;
      } catch (error) {
        logAuth("Ошибка входа", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      logAuth("Успешный вход", data);
      
      if (data && data.user) {
        // Обновляем глобальное состояние
        globalAuthState.user = data.user;
        globalAuthState.isAuthenticated = true;
        globalAuthState.sessionChecked = true;
        
        if (data.user.isAdmin) {
          logAuth("Пользователь имеет права администратора");
          adminStateRef.current = true;
          localStorage.setItem("isAdmin", "true");
          globalAuthState.isAdmin = true;
        }
        
        // Обновляем кэш запросов
        queryClient.setQueryData(["/api/auth/user"], { user: data.user });
        setUserState(data.user);
        
        // Уведомляем пользователя
        toast({
          title: "Вход выполнен успешно",
          description: "Добро пожаловать!",
          variant: "success"
        });

        // Запускаем проверку данных пользователя через 1 секунду
        setTimeout(() => {
          logAuth("Запланированная проверка данных после входа");
          refetchUserData();
        }, 1000);
      } else {
        logAuth("Ответ на вход не содержит данных пользователя", data);
        toast({
          title: "Ошибка входа",
          description: "Не удалось получить данные пользователя",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      logAuth("Ошибка при входе", error);
      toast({
        title: "Ошибка входа",
        description: error.message || "Не удалось выполнить вход",
        variant: "destructive"
      });
    }
  });

  // Регистрация пользователя
  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      logAuth("Регистрация нового пользователя", userData);
      
      try {
        const data = await directApiRequest("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(userData),
        });
        
        return data;
      } catch (error) {
        logAuth("Ошибка регистрации", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      logAuth("Успешная регистрация", data);
      
      if (data && data.user) {
        // Обновляем глобальное состояние
        globalAuthState.user = data.user;
        globalAuthState.isAuthenticated = true;
        globalAuthState.sessionChecked = true;
        
        // Обновляем кэш запросов
        queryClient.setQueryData(["/api/auth/user"], { user: data.user });
        setUserState(data.user);
        
        // Уведомляем пользователя
        toast({
          title: "Регистрация выполнена",
          description: "Аккаунт успешно создан!",
          variant: "success"
        });
        
        // Запускаем проверку данных пользователя через 1 секунду
        setTimeout(() => {
          logAuth("Запланированная проверка данных после регистрации");
          refetchUserData();
        }, 1000);
      } else {
        logAuth("Ответ на регистрацию не содержит данных пользователя", data);
        toast({
          title: "Ошибка регистрации",
          description: "Регистрация выполнена, но не удалось получить данные пользователя",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      logAuth("Ошибка при регистрации", error);
      toast({
        title: "Ошибка регистрации",
        description: error.message || "Не удалось создать аккаунт",
        variant: "destructive"
      });
    }
  });

  // Выход из системы
  const logoutMutation = useMutation({
    mutationFn: async () => {
      logAuth("Выход из системы");
      
      try {
        await directApiRequest("/api/auth/logout", {
          method: "POST"
        });
        
        // Сбрасываем состояние пользователя независимо от результата запроса
        localStorage.removeItem("isAdmin");
        adminStateRef.current = false;
        
        // Очищаем глобальное состояние
        globalAuthState.user = null;
        globalAuthState.isAuthenticated = false;
        globalAuthState.isAdmin = false;
        
        // Очищаем кэш запросов
        queryClient.setQueryData(["/api/auth/user"], null);
        setUserState(null);
        
        return true;
      } catch (error) {
        logAuth("Ошибка при выходе из системы", error);
        // Все равно сбрасываем состояние пользователя
        localStorage.removeItem("isAdmin");
        adminStateRef.current = false;
        globalAuthState.user = null;
        globalAuthState.isAuthenticated = false;
        globalAuthState.isAdmin = false;
        queryClient.setQueryData(["/api/auth/user"], null);
        setUserState(null);
        
        throw error;
      }
    },
    onSuccess: () => {
      logAuth("Успешный выход из системы");
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы",
        variant: "success"
      });
    },
    onError: (error: Error) => {
      logAuth("Ошибка при выходе", error);
      toast({
        title: "Ошибка выхода",
        description: "Не удалось корректно выйти из системы, но сессия сброшена",
        variant: "default"
      });
    }
  });

  // Функция для обновления данных пользователя (явное обновление)
  const refreshUser = async (): Promise<any> => {
    logAuth("Запрос на обновление данных пользователя");
    try {
      // Прямой запрос к API
      const data = await directApiRequest("/api/auth/user");
      
      if (data && data.user) {
        logAuth("Успешное обновление данных пользователя", data.user);
        // Обновляем глобальное состояние
        globalAuthState.user = data.user;
        globalAuthState.isAuthenticated = true;
        
        if (data.user.isAdmin) {
          adminStateRef.current = true;
          localStorage.setItem("isAdmin", "true");
          globalAuthState.isAdmin = true;
        }
        
        // Обновляем кэш запросов
        queryClient.setQueryData(["/api/auth/user"], { user: data.user });
        setUserState(data.user);
        
        return data.user;
      } else {
        logAuth("Ответ на обновление не содержит данных пользователя");
        return userState;
      }
    } catch (error) {
      logAuth("Ошибка при обновлении данных пользователя", error);
      return userState;
    }
  };

  // Обработчик для отслеживания навигации и сохранения сессии
  useEffect(() => {
    const handleBeforeUnload = () => {
      logAuth("Сохранение состояния перед перезагрузкой страницы");
      persistAuthState.save();
    };
    
    // Восстанавливаем состояние при загрузке
    const restored = persistAuthState.restore();
    logAuth("Попытка восстановления состояния авторизации", { success: restored });
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Проверяем сессию регулярно
  useEffect(() => {
    const interval = setInterval(() => {
      if (globalAuthState.isAuthenticated) {
        logAuth("Выполняем регулярную проверку сессии");
        refreshUser().catch((error) => {
          logAuth("Ошибка при регулярной проверке сессии", error);
        });
      }
    }, 60000); // Проверяем каждую минуту
    
    return () => clearInterval(interval);
  }, []);

  // Проверяем сессию при фокусе окна
  useEffect(() => {
    const handleFocus = () => {
      if (globalAuthState.isAuthenticated) {
        logAuth("Проверка сессии при фокусе окна");
        refreshUser().catch((error) => {
          logAuth("Ошибка при проверке сессии при фокусе", error);
        });
      }
    };
    
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Значение контекста
  const contextValue: AuthContextType = {
    user: userState,
    isLoading: isLoading && !authChecked,
    error,
    isAdmin: userState?.isAdmin || adminStateRef.current,
    isAuthenticated: !!userState,
    loginMutation,
    registerMutation,
    logoutMutation,
    refreshUserData: refreshUser,
    setUser: (user: User) => {
      logAuth("Установка пользователя вручную", user);
      setUserState(user);
      queryClient.setQueryData(["/api/auth/user"], { user });
      globalAuthState.user = user;
      globalAuthState.isAuthenticated = true;
      if (user.isAdmin) {
        adminStateRef.current = true;
        localStorage.setItem("isAdmin", "true");
        globalAuthState.isAdmin = true;
      }
    }
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Хук для использования контекста авторизации
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    console.error(`${LOG_PREFIX} useAuth должен использоваться внутри AuthProvider`);
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  
  return context;
};
