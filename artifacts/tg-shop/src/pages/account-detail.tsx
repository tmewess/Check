import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { getTelegramUser } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, RotateCcw, Star, ArrowLeft, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { GetCodeModal } from "@/components/get-code-modal";
import { Confetti } from "@/components/confetti";

interface Account {
  id: number;
  phone: string | null;
  country: string;
  phonePrefix: string | null;
  dcId: string | null;
  userId: string | null;
  authKey: string | null;
  price: number;
  isFree: string;
  hasPremium: boolean;
  hasPassword: boolean;
  password: string | null;
  filePath: string | null;
  fileName: string | null;
  description: string | null;
  status: string;
  lolzItemId: string | null;
  sessionId: number | null;
  sessionData?: { phone: string | null; password: string | null; firstName: string | null } | null;
  spamBlock: string | null;
  origin: string | null;
  lastActivity: string | null;
  registrationDate: string | null;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "США": "🇺🇸", "Россия": "🇷🇺", "Украина": "🇺🇦", "Казахстан": "🇰🇿",
  "Беларусь": "🇧🇾", "Польша": "🇵🇱", "Германия": "🇩🇪", "Франция": "🇫🇷",
  "Италия": "🇮🇹", "Турция": "🇹🇷", "Индия": "🇮🇳", "Китай": "🇨🇳",
  "Япония": "🇯🇵", "Бразилия": "🇧🇷", "Аргентина": "🇦🇷",
  "Индонезия": "🇮🇩", "Пакистан": "🇵🇰", "Бангладеш": "🇧🇩",
  "Нигерия": "🇳🇬", "Великобритания": "🇬🇧", "Вьетнам": "🇻🇳",
  "Таиланд": "🇹🇭", "Филиппины": "🇵🇭", "Иран": "🇮🇷",
  "Узбекистан": "🇺🇿", "Азербайджан": "🇦🇿", "Армения": "🇦🇲",
  "Грузия": "🇬🇪", "Кыргызстан": "🇰🇬", "Таджикистан": "🇹🇯",
  "Молдова": "🇲🇩", "Литва": "🇱🇹", "Латвия": "🇱🇻",
  "Эстония": "🇪🇪", "Нидерланды": "🇳🇱", "Испания": "🇪🇸",
  "Португалия": "🇵🇹", "Греция": "🇬🇷", "Румыния": "🇷🇴",
  "Болгария": "🇧🇬", "Сербия": "🇷🇸", "Венгрия": "🇭🇺",
  "Чехия": "🇨🇿", "Словакия": "🇸🇰", "Австрия": "🇦🇹",
  "Швейцария": "🇨🇭", "Швеция": "🇸🇪", "Норвегия": "🇳🇴",
  "Финляндия": "🇫🇮", "Дания": "🇩🇰", "Канада": "🇨🇦",
  "Мексика": "🇲🇽", "Австралия": "🇦🇺", "Южная Корея": "🇰🇷",
  "Саудовская Аравия": "🇸🇦", "ОАЭ": "🇦🇪", "Египет": "🇪🇬",
  "Другая": "🌍",
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || "🌍";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-sm font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default function AccountDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = getTelegramUser();
  const accountId = Number(id);

  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuying, setIsBuying] = useState(false);
  const [order, setOrder] = useState<{ id: number; account: Account } | null>(null);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validResult, setValidResult] = useState<{ valid: boolean; spamBlock: string; hasPremium: boolean } | null>(null);

  const handleValidate = async () => {
    if (!account?.sessionId) return;
    setValidating(true);
    setValidResult(null);
    try {
      const res = await fetch(`/api/sessions/${account.sessionId}/check`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const spam = data.spamBlock ?? "Отсутствует";
        const hasSpam = spam !== "Отсутствует" && spam !== "0" && spam !== "none";
        setValidResult({ valid: !hasSpam, spamBlock: spam, hasPremium: data.hasPremium ?? account.hasPremium });
      } else {
        toast({ title: "Не удалось проверить", description: data.error ?? "Ошибка валидации", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Нет подключения", variant: "destructive" });
    }
    setValidating(false);
  };

  useEffect(() => {
    fetch(`/api/accounts/${accountId}`)
      .then((r) => r.json())
      .then((data) => {
        setAccount(data);
        setIsLoading(false);
      });
    if (user) {
      fetch(`/api/balance/${user.id}`)
        .then((r) => r.json())
        .then((data) => setBalance(data.balance ?? 0));
    }
  }, [accountId, user]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано", description: `${label} скопирован в буфер` });
  };

  const handleCopyAll = () => {
    if (!order?.account) return;
    const acc = order.account;
    const parts: string[] = [];
    if (acc.phone) parts.push(`Номер: ${acc.phone}`);
    if (acc.userId) parts.push(`ID: ${acc.userId}`);
    if (acc.dcId) parts.push(`DC: ${acc.dcId}`);
    if (acc.hasPassword && acc.password) parts.push(`Пароль 2FA: ${acc.password}`);
    if (acc.sessionData?.phone) parts.push(`Номер (бот): ${acc.sessionData.phone}`);
    if (acc.sessionData?.password) parts.push(`Пароль (бот): ${acc.sessionData.password}`);
    if (acc.authKey) parts.push(`Auth Key: ${acc.authKey}`);
    navigator.clipboard.writeText(parts.join("\n"));
    toast({ title: "Скопировано", description: "Все данные аккаунта" });
  };

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [modalStage, setModalStage] = useState<"checking" | "valid" | "invalid" | "buying">("checking");
  const [checkInfo, setCheckInfo] = useState<{ spamBlock: string; hasPremium: boolean } | null>(null);

  const handleBuyClick = () => {
    if (!user) {
      toast({ title: "Ошибка", description: "Откройте в Telegram", variant: "destructive" });
      return;
    }
    if (!account) return;
    const isFree = account.isFree === "true" || account.price === 0;
    if (!isFree && balance < account.price) {
      toast({ title: "Недостаточно Stars", description: `Нужно: ${account.price}, у вас: ${balance}. Пополните баланс.`, variant: "destructive" });
      return;
    }
    // Open modal and start checking
    setModalStage("checking");
    setCheckInfo(null);
    setShowBuyModal(true);
    runValidation();
  };

  const runValidation = async () => {
    if (!account) return;
    if (!account.sessionId) {
      // No session — skip validation, go straight to valid
      setModalStage("valid");
      setCheckInfo({ spamBlock: "Не проверялся", hasPremium: account.hasPremium });
      return;
    }
    try {
      const checkRes = await fetch(`/api/sessions/${account.sessionId}/check`, { method: "POST" });
      const checkData = await checkRes.json();
      const spam = checkData.spamBlock ?? "";
      const isValid = checkData.success && (spam === "" || spam === "0" || spam === "none" || spam === "Отсутствует");
      setCheckInfo({
        spamBlock: isValid ? "Отсутствует" : (spam || "Обнаружен"),
        hasPremium: checkData.hasPremium ?? account.hasPremium,
      });
      if (!isValid) {
        setModalStage("invalid");
        await fetch(`/api/accounts/${account.id}/remove`, { method: "POST" }).catch(() => {});
      } else {
        setModalStage("valid");
      }
    } catch {
      // Check failed — allow purchase
      setModalStage("valid");
      setCheckInfo({ spamBlock: "Не удалось проверить", hasPremium: account.hasPremium });
    }
  };

  const handleConfirmPurchase = async () => {
    if (!user || !account) return;
    setModalStage("buying");
    const isFree = account.isFree === "true" || account.price === 0;
    try {
      const res = await fetch("/api/balance/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: String(user.id),
          telegramUsername: user.username,
          accountId: account.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowBuyModal(false);
        if (!isFree) setBalance((b) => b - account.price);
        setOrder({ id: data.orderId, account: data.account });
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        toast({ title: "Успех!", description: isFree ? "Аккаунт получен!" : "Аккаунт куплен!" });
      } else {
        setShowBuyModal(false);
        toast({ title: "Ошибка", description: data.error ?? "Не удалось купить", variant: "destructive" });
      }
    } catch {
      setShowBuyModal(false);
      toast({ title: "Ошибка", description: "Нет подключения", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!order?.account.filePath) return;
    window.open(`/api/accounts/download/${order.account.id}`, "_blank");
  };

  const handleResetSessions = async () => {
    try {
      const res = await fetch(`/api/lolz/reset/${order?.account.id}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Успех", description: "Сессии сброшены" });
      } else {
        toast({ title: "Ошибка", description: data.error || "Не удалось сбросить", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Нет подключения к API", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-6">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Layout>
    );
  }

  if (!account) {
    return (
      <Layout>
        <div className="p-4 text-center text-muted-foreground">Аккаунт не найден.</div>
      </Layout>
    );
  }

  if (order) {
    const acc = order.account;
    const hasApiIntegration = !!(acc.lolzItemId) || !!(acc.sessionId);

    return (
      <>
      <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold tracking-tight text-lg">Данные аккаунта</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{getFlag(acc.country)}</span>
            <div>
              <div className="font-semibold">{acc.country || "Аккаунт Telegram"}</div>
              {acc.hasPremium && (
                <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">Premium</span>
              )}
            </div>
          </div>

          <Card className="p-4 space-y-3 bg-card/80 border-border/40">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Данные для входа в Telegram</div>

            {acc.phone && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Номер телефона:</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-sm font-mono">{acc.phone}</div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(acc.phone!, "Номер")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {acc.userId && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">ID аккаунта:</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-sm font-mono">{acc.userId}</div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(acc.userId!, "ID")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {acc.dcId && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">DC:</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-sm font-mono">{acc.dcId}</div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(acc.dcId!, "DC")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {acc.hasPassword && acc.password && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Пароль 2FA:</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 text-sm font-mono text-amber-400">{acc.password}</div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(acc.password!, "Пароль")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            {acc.hasPassword && !acc.password && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Пароль 2FA:</label>
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <span className="text-xs text-amber-400">⚠️ На аккаунте установлен пароль 2FA, но он не был сохранён при заливе. Обратитесь в поддержку.</span>
                </div>
              </div>
            )}

            {acc.authKey && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Auth Key:</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-xs font-mono truncate">{acc.authKey.slice(0, 24)}...{acc.authKey.slice(-8)}</div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(acc.authKey!, "Auth Key")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Session bot account data */}
            {acc.sessionData && (acc.sessionData.phone || acc.sessionData.password) && (
              <div className="pt-1 border-t border-border/40 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Аккаунт бота</div>
                {acc.sessionData.phone && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Номер (бот):</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2.5 text-sm font-mono">{acc.sessionData.phone}</div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(acc.sessionData!.phone!, "Номер бота")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {acc.sessionData.password && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Пароль (бот):</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 text-sm font-mono text-amber-400">{acc.sessionData.password}</div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 active:scale-90 transition-transform duration-100" onClick={() => handleCopy(acc.sessionData!.password!, "Пароль бота")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <Button
                variant="outline"
                className="w-full h-10 text-sm active:scale-95 transition-transform duration-100"
                onClick={() => setShowCopyDropdown(!showCopyDropdown)}
              >
                Скопировать данные
                {showCopyDropdown ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
              </Button>
              {showCopyDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                  <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-none" onClick={handleCopyAll}>
                    Все данные
                  </Button>
                  {acc.phone && (
                    <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-none" onClick={() => handleCopy(acc.phone!, "Номер")}>
                      Только номер
                    </Button>
                  )}
                  {acc.authKey && (
                    <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-none" onClick={() => handleCopy(acc.authKey!, "Auth Key")}>
                      Только Auth Key
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {acc.filePath && (
            <Card className="p-4 space-y-3 bg-card/80 border-border/40">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Скачать:</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 active:scale-95 transition-transform duration-100" onClick={handleDownload}>
                  <Download className="w-3 h-3 mr-1" />
                  TData
                </Button>
              </div>
            </Card>
          )}

          {hasApiIntegration && (
            <Card className="p-4 space-y-3 bg-card/80 border-border/40">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Получить код для входа в Telegram</div>
              <div className="flex gap-2">
                <Button className="flex-1 h-10 text-sm bg-green-600 hover:bg-green-700 text-white active:scale-95 transition-transform duration-100" onClick={() => setShowCodeModal(true)}>
                  Получить код
                </Button>
                <Button variant="outline" className="flex-1 h-10 text-sm active:scale-95 transition-transform duration-100" onClick={handleResetSessions}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Сбросить сессии
                </Button>
              </div>
            </Card>
          )}
        </main>
      </div>
      <Confetti active={showConfetti} />
      {showCodeModal && (
        <GetCodeModal
          accountId={order.account.id}
          phone={order.account.phone}
          onClose={() => setShowCodeModal(false)}
        />
      )}
      </>
    );
  }

  // Purchase view
  const spamLabel = !account.spamBlock || account.spamBlock === "0" || account.spamBlock === "none"
    ? "Отсутствует"
    : account.spamBlock === "1" ? "Спам" : account.spamBlock;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground pb-24">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 active:scale-90 transition-transform duration-100" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold tracking-tight text-lg">Аккаунт</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getFlag(account.country)}</span>
          <div>
            <h1 className="text-xl font-bold">{account.country || "Аккаунт Telegram"}</h1>
            <div className="text-base font-medium mt-0.5">
              {account.isFree === "true" || account.price === 0 ? (
                <span className="text-green-400">Бесплатно</span>
              ) : (
                <span className="text-primary flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  {account.price} Stars
                </span>
              )}
            </div>
            {account.hasPremium && (
              <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">Premium</span>
            )}
          </div>
        </div>

        {account.dcId && (
          <div className="flex items-center gap-2">
            {account.phonePrefix && (
              <span className="text-[10px] bg-muted/60 px-2 py-0.5 rounded-full text-muted-foreground font-mono">
                {account.phonePrefix}****
              </span>
            )}
            <span className="text-[10px] bg-muted/60 px-2 py-0.5 rounded-full text-muted-foreground">
              DC {account.dcId}
            </span>
          </div>
        )}

        {/* Description first, then info card */}
        {account.description && (
          <Card className="p-4 bg-card/80 border-border/40">
            <h3 className="text-sm font-semibold mb-2">Описание</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{account.description}</p>
          </Card>
        )}

        <Card className="p-4 bg-card/80 border-border/40">
          <h3 className="text-sm font-semibold mb-3">Достоверная информация</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <InfoRow label="Страна" value={account.country || "--"} />
            <InfoRow label="Telegram Premium" value={account.hasPremium ? "Да" : "Нет"} />
            <InfoRow label="Защита 2FA" value={account.hasPassword ? "Установлен" : "Нет"} />
            <InfoRow label="Спамблок" value={spamLabel} />
            {account.origin && (
              <InfoRow label="Происхождение" value={account.origin} />
            )}
            {account.registrationDate && (
              <InfoRow label="Дата регистрации" value={account.registrationDate} />
            )}
          </div>
        </Card>

        {account.isFree !== "true" && account.price !== 0 && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-3">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span className="text-sm">Ваш баланс: <strong>{balance} Stars</strong></span>
          </div>
        )}

        {/* Validation happens automatically in the modal when Buy is clicked */}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border/50 z-10">
        <Button
          className="w-full h-12 text-base font-semibold active:scale-95 transition-transform duration-100"
          onClick={handleBuyClick}
          disabled={isBuying || account.status !== "available"}
        >
          {account.isFree === "true" || account.price === 0
            ? "Получить бесплатно"
            : account.status === "available"
              ? "Купить за Stars"
              : "Недоступен"}
        </Button>
      </div>

      {/* Validation + Purchase Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (modalStage !== "buying") setShowBuyModal(false); }}
          />
          {/* Sheet */}
          <div className="relative w-full max-w-lg rounded-t-2xl bg-background border-t border-border overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="px-6 pb-8 pt-2 space-y-5">
              {/* CHECKING stage */}
              {modalStage === "checking" && (
                <div className="flex flex-col items-center py-6 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg">Проверка аккаунта</div>
                    <div className="text-sm text-muted-foreground mt-1">Проверяем валидность, спамблок и Premium...</div>
                  </div>
                  <div className="w-full space-y-2">
                    {["Авторизация сессии", "Проверка спамблока", "Проверка Premium"].map((step, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                        <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                        <span className="text-sm">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VALID stage */}
              {modalStage === "valid" && (
                <>
                  <div className="flex flex-col items-center py-4 gap-3">
                    <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg text-green-400">Аккаунт валидный</div>
                      <div className="text-sm text-muted-foreground mt-0.5">Проверка пройдена успешно</div>
                    </div>
                  </div>

                  {checkInfo && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                        <div className="text-xs text-muted-foreground">Спамблок</div>
                        <div className="font-semibold text-sm text-green-400">{checkInfo.spamBlock}</div>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                        <div className="text-xs text-muted-foreground">Premium</div>
                        <div className={`font-semibold text-sm ${checkInfo.hasPremium ? "text-yellow-400" : "text-muted-foreground"}`}>
                          {checkInfo.hasPremium ? "⭐ Есть" : "Нет"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3 space-y-1 col-span-2">
                        <div className="text-xs text-muted-foreground">Стоимость</div>
                        <div className="font-semibold text-sm">
                          {account.isFree === "true" || account.price === 0
                            ? <span className="text-green-400">Бесплатно</span>
                            : <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /> {account.price} Stars</span>
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 h-12"
                      onClick={() => setShowBuyModal(false)}
                    >
                      Отмена
                    </Button>
                    <Button
                      className="flex-1 h-12 font-semibold bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleConfirmPurchase}
                    >
                      Подтвердить покупку
                    </Button>
                  </div>
                </>
              )}

              {/* INVALID stage */}
              {modalStage === "invalid" && (
                <>
                  <div className="flex flex-col items-center py-6 gap-3">
                    <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg text-red-400">Аккаунт невалидный</div>
                      <div className="text-sm text-muted-foreground mt-1">Аккаунт удалён из каталога</div>
                    </div>
                  </div>
                  <Button
                    className="w-full h-12"
                    variant="outline"
                    onClick={() => setShowBuyModal(false)}
                  >
                    Закрыть
                  </Button>
                </>
              )}

              {/* BUYING stage */}
              {modalStage === "buying" && (
                <div className="flex flex-col items-center py-8 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <div className="text-center">
                    <div className="font-semibold text-lg">Оформляем покупку...</div>
                    <div className="text-sm text-muted-foreground mt-1">Подождите несколько секунд</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
