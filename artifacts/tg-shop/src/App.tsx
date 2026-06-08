import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Catalog from "@/pages/catalog";
import AccountDetail from "@/pages/account-detail";
import OtherProductDetail from "@/pages/other-product-detail";
import Orders from "@/pages/orders";
import News from "@/pages/news";
import Profile from "@/pages/profile";
import FaqPage from "@/pages/faq";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/" component={Catalog} />
            <Route path="/account/:id" component={AccountDetail} />
            <Route path="/other/:id" component={OtherProductDetail} />
            <Route path="/orders" component={Orders} />
            <Route path="/news" component={News} />
            <Route path="/profile" component={Profile} />
            <Route path="/faq" component={FaqPage} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
