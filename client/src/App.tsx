import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/lib/protected-route";
import ScrollToTop from "@/components/ScrollToTop";

// Pages
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import CatalogPage from "@/pages/catalog-page";
import ProductPage from "@/pages/product-page";
import CartPage from "@/pages/cart-page";
import CheckoutPage from "@/pages/checkout-page";
import ProfilePage from "@/pages/profile-page";
import AdminPage from "@/pages/admin-page";
import FaqPage from "@/pages/faq-page";

// Components
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileNavbar from "@/components/MobileNavbar";

function Router() {
  return (
    <div className="flex flex-col min-h-screen pb-16 md:pb-0">
      <Header />
      <ScrollToTop />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/catalog" component={CatalogPage} />
          <Route path="/product/:id" component={ProductPage} />
          <Route path="/cart" component={CartPage} />
          <ProtectedRoute path="/checkout" component={CheckoutPage} />
          <ProtectedRoute path="/profile" component={ProfilePage} />
          <ProtectedRoute path="/admin" component={AdminPage} />
          <Route path="/faq" component={FaqPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
      <MobileNavbar />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
