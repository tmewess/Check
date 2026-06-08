import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, HelpCircle, GripVertical, Eye, EyeOff } from "lucide-react";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export default function Faq() {
  const { toast } = useToast();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FaqItem | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    fetch("/api/faq/all")
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const openCreate = () => {
    setEditingItem(null);
    setQuestion("");
    setAnswer("");
    setSortOrder(String(items.length));
    setIsDialogOpen(true);
  };

  const openEdit = (item: FaqItem) => {
    setEditingItem(item);
    setQuestion(item.question);
    setAnswer(item.answer);
    setSortOrder(String(item.sort_order));
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) {
      toast({ title: "Ошибка", description: "Заполните вопрос и ответ", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editingItem ? `/api/faq/${editingItem.id}` : "/api/faq";
      const method = editingItem ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), answer: answer.trim(), sortOrder: parseInt(sortOrder, 10) || 0 }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Сохранено" });
        setIsDialogOpen(false);
        fetchItems();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleToggleActive = async (item: FaqItem) => {
    try {
      await fetch(`/api/faq/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.is_active }),
      });
      fetchItems();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить этот вопрос?")) return;
    try {
      await fetch(`/api/faq/${id}`, { method: "DELETE" });
      toast({ title: "Удалено" });
      fetchItems();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">FAQ</h2>
          <p className="text-muted-foreground text-sm mt-1">Часто задаваемые вопросы — отображаются в мини-приложении</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить вопрос
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="w-4 h-4" />
            Вопросы и ответы ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Вопросов пока нет. Добавьте первый!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-3 p-4 rounded-lg border transition-colors ${item.is_active ? "border-border bg-card" : "border-border/40 bg-muted/20 opacity-60"}`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="font-medium text-sm leading-snug">{item.question}</span>
                      {!item.is_active && <Badge variant="outline" className="text-xs shrink-0">Скрыт</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{item.answer}</p>
                    <div className="text-xs text-muted-foreground mt-1">Порядок: {item.sort_order}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleToggleActive(item)}
                      title={item.is_active ? "Скрыть" : "Показать"}
                    >
                      {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Редактировать вопрос" : "Новый вопрос"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Вопрос</Label>
              <Input
                placeholder="Как пользоваться аккаунтом?"
                value={question}
                onChange={e => setQuestion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ответ</Label>
              <Textarea
                placeholder="Подробный ответ на вопрос..."
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Порядок сортировки</Label>
              <Input
                type="number"
                placeholder="0"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Меньшее число — выше в списке</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
