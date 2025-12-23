import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { calculatePrice, calculateSac } from "./utils/finance";
import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";

// Schema de entrada para o cálculo
const calculationInputSchema = z.object({
  propertyValue: z.number().int().positive(), // Valor do imóvel em centavos
  downPaymentValue: z.number().int().min(0), // Valor da entrada em centavos
  annualInterestRate: z.number().positive(), // Taxa de juros anual (ex: 0.08)
  termInMonths: z.number().int().positive(), // Prazo em meses
  calculationType: z.enum(["SAC", "PRICE"]), // Tipo de cálculo
  
  // Dados do Lead
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  whatsapp: z.string().min(8, "WhatsApp é obrigatório"),
});

export const financeRouter = router({
  calculate: publicProcedure
    .input(calculationInputSchema)
    .mutation(async ({ input }) => {
      const {
        propertyValue,
        downPaymentValue,
        annualInterestRate,
        termInMonths,
        calculationType,
        name,
        email,
        whatsapp,
      } = input;

      const financedAmount = propertyValue - downPaymentValue;

      if (financedAmount <= 0) {
        throw new Error("O valor financiado deve ser positivo.");
      }

      let result;
      const calculationInput = {
        financedAmount,
        annualInterestRate,
        termInMonths,
      };

      if (calculationType === "PRICE") {
        result = calculatePrice(calculationInput);
      } else {
        result = calculateSac(calculationInput);
      }

      // Captura de Lead
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(leads).values({
        name,
        email,
        whatsapp,
        source: "simulador",
        propertyValue,
        downPaymentValue,
        // Outros campos do lead podem ser preenchidos com defaults ou nulos
      });

      // Notificação por E-mail ao Corretor
      const title = `NOVO LEAD - Simulação de Financiamento de Luxo`;
      const content = `
        Um novo lead de simulação foi capturado:
        
        Nome: ${name}
        Email: ${email}
        WhatsApp: ${whatsapp}
        
        Valor do Imóvel: R$ ${(propertyValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        Valor da Entrada: R$ ${(downPaymentValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        Valor Financiado: R$ ${(financedAmount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        
        Tipo de Cálculo: ${calculationType}
        Primeira Parcela Estimada: R$ ${(result.firstInstallment / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        Total de Juros Estimado: R$ ${(result.totalInterest / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        
        Acesse o Dashboard para mais detalhes e acompanhamento.
      `;

      // Envia a notificação, mas não impede o retorno da simulação em caso de falha
      notifyOwner({ title, content }).catch(console.error);

      return {
        ...result,
        calculationType,
        financedAmount,
      };
    }),
});
