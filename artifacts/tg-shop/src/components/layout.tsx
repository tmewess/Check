import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { isTelegramWebApp } from "@/lib/telegram";

function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("light");
    } else {
      root.classList.add("light");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((v) => !v) };
}

const navItems = [
  {
    href: "/",
    label: "Каталог",
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.55}>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" stroke={active ? "hsl(262 83% 63%)" : "none"} fill="none" strokeWidth="1.5"/>
        <path d="M12 17.5v-11" stroke={active ? "hsl(262 83% 63%)" : "none"} fill="none" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: "/orders",
    label: "Заказы",
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.55}>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5" stroke={active ? "hsl(262 83% 63%)" : "none"} fill="none" strokeWidth="1.5"/>
        <path d="M12 22V12" stroke={active ? "hsl(262 83% 63%)" : "none"} fill="none" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: "/news",
    label: "Новости",
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.55}>
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8" stroke={active ? "hsl(262 83% 63%)" : "none"} fill="none" strokeWidth="1.5"/>
        <path d="M15 18h-5" stroke={active ? "hsl(262 83% 63%)" : "none"} fill="none" strokeWidth="1.5"/>
        <path d="M10 6h8v4h-8V6Z" stroke={active ? "hsl(262 83% 63%)" : "none"} fill="none" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.55}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [pressed, setPressed] = useState<string | null>(null);
  const { isDark, toggle } = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isTelegramWebApp()) {
      WebApp.ready();
      WebApp.expand();
    }
    audioRef.current = new Audio("/tg-shop/click.mp3");
    audioRef.current.volume = 0.6;
  }, []);

  const handlePress = (href: string) => {
    setPressed(href);
    setTimeout(() => setPressed(null), 180);
  };

  const handleLogoClick = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground pb-[72px]">
      <style>{`
        @keyframes navBounce {
          0% { transform: scale(1) translateY(0); }
          30% { transform: scale(0.80) translateY(2px); }
          65% { transform: scale(1.18) translateY(-2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes indicatorSlide {
          0% { transform: scaleX(0) translateX(-50%); opacity: 0; }
          100% { transform: scaleX(1) translateX(-50%); opacity: 1; }
        }
        @keyframes labelPop {
          0% { opacity: 0; transform: translateY(3px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nav-active-bounce {
          animation: navBounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .nav-press {
          animation: navBounce 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .nav-indicator {
          left: 50%;
          animation: indicatorSlide 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          transform-origin: center;
        }
        .nav-label-active {
          animation: labelPop 0.22s ease-out forwards;
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full">
        <div
          className="absolute inset-0 border-b"
          style={{
            background: isDark
              ? "rgba(0,0,0,0.85)"
              : "rgba(255,255,255,0.85)",
            borderColor: "rgba(168,85,247,0.12)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        />
        <div className="relative flex h-14 items-center justify-between px-4">
          <button
            className="flex items-center gap-2.5 focus:outline-none active:scale-95 transition-transform"
            onClick={handleLogoClick}
            aria-label="VoidAccount"
          >
            <div className="relative">
              <div
                className="absolute inset-0 rounded-xl blur-md opacity-50"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
              />
              <div
                className="relative h-9 w-9 rounded-xl flex items-center justify-center neon-logo overflow-hidden"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)" }}
              >
                <span className="text-white font-black text-base select-none">V</span>
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold tracking-tight text-[15px]">VoidAccount</span>
              <span className="text-[10px] font-medium" style={{ color: "hsl(262 83% 70%)" }}>marketplace</span>
            </div>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label="Переключить тему"
            className="relative flex items-center rounded-full p-1 transition-all duration-300 focus:outline-none"
            style={{
              background: isDark
                ? "rgba(168,85,247,0.12)"
                : "rgba(124,58,237,0.08)",
              border: "1px solid rgba(168,85,247,0.2)",
              width: 52,
              height: 28,
            }}
          >
            <span
              className="absolute flex items-center justify-center rounded-full shadow-sm transition-all duration-300"
              style={{
                width: 22,
                height: 22,
                left: isDark ? 3 : "calc(100% - 25px)",
                background: isDark
                  ? "linear-gradient(135deg,#7c3aed,#a855f7)"
                  : "linear-gradient(135deg,#f59e0b,#fbbf24)",
              }}
            >
              {isDark ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* FAQ floating button */}
      <Link
        href="/faq"
        className="fixed z-40 select-none focus:outline-none active:scale-90 transition-transform duration-100"
        style={{ bottom: 80, right: 16 }}
        aria-label="FAQ"
      >
        <div
          className="flex items-center justify-center w-11 h-11 rounded-full shadow-lg"
          style={{
            background: "linear-gradient(135deg,#7c3aed,#a855f7)",
            boxShadow: "0 4px 20px rgba(124,58,237,0.45)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <path d="M12 17h.01"/>
          </svg>
        </div>
      </Link>

      {/* Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
        style={{ height: 64 }}
      >
        <div
          className="absolute inset-0 border-t"
          style={{
            background: isDark
              ? "rgba(0,0,0,0.92)"
              : "rgba(255,255,255,0.92)",
            borderColor: "rgba(168,85,247,0.12)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        />
        <div className="relative flex h-full w-full items-center justify-around px-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const isPressed = pressed === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handlePress(item.href)}
                className="relative flex flex-col items-center justify-center w-full h-full gap-1 select-none focus:outline-none"
              >
                {isActive && (
                  <span
                    className="nav-indicator absolute top-0 w-10 h-[2px] rounded-full"
                    style={{ background: "linear-gradient(90deg,#7c3aed,#ec4899)" }}
                  />
                )}
                <span
                  className={isActive ? "nav-active-bounce" : isPressed ? "nav-press" : ""}
                  style={{ color: isActive ? "hsl(262 83% 68%)" : undefined }}
                >
                  {item.icon(isActive)}
                </span>
                <span
                  className={`text-[10px] font-semibold leading-none transition-colors duration-150 ${isActive ? "nav-label-active" : "opacity-45"}`}
                  style={{ color: isActive ? "hsl(262 83% 68%)" : undefined }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
