import Hero from "@/components/Hero";
import CategoryFilter from "@/components/CategoryFilter";
import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import ProductCard from "@/components/ProductCard";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import FaqAccordion from "@/components/FaqAccordion";
import Newsletter from "@/components/Newsletter";
import { Loader2 } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;
  
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
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
  
  return (
    <>
      <Hero />
      <CategoryFilter />
      
      {/* Product Catalog */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
                {paginatedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
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
                      
                      {[...Array(totalPages)].map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink
                            onClick={() => setPage(i + 1)}
                            isActive={page === i + 1}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
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
          )}
        </div>
      </section>
      
      <Features />
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="heading font-montserrat font-semibold text-xl mb-4">Наши отзывы в Telegram</h2>
        <p className="mb-6">Прочитайте, что говорят о нас наши клиенты</p>
        <Button asChild variant="outline" size="lg">
          <a href="https://t.me/junglefeedback" target="_blank" rel="noreferrer">
            Перейти к отзывам в Telegram
          </a>
        </Button>
      </div>
      <FaqAccordion />
      <Newsletter />
    </>
  );
}
