import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Star, Search } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { SOCIAL_NETWORKS, getSocialNetwork } from "@/lib/social-networks";

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
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  available: "Доступен",
  sold: "Продан",
};

export default function OtherProducts() {
  const [products, setProducts] = useState<OtherProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    socialNetwork: "",
    login: "",
    password: "",
    email: "",
    emailPassword: "",
    description: "",
    deliveryDescription: "",
    price: "",
    isFree: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchProducts = () => {
    setIsLoading(true);
    fetch("/api/other-products")
      .then(r => r.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleAdd = async () => {
    if (!form.socialNetwork) {
      toast({ title: "Ошибка", description: "Выберите соцсеть", variant: "destructive" });
      return;
    }
    if (!form.description && !form.login) {
      toast({ title: "Ошибка", description: "Заполните описание или логин", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/other-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialNetwork: form.socialNetwork,
          login: form.login || undefined,
          password: form.password || undefined,
          email: form.email || undefined,
          emailPassword: form.emailPassword || undefined,
          description: form.description || undefined,
          deliveryDescription: form.deliveryDescription || undefined,
          price: form.isFree ? 0 : Number(form.price) || 0,
          isFree: form.isFree ? "true" : "false",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Успешно", description: "Товар добавлен" });
        setIsDialogOpen(false);
        setForm({ socialNetwork: "", login: "", password: "", email: "", emailPassword: "", description: "", deliveryDescription: "", price: "", isFree: false });
        fetchProducts();
      } else {
        toast({ title: "Ошибка", description: data.error ?? "Не удалось добавить", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Сетевая ошибка", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/other-products/${id}`, { method: "DELETE" });
      setProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: "Удалено" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось удалить", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = products.filter(p => {
    const sn = getSocialNetwork(p.socialNetwork);
    const q = search.toLowerCase();
    return (
      sn.name.toLowerCase().includes(q) ||
      (p.login ?? "").toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q)
    );
  });

  const descriptionFilled = form.description.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Прочие товары</h2>
          <p className="text-muted-foreground mt-1">Аккаунты соцсетей и другие товары</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить товар
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по соцсети, логину, описанию..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {products.length === 0 ? "Товаров пока нет. Добавьте первый!" : "Ничего не найдено"}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Соцсеть</TableHead>
                    <TableHead>Логин</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Добавлен</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(product => {
                    const sn = getSocialNetwork(product.socialNetwork);
                    const isFree = product.isFree === "true" || product.price === 0;
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{sn.emoji}</span>
                            <span className="font-medium text-sm">{sn.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground">{product.login ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate max-w-[180px] block">{product.description ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          {isFree ? (
                            <Badge variant="secondary" className="text-green-400 border-green-400/30 bg-green-400/10">Бесплатно</Badge>
                          ) : (
                            <span className="flex items-center gap-1 text-sm font-medium">
                              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                              {product.price}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.status === "available" ? "default" : "secondary"}>
                            {STATUS_LABELS[product.status] ?? product.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(product.createdAt), "dd MMM yyyy", { locale: ru })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(product.id)}
                            disabled={deletingId === product.id}
                          >
                            {deletingId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить товар</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Соцсеть *</Label>
              <Select value={form.socialNetwork} onValueChange={v => setForm(f => ({ ...f, socialNetwork: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите соцсеть" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                  {SOCIAL_NETWORKS.map(sn => (
                    <SelectItem key={sn.id} value={sn.id}>
                      <span className="flex items-center gap-2">
                        <span>{sn.emoji}</span>
                        <span>{sn.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-md p-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Заполните описание <strong>или</strong> данные для входа. Если заполнено описание — остальное необязательно.
              </p>
              <div>
                <Label>Описание товара (видно до покупки)</Label>
                <Textarea className="mt-1" rows={2} placeholder="Аккаунт с 1000 подписчиков..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label>Логин {!descriptionFilled && <span className="text-destructive">*</span>}</Label>
                <Input className="mt-1" placeholder="username или email" value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} />
              </div>
              <div>
                <Label>Пароль {!descriptionFilled && <span className="text-destructive">*</span>}</Label>
                <Input type="password" className="mt-1" placeholder="••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <Label>Почта <span className="text-muted-foreground text-xs">(необязательно)</span></Label>
                <Input className="mt-1" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Пароль от почты <span className="text-muted-foreground text-xs">(необязательно)</span></Label>
                <Input type="password" className="mt-1" placeholder="••••••" value={form.emailPassword} onChange={e => setForm(f => ({ ...f, emailPassword: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Описание после покупки</Label>
              <Textarea className="mt-1" rows={3} placeholder="Инструкции после оплаты..." value={form.deliveryDescription} onChange={e => setForm(f => ({ ...f, deliveryDescription: e.target.value }))} />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.isFree} onCheckedChange={v => setForm(f => ({ ...f, isFree: v }))} />
              <Label>Бесплатный товар</Label>
            </div>

            {!form.isFree && (
              <div>
                <Label>Цена (Stars)</Label>
                <div className="relative mt-1">
                  <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <Input type="number" min={1} className="pl-9" placeholder="100" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              </div>
            )}

            <Button className="w-full" onClick={handleAdd} disabled={isSaving}>
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Сохранение...</> : "Добавить товар"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
