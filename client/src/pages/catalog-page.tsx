import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Product } from "@shared/schema";
import ProductCard from "@/components/ProductCard";
import CategoryFilter from "@/components/CategoryFilter";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function CatalogPage() {
  const [location, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [minPriceInput, setMinPriceInput] = useState("0");
  const [maxPriceInput, setMaxPriceInput] = useState("10000");
  const itemsPerPage = 12;
  
  // Parse URL parameters
  const searchParams = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const category = searchParams.get("category") || "";
  const available = searchParams.get("available") === "true";
  const preorder = searchParams.get("preorder") === "true";
  const rare = searchParams.get("rare") === "true";
  const easy = searchParams.get("easy") === "true";
  const discount = searchParams.get("discount") === "true";
  const initialSearch = searchParams.get("search") || "";
  const minPrice = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!) : undefined;
  
  // Set initial search term
  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch);
    }
    if (minPrice !== undefined) {
      setMinPriceInput(minPrice.toString());
      setPriceRange(prev => [minPrice, prev[1]]);
    }
    if (maxPrice !== undefined) {
      setMaxPriceInput(maxPrice.toString());
      setPriceRange(prev => [prev[0], maxPrice]);
    }
  }, [initialSearch, minPrice, maxPrice]);
  
  // Build API query string
  const buildQueryString = () => {
    const params = new URLSearchParams();
    
    if (category) params.append("category", category);
    if (available) params.append("available", "true");
    if (preorder) params.append("preorder", "true");
    
    // Translate UI filters to API parameters
    if (rare) params.append("labels", "Редкие");
    if (easy) params.append("labels", "Простой уход");
    if (discount) params.append("labels", "Скидка");
    
    if (searchTerm) params.append("search", searchTerm);
    
    // Добавляем фильтрацию по цене
    if (priceRange[0] > 0) params.append("minPrice", priceRange[0].toString());
    if (priceRange[1] < 10000) params.append("maxPrice", priceRange[1].toString());
    
    return params.toString();
  };
  
  // Fetch products with filters
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: [`/api/products?${buildQueryString()}`],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    }
  });
  
  // Simple pagination calculation
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = products.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchTerm });
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
    // Обновляем URL и запускаем запрос с новыми параметрами цены
    updateUrlParams({ 
      minPrice: priceRange[0] > 0 ? priceRange[0].toString() : undefined, 
      maxPrice: priceRange[1] < 10000 ? priceRange[1].toString() : undefined 
    });
  };
  
  const updateUrlParams = (newParams: Record<string, string | undefined>) => {
    const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
    
    // Update or remove parameters
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === undefined) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    
    // Reset to page 1 when filters change
    setPage(1);
    
    // Construct new URL
    const newUrl = `/catalog${params.toString() ? `?${params.toString()}` : ""}`;
    setLocation(newUrl);
  };
  
  const handleFilterToggle = (filter: string) => {
    const currentValue = searchParams.get(filter) === "true";
    updateUrlParams({ [filter]: currentValue ? undefined : "true" });
  };
  
  return (
    <>
      <div className="bg-primary text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="heading font-montserrat font-bold text-2xl md:text-3xl">Каталог растений</h1>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="w-full md:w-auto">
            <div className="relative">
              <Input
                type="text"
                placeholder="Поиск растений..."
                className="form-input pr-10 w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button 
                type="submit"
                variant="ghost" 
                size="icon"
                className="absolute right-0 top-0 text-gray-500"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </form>
          
          {/* Mobile filters button */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <SlidersHorizontal className="h-5 w-5 mr-2" />
                  Фильтры
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="py-4">
                  <h3 className="font-montserrat font-semibold text-lg mb-4">Фильтры</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-2">Категории</h4>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Checkbox 
                            id="mobile-available" 
                            checked={available}
                            onCheckedChange={() => handleFilterToggle("available")}
                          />
                          <Label htmlFor="mobile-available" className="ml-2">В наличии</Label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox 
                            id="mobile-preorder" 
                            checked={preorder}
                            onCheckedChange={() => handleFilterToggle("preorder")}
                          />
                          <Label htmlFor="mobile-preorder" className="ml-2">Предзаказ</Label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox 
                            id="mobile-rare" 
                            checked={rare}
                            onCheckedChange={() => handleFilterToggle("rare")}
                          />
                          <Label htmlFor="mobile-rare" className="ml-2">Редкие виды</Label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox 
                            id="mobile-easy" 
                            checked={easy}
                            onCheckedChange={() => handleFilterToggle("easy")}
                          />
                          <Label htmlFor="mobile-easy" className="ml-2">Простой уход</Label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox 
                            id="mobile-discount" 
                            checked={discount}
                            onCheckedChange={() => handleFilterToggle("discount")}
                          />
                          <Label htmlFor="mobile-discount" className="ml-2">Со скидкой</Label>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Цена</h4>
                      <Slider
                        defaultValue={priceRange}
                        min={0}
                        max={10000}
                        step={100}
                        value={priceRange}
                        onValueChange={handlePriceChange}
                        className="mb-4"
                      />
                      <div className="flex items-center gap-2 mb-2">
                        <Input
                          type="text"
                          placeholder="От"
                          className="form-input"
                          value={minPriceInput}
                          onChange={(e) => handlePriceInputChange(e.target.value, maxPriceInput)}
                        />
                        <span>-</span>
                        <Input
                          type="text"
                          placeholder="До"
                          className="form-input"
                          value={maxPriceInput}
                          onChange={(e) => handlePriceInputChange(minPriceInput, e.target.value)}
                        />
                      </div>
                      <SheetClose asChild>
                        <Button onClick={applyPriceFilter} className="w-full">
                          Применить
                        </Button>
                      </SheetClose>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          {/* Desktop filters */}
          <div className="hidden md:flex items-center space-x-2">
            <Button
              variant={available ? "default" : "outline"}
              size="sm"
              className={available ? "bg-primary text-white" : ""}
              onClick={() => handleFilterToggle("available")}
            >
              В наличии
            </Button>
            <Button
              variant={preorder ? "default" : "outline"}
              size="sm"
              className={preorder ? "bg-primary text-white" : ""}
              onClick={() => handleFilterToggle("preorder")}
            >
              Предзаказ
            </Button>
            <Button
              variant={rare ? "default" : "outline"}
              size="sm"
              className={rare ? "bg-primary text-white" : ""}
              onClick={() => handleFilterToggle("rare")}
            >
              Редкие виды
            </Button>
            <Button
              variant={easy ? "default" : "outline"}
              size="sm"
              className={easy ? "bg-primary text-white" : ""}
              onClick={() => handleFilterToggle("easy")}
            >
              Простой уход
            </Button>
            <Button
              variant={discount ? "default" : "outline"}
              size="sm"
              className={discount ? "bg-primary text-white" : ""}
              onClick={() => handleFilterToggle("discount")}
            >
              Со скидкой
            </Button>
          </div>
        </div>
        
        {/* Desktop price filter */}
        <div className="hidden md:flex items-center space-x-4 mb-6">
          <span className="text-sm font-medium">Цена:</span>
          <div className="w-64">
            <Slider
              defaultValue={priceRange}
              min={0}
              max={10000}
              step={100}
              value={priceRange}
              onValueChange={handlePriceChange}
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="От"
              className="form-input w-20"
              value={minPriceInput}
              onChange={(e) => handlePriceInputChange(e.target.value, maxPriceInput)}
            />
            <span>-</span>
            <Input
              type="text"
              placeholder="До"
              className="form-input w-20"
              value={maxPriceInput}
              onChange={(e) => handlePriceInputChange(minPriceInput, e.target.value)}
            />
          </div>
          <Button onClick={applyPriceFilter} size="sm">
            Применить
          </Button>
        </div>
        
        {/* Result count */}
        <div className="mb-6">
          <p className="text-gray-600">
            {isLoading ? "Загрузка..." : `Найдено ${products.length} растений`}
          </p>
        </div>
        
        {/* Products */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 max-w-[1400px] mx-auto">
              {paginatedProducts.map((product) => (
                <div key={product.id} className="flex justify-center">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className={page === 1 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        aria-disabled={page === 1}
                      />
                    </PaginationItem>
                    
                    {/* Display limited page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Logic to show current page plus 2 before and after
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={i}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={page === pageNum}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    {/* Show ellipsis if needed */}
                    {totalPages > 5 && page < totalPages - 2 && (
                      <PaginationItem>
                        <span className="px-4">...</span>
                      </PaginationItem>
                    )}
                    
                    {/* Show last page if not visible */}
                    {totalPages > 5 && page < totalPages - 2 && (
                      <PaginationItem>
                        <PaginationLink
                          onClick={() => setPage(totalPages)}
                          isActive={page === totalPages}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className={page === totalPages ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        aria-disabled={page === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">По вашему запросу ничего не найдено</h3>
            <p className="text-gray-600 mb-4">Попробуйте изменить параметры поиска или фильтры</p>
            <Button 
              onClick={() => {
                setLocation("/catalog");
                setSearchTerm("");
                setPriceRange([0, 10000]);
                setMinPriceInput("0");
                setMaxPriceInput("10000");
              }}
              variant="outline"
            >
              Сбросить все фильтры
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
