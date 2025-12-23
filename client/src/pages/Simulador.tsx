import { FinanceSimulatorForm } from "@/components/FinanceSimulatorForm";
import { PageLayout } from "@/components/PageLayout";

export function Simulador() {
  return (
    <PageLayout title="Simulador de Financiamento" description="Simule as parcelas do seu financiamento imobiliário de luxo.">
      <div className="py-12">
        <FinanceSimulatorForm />
      </div>
    </PageLayout>
  );
}
