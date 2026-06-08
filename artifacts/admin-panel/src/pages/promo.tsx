import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Tag, Star, Hash, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface PromoCode {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Promo() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const fetchCodes = () => {
    setLoading(true);
    fetch("/api/promo")
      .then(r => r.json())
      .then(data => { setCodes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchCodes(); }, []);

  const openCreate = () => {
    setCode("");
    setDiscountType("fixed");
    setDiscountValue("");
    setUsageLimit("");
    setExpiresAt("");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !discountValue) {
      toast({ title: "Ошибка", description: "Заполните код и значение скидки", variant: "destructive" });
      return;
    }
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Ошибка", description: "Некорректное значение скидки", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountType,
          discountValue: val,
          usageLimit: usageLimit ? parseInt(usageLimit, 10) : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Промокод создан" });
        setIsDialogOpen(false);
        fetchCodes();
      } else {
        throw new Error(data.error ?? "Ошибка");
      }
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, codeStr: string) => {
    if (!confirm(`Удалить промокод «${codeStr}»?`)) return;
    try {
      await fetch(`/api/promo/${id}`, { method: "DELETE" });
      toast({ title: "Удалено" });
      fetchCodes();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isExhausted = (code: PromoCode) => {
    return code.usage_limit !== null && code.used_count >= code.usage_limit;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Промокоды</h2>
          <p className="text-muted-foreground text-sm mt-1">Управление промокодами для пользователей</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Создать промокод
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Tag className="w-8 h-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{codes.length}</div>
                <div className="text-xs text-muted-foreground">Всего кодов</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{codes.reduce((s, c) => s + c.used_count, 0)}</div>
                <div className="text-xs text-muted-foreground">Активаций всего</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-yellow-400" />
              <div>
                <div className="text-2xl font-bold">
                  {codes.filter(c => c.is_active && !isExpired(c.expires_at) && !isExhausted(c)).length}
                </div>
                <div className="text-xs text-muted-foreground">Активных</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-4 h-4" />
            Список промокодов
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
          ) : codes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Промокодов пока нет. Создайте первый!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {codes.map((promo) => {
                const expired = isExpired(promo.expires_at);
                const exhausted = isExhausted(promo);
                const inactive = !promo.is_active || expired || exhausted;
                return (
                  <div
                    key={promo.id}
                    className={`flex gap-4 items-start p-4 rounded-lg border transition-colors ${inactive ? "border-border/40 opacity-60" : "border-border bg-card"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-mono font-bold text-primary text-lg tracking-wider">{promo.code}</span>
                        {expired && <Badge variant="destructive" className="text-xs">Истёк</Badge>}
                        {exhausted && <Badge variant="destructive" className="text-xs">Исчерпан</Badge>}
                        {!promo.is_active && <Badge variant="outline" className="text-xs">Отключён</Badge>}
                        {!inactive && <Badge variant="default" className="text-xs bg-green-600">Активен</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Star className="w-3.5 h-3.5 text-yellow-400" />
                          {promo.discount_type === "fixed"
                            ? `+${promo.discount_value} Stars`
                            : `Скидка ${promo.discount_value}%`}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          {promo.used_count}
                          {promo.usage_limit !== null ? ` / ${promo.usage_limit}` : " (∞)"} использований
                        </div>
                        {promo.expires_at && (
                          <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                            <Calendar className="w-3.5 h-3.5" />
                            До {format(new Date(promo.expires_at), "d MMM yyyy HH:mm", { locale: ru })}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Hash className="w-3.5 h-3.5" />
                          ID: {promo.id}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleDelete(promo.id, promo.code)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый промокод</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Промокод</Label>
              <Input
                placeholder="SUMMER2024"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Вводится пользователем для активации</p>
            </div>

            <div className="space-y-2">
              <Label>Тип</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={discountType === "fixed" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setDiscountType("fixed")}
                >
                  ⭐ Stars (фиксированно)
                </Button>
                <Button
                  type="button"
                  variant={discountType === "percent" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setDiscountType("percent")}
                >
                  % Скидка
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{discountType === "fixed" ? "Количество Stars" : "Процент скидки"}</Label>
              <Input
                type="number"
                placeholder={discountType === "fixed" ? "100" : "15"}
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {discountType === "fixed"
                  ? "Зачислится на баланс пользователя"
                  : "Скидка в % при покупке (применяется на фронтенде)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Лимит активаций</Label>
              <Input
                type="number"
                placeholder="Без ограничений"
                value={usageLimit}
                onChange={e => setUsageLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Оставьте пустым для неограниченного использования</p>
            </div>

            <div className="space-y-2">
              <Label>Дата истечения</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Оставьте пустым для бессрочного промокода</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Создание..." : "Создать"}
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
