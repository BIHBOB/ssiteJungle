import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ShoppingCart, AlertTriangle, ChevronRight, X } from "lucide-react";
import CartItem from "@/components/CartItem";
import PromoCodeInput from "@/components/cart/PromoCodeInput";
import { Product } from "@shared/schema";
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

// Cart item type
type CartItem = {
  id: number;
  name: string;
  image: string;
  price: string | number;
  quantity: number;
};

export default function CartPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [waitlistItems, setWaitlistItems] = useState<CartItem[]>([]);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [promoCodeDiscount, setPromoCodeDiscount] = useState(0);
  
  // Get cart items from localStorage
  const { data: cartItems = [], refetch: refetchCart } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    queryFn: () => {
      const storedCart = localStorage.getItem("cart");
      return storedCart ? JSON.parse(storedCart) : [];
    },
  });
  
  // Get full product details for each cart item
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    }
  });
  
  // Новая функция расчёта доставки для корзины (по умолчанию Почта России)
  const calculateDeliveryCost = () => {
    if (cartItems.length === 0 || products.length === 0) return 0;
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
    if (cartItems.length > 3) {
      return "Сумма доставки: максимальная стоимость среди всех растений + 200₽ за каждую единицу товара начиная с 4-й.";
    }
    return "Сумма доставки равна максимальной стоимости доставки среди всех растений в заказе.";
  };
  
  // Calculate subtotal (items cost)
  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      return total + (price * item.quantity);
    }, 0);
  };
  
  // Calculate total (subtotal + delivery - promo code discount)
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const deliveryCost = calculateDeliveryCost();
    
    // Apply discount only to subtotal
    const discountedSubtotal = subtotal - promoCodeDiscount;
    const finalSubtotal = Math.max(0, discountedSubtotal); // Ensure subtotal doesn't go below zero

    return finalSubtotal + deliveryCost;
  };
  
  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };
  
  // Check availability and populate waitlist items
  useEffect(() => {
    if (products.length === 0 || cartItems.length === 0) return;
    
    const unavailable: CartItem[] = [];
    
    cartItems.forEach(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) return;
      
      // Product is not available or quantity in cart > available quantity
      if (!product.isAvailable || product.quantity < item.quantity) {
        const availableQty = product.isAvailable ? product.quantity : 0;
        const waitlistQty = item.quantity - availableQty;
        
        if (waitlistQty > 0) {
          unavailable.push({
            ...item,
            quantity: waitlistQty
          });
        }
      }
    });
    
    setWaitlistItems(unavailable);
  }, [products, cartItems]);
  
  // Update item quantity
  const updateItemQuantity = (id: number, quantity: number) => {
    if (quantity < 1) return removeItem(id);
    
    const cartJson = localStorage.getItem("cart") || "[]";
    let cart = JSON.parse(cartJson);
    
    const updatedCart = cart.map((item: CartItem) => 
      item.id === id ? { ...item, quantity } : item
    );
    
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    queryClient.setQueryData(["/api/cart"], updatedCart);
    refetchCart();
  };
  
  // Remove item from cart
  const removeItem = (id: number) => {
    const cartJson = localStorage.getItem("cart") || "[]";
    let cart = JSON.parse(cartJson);
    
    const updatedCart = cart.filter((item: CartItem) => item.id !== id);
    
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    queryClient.setQueryData(["/api/cart"], updatedCart);
    refetchCart();
    
    toast({
      title: "Товар удален",
      description: "Товар удален из корзины",
    });
  };
  
  // Clear cart
  const clearCart = () => {
    localStorage.setItem("cart", "[]");
    queryClient.setQueryData(["/api/cart"], []);
    refetchCart();
    
    toast({
      title: "Корзина очищена",
      description: "Все товары удалены из корзины",
    });
  };
  
  // Proceed to checkout
  const proceedToCheckout = () => {
    if (cartItems.length === 0) {
      toast({
        title: "Корзина пуста",
        description: "Добавьте товары в корзину перед оформлением заказа",
        variant: "destructive"
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Пожалуйста, войдите в аккаунт для оформления заказа",
        variant: "destructive"
      });
      setLocation("/auth");
      return;
    }
    
    setLocation("/checkout");
  };
  
  // Check if we have unavailable items
  const hasUnavailable = waitlistItems.length > 0;
  
  // Function to apply promo code (assuming it exists in this file or a related component)
  const applyPromoCode = async (code: string) => {
    // Assuming a mutation or API call to apply promo code
    // After successful application:
    queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
    // You might also need to refetch cart data if the discount is applied to the cart before checkout
    refetchCart(); 
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="heading font-montserrat font-bold text-2xl md:text-3xl mb-6">Корзина</h1>
      
      {cartItems.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-montserrat font-semibold text-lg">Товары в корзине</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-500 hover:text-error"
                  onClick={clearCart}
                >
                  <X className="h-4 w-4 mr-1" />
                  Очистить
                </Button>
              </div>
              
              <div className="divide-y">
                {cartItems.map((item) => {
                  const product = products.find(p => p.id === item.id);
                  const isAvailable = product?.isAvailable ?? false;
                  const availableQuantity = product?.quantity || 0;
                  const isLimited = isAvailable && availableQuantity < item.quantity;
                  
                  return (
                    <CartItem
                      key={item.id}
                      item={item}
                      isAvailable={isAvailable}
                      availableQuantity={availableQuantity}
                      isLimited={isLimited}
                      onUpdateQuantity={updateItemQuantity}
                      onRemove={removeItem}
                    />
                  );
                })}
              </div>
              
              {hasUnavailable && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-md border border-yellow-200">
                  <div className="flex gap-2 text-yellow-800">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Товары с ограниченной доступностью</p>
                      <p className="text-xs mt-1">
                        Некоторые товары в вашей корзине недоступны или имеют ограниченное количество.
                        Они будут добавлены в {" "}
                        <button 
                          className="underline font-medium" 
                          onClick={() => setWaitlistOpen(true)}
                        >
                          лист ожидания
                        </button>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
              <h2 className="font-montserrat font-semibold text-lg mb-4">Сумма заказа</h2>
              
              <div className="space-y-3 mb-6">
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
                {promoCodeDiscount > 0 && (
                  <div className="flex justify-between text-success-foreground font-medium mt-2">
                    <span>Скидка по промокоду:</span>
                    <span>-{formatPrice(promoCodeDiscount)} ₽</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Итого:</span>
                  <span className="text-primary">{formatPrice(calculateTotal())} ₽</span>
                </div>
              </div>
              
              <div className="mb-6">
                <PromoCodeInput
                  itemsTotal={calculateSubtotal()}
                  onPromoCodeApplied={setPromoCodeDiscount}
                />
              </div>
              
              <Button 
                className="w-full bg-secondary hover:bg-yellow-500 text-white"
                onClick={proceedToCheckout}
              >
                Оформить заказ
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              
              <p className="text-xs text-gray-500 mt-4 text-center">
                Нажимая "Оформить заказ", вы соглашаетесь с условиями доставки и оплаты
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="heading font-montserrat font-semibold text-xl mb-2">Ваша корзина пуста</h2>
          <p className="text-gray-600 mb-6">Добавьте что-нибудь из нашего каталога</p>
          <Button 
            className="bg-primary hover:bg-green-700 text-white"
            onClick={() => setLocation("/catalog")}
          >
            Перейти в каталог
          </Button>
        </div>
      )}
      
      {/* Waitlist Sheet */}
      <Sheet open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Лист ожидания</SheetTitle>
            <SheetDescription>
              Эти товары будут добавлены в лист ожидания
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            {waitlistItems.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="h-16 w-16 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow">
                  <Link href={`/product/${item.id}`} className="font-medium hover:text-primary">
                    {item.name}
                  </Link>
                  <div className="text-sm text-gray-500 mt-1">Количество: {item.quantity}</div>
                  <div className="text-error text-sm mt-1">Нет в наличии</div>
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-sm text-gray-600 mt-6">
            Вы получите уведомление, когда товары снова появятся в наличии.
            Для этого необходимо быть авторизованным пользователем.
          </p>
          
          <SheetFooter className="mt-6">
            <SheetClose asChild>
              <Button variant="outline">Закрыть</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
