import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getTelegramUser } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Copy, Download, RotateCcw, ChevronDown, ChevronUp, ArrowLeft, ShoppingBag } from "lucide-react";
import { GetCodeModal } from "@/components/get-code-modal";
import { getSocialNetwork, getSocialIconSvg } from "@/lib/social-networks";

interface OrderWithAccount {
  id: number;
  telegramUserId: string;
  telegramUsername: string | null;
  accountId: number | null;
  otherProductId: number | null;
  status: string;
  paymentMethod: string;
  amount: number;
  createdAt: string;
  accountPhone: string | null;
  accountCountry: string | null;
  accountDcId: string | null;
  accountUserId: string | null;
  accountAuthKey: string | null;
  accountFilePath: string | null;
  accountLolzItemId: string | null;
  accountSessionId: number | null;
  accountHasPremium: boolean;
  accountDescription: string | null;
  accountPassword: string | null;
  accountHasPassword: boolean | null;
  otherProductSocialNetwork: string | null;
  otherProductDescription: string | null;
  otherProductContent: string | null;
  otherProductPrice: number | null;
  otherProductLogin: string | null;
  otherProductPassword: string | null;
  otherProductEmail: string | null;
  otherProductEmailPassword: string | null;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "США": "🇺🇸", "Россия": "🇷🇺", "Украина": "🇺🇦", "Казахстан": "🇰🇿",
  "Беларусь": "🇧🇾", "Польша": "🇵🇱", "Германия": "🇩🇪", "Франция": "🇫🇷",
  "Италия": "🇮🇹", "Турция": "🇹🇷", "Индия": "🇮🇳", "Китай": "🇨🇳",
  "Япония": "🇯🇵", "Бразилия": "🇧🇷", "Аргентина": "🇦🇷",
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || "🌍";
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидание", paid: "Оплачен", delivered: "Доставлен",
  cancelled: "Отменён", refunded: "Возврат",
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  delivered: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  paid:      { bg: "rgba(59,130,246,0.12)", color: "#60a5fa" },
  pending:   { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
  cancelled: { bg: "rgba(239,68,68,0.12)",  color: "#f87171" },
  refunded:  { bg: "rgba(239,68,68,0.12)",  color: "#f87171" },
};

function DataRow({
  label, value, onCopy,
}: { label: string; value: string | null; onCopy?: () => void }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <div
          className="flex-1 rounded-xl px-3 py-2.5 text-sm font-mono truncate"
          style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.12)" }}
        >
          {value.length > 32 ? `${value.slice(0, 24)}...${value.slice(-8)}` : value}
        </div>
        {onCopy && (
          <button
            onClick={onCopy}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
          >
            <Copy className="w-3.5 h-3.5" style={{ color: "hsl(262 83% 68%)" }} />
          </button>
        )}
      </div>
    </div>
  );
}

function isOtherProductOrder(order: OrderWithAccount): boolean {
  return order.otherProductId !== null && order.accountId === null;
}

