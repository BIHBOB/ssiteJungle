import { useQuery } from "@tanstack/react-query";
import { Review } from "@shared/schema";
import { User, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ExternalLink from "@/components/ExternalLink";

function Testimonials() {
  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews?approved=true"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    }
  });
  
  const formatDate = (dateString: Date | string) => {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };
  
  // Generate stars for rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex text-secondary">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            className={`h-4 w-4 ${index < rating ? 'fill-current' : ''}`}
          />
        ))}
      </div>
    );
  };
  
  // Show only the most recent 3 reviews
  const displayedReviews = reviews.slice(0, 3);
  
  return (
    <section className="py-8 md:py-16">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="heading font-montserrat font-bold text-2xl md:text-3xl">
            Отзывы наших клиентов
          </h2>
          <ExternalLink 
            href="https://t.me/junglefeedback" 
            className="text-primary hover:underline hidden md:block"
          >
            Все отзывы
          </ExternalLink>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Skeleton loader
            [...Array(3)].map((_, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                  <Skeleton className="w-12 h-12 rounded-full mr-3" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-3" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))
          ) : displayedReviews.length > 0 ? (
            // Display actual reviews
            displayedReviews.map((review) => (
              <div key={review.id} className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3">
                    {review.images && review.images.length > 0 ? (
                      <img src={review.images[0]} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-montserrat font-semibold">
                      Пользователь #{review.userId}
                    </h4>
                    {renderStars(review.rating)}
                  </div>
                </div>
                <p className="text-gray-700 mb-3">{review.text}</p>
                <span className="text-gray-500 text-sm">{review.createdAt ? formatDate(review.createdAt) : 'Недавно'}</span>
              </div>
            ))
          ) : (
            // No reviews yet
            <div className="col-span-1 md:col-span-3 text-center py-8">
              <p className="text-gray-500">
                Пока нет отзывов. Будьте первым, кто оставит отзыв о нашем магазине!
              </p>
            </div>
          )}
          
          {/* Fallback reviews for demo */}
          {!isLoading && displayedReviews.length === 0 && (
            <>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3">
                    <User className="h-6 w-6 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-montserrat font-semibold">Анна К.</h4>
                    <div className="flex text-secondary">
                      {[...Array(5)].map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 mb-3">Заказывала монстеру, пришла в идеальном состоянии! Очень красивое и здоровое растение, буду заказывать ещё. Отдельное спасибо за подробную инструкцию по уходу.</p>
                <span className="text-gray-500 text-sm">12 марта 2023</span>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3">
                    <User className="h-6 w-6 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-montserrat font-semibold">Дмитрий В.</h4>
                    <div className="flex text-secondary">
                      {[...Array(5)].map((_, index) => (
                        <Star key={index} className={`h-4 w-4 ${index < 4 ? 'fill-current' : ''}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 mb-3">Быстрая доставка и качественная упаковка. Растение перенесло дорогу отлично! Филодендрон даже больше, чем я ожидал. Очень доволен покупкой.</p>
                <span className="text-gray-500 text-sm">27 февраля 2023</span>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3">
                    <User className="h-6 w-6 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-montserrat font-semibold">Екатерина М.</h4>
                    <div className="flex text-secondary">
                      {[...Array(5)].map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 mb-3">Третий раз заказываю в Jungle Plants и всегда остаюсь довольна! В этот раз взяла фикус и калатею - оба пришли в отличном состоянии. Спасибо за качественные растения!</p>
                <span className="text-gray-500 text-sm">5 февраля 2023</span>
              </div>
            </>
          )}
        </div>
        
        <div className="text-center mt-6 md:hidden">
          <ExternalLink 
            href="https://t.me/junglefeedback" 
            className="text-primary hover:underline"
          >
            Все отзывы
          </ExternalLink>
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
