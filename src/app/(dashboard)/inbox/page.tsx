import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

export default function InboxPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Conversas de Direct e comentários do Instagram em um só lugar.
      </p>
      <Card className="mt-6">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Inbox size={28} />
          <p className="max-w-sm text-sm">
            Essa tela chega na <b>Fase 2</b>: assim que sua conta do Instagram estiver conectada e
            recebendo webhooks, as conversas vão aparecer aqui automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
