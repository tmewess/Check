import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Plus, Star } from "lucide-react";
import { getTelegramUser } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";
import { getSocialNetwork, getSocialIconSvg } from "@/lib/social-networks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Account {
  id: number;
  phone: string | null;
  country: string;
  phonePrefix: string | null;
  dcId: string | null;
  userId: string | null;
  authKey: string | null;
  status: string;
  price: number;
  isFree: string;
  hasPremium: boolean;
  hasPassword: boolean;
  filePath: string | null;
  fileName: string | null;
  createdAt: string;
  spamBlock: string | null;
  origin: string | null;
  lastActivity: string | null;
  registrationDate: string | null;
  description: string | null;
  lolzItemId: string | null;
  sessionId: number | null;
}

interface OtherProduct {
  id: number;
  socialNetwork: string;
  description: string | null;
  price: number;
  isFree: string;
  status: string;
  createdAt: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "Австралия": "🇦🇺", "Австрия": "🇦🇹", "Азербайджан": "🇦🇿",
  "Албания": "🇦🇱", "Алжир": "🇩🇿", "Ангола": "🇦🇴",
  "Аргентина": "🇦🇷", "Армения": "🇦🇲", "Афганистан": "🇦🇫",
  "Багамы": "🇧🇸", "Бангладеш": "🇧🇩", "Беларусь": "🇧🇾",
  "Бельгия": "🇧🇪", "Болгария": "🇧🇬", "Боливия": "🇧🇴",
  "Бразилия": "🇧🇷", "Бруней": "🇧🇳", "Великобритания": "🇬🇧",
  "Венгрия": "🇭🇺", "Венесуэла": "🇻🇪", "Вьетнам": "🇻🇳",
  "Германия": "🇩🇪", "Греция": "🇬🇷", "Грузия": "🇬🇪",
  "Дания": "🇩🇰", "Египет": "🇪🇬", "Израиль": "🇮🇱",
  "Индия": "🇮🇳", "Индонезия": "🇮🇩", "Иордания": "🇯🇴",
  "Ирак": "🇮🇶", "Иран": "🇮🇷", "Ирландия": "🇮🇪",
  "Испания": "🇪🇸", "Италия": "🇮🇹", "Казахстан": "🇰🇿",
  "Камерун": "🇨🇲", "Канада": "🇨🇦", "Кения": "🇰🇪",
  "Китай": "🇨🇳", "Колумбия": "🇨🇴", "Кыргызстан": "🇰🇬",
  "Латвия": "🇱🇻", "Литва": "🇱🇹", "Ливан": "🇱🇧",
  "Малайзия": "🇲🇾", "Марокко": "🇲🇦", "Мексика": "🇲🇽",
  "Молдова": "🇲🇩", "Монголия": "🇲🇳", "Нидерланды": "🇳🇱",
  "Нигерия": "🇳🇬", "Норвегия": "🇳🇴", "ОАЭ": "🇦🇪",
  "Пакистан": "🇵🇰", "Перу": "🇵🇪", "Польша": "🇵🇱",
  "Португалия": "🇵🇹", "Россия": "🇷🇺", "Румыния": "🇷🇴",
  "Саудовская Аравия": "🇸🇦", "Сербия": "🇷🇸", "Сингапур": "🇸🇬",
  "Словакия": "🇸🇰", "США": "🇺🇸", "Таджикистан": "🇹🇯",
  "Таиланд": "🇹🇭", "Тунис": "🇹🇳", "Турция": "🇹🇷",
  "Узбекистан": "🇺🇿", "Украина": "🇺🇦", "Филиппины": "🇵🇭",
  "Финляндия": "🇫🇮", "Франция": "🇫🇷", "Чехия": "🇨🇿",
  "Чили": "🇨🇱", "Швейцария": "🇨🇭", "Швеция": "🇸🇪",
  "Эстония": "🇪🇪", "Эфиопия": "🇪🇹", "Япония": "🇯🇵",
  "Южная Корея": "🇰🇷", "Южная Африка": "🇿🇦", "Другая": "🌍",
};

function getFlag(country: string): string {
  if (!country) return "🌍";
  // If country starts with an emoji flag (e.g. "🇰🇿 Казахстан"), extract it
  const emojiMatch = country.match(/^(\p{Emoji_Presentation}+|\p{Extended_Pictographic}+)\s*/u);
  if (emojiMatch) return emojiMatch[1];
  // Otherwise look up by name
  return COUNTRY_FLAGS[country] || "🌍";
}

function getIdDigitLabel(userId: string | null): string | null {
  if (!userId) return null;
  const digits = userId.replace(/\D/g, "").length;
  if (!digits) return null;
  return `${digits}ID`;
}

