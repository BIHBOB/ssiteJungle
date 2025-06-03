import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface PromoCodeInputProps {
  itemsTotal: number;
  onPromoCodeApplied: (discount: number) => void;
}

export default function PromoCodeInput({ itemsTotal, onPromoCodeApplied }: PromoCodeInputProps) {
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem('appliedPromoCode');
    return stored ? JSON.parse(stored).code : null;
  });
  const { toast } = useToast();

  const handleApply = async () => {
    if (!promoCode.trim()) {
      toast({
        title: 'Введите промокод',
        description: 'Пожалуйста, введите код промокода',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest(
        'POST',
        '/api/promo-codes/validate',
        {
          code: promoCode.trim(),
          cartTotal: itemsTotal
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка при применении промокода');
      }

      const data = await response.json();
      onPromoCodeApplied(data.discount);
      setAppliedCode(promoCode.trim());
      setPromoCode('');

      // Store promo code info in localStorage
      localStorage.setItem('appliedPromoCode', JSON.stringify({
        code: promoCode.trim(),
        discount: data.discount,
        discountType: data.discountType,
        discountValue: data.discountValue
      }));

      toast({
        title: 'Промокод применен',
        description: `Скидка ${data.discount} ₽ успешно применена`,
        variant: 'success'
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось применить промокод',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    onPromoCodeApplied(0);
    setAppliedCode(null);
    setPromoCode('');
    // Remove promo code from localStorage
    localStorage.removeItem('appliedPromoCode');
  };

  return (
    <div className="space-y-2">
      {appliedCode ? (
        <div className="flex items-center justify-between bg-green-50 text-green-700 px-3 py-2 rounded-md">
          <span className="text-sm font-medium">
            Промокод {appliedCode} применен
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-green-100"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Введите промокод"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={handleApply}
            disabled={isLoading || !promoCode.trim()}
            className="whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Применение...
              </>
            ) : (
              'Применить'
            )}
          </Button>
        </div>
      )}
    </div>
  );
} 