import { Card, CardContent } from "@/components/ui/card";
import { Workflow } from "lucide-react";

export default function AutomationsPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Automações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Construtor visual de fluxos: palavras-chave, condições, delay e tags.
      </p>
      <Card className="mt-6">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Workflow size={28} />
          <p className="max-w-sm text-sm">
            O construtor visual de automações chega na <b>Fase 3</b>, junto com o recebimento de
            mensagens em tempo real.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
