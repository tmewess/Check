import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Newspaper, Sparkles } from "lucide-react";

interface NewsItem {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((data) => {
        setNews(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-6">
        <div className="animate-fade-in-1">
          <h1 className="text-xl font-bold tracking-tight">Новости</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Актуальная информация</p>
        </div>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))
          ) : news.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground animate-fade-in">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(168,85,247,0.1)" }}
              >
                <Newspaper className="w-8 h-8" style={{ color: "hsl(262 83% 68%)" }} />
              </div>
              <p className="text-sm font-medium">Новостей пока нет</p>
              <p className="text-xs mt-1 opacity-60">Загляните позже</p>
            </div>
          ) : (
            news.map((item, i) => (
              <div
                key={item.id}
                className="rounded-2xl p-4 animate-fade-in"
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid rgba(168,85,247,0.12)",
                  animationDelay: `${i * 0.07}s`,
                }}
              >
                {/* Accent left bar */}
                <div className="flex gap-3">
                  <div
                    className="w-1 rounded-full flex-shrink-0"
                    style={{ background: "linear-gradient(180deg,#7c3aed,#ec4899)", minHeight: 40 }}
                  />
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm leading-snug">{item.title}</h3>
                      <span
                        className="text-[10px] font-medium flex-shrink-0 px-2 py-0.5 rounded-lg"
                        style={{
                          background: "rgba(168,85,247,0.1)",
                          color: "hsl(262 83% 68%)",
                        }}
                      >
                        {format(new Date(item.createdAt), "d MMM", { locale: ru })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {!isLoading && news.length > 0 && (
          <div
            className="rounded-2xl p-3 flex items-center gap-2 animate-fade-in"
            style={{
              background: "linear-gradient(135deg,rgba(124,58,237,0.1),rgba(236,72,153,0.06))",
              border: "1px solid rgba(168,85,247,0.15)",
            }}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(262 83% 68%)" }} />
            <span className="text-xs text-muted-foreground">Подписывайтесь на наш канал, чтобы не пропустить обновления</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
