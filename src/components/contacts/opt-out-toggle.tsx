"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function OptOutToggle({ contactId, optedOut }: { contactId: string; optedOut: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optedOut: !optedOut }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!optedOut) {
    return (
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={toggle} disabled={loading}>
        {loading && <Loader2 size={12} className="mr-1 animate-spin" />}
        Marcar como &quot;parar&quot;
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive">Optou por sair</Badge>
      <Button variant="ghost" size="sm" className="text-xs" onClick={toggle} disabled={loading}>
        {loading && <Loader2 size={12} className="mr-1 animate-spin" />}
        Reativar
      </Button>
    </div>
  );
}
