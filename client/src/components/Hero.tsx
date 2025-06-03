import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function Hero() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setLocation(`/catalog?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <section className="relative bg-primary text-white py-12 md:py-16 overflow-hidden">
      {/* Background image with opacity */}
      <div 
        className="absolute inset-0 opacity-20" 
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1545241047-6083a3684587?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      ></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl">
          <h1 className="heading font-montserrat font-bold text-3xl md:text-4xl lg:text-5xl mb-4">
            Превратите ваш дом в уютные джунгли
          </h1>
          <p className="text-lg md:text-xl opacity-90 mb-8">
            Доставляем редкие и экзотические растения прямо к вашей двери
          </p>
          
          <form onSubmit={handleSearch} className="relative max-w-xl">
            <Input
              type="text"
              placeholder="Поиск растений..."
              className="form-input w-full py-3 px-5 pr-12 rounded-lg border-none focus:ring-2 focus:ring-secondary text-neutral-dark"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button 
              type="submit"
              variant="ghost" 
              size="icon"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary"
            >
              <Search className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default Hero;
