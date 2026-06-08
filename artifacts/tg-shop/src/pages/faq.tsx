import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
}

export default function Faq() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/faq")
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  const toggle = (id: number) => setOpenId(prev => prev === id ? null : id);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 active:scale-90 transition-transform duration-100"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-lg">FAQ</span>
        </div>
      </header>

      <main className="flex-1 p-4 pb-8 space-y-3">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Вопросы пока не добавлены.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Загляните позже!</p>
          </div>
        ) : (
          items.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden transition-all duration-200"
                style={{
                  background: "hsl(var(--card))",
                  border: isOpen
                    ? "1px solid rgba(168,85,247,0.35)"
                    : "1px solid rgba(168,85,247,0.1)",
                  boxShadow: isOpen ? "0 4px 20px rgba(124,58,237,0.12)" : "none",
                }}
              >
                <button
                  className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left focus:outline-none active:opacity-75 transition-opacity"
                  onClick={() => toggle(item.id)}
                >
                  <span className="font-medium text-sm leading-snug">{item.question}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {isOpen
                      ? <ChevronUp className="w-4 h-4" style={{ color: "hsl(262 83% 68%)" }} />
                      : <ChevronDown className="w-4 h-4" />
                    }
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <div
                      className="w-full h-px mb-3"
                      style={{ background: "rgba(168,85,247,0.15)" }}
                    />
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
