import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global fetch interceptor — adds Authorization header to all /api requests
const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("/api") || url.includes("/api/")) {
    const token = localStorage.getItem("tg_admin_token");
    if (token) {
      init = {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
      };
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