function AccountSkeleton({ index }: { index: number }) {
  return (
    <div
      className="rounded-2xl p-4 overflow-hidden relative animate-fade-in"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid rgba(168,85,247,0.1)",
        animationDelay: `${index * 0.06}s`,
      }}
    >
      <div className="shimmer-card absolute inset-0 rounded-2xl overflow-hidden" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2.5 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-5 rounded-md bg-muted/50" />
            <div className="h-4 w-28 rounded-lg bg-muted/50" />
          </div>
          <div className="h-3 w-36 rounded-md bg-muted/35" />
          <div className="h-5 w-14 rounded-full bg-muted/35" />
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <div className="h-5 w-14 rounded-md bg-muted/50" />
          <div className="h-8 w-20 rounded-xl bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

export default function Catalog() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [otherProducts, setOtherProducts] = useState<OtherProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<"telegram" | "other">("telegram");
  const user = getTelegramUser();
  const { toast } = useToast();

  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("100");

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts/available").then(r => r.json()),
      fetch("/api/other-products/available").then(r => r.json()),
    ]).then(([accs, others]) => {
      setAccounts(Array.isArray(accs) ? accs : []);
      setOtherProducts(Array.isArray(others) ? others : []);
      setIsLoading(false);
    });

    if (user) {
      fetch(`/api/balance/${user.id}`)
        .then(r => r.json())
        .then(data => setBalance(data.balance ?? 0));
    }
  }, [user]);

  const handleTopup = async () => {
    if (!user) {
      toast({ title: "Ошибка", description: "Откройте в Telegram", variant: "destructive" });
      return;
    }
    const amount = parseInt(topupAmount, 10);
    if (isNaN(amount) || amount < 1) {
      toast({ title: "Ошибка", description: "Минимальное пополнение — 1 Star", variant: "destructive" });
      return;
    }
    const tg = (window as any).Telegram?.WebApp;
    try {
      const res = await fetch("/api/balance/topup-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUserId: String(user.id), amount }),
      });
      const data = await res.json();
      if (data.success && data.invoiceUrl) {
        setIsTopupOpen(false);
        if (tg?.openInvoice) {
          tg.openInvoice(data.invoiceUrl, (status: string) => {
            if (status === "paid") {
              toast({ title: "Успешно", description: "Баланс пополнен" });
              fetch(`/api/balance/${user.id}`)
                .then(r => r.json())
                .then(d => setBalance(d.balance ?? 0));
            } else if (status === "cancelled") {
              toast({ title: "Отменено", description: "Платёж отменён" });
            }
          });
        } else {
          window.open(data.invoiceUrl, "_blank");
        }
      } else {
        toast({ title: "Пополнение", description: data.error ?? "Ошибка создания инвойса", variant: "destructive" });
      }
    } catch {
      toast({ title: "Пополнение", description: "Используйте команду /topup в боте", variant: "destructive" });
    }
  };

  const handleCryptoTopup = async () => {
    if (!user) return;
    const amount = parseInt(topupAmount, 10);
    if (isNaN(amount) || amount < 1) return;
    try {
      const res = await fetch("/api/balance/crypto-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUserId: String(user.id), amount }),
      });
      const data = await res.json();
      if (data.success && data.invoiceUrl) {
        setIsTopupOpen(false);
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openLink) {
          tg.openLink(data.invoiceUrl);
        } else {
          window.open(data.invoiceUrl, "_blank");
        }
      } else {
        toast({ title: "Ошибка", description: data.error ?? "Crypto Bot не настроен", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось создать счёт", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-6">

        {/* Header row */}
        <div className="flex items-center justify-between animate-fade-in-1">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Каталог</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Все товары магазина</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold"
              style={{
                background: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(168,85,247,0.10))",
                border: "1px solid rgba(168,85,247,0.25)",
              }}
            >
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span>{balance.toFixed(0)}</span>
            </div>
            <button
              onClick={() => setIsTopupOpen(true)}
              className="flex items-center justify-center rounded-xl w-8 h-8 transition-all active:scale-90 duration-100"
              style={{
                background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                boxShadow: "0 2px 12px rgba(124,58,237,0.35)",
              }}
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Tabs — smaller, no emojis */}
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}
        >
          <button
            onClick={() => setActiveTab("telegram")}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all active:scale-95 duration-100"
            style={{
              background: activeTab === "telegram" ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "transparent",
              color: activeTab === "telegram" ? "white" : undefined,
              boxShadow: activeTab === "telegram" ? "0 2px 8px rgba(124,58,237,0.3)" : "none",
            }}
          >
            Telegram
            {accounts.length > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: activeTab === "telegram" ? "rgba(255,255,255,0.25)" : "rgba(168,85,247,0.2)",
                }}
              >
                {accounts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("other")}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all active:scale-95 duration-100"
            style={{
              background: activeTab === "other" ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "transparent",
              color: activeTab === "other" ? "white" : undefined,
              boxShadow: activeTab === "other" ? "0 2px 8px rgba(124,58,237,0.3)" : "none",
            }}
          >
            Прочие
            {otherProducts.length > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: activeTab === "other" ? "rgba(255,255,255,0.25)" : "rgba(168,85,247,0.2)",
                }}
              >
                {otherProducts.length}
              </span>
            )}
          </button>
        </div>

        {/* Account list */}
        {activeTab === "telegram" && (
          <div className="flex flex-col gap-2.5">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <AccountSkeleton key={i} index={i} />)
            ) : accounts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground animate-fade-in">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-sm font-medium">Аккаунтов пока нет</p>
                <p className="text-xs mt-1 opacity-60">Загляните позже</p>
              </div>
            ) : (
              accounts.map((acc, i) => (
                <Link key={acc.id} href={`/account/${acc.id}`}>
                  <div
                    className="card-press rounded-2xl p-4 animate-fade-in cursor-pointer"
                    style={{
                      background: "hsl(var(--card))",
                      border: "1px solid rgba(168,85,247,0.12)",
                      animationDelay: `${i * 0.05}s`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Country flag on the left */}
                        <span className="text-2xl leading-none mt-0.5 shrink-0">
                          {getFlag(acc.country)}
                        </span>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Description top, country below */}
                          {acc.description ? (
                            <>
                              <div className="font-semibold text-sm truncate">{acc.description}</div>
                              <div className="text-xs text-muted-foreground">{acc.country?.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u, "") || "Другая"}</div>
                            </>
                          ) : (
                            <div className="font-semibold text-sm">{acc.country?.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u, "") || "Другая"}</div>
                          )}
                          {/* Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {acc.hasPremium && <span className="badge-premium">Premium</span>}
                            {acc.hasPassword && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: "rgba(251,146,60,0.15)", color: "#f97316" }}>
                                2FA
                              </span>
                            )}
                            {(acc.isFree === "true" || acc.price === 0) && (
                              <span className="badge-free">Free</span>
                            )}
                          </div>
                          {/* DC / ID / Auto-delivery row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {acc.dcId && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ background: "rgba(168,85,247,0.12)", color: "hsl(262 83% 68%)" }}
                              >
                                DC {acc.dcId}
                              </span>
                            )}
                            {getIdDigitLabel(acc.userId) && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ background: "rgba(168,85,247,0.12)", color: "hsl(262 83% 68%)" }}
                              >
                                {getIdDigitLabel(acc.userId)}
                              </span>
                            )}
                            {(acc.sessionId || acc.lolzItemId) && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
                              >
                                Авто-выдача
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-sm font-bold" style={{ color: "hsl(262 83% 70%)" }}>
                          {acc.isFree === "true" || acc.price === 0 ? "Free" : `${acc.price} ★`}
                        </span>
                        <div
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                          style={{
                            background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                            boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
                          }}
                        >
                          Купить
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Other products list */}
        {activeTab === "other" && (
          <div className="flex flex-col gap-2.5">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <AccountSkeleton key={i} index={i} />)
            ) : otherProducts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground animate-fade-in">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-sm font-medium">Товаров пока нет</p>
                <p className="text-xs mt-1 opacity-60">Загляните позже</p>
              </div>
            ) : (
              otherProducts.map((product, i) => {
                const sn = getSocialNetwork(product.socialNetwork);
                const svgIcon = getSocialIconSvg(product.socialNetwork);
                const isFree = product.isFree === "true" || product.price === 0;
                return (
                  <Link key={product.id} href={`/other/${product.id}`}>
                    <div
                      className="card-press rounded-2xl p-4 animate-fade-in cursor-pointer"
                      style={{
                        background: "hsl(var(--card))",
                        border: "1px solid rgba(168,85,247,0.12)",
                        animationDelay: `${i * 0.05}s`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: sn.bgColor }}
                          dangerouslySetInnerHTML={{
                            __html: `<div style="width:22px;height:22px">${svgIcon}</div>`
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{sn.name}</div>
                          {product.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className="text-sm font-bold" style={{ color: "hsl(262 83% 70%)" }}>
                            {isFree ? "Free" : `${product.price} ★`}
                          </span>
                          <div
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                            style={{
                              background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                              boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
                            }}
                          >
                            Купить
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Topup Dialog */}
      <Dialog open={isTopupOpen} onOpenChange={setIsTopupOpen}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Пополнить баланс</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Сумма (Stars)</Label>
              <Input
                type="number"
                value={topupAmount}
                onChange={e => setTopupAmount(e.target.value)}
                placeholder="100"
                min="1"
              />
            </div>
            <button
              onClick={handleTopup}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 duration-100"
              style={{
                background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                boxShadow: "0 2px 12px rgba(124,58,237,0.35)",
              }}
            >
              Пополнить через Telegram Stars
            </button>
            <button
              onClick={handleCryptoTopup}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 duration-100"
              style={{
                background: "linear-gradient(135deg,#0088cc,#00a0e0)",
                boxShadow: "0 2px 12px rgba(0,136,204,0.35)",
              }}
            >
              Пополнить через Crypto Bot
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