export default function Orders() {
  const user = getTelegramUser();
  const telegramUserId = user?.id.toString() || "dev";
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithAccount | null>(null);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [orders, setOrders] = useState<OrderWithAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orders/my", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUserId }),
      })
      .then((r) => r.json())
      .then((data) => {
        setOrders(data || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const userOrders = orders;

  const handleCopy = (text: string | null, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано", description: `${label} скопирован в буфер` });
  };

  const handleCopyAll = (order: OrderWithAccount) => {
    const parts: string[] = [];
    if (order.accountPhone) parts.push(`Номер: ${order.accountPhone}`);
    if (order.accountUserId) parts.push(`ID: ${order.accountUserId}`);
    if (order.accountAuthKey) parts.push(`Auth Key: ${order.accountAuthKey}`);
    if (order.accountDcId) parts.push(`DC: ${order.accountDcId}`);
    if (order.accountHasPassword && order.accountPassword) parts.push(`Пароль 2FA: ${order.accountPassword}`);
    navigator.clipboard.writeText(parts.join("\n"));
    toast({ title: "Скопировано", description: "Все данные аккаунта" });
  };

  const handleDownload = (accountId: number) => {
    window.open(`/api/accounts/download/${accountId}`, "_blank");
  };

  const handleResetSessions = async (order: OrderWithAccount) => {
    try {
      const res = await fetch(`/api/lolz/reset/${order.accountId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Успех", description: "Сессии сброшены" });
      } else {
        toast({ title: "Ошибка", description: data.error || "Не удалось сбросить сессии", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Нет подключения к API", variant: "destructive" });
    }
  };

  function getOrderTitle(order: OrderWithAccount): string {
    if (isOtherProductOrder(order) && order.otherProductSocialNetwork) {
      const sn = getSocialNetwork(order.otherProductSocialNetwork);
      return sn.name;
    }
    if (order.accountCountry) return order.accountCountry;
    return "Заказ";
  }

  function getOrderIcon(order: OrderWithAccount): string {
    if (isOtherProductOrder(order) && order.otherProductSocialNetwork) {
      const sn = getSocialNetwork(order.otherProductSocialNetwork);
      return sn.emoji;
    }
    if (order.accountCountry) return getFlag(order.accountCountry);
    return "📦";
  }

  function getOrderSvgIcon(order: OrderWithAccount): { svg: string; bg: string } | null {
    if (isOtherProductOrder(order) && order.otherProductSocialNetwork) {
      const sn = getSocialNetwork(order.otherProductSocialNetwork);
      return { svg: getSocialIconSvg(order.otherProductSocialNetwork), bg: sn.bgColor };
    }
    return null;
  }

  // Full-screen detail view
  if (selectedOrder) {
    const order = selectedOrder;
    const isOther = isOtherProductOrder(order);
    const hasApiIntegration = !isOther && (!!(order.accountLolzItemId) || !!(order.accountSessionId));
    const statusStyle = STATUS_STYLES[order.status] ?? { bg: "rgba(168,85,247,0.1)", color: "hsl(262 83% 68%)" };
    const svgInfo = getOrderSvgIcon(order);

    return (
      <>
        <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground">
          {/* Detail header */}
          <header className="sticky top-0 z-50 w-full">
            <div
              className="absolute inset-0"
              style={{ background: "hsl(var(--background))", borderBottom: "1px solid rgba(168,85,247,0.15)" }}
            />
            <div className="relative flex items-center gap-3 px-4 h-14">
              <button
                onClick={() => { setSelectedOrder(null); setShowCopyDropdown(false); setShowCodeModal(false); }}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all active:scale-90"
                style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
              >
                <ArrowLeft className="w-4 h-4" style={{ color: "hsl(262 83% 68%)" }} />
              </button>
              <div>
                <div className="font-semibold tracking-tight" style={{ fontSize: "15px" }}>
                  Заказ #{order.id}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {format(new Date(order.createdAt), "dd MMM yyyy, HH:mm", { locale: ru })}
                </div>
              </div>
              <div className="ml-auto">
                <div
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: statusStyle.bg, color: statusStyle.color }}
                >
                  {STATUS_LABELS[order.status] ?? order.status}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {/* Order type header */}
            <div
              className="flex items-center gap-3 p-3 rounded-2xl"
              style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.15)" }}
            >
              {svgInfo ? (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: svgInfo.bg }}
                  dangerouslySetInnerHTML={{ __html: `<div style="width:22px;height:22px">${svgInfo.svg}</div>` }}
                />
              ) : (
                <span className="text-2xl">{getOrderIcon(order)}</span>
              )}
              <div>
                <div className="font-semibold text-sm">{getOrderTitle(order)}</div>
                {isOther && order.otherProductDescription && (
                  <div className="text-xs text-muted-foreground">{order.otherProductDescription}</div>
                )}
                {!isOther && order.accountHasPremium && (
                  <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">Premium</span>
                )}
              </div>
              <div className="ml-auto text-right">
                <div className="text-sm font-bold" style={{ color: "hsl(262 83% 68%)" }}>
                  {order.amount === 0 ? "Free" : `${order.amount} ★`}
                </div>
              </div>
            </div>

            {/* Content for Other product orders */}
            {isOther && (order.otherProductLogin || order.otherProductPassword || order.otherProductEmail || order.otherProductContent) ? (
              <div
                className="p-4 rounded-2xl space-y-3"
                style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.12)" }}
              >
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Данные товара
                </div>
                {order.otherProductLogin && (
                  <DataRow label="Логин" value={order.otherProductLogin} onCopy={() => handleCopy(order.otherProductLogin, "Логин")} />
                )}
                {order.otherProductPassword && (
                  <DataRow label="Пароль" value={order.otherProductPassword} onCopy={() => handleCopy(order.otherProductPassword, "Пароль")} />
                )}
                {order.otherProductEmail && (
                  <DataRow label="Email" value={order.otherProductEmail} onCopy={() => handleCopy(order.otherProductEmail, "Email")} />
                )}
                {order.otherProductEmailPassword && (
                  <DataRow label="Пароль от Email" value={order.otherProductEmailPassword} onCopy={() => handleCopy(order.otherProductEmailPassword, "Пароль от Email")} />
                )}
                {order.otherProductContent && (
                  <DataRow label="Инструкция" value={order.otherProductContent} onCopy={() => handleCopy(order.otherProductContent, "Инструкция")} />
                )}
                <button
                  onClick={() => {
                    const parts: string[] = [];
                    if (order.otherProductLogin) parts.push(`Логин: ${order.otherProductLogin}`);
                    if (order.otherProductPassword) parts.push(`Пароль: ${order.otherProductPassword}`);
                    if (order.otherProductEmail) parts.push(`Email: ${order.otherProductEmail}`);
                    if (order.otherProductEmailPassword) parts.push(`Пароль Email: ${order.otherProductEmailPassword}`);
                    navigator.clipboard.writeText(parts.join("\n"));
                    toast({ title: "Скопировано", description: "Все данные скопированы" });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                  style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", color: "hsl(262 83% 68%)" }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Скопировать все данные
                </button>
              </div>
            ) : isOther ? (
              <div
                className="p-4 rounded-2xl text-center"
                style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.12)" }}
              >
                <p className="text-sm text-muted-foreground">Данные будут доступны после обработки заказа</p>
              </div>
            ) : null}

            {/* Account data for Telegram accounts */}
            {!isOther && (
              <div
                className="p-4 rounded-2xl space-y-3"
                style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.12)" }}
              >
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Данные аккаунта
                </div>
                <DataRow label="Номер телефона" value={order.accountPhone} onCopy={() => handleCopy(order.accountPhone, "Номер")} />
                <DataRow label="ID пользователя" value={order.accountUserId} onCopy={() => handleCopy(order.accountUserId, "ID")} />
                <DataRow label="DC ID" value={order.accountDcId} onCopy={() => handleCopy(order.accountDcId, "DC")} />
                {order.accountHasPassword && order.accountPassword && (
                  <DataRow label="Пароль 2FA" value={order.accountPassword} onCopy={() => handleCopy(order.accountPassword, "Пароль")} />
                )}
                {order.accountAuthKey && (
                  <DataRow label="Auth Key" value={order.accountAuthKey} onCopy={() => handleCopy(order.accountAuthKey, "Auth Key")} />
                )}

                {/* Copy all */}
                <div className="relative pt-1">
                  <button
                    onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                    style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", color: "hsl(262 83% 68%)" }}
                  >
                    Скопировать данные
                    {showCopyDropdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showCopyDropdown && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10"
                      style={{ background: "hsl(var(--card))", border: "1px solid rgba(168,85,247,0.2)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}
                    >
                      <button className="w-full text-left px-4 py-2.5 text-sm active:bg-muted/20 transition-colors" onClick={() => { handleCopyAll(order); setShowCopyDropdown(false); }}>Все данные</button>
                      {order.accountPhone && <button className="w-full text-left px-4 py-2.5 text-sm active:bg-muted/20 transition-colors" onClick={() => { handleCopy(order.accountPhone, "Номер"); setShowCopyDropdown(false); }}>Только номер</button>}
                      {order.accountAuthKey && <button className="w-full text-left px-4 py-2.5 text-sm active:bg-muted/20 transition-colors" onClick={() => { handleCopy(order.accountAuthKey, "Auth Key"); setShowCopyDropdown(false); }}>Только Auth Key</button>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Download / Reset sessions for Telegram accounts */}
            {!isOther && (order.accountFilePath || hasApiIntegration) && (
              <div
                className="p-4 rounded-2xl space-y-3"
                style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.12)" }}
              >
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Действия</div>
                <div className="flex gap-2 flex-wrap">
                  {order.accountFilePath && order.accountId !== null && (
                    <button
                      onClick={() => handleDownload(order.accountId!)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium active:scale-95 transition-all"
                      style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "hsl(262 83% 68%)" }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Скачать TData
                    </button>
                  )}
                  {hasApiIntegration && (
                    <>
                      <button
                        onClick={() => setShowCodeModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white active:scale-95 transition-all"
                        style={{ background: "linear-gradient(135deg,#059669,#10b981)", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
                      >
                        Получить код
                      </button>
                      <button
                        onClick={() => handleResetSessions(order)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium active:scale-95 transition-all"
                        style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "hsl(262 83% 68%)" }}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Сброс сессий
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {showCodeModal && order.accountId !== null && (
          <GetCodeModal
            accountId={order.accountId!}
            phone={order.accountPhone}
            onClose={() => setShowCodeModal(false)}
          />
        )}
      </>
    );
  }

  // Orders list view
  return (
    <Layout>
      <div className="p-4 space-y-4 pb-6">
        <div className="animate-fade-in-1">
          <h1 className="text-xl font-bold tracking-tight">Мои заказы</h1>
          <p className="text-xs text-muted-foreground mt-0.5">История покупок</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0,1,2].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        ) : userOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <ShoppingBag className="w-14 h-14 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">Заказов пока нет</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Перейдите в каталог, чтобы купить товар</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {userOrders.map((order, i) => {
              const statusStyle = STATUS_STYLES[order.status] ?? { bg: "rgba(168,85,247,0.1)", color: "hsl(262 83% 68%)" };
              const isOther = isOtherProductOrder(order);
              const svgInfo = getOrderSvgIcon(order);
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left card-press rounded-2xl p-4 animate-fade-in cursor-pointer"
                  style={{
                    background: "hsl(var(--card))",
                    border: "1px solid rgba(168,85,247,0.12)",
                    animationDelay: `${i * 0.05}s`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {svgInfo ? (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: svgInfo.bg }}
                        dangerouslySetInnerHTML={{ __html: `<div style="width:22px;height:22px">${svgInfo.svg}</div>` }}
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                        style={{ background: "rgba(168,85,247,0.1)" }}
                      >
                        {getOrderIcon(order)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{getOrderTitle(order)}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        #{order.id} · {format(new Date(order.createdAt), "dd MMM", { locale: ru })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-sm font-bold" style={{ color: "hsl(262 83% 68%)" }}>
                        {order.amount === 0 ? "Free" : `${order.amount} ★`}
                      </span>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
