import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Package, Trash2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderRow {
  id: number;
  telegramUserId: string;
  telegramUsername: string | null;
  accountId: number;
  status: string;
  paymentMethod: string;
  amount: number;
  createdAt: string;
  accountPhone: string | null;
  accountCountry: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    delivered: { label: "Доставлен", variant: "default" },
    paid: { label: "Оплачен", variant: "secondary" },
    pending: { label: "Ожидание", variant: "outline" },
    cancelled: { label: "Отменён", variant: "destructive" },
    refunded: { label: "Возврат", variant: "destructive" },
  };
  const s = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function PaymentBadge({ method }: { method: string }) {
  const labels: Record<string, string> = {
    stars: "⭐ Stars",
    crypto: "₿ Крипто",
    yookassa: "💳 Карта",
    free: "🎁 Бесплатно",
    balance: "⭐ Баланс",
  };
  return <Badge variant="outline" className="text-xs">{labels[method] ?? method}</Badge>;
}

export default function Logs() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadOrders = () => {
    setIsLoading(true);
    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => {
        setOrders(data || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  const handleDeleteAll = async () => {
    if (!confirm("Удалить ВСЕ заказы? Это невозвратно!")) return;
    const res = await fetch("/api/orders", { method: "DELETE" });
    if (res.ok) {
      loadOrders();
      toast({ title: "Успешно", description: "Все заказы удалены" });
    }
  };

  const handleRefund = async (orderId: number) => {
    if (!confirm(`Возвратить Stars по заказу #${orderId}?`)) return;
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "refunded" }),
      });
      loadOrders();
      toast({ title: "Возврат", description: `Заказ #${orderId} отмечен возвратом. Используйте /refund ${orderId} в боте.` });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Логи продаж</h2>
          <p className="text-sm text-muted-foreground mt-1">Кто купил, какой аккаунт и статус</p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDeleteAll}>
          <Trash2 className="mr-1 h-4 w-4" /> Очистить все
        </Button>
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
        <span className="text-sm text-muted-foreground">
          Записей: <strong>{filtered.length}</strong>
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Покупатель</TableHead>
                <TableHead>Страна / Номер</TableHead>
                <TableHead>Оплата</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Загрузка...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    Нет заказов
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.id}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{order.telegramUsername ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{order.telegramUserId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{order.accountCountry ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{order.accountPhone ?? "—"}</div>
                    </TableCell>
                    <TableCell><PaymentBadge method={order.paymentMethod} /></TableCell>
                    <TableCell>⭐ {order.amount}</TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(order.createdAt), "dd.MM.yyyy HH:mm", { locale: ru })}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.status === "paid" && (
                        <Button size="sm" variant="ghost" onClick={() => handleRefund(order.id)}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
