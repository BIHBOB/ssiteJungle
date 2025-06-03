import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterParams = {
  category?: string;
  available?: boolean;
  preorder?: boolean;
  rare?: boolean;
  easy?: boolean;
  discount?: boolean;
  minPrice?: number;
  maxPrice?: number;
};

function CategoryFilter() {
  const [location, setLocation] = useLocation();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([500, 5000]);
  const [minPriceInput, setMinPriceInput] = useState("500");
  const [maxPriceInput, setMaxPriceInput] = useState("5000");
  
  // Parse current URL params
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const currentCategory = searchParams.get("category") || "";
  const available = searchParams.get("available") === "true";
  const preorder = searchParams.get("preorder") === "true";
  const rare = searchParams.get("rare") === "true";
  const easy = searchParams.get("easy") === "true";
  const discount = searchParams.get("discount") === "true";
  
  const toggleMobileFilters = () => {
    setShowMobileFilters(!showMobileFilters);
  };
  
  const applyFilter = (newParams: FilterParams) => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    
    // Update or remove parameters
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === undefined || value === false) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    
    // Construct new URL
    const newUrl = `/catalog${params.toString() ? `?${params.toString()}` : ""}`;
    setLocation(newUrl);
    
    // Close mobile filters
    setShowMobileFilters(false);
  };
  
  const handleCategoryClick = (category: string | undefined) => {
    applyFilter({ category });
  };
  
  const handleToggleFilter = (filter: keyof FilterParams) => {
    const currentValue = searchParams.get(filter) === "true";
    applyFilter({ [filter]: !currentValue });
  };
  
  const handlePriceChange = (value: number[]) => {
    setPriceRange([value[0], value[1]]);
    setMinPriceInput(value[0].toString());
    setMaxPriceInput(value[1].toString());
  };
  
  const handlePriceInputChange = (min: string, max: string) => {
    const minValue = parseInt(min) || 0;
    const maxValue = parseInt(max) || 10000;
    
    setMinPriceInput(min);
    setMaxPriceInput(max);
    
    if (minValue >= 0 && maxValue > minValue) {
      setPriceRange([minValue, maxValue]);
    }
  };
  
  const applyPriceFilter = () => {
    applyFilter({ minPrice: priceRange[0], maxPrice: priceRange[1] });
  };
  
  return (
    <section className="bg-neutral-medium py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading font-montserrat font-semibold text-xl">Каталог растений</h2>
          <button
            className="lg:hidden flex items-center text-neutral-dark"
            onClick={toggleMobileFilters}
          >
            <Filter className="h-5 w-5 mr-1" />
            <span>Фильтры</span>
          </button>
        </div>
        
        <div className="hidden lg:flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-2">
          <Button
            variant={!currentCategory ? "default" : "outline"}
            className={!currentCategory ? "bg-primary text-white" : ""}
            onClick={() => handleCategoryClick(undefined)}
          >
            Все растения
          </Button>
          <Button
            variant={available ? "default" : "outline"}
            className={available ? "bg-primary text-white" : ""}
            onClick={() => handleToggleFilter("available")}
          >
            В наличии
          </Button>
          <Button
            variant={preorder ? "default" : "outline"}
            className={preorder ? "bg-primary text-white" : ""}
            onClick={() => handleToggleFilter("preorder")}
          >
            Предзаказ
          </Button>
          <Button
            variant={rare ? "default" : "outline"}
            className={rare ? "bg-primary text-white" : ""}
            onClick={() => handleToggleFilter("rare")}
          >
            Редкие виды
          </Button>
          <Button
            variant={easy ? "default" : "outline"}
            className={easy ? "bg-primary text-white" : ""}
            onClick={() => handleToggleFilter("easy")}
          >
            Простой уход
          </Button>
          <Button
            variant={discount ? "default" : "outline"}
            className={discount ? "bg-primary text-white" : ""}
            onClick={() => handleToggleFilter("discount")}
          >
            Со скидкой
          </Button>
        </div>
        
        {/* Mobile Filters */}
        {showMobileFilters && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-2xl shadow-lg animate-slideUp">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Фильтры</h3>
                  <button 
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors" 
                    onClick={() => setShowMobileFilters(false)}
                    aria-label="Закрыть фильтры"
                  >
                    <X className="h-5 w-5 text-gray-600" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Категории</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={!currentCategory ? "default" : "outline"}
                        className={cn(
                          "w-full justify-start text-sm transition-all duration-200",
                          !currentCategory 
                            ? "bg-primary text-white hover:bg-primary/90" 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => handleCategoryClick(undefined)}
                      >
                        Все растения
                      </Button>
                      {/* Add categories here */}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Фильтры</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={available ? "default" : "outline"}
                        className={cn(
                          "w-full justify-start text-sm transition-all duration-200",
                          available 
                            ? "bg-primary text-white hover:bg-primary/90" 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => handleToggleFilter("available")}
                      >
                        В наличии
                      </Button>
                      <Button
                        variant={preorder ? "default" : "outline"}
                        className={cn(
                          "w-full justify-start text-sm transition-all duration-200",
                          preorder 
                            ? "bg-primary text-white hover:bg-primary/90" 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => handleToggleFilter("preorder")}
                      >
                        Предзаказ
                      </Button>
                      <Button
                        variant={rare ? "default" : "outline"}
                        className={cn(
                          "w-full justify-start text-sm transition-all duration-200",
                          rare 
                            ? "bg-primary text-white hover:bg-primary/90" 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => handleToggleFilter("rare")}
                      >
                        Редкие виды
                      </Button>
                      <Button
                        variant={easy ? "default" : "outline"}
                        className={cn(
                          "w-full justify-start text-sm transition-all duration-200",
                          easy 
                            ? "bg-primary text-white hover:bg-primary/90" 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => handleToggleFilter("easy")}
                      >
                        Простой уход
                      </Button>
                      <Button
                        variant={discount ? "default" : "outline"}
                        className={cn(
                          "w-full justify-start text-sm transition-all duration-200",
                          discount 
                            ? "bg-primary text-white hover:bg-primary/90" 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => handleToggleFilter("discount")}
                      >
                        Со скидкой
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={() => {
                      setShowMobileFilters(false);
                      applyPriceFilter();
                    }}
                  >
                    Применить фильтры
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default CategoryFilter;
