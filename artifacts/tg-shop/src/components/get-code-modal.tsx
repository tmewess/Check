import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, X, RefreshCw } from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";

interface CodeEntry {
  code: string;
  date: string;
}

interface GetCodeModalProps {
  accountId: number;
  phone?: string | null;
  onClose: () => void;
}

function formatCodeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин. назад`;

  if (isToday(date)) {
    return `сегодня в ${format(date, "HH:mm")}`;
  }
  if (isYesterday(date)) {
    return `вчера в ${format(date, "HH:mm")}`;
  }
  return format(date, "EEEE 'в' HH:mm", { locale: ru });
}

export function GetCodeModal({ accountId, phone, onClose }: GetCodeModalProps) {
  const { toast } = useToast();
  const [codes, setCodes] = useState<CodeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/session-code`);
      const data = await res.json();
      if (data.success && data.codes?.length > 0) {
        setCodes(data.codes);
      } else {
        setError(data.error || "Коды не найдены");
        setCodes(null);
      }
    } catch {
      setError("Нет подключения к API");
      setCodes(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Скопировано", description: `Код ${code} скопирован` });
  };

  if (!codes && !error && !isLoading) {
    fetchCodes();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-t-2xl border border-border/50 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-green-600 rounded-t-2xl">
          <span className="font-semibold text-white text-base">Коды подтверждения</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-4 pt-3 pb-1">
          {phone && (
            <p className="text-sm text-muted-foreground mb-3">
              Telegram для <span className="font-mono text-foreground">{phone}</span>
            </p>
          )}
        </div>

        <div className="px-4 pb-4 space-y-3 min-h-[120px]">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Запрашиваю коды...</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}

          {!isLoading && codes && codes.map((entry, i) => (
            <div key={i} className="space-y-1">
              {i === 0 && (
                <p className="text-xs text-muted-foreground">{formatCodeDate(entry.date)}</p>
              )}
              {i > 0 && (
                <p className="text-xs text-muted-foreground pt-1 border-t border-border/30">{formatCodeDate(entry.date)}</p>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/70 rounded-xl px-4 py-3 text-xl font-mono font-semibold tracking-widest text-foreground">
                  {entry.code}
                </div>
                <Button
                  size="icon"
                  className="h-12 w-12 rounded-xl bg-muted/70 hover:bg-muted text-foreground shrink-0"
                  variant="ghost"
                  onClick={() => handleCopy(entry.code)}
                >
                  <Copy className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 pb-5 pt-1">
          <Button
            variant="outline"
            className="w-full h-11 text-sm font-medium"
            onClick={fetchCodes}
            disabled={isLoading}
          >
            {isLoading ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Загрузка...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" />Получить новый код</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
