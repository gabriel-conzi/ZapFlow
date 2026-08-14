"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "zapflow-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // navegador bloqueando localStorage (ex: modo privado) — sem problema,
      // o tema só não fica salvo pra próxima visita.
    }
  }

  // Evita renderizar o ícone errado por uma fração de segundo antes do
  // useEffect rodar (o estado real do tema só é conhecido no browser).
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled title="Tema">
        <Sun size={15} />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={isDark ? "Mudar pra modo claro" : "Mudar pra modo escuro"}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </Button>
  );
}
