import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Eye, Key } from "lucide-react";

interface OrderRow {
  id: number;
  telegramUserId: string;
  telegramUsername: string | null;
  accountId: number;
  status: string;
  paymentMethod: string;
  amount: number;
  createdAt: string;
  deliveredAt: string | null;
  accountPhone: string | null;
  accountCountry: string | null;
  accountDcId: string | null;
  accountUserId: string | null;
  accountAuthKey: string | null;
  accountFilePath: string | null;
  accountLolzItemId: string | null;
  accountSessionId: number | null;
  accountHasPremium: boolean | null;
  accountDescription: string | null;
  accountPassword: string | null;
  accountHasPassword: boolean | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидание",
  paid: "Оплачен",
  delivered: "Доставлен",
  cancelled: "Отменён",
  refunded: "Возврат",
};

const PAYMENT_LABELS: Record<string, string> = {
  stars: "⭐ Stars",
  crypto: "₿ Крипто",
  yookassa: "💳 ЮKassa",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="font-mono text-xs bg-muted p-2 rounded break-all">{value}</div>
    </div>
  );
}

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [fetchingCode, setFetchingCode] = useState(false);
  const [codeResult, setCodeResult] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => { setOrders(data || []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
        if (selectedOrder?.id === id) setSelectedOrder((prev) => prev ? { ...prev, status } : prev);
        toast({ title: "Успешно", description: "Статус заказа обновлён" });
      } else {
        throw new Error();
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось обновить заказ", variant: "destructive" });
    }
  };

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  const handleGetCode = async (sessionId: number) => {
    setFetchingCode(true);
    setCodeResult(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/request-code`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        if (data.code) {
          setCodeResult(data.code);
          toast({ title: "Код получен", description: `Код входа: ${data.code}` });
        } else {
          toast({ title: "Запрос отправлен", description: "Код будет отправлен на номер аккаунта. Проверьте через несколько секунд." });
        }
      } else {
        throw new Error(data.error ?? "Ошибка запроса кода");
      }
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
    setFetchingCode(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Заказы</h2>
      </div>

      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Фильтр по статусу" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Ожидание</SelectItem>
            <SelectItem value="paid">Оплачен</SelectItem>
            <SelectItem value="delivered">Доставлен</SelectItem>
            <SelectItem value="cancelled">Отменён</SelectItem>
            <SelectItem value="refunded">Возврат</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID заказа</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Аккаунт</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Оплата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Загрузка...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Заказов не найдено.</TableCell>
                </TableRow>
              ) : (
                filtered.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedOrder(order)}>
                    <TableCell className="font-mono text-sm">#{order.id}</TableCell>
                    <TableCell>
                      {order.telegramUsername ? (
                        <span>@{order.telegramUsername}</span>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">{order.telegramUserId}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.accountPhone ?? `#${order.accountId}`}
                      {order.accountCountry ? ` · ${order.accountCountry}` : ""}
                    </TableCell>
                    <TableCell className="font-semibold">⭐ {order.amount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.status === "delivered" ? "default" : order.status === "paid" ? "secondary" : "destructive"}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(order.createdAt), "d MMM, HH:mm", { locale: ru })}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedOrder(order)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {order.status === "paid" && (
                          <Button size="sm" onClick={() => handleUpdateStatus(order.id, "delivered")}>
                            Доставить
                          </Button>
                        )}
                        {order.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(order.id, "cancelled")}>
                            Отменить
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order detail dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Заказ #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={selectedOrder.status === "delivered" ? "default" : selectedOrder.status === "paid" ? "secondary" : "destructive"}>
                  {STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}
                </Badge>
                <Badge variant="outline">{PAYMENT_LABELS[selectedOrder.paymentMethod] ?? selectedOrder.paymentMethod}</Badge>
                <span className="font-semibold text-sm ml-auto">⭐ {selectedOrder.amount}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Telegram ID" value={selectedOrder.telegramUserId} />
                {selectedOrder.telegramUsername && (
                  <InfoRow label="Username" value={`@${selectedOrder.telegramUsername}`} />
                )}
                <InfoRow label="Телефон аккаунта" value={selectedOrder.accountPhone} />
                <InfoRow label="Страна" value={selectedOrder.accountCountry} />
                <InfoRow label="DC ID" value={selectedOrder.accountDcId} />
                <InfoRow label="Telegram ID аккаунта" value={selectedOrder.accountUserId} />
                {selectedOrder.accountDescription && (
                  <div className="col-span-2">
                    <InfoRow label="Описание" value={selectedOrder.accountDescription} />
                  </div>
                )}
                {selectedOrder.accountHasPassword && (
                  <div className="col-span-2">
                    <InfoRow
                      label="🔐 Пароль 2FA"
                      value={selectedOrder.accountPassword ?? "Установлен (пароль не сохранён)"}
                    />
                  </div>
                )}
                {selectedOrder.accountHasPremium && (
                  <div className="col-span-2">
                    <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">⭐ Telegram Premium</div>
                  </div>
                )}
                <InfoRow label="Lolz Item ID" value={selectedOrder.accountLolzItemId} />
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border">
                <div>Создан: {format(new Date(selectedOrder.createdAt), "d MMMM yyyy, HH:mm", { locale: ru })}</div>
                {selectedOrder.deliveredAt && (
                  <div>Доставлен: {format(new Date(selectedOrder.deliveredAt), "d MMMM yyyy, HH:mm", { locale: ru })}</div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                {selectedOrder.status === "paid" && (
                  <Button className="flex-1" onClick={() => handleUpdateStatus(selectedOrder.id, "delivered")}>
                    Доставить
                  </Button>
                )}
                {selectedOrder.status === "pending" && (
                  <Button variant="outline" className="flex-1" onClick={() => handleUpdateStatus(selectedOrder.id, "cancelled")}>
                    Отменить
                  </Button>
                )}
                {selectedOrder.accountSessionId && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-1.5"
                    onClick={() => handleGetCode(selectedOrder.accountSessionId!)}
                    disabled={fetchingCode}
                  >
                    <Key className="w-4 h-4" />
                    {fetchingCode ? "..." : "Получить код"}
                  </Button>
                )}
                {codeResult && (
                  <div className="w-full mt-1 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Код входа</div>
                    <div className="font-mono text-2xl font-bold tracking-widest text-green-400">{codeResult}</div>
                  </div>
                )}
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                  Закрыть
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
