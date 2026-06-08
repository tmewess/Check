import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trash2, UserPlus, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Admin {
  telegramUserId: string;
  username: string | null;
  loginUsername: string | null;
  loginPassword: string | null;
  addedAt: string;
}

export default function Admins() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUserId, setNewUserId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newLoginUsername, setNewLoginUsername] = useState("");
  const [newLoginPassword, setNewLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchAdmins = () => {
    setIsLoading(true);
    fetch("/api/admins")
      .then((r) => r.json())
      .then((data) => { setAdmins(data || []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleAdd = async () => {
    const id = newUserId.trim();
    if (!id) {
      toast({ title: "Ошибка", description: "Введите Telegram ID пользователя", variant: "destructive" });
      return;
    }
    if ((newLoginUsername.trim() && !newLoginPassword.trim()) || (!newLoginUsername.trim() && newLoginPassword.trim())) {
      toast({ title: "Ошибка", description: "Укажите и логин, и пароль — или оставьте оба пустыми", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: id,
          username: newUsername.trim() || undefined,
          loginUsername: newLoginUsername.trim() || undefined,
          loginPassword: newLoginPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Готово", description: "Администратор добавлен" });
        setNewUserId("");
        setNewUsername("");
        setNewLoginUsername("");
        setNewLoginPassword("");
        fetchAdmins();
      } else {
        toast({ title: "Ошибка", description: data.error || "Не удалось добавить", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Нет подключения к API", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (telegramUserId: string) => {
    try {
      await fetch(`/api/admins/${encodeURIComponent(telegramUserId)}`, { method: "DELETE" });
      setAdmins((prev) => prev.filter((a) => a.telegramUserId !== telegramUserId));
      toast({ title: "Готово", description: "Администратор удалён" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось удалить", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <h2 className="text-3xl font-bold tracking-tight">Администраторы</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Добавить администратора</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Telegram ID *</Label>
              <Input
                placeholder="928951125"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                type="number"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Telegram Username (без @)</Label>
              <Input
                placeholder="username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="border border-border rounded-md p-3 space-y-3 bg-muted/20">
            <p className="text-xs text-muted-foreground font-medium">
              Логин и пароль для входа в панель по кнопке "Войти по логину/паролю" (необязательно)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Логин для панели</Label>
                <Input
                  placeholder="admin_user"
                  value={newLoginUsername}
                  onChange={(e) => setNewLoginUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Пароль для панели</Label>
                <div className="relative">
                  <Input
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={newLoginPassword}
                    onChange={(e) => setNewLoginPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleAdd} disabled={adding}>
            <UserPlus className="w-4 h-4 mr-2" />
            {adding ? "Добавление..." : "Добавить администратора"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Список администраторов</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telegram ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Логин в панель</TableHead>
                <TableHead>Добавлен</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-sm">928951125</TableCell>
                <TableCell><Badge variant="secondary">Void (главный)</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">Void / ••••••••</TableCell>
                <TableCell className="text-muted-foreground text-sm">—</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="text-xs">Системный</Badge>
                </TableCell>
              </TableRow>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Загрузка...</TableCell>
                </TableRow>
              ) : admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Дополнительных администраторов нет</TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow key={admin.telegramUserId}>
                    <TableCell className="font-mono text-sm">{admin.telegramUserId}</TableCell>
                    <TableCell>
                      {admin.username ? <span className="text-sm">@{admin.username}</span> : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {admin.loginUsername ? (
                        <span className="font-mono text-xs">{admin.loginUsername} / ••••••••</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Только через Telegram</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(admin.addedAt), "d MMM yyyy, HH:mm", { locale: ru })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(admin.telegramUserId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
