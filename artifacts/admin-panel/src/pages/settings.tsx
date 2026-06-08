import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Shield, Loader2, Bell, Wrench } from "lucide-react";

interface BotSettings {
  id?: number;
  botToken: string;
  welcomeMessage: string;
  supportUsername: string;
  paymentYookassaEnabled: boolean;
  yookassaShopId: string;
  yookassaSecretKey: string;
  paymentStarsEnabled: boolean;
  paymentCryptoEnabled: boolean;
  cryptoBotToken: string;
  lolzApiKey: string;
  tgApiId: string;
  tgApiHash: string;
  requireSubscription: boolean;
  subscriptionChannel: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

interface Proxy {
  id: number;
  ip: string;
  port: string;
  username: string | null;
  password: string | null;
  createdAt: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<BotSettings>({
    botToken: "",
    welcomeMessage: "",
    supportUsername: "",
    paymentYookassaEnabled: false,
    yookassaShopId: "",
    yookassaSecretKey: "",
    paymentStarsEnabled: false,
    paymentCryptoEnabled: false,
    cryptoBotToken: "",
    lolzApiKey: "",
    tgApiId: "",
    tgApiHash: "",
    requireSubscription: false,
    subscriptionChannel: "",
    maintenanceMode: false,
    maintenanceMessage: "🔧 Технические работы. Скоро вернёмся!",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [proxiesLoading, setProxiesLoading] = useState(true);
  const [newProxy, setNewProxy] = useState({ ip: "", port: "", username: "", password: "" });
  const [addingProxy, setAddingProxy] = useState(false);
  const [deletingProxyId, setDeletingProxyId] = useState<number | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/bot/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          botToken: data.botToken || "",
          welcomeMessage: data.welcomeMessage || "",
          supportUsername: data.supportUsername || "",
          paymentYookassaEnabled: data.paymentYookassaEnabled || false,
          yookassaShopId: data.yookassaShopId || "",
          yookassaSecretKey: data.yookassaSecretKey || "",
          paymentStarsEnabled: data.paymentStarsEnabled || false,
          paymentCryptoEnabled: data.paymentCryptoEnabled || false,
          cryptoBotToken: data.cryptoBotToken || "",
          lolzApiKey: data.lolzApiKey || "",
          tgApiId: data.tgApiId || "",
          tgApiHash: data.tgApiHash || "",
          requireSubscription: data.requireSubscription || false,
          subscriptionChannel: data.subscriptionChannel || "",
          maintenanceMode: data.maintenanceMode || false,
          maintenanceMessage: data.maintenanceMessage || "🔧 Технические работы. Скоро вернёмся!",
        });
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    fetchProxies();
  }, []);

  const fetchProxies = () => {
    setProxiesLoading(true);
    fetch("/api/proxies")
      .then((r) => r.json())
      .then((data) => setProxies(Array.isArray(data) ? data : []))
      .catch(() => setProxies([]))
      .finally(() => setProxiesLoading(false));
  };

  const handleChange = (field: keyof BotSettings, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/bot/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast({ title: "Успешно", description: "Настройки сохранены" });
      } else {
        throw new Error("Failed");
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProxy = async () => {
    if (!newProxy.ip || !newProxy.port) {
      toast({ title: "Ошибка", description: "IP и порт обязательны", variant: "destructive" });
      return;
    }
    setAddingProxy(true);
    try {
      const res = await fetch("/api/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProxy),
      });
      if (res.ok) {
        toast({ title: "Успешно", description: "Прокси добавлен" });
        setNewProxy({ ip: "", port: "", username: "", password: "" });
        fetchProxies();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message || "Не удалось добавить прокси", variant: "destructive" });
    } finally {
      setAddingProxy(false);
    }
  };

  const handleDeleteProxy = async (id: number) => {
    setDeletingProxyId(id);
    try {
      const res = await fetch(`/api/proxies/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Удалено", description: "Прокси удалён" });
        setProxies((prev) => prev.filter((p) => p.id !== id));
      } else {
        throw new Error("Failed");
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось удалить прокси", variant: "destructive" });
    } finally {
      setDeletingProxyId(null);
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Загрузка...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Настройки</h2>
        <p className="text-muted-foreground mt-2">Настройка бота и платёжных шлюзов.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Настройки бота</CardTitle>
            <CardDescription>Основные настройки Telegram бота</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Токен бота</Label>
              <Input type="password" value={settings.botToken} onChange={(e) => handleChange("botToken", e.target.value)} placeholder="123456789:ABCdefGHIjklMNO..." />
            </div>
            <div>
              <Label>Приветственное сообщение</Label>
              <Input value={settings.welcomeMessage} onChange={(e) => handleChange("welcomeMessage", e.target.value)} placeholder="Добро пожаловать в наш магазин!" />
            </div>
            <div>
              <Label>Username поддержки</Label>
              <Input value={settings.supportUsername} onChange={(e) => handleChange("supportUsername", e.target.value)} placeholder="support_admin" />
            </div>
          </CardContent>
        </Card>

        {/* Subscription requirement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Обязательная подписка
            </CardTitle>
            <CardDescription>Требовать подписку на канал перед использованием бота</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Требовать подписку</p>
                <p className="text-xs text-muted-foreground">Пользователи без подписки не смогут пользоваться ботом</p>
              </div>
              <Switch checked={settings.requireSubscription} onCheckedChange={(v) => handleChange("requireSubscription", v)} />
            </div>
            {settings.requireSubscription && (
              <div>
                <Label>Username канала</Label>
                <Input
                  value={settings.subscriptionChannel}
                  onChange={(e) => handleChange("subscriptionChannel", e.target.value)}
                  placeholder="@mychannel или mychannel"
                />
                <p className="text-xs text-muted-foreground mt-1">Укажите @username или просто username без @</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Maintenance mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Режим обслуживания
            </CardTitle>
            <CardDescription>Временно отключить бот для всех пользователей</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Режим обслуживания</p>
                <p className="text-xs text-muted-foreground">Бот будет отвечать сообщением об обслуживании всем пользователям (кроме администраторов)</p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(v) => handleChange("maintenanceMode", v)}
              />
            </div>
            <div>
              <Label>Сообщение обслуживания</Label>
              <Textarea
                value={settings.maintenanceMessage}
                onChange={(e) => handleChange("maintenanceMessage", e.target.value)}
                placeholder="🔧 Технические работы. Скоро вернёмся!"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Способы оплаты</CardTitle>
            <CardDescription>Настройка платёжных шлюзов</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 border rounded-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">⭐ Telegram Stars</h4>
                  <p className="text-sm text-muted-foreground">Принимать нативные Telegram Stars</p>
                </div>
                <Switch checked={settings.paymentStarsEnabled} onCheckedChange={(v) => handleChange("paymentStarsEnabled", v)} />
              </div>
            </div>

            <div className="space-y-4 border rounded-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">₿ Crypto Bot</h4>
                  <p className="text-sm text-muted-foreground">Принимать оплату криптовалютой</p>
                </div>
                <Switch checked={settings.paymentCryptoEnabled} onCheckedChange={(v) => handleChange("paymentCryptoEnabled", v)} />
              </div>
              {settings.paymentCryptoEnabled && (
                <div className="pt-4 border-t">
                  <Label>Crypto Bot API Token</Label>
                  <Input type="password" value={settings.cryptoBotToken} onChange={(e) => handleChange("cryptoBotToken", e.target.value)} placeholder="Токен Crypto Bot" />
                  <p className="text-xs text-muted-foreground mt-1">Получить токен у @CryptoBot → /pay</p>
                </div>
              )}
            </div>

            <div className="space-y-4 border rounded-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">💳 ЮKassa</h4>
                  <p className="text-sm text-muted-foreground">Принимать оплату банковскими картами</p>
                </div>
                <Switch checked={settings.paymentYookassaEnabled} onCheckedChange={(v) => handleChange("paymentYookassaEnabled", v)} />
              </div>
              {settings.paymentYookassaEnabled && (
                <div className="pt-4 border-t space-y-4">
                  <div>
                    <Label>Shop ID</Label>
                    <Input value={settings.yookassaShopId} onChange={(e) => handleChange("yookassaShopId", e.target.value)} placeholder="123456" />
                  </div>
                  <div>
                    <Label>Secret Key</Label>
                    <Input type="password" value={settings.yookassaSecretKey} onChange={(e) => handleChange("yookassaSecretKey", e.target.value)} placeholder="live_..." />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Дополнительно</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Lolz API Key</Label>
              <Input type="password" value={settings.lolzApiKey} onChange={(e) => handleChange("lolzApiKey", e.target.value)} placeholder="Ключ Lolz API" />
            </div>
            <div>
              <Label>Telegram API ID</Label>
              <Input value={settings.tgApiId} onChange={(e) => handleChange("tgApiId", e.target.value)} placeholder="12345" />
            </div>
            <div>
              <Label>Telegram API Hash</Label>
              <Input type="password" value={settings.tgApiHash} onChange={(e) => handleChange("tgApiHash", e.target.value)} placeholder="abcdef..." />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSaving} className="w-full">
          {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Сохранение...</> : "Сохранить настройки"}
        </Button>
      </form>

      {/* Proxies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Прокси для Telegram API
          </CardTitle>
          <CardDescription>
            Прокси используются при каждом подключении к Telegram API. Если добавлено несколько — они чередуются по очереди (round-robin).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border rounded-md p-4 space-y-4">
            <h4 className="font-medium text-sm">Добавить прокси</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>IP адрес</Label>
                <Input value={newProxy.ip} onChange={(e) => setNewProxy((p) => ({ ...p, ip: e.target.value }))} placeholder="1.2.3.4" />
              </div>
              <div>
                <Label>Порт</Label>
                <Input value={newProxy.port} onChange={(e) => setNewProxy((p) => ({ ...p, port: e.target.value }))} placeholder="1080" />
              </div>
              <div>
                <Label>Логин <span className="text-muted-foreground">(необязательно)</span></Label>
                <Input value={newProxy.username} onChange={(e) => setNewProxy((p) => ({ ...p, username: e.target.value }))} placeholder="user" />
              </div>
              <div>
                <Label>Пароль <span className="text-muted-foreground">(необязательно)</span></Label>
                <Input type="password" value={newProxy.password} onChange={(e) => setNewProxy((p) => ({ ...p, password: e.target.value }))} placeholder="••••••" />
              </div>
            </div>
            <Button onClick={handleAddProxy} disabled={addingProxy} className="w-full">
              {addingProxy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Добавление...</> : <><Plus className="w-4 h-4 mr-2" />Добавить прокси</>}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Активные прокси</h4>
              <Badge variant="secondary">{proxies.length} шт.</Badge>
            </div>

            {proxiesLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />Загрузка...
              </div>
            ) : proxies.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-md">
                Прокси не добавлены. Подключения к Telegram API будут без прокси.
              </div>
            ) : (
              <div className="space-y-2">
                {proxies.map((proxy, idx) => (
                  <div key={proxy.id} className="flex items-center justify-between border rounded-md px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs font-mono w-6 h-6 flex items-center justify-center p-0">{idx + 1}</Badge>
                      <div>
                        <p className="font-mono text-sm font-medium">{proxy.ip}:{proxy.port}</p>
                        {proxy.username && <p className="text-xs text-muted-foreground">Логин: {proxy.username}</p>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteProxy(proxy.id)}
                      disabled={deletingProxyId === proxy.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {deletingProxyId === proxy.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
