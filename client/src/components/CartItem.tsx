import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MinusCircle, PlusCircle, AlertTriangle, Trash2 } from "lucide-react";

interface CartItemProps {
  item: {
    id: number;
    name: string;
    image: string;
    price: string | number;
    quantity: number;
  };
  isAvailable?: boolean;
  availableQuantity?: number;
  isLimited?: boolean;
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemove: (id: number) => void;
}

export default function CartItem({
  item,
  isAvailable = true,
  availableQuantity = 0,
  isLimited = false,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  const { id, name, image, price, quantity } = item;
  const [isHovering, setIsHovering] = useState(false);
  
  // Format price
  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('ru-RU').format(typeof price === 'string' ? parseFloat(price) : price);
  };
  
  // Calculate item total
  const calculateTotal = () => {
    const priceValue = typeof price === 'string' ? parseFloat(price) : price;
    return priceValue * quantity;
  };
  
  // Increment quantity
  const incrementQuantity = () => {
    if (isAvailable && (!isLimited || quantity < availableQuantity)) {
      onUpdateQuantity(id, quantity + 1);
    }
  };
  
  // Decrement quantity
  const decrementQuantity = () => {
    if (quantity > 1) {
      onUpdateQuantity(id, quantity - 1);
    } else {
      onRemove(id);
    }
  };
  
  return (
    <div 
      className="py-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Product Image */}
      <div className="h-20 w-20 rounded overflow-hidden flex-shrink-0">
        <Link href={`/product/${id}`}>
          <img 
            src={image} 
            alt={name} 
            className={`w-full h-full object-cover transition-opacity ${!isAvailable ? 'opacity-70' : ''}`} 
          />
        </Link>
      </div>
      
      {/* Product Details */}
      <div className="flex-grow">
        <Link href={`/product/${id}`} className="font-medium hover:text-primary transition-colors">
          {name}
        </Link>
        
        {/* Availability Warning */}
        {!isAvailable && (
          <div className="flex items-center text-error text-sm mt-1">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            <span>Нет в наличии</span>
          </div>
        )}
        
        {isLimited && (
          <div className="flex items-center text-warning text-sm mt-1">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            <span>Доступно только: {availableQuantity} шт.</span>
          </div>
        )}
      </div>
      
      {/* Price */}
      <div className="text-primary font-medium">
        {formatPrice(price)} ₽
      </div>
      
      {/* Quantity Controls */}
      <div className="flex items-center">
        <button
          className="p-1 hover:text-primary disabled:opacity-50 disabled:pointer-events-none transition-colors"
          onClick={decrementQuantity}
          disabled={!isAvailable}
        >
          <MinusCircle className="h-5 w-5" />
        </button>
        <span className="mx-2 min-w-8 text-center">{quantity}</span>
        <button
          className="p-1 hover:text-primary disabled:opacity-50 disabled:pointer-events-none transition-colors"
          onClick={incrementQuantity}
          disabled={!isAvailable || (isLimited && quantity >= availableQuantity)}
        >
          <PlusCircle className="h-5 w-5" />
        </button>
      </div>
      
      {/* Total */}
      <div className="font-bold text-primary">
        {formatPrice(calculateTotal())} ₽
      </div>
      
      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className={`text-gray-400 hover:text-error transition-opacity ${isHovering ? 'opacity-100' : 'opacity-0 sm:opacity-100'}`}
        onClick={() => onRemove(id)}
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
}
