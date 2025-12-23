import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";

// Schema de validação do formulário
const formSchema = z.object({
  propertyValue: z.coerce.number().int().positive("Valor do imóvel deve ser positivo"),
  downPaymentValue: z.coerce.number().int().min(0, "Valor da entrada não pode ser negativo"),
  annualInterestRate: z.coerce.number().min(0.01, "Taxa de juros deve ser positiva"),
  termInMonths: z.coerce.number().int().min(12, "Prazo mínimo de 12 meses"),
  calculationType: z.enum(["SAC", "PRICE"]),
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  whatsapp: z.string().min(8, "WhatsApp é obrigatório"),
});

type FormValues = z.infer<typeof formSchema>;

interface FinanceSimulatorFormProps {
  initialPropertyValue?: number; // Valor inicial do imóvel (em centavos)
  isWidget?: boolean; // Se for um widget lateral, o layout é mais compacto
}

export function FinanceSimulatorForm({ initialPropertyValue, isWidget = false }: FinanceSimulatorFormProps) {
  const [result, setResult] = useState<any>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyValue: initialPropertyValue || 50000000, // Exemplo: R$ 500.000,00
      downPaymentValue: initialPropertyValue ? Math.round(initialPropertyValue * 0.2) : 10000000, // 20% de entrada
      annualInterestRate: 0.08, // 8% ao ano
      termInMonths: 360, // 30 anos
      calculationType: "SAC",
      name: "",
      email: "",
      whatsapp: "",
    },
  });

  const { mutate, isLoading } = trpc.finance.calculate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setShowLeadForm(false); // Esconde o formulário de lead após o sucesso
    },
    onError: (error) => {
      console.error("Erro na simulação:", error);
      alert("Ocorreu um erro ao simular o financiamento. Verifique os dados e tente novamente.");
    },
  });

  const onSubmitSimulation = (values: FormValues) => {
    // A primeira submissão é apenas para calcular e mostrar o formulário de lead
    if (!showLeadForm) {
      setShowLeadForm(true);
      return;
    }
    
    // A segunda submissão envia os dados e chama o backend
    mutate(values);
  };

  const cardClassName = isWidget ? "w-full" : "w-full max-w-2xl mx-auto";

  return (
    <Card className={cardClassName}>
      <CardHeader>
        <CardTitle>{isWidget ? "Simule Seu Financiamento" : "Simulador de Financiamento de Luxo"}</CardTitle>
        <CardDescription>
          {isWidget ? "Descubra as parcelas para este imóvel." : "Preencha os dados para simular seu financiamento e dar o primeiro passo para sua mansão."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitSimulation)} className="space-y-4">
            {/* Campos de Simulação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="propertyValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do Imóvel (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 1500000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) * 100)} // Converte para centavos
                        value={field.value / 100} // Exibe em Reais
                        disabled={isWidget}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="downPaymentValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Entrada (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 300000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) * 100)} // Converte para centavos
                        value={field.value / 100} // Exibe em Reais
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="annualInterestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Juros Anual (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 8.0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) / 100)} // Converte para decimal
                        value={field.value * 100} // Exibe em porcentagem
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="termInMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo (Meses)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 360" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="calculationType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tipo de Tabela</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="SAC" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          SAC (Sistema de Amortização Constante)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="PRICE" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          PRICE (Parcelas Constantes)
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campos de Lead Magnet (Visível após a primeira submissão) */}
            {showLeadForm && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Preencha seus dados para ver o resultado</h3>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="seu.email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="(99) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {showLeadForm ? "Ver Resultado e Enviar Lead" : "Simular Financiamento"}
            </Button>
          </form>
        </Form>

        {/* Resultado da Simulação */}
        {result && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 space-y-3">
            <h3 className="text-xl font-bold text-green-600 dark:text-green-400">Resultado da Simulação ({result.calculationType})</h3>
            <p>
              <span className="font-semibold">Valor Financiado:</span> {formatCurrency(result.financedAmount)}
            </p>
            <p>
              <span className="font-semibold">Primeira Parcela:</span> {formatCurrency(result.firstInstallment)}
            </p>
            <p>
              <span className="font-semibold">Última Parcela:</span> {formatCurrency(result.lastInstallment)}
            </p>
            <p>
              <span className="font-semibold">Total Pago (Principal + Juros):</span> {formatCurrency(result.totalPaid)}
            </p>
            <p>
              <span className="font-semibold">Total de Juros:</span> {formatCurrency(result.totalInterest)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              *Estes valores são estimativas. Para uma análise completa, nosso corretor entrará em contato.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
