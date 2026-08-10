import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function BillingPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Assinatura</h1>
      <p className="mt-1 text-sm text-muted-foreground">Plano e cobrança.</p>

      <Card className="mt-6 max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Plano atual</CardTitle>
            <Badge variant="secondary">Gratuito</Badge>
          </div>
          <CardDescription>Uso próprio — sem cobrança configurada ainda.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Esta tela já está com a estrutura pronta para a Fase 5, quando o Stripe for conectado
          (planos, checkout e portal de cobrança).
        </CardContent>
      </Card>
    </div>
  );
}
