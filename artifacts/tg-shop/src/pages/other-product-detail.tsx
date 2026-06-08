import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTelegramUser } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";
import { Copy, ArrowLeft, Star, Shield } from "lucide-react";
import { getSocialNetwork, getSocialIconSvg } from "@/lib/social-networks";
import { Confetti } from "@/components/confetti";

interface OtherProduct {
  id: number;
  socialNetwork: string;
  login: string | null;
  password: string | null;
  email: string | null;
  emailPassword: string | null;
  description: string | null;
  deliveryDescription: string | null;
  price: number;
  isFree: string;
  status: string;
}

export default function OtherProductDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = getTelegramUser();
  const productId = Number(id);

  const [product, setProduct] = useState<OtherProduct | null>(null);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuying, setIsBuying] = useState(false);
  const [purchased, setPurchased] = useState<OtherProduct | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    fetch(`/api/other-products/${productId}`)
      .then(r => r.json())
      .then(data => { setProduct(data); setIsLoading(false); });
    if (user) {
      fetch(`/api/balance/${user.id}`)
        .then(r => r.json())
        .then(data => setBalance(data.balance ?? 0));
    }
  }, [productId, user]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано", description: `${label} скопирован` });
  };

  const handleBuy = async () => {
    if (!user) { toast({ title: "Ошибка", description: "Откройте в Telegram", variant: "destructive" }); return; }
    if (!product) return;
    const isFree = product.isFree === "true" || product.price === 0;
    if (!isFree && balance < product.price) {
      toast({ title: "Недостаточно Stars", description: `Нужно: ${product.price}, у вас: ${balance}`, variant: "destructive" });
      return;
    }
    setIsBuying(true);
    const res = await fetch(`/api/other-products/${product.id}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramUserId: String(user.id), telegramUsername: user.username }),
    });
    const data = await res.json();
    if (data.success) {
      if (!isFree) setBalance(b => b - product.price);
      setPurchased(data.product);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      toast({ title: "Успех!", description: isFree ? "Товар получен!" : "Товар куплен!" });
    } else {
      toast({ title: "Ошибка", description: data.error ?? "Не удалось купить", variant: "destructive" });
    }
    setIsBuying(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!product) {
    return <div className="p-4 text-center text-muted-foreground">Товар не найден.</div>;
  }

  const sn = getSocialNetwork(product.socialNetwork);
  const svgIcon = getSocialIconSvg(product.socialNetwork);
  const isFree = product.isFree === "true" || product.price === 0;

  // After purchase view
  if (purchased) {
    return (
      <>
        <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground">
          <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
            <div className="flex h-14 items-center px-4 gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 active:scale-90 transition-transform duration-100" onClick={() => setLocation("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <span className="font-semibold text-lg">Данные товара</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: sn.bgColor }}
                dangerouslySetInnerHTML={{ __html: `<div style="width:26px;height:26px">${svgIcon}</div>` }}
              />
              <div>
                <div className="font-semibold">{sn.name}</div>
                <div className="text-xs text-green-400">Покупка успешна ✓</div>
              </div>
            </div>

            {purchased.description && (
              <Card className="p-4 bg-card/80 border-border/40">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Описание товара</div>
                <p className="text-sm">{purchased.description}</p>
              </Card>
            )}

            {(purchased.login || purchased.password || purchased.email || purchased.emailPassword) && (
              <Card className="p-4 space-y-3 bg-card/80 border-border/40">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Данные для входа</div>
                {purchased.login && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Логин:</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-sm font-mono">{purchased.login}</div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(purchased.login!, "Логин")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {purchased.password && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Пароль:</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-sm font-mono">{purchased.password}</div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(purchased.password!, "Пароль")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {purchased.email && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Почта:</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-sm font-mono">{purchased.email}</div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(purchased.email!, "Почта")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {purchased.emailPassword && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Пароль от почты:</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-sm font-mono">{purchased.emailPassword}</div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(purchased.emailPassword!, "Пароль от почты")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {purchased.deliveryDescription && (
              <Card className="p-4 bg-card/80 border-border/40">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Инструкции</div>
                <p className="text-sm whitespace-pre-wrap">{purchased.deliveryDescription}</p>
              </Card>
            )}
          </main>
        </div>
        <Confetti active={showConfetti} />
      </>
    );
  }

  // Pre-purchase view
  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground pb-24">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 active:scale-90 transition-transform duration-100" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-lg">Товар</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: sn.bgColor, boxShadow: `0 4px 16px ${sn.bgColor}55` }}
            dangerouslySetInnerHTML={{ __html: `<div style="width:30px;height:30px">${svgIcon}</div>` }}
          />
          <div>
            <h1 className="text-xl font-bold">{sn.name}</h1>
            <div className="text-base font-medium mt-0.5">
              {isFree ? (
                <span className="text-green-400">Бесплатно</span>
              ) : (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  {product.price} Stars
                </span>
              )}
            </div>
          </div>
        </div>

        {product.description && (
          <Card className="p-4 bg-card/80 border-border/40">
            <h3 className="text-sm font-semibold mb-2">Описание</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
          </Card>
        )}

        {!isFree && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-3">
            <Shield className="w-5 h-5 text-yellow-400" />
            <span className="text-sm">Ваш баланс: <strong>{balance} Stars</strong></span>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border/50 z-10">
        <Button
          className="w-full h-12 text-base font-semibold active:scale-95 transition-transform duration-100"
          onClick={handleBuy}
          disabled={isBuying || product.status !== "available"}
        >
          {isBuying ? "Обработка..." : isFree ? "Получить бесплатно" : product.status === "available" ? "Купить за Stars" : "Недоступен"}
        </Button>
      </div>
    </div>
  );
}
