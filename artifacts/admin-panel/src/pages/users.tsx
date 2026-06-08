import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Ban, Minus, Plus, User } from "lucide-react";

interface UserRow {
  telegramUserId: string;
  balance: number;
  updatedAt: string;
  orderCount: number;
}

type DialogMode = "add" | "subtract";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>("add");
  const [balanceAmount, setBalanceAmount] = useState("100");
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось загрузить пользователей", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateBalance = async (telegramUserId: string, delta: number) => {
    try {
      const res = await fetch(`/api/users/${telegramUserId}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: delta }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Успех", description: `Баланс обновлен: ${data.balance} Stars` });
        fetchUsers();
        setSelectedUser(null);
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось обновить баланс", variant: "destructive" });
    }
  };

  const openDialog = (user: UserRow, mode: DialogMode) => {
    setSelectedUser(user);
    setDialogMode(mode);
    setBalanceAmount("100");
  };

  const handleConfirmBalance = () => {
    if (!selectedUser) return;
    const amount = parseInt(balanceAmount) || 0;
    if (amount <= 0) {
      toast({ title: "Ошибка", description: "Введите положительное число", variant: "destructive" });
      return;
    }
    const delta = dialogMode === "add" ? amount : -amount;
    handleUpdateBalance(selectedUser.telegramUserId, delta);
  };

  const handleBan = async (telegramUserId: string) => {
    toast({ title: "Заблокирован", description: `Пользователь ${telegramUserId} заблокирован` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Пользователи</h2>
        <div className="text-sm text-muted-foreground">
          Всего: {users.length}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Баланс</TableHead>
                <TableHead>Заказы</TableHead>
                <TableHead>Обновлён</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Пользователей пока нет.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.telegramUserId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-xs">{u.telegramUserId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {u.balance} Stars
                      </Badge>
                    </TableCell>
                    <TableCell>{u.orderCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.updatedAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-500"
                          onClick={() => openDialog(u, "add")}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-orange-500"
                          onClick={() => openDialog(u, "subtract")}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleBan(u.telegramUserId)}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Balance Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "Выдать Stars" : "Забрать Stars"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Пользователь</Label>
              <div className="font-mono text-sm text-muted-foreground">{selectedUser?.telegramUserId}</div>
            </div>
            <div className="space-y-1">
              <Label>Текущий баланс</Label>
              <div className="font-semibold">{selectedUser?.balance} Stars</div>
            </div>
            <div className="space-y-2">
              <Label>Сумма (Stars)</Label>
              <Input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="100"
                min="1"
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              variant={dialogMode === "add" ? "default" : "destructive"}
              onClick={handleConfirmBalance}
            >
              {dialogMode === "add" ? (
                <><Plus className="w-4 h-4 mr-1" /> Выдать {balanceAmount || "?"} Stars</>
              ) : (
                <><Minus className="w-4 h-4 mr-1" /> Забрать {balanceAmount || "?"} Stars</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
