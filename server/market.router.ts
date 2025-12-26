import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { searchProfiles, properties } from "../drizzle/schema";
import { sql, and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

// Helper para formatar valores em centavos para BRL
const formatCurrency = (value: number) => 
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Router para funcionalidades de Inteligência de Mercado.
 */
export const marketRouter = router({
  /**
   * Procedure para verificar novos imóveis e fazer o matching com perfis de busca.
   * Esta rota é destinada a ser chamada por um sistema externo (como o N8n)
   * em intervalos regulares (ex: a cada 24 horas).
   */
  checkNewProperties: publicProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Definir o período de busca (últimas 24 horas)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // 2. Buscar novos imóveis (criados ou atualizados recentemente)
      const newProperties = await db.select()
        .from(properties)
        .where(gte(properties.createdAt, oneDayAgo));

      if (newProperties.length === 0) {
        return { success: true, message: "Nenhum novo imóvel encontrado nas últimas 24h." };
      }

      // 3. Buscar todos os perfis de busca ativos
      const activeProfiles = await db.select()
        .from(searchProfiles)
        .where(eq(searchProfiles.isActive, true));

      if (activeProfiles.length === 0) {
        return { success: true, message: "Nenhum perfil de busca ativo encontrado." };
      }

      let matchesFound = 0;
      const notifications: { title: string; content: string }[] = [];

      // 4. Fazer o matching
      for (const profile of activeProfiles) {
        const lead = await db.query.leads.findFirst({ where: eq(searchProfiles.leadId, profile.leadId) });
        if (!lead) continue;

        for (const prop of newProperties) {
          // Lógica de Matching
          const isMatch = 
            // Budget
            (profile.budgetMin === null || prop.salePrice >= profile.budgetMin) &&
            (profile.budgetMax === null || prop.salePrice <= profile.budgetMax) &&
            // Quartos
            (profile.bedroomsMin === null || prop.bedrooms >= profile.bedroomsMin) &&
            (profile.bedroomsMax === null || prop.bedrooms <= profile.bedroomsMax) &&
            // Cidade (simples)
            (profile.city === null || prop.city === profile.city);
            // Outros critérios (bairros, tipos, etc. exigiriam parsing de JSON)

          if (isMatch) {
            matchesFound++;
            
            // 5. Criar Notificação para o Corretor (e para o N8n)
            const title = `ALERTA DE OPORTUNIDADE: Novo Imóvel para ${lead.name}`;
            const content = `
              O imóvel "${prop.title}" (R$ ${formatCurrency(prop.salePrice)})
              corresponde ao perfil de busca do lead ${lead.name} (${lead.email} / ${lead.whatsapp}).
              
              **Critérios do Perfil:**
              - Orçamento: ${profile.budgetMin ? formatCurrency(profile.budgetMin) : 'Qualquer'} - ${profile.budgetMax ? formatCurrency(profile.budgetMax) : 'Qualquer'}
              - Quartos: ${profile.bedroomsMin || 'Qualquer'} - ${profile.bedroomsMax || 'Qualquer'}
              - Cidade: ${profile.city || 'Qualquer'}
              
              **Detalhes do Imóvel:**
              - Título: ${prop.title}
              - Preço: R$ ${formatCurrency(prop.salePrice)}
              - Link: [Acessar Imóvel]
              
              Acesse o Dashboard para enviar o alerta ao cliente.
            `;
            
            notifications.push({ title, content });
          }
        }
      }

      // 6. Disparar todas as notificações (o N8n pode capturar isso)
      for (const notif of notifications) {
        // Usamos notifyOwner para que o N8n possa capturar o evento
        notifyOwner(notif).catch(console.error);
      }

      return { 
        success: true, 
        message: `Busca concluída. ${newProperties.length} novos imóveis e ${matchesFound} matches encontrados.`,
        matchesFound,
      };
    }),
});
