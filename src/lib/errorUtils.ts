"use client";

/**
 * Utilitário de Tratamento de Erros "Padrão Ouro"
 * Garante que mensagens técnicas fiquem no quartel e apenas o essencial vá para a frente de batalha.
 */

export const sanitizeError = (error: any): string => {
  // 1. Logging Condicional (Apenas em Desenvolvimento)
  // import.meta.env.DEV é uma constante do Vite que é false em build de produção.
  if (import.meta.env.DEV) {
    console.error(" [DEBUG TÉCNICO]:", error);
  }

  // 2. Extração da Mensagem Amigável
  if (typeof error === 'string') return error;
  
  const code = error?.code || '';
  const msg = error?.message || error?.error_description || "Erro inesperado na operação.";

  // 3. Sanitização de Erros Comuns do Supabase/PostgreSQL
  if (msg.includes("PGRST") || code.startsWith("PGRST")) return "Erro de comunicação com o banco de dados.";
  if (msg.includes("row-level security") || code === '42501') return "Você não tem permissão para realizar esta ação.";
  if (msg.includes("violates foreign key constraint") || code === '23503') return "Este registro está vinculado a outros dados e não pode ser alterado.";
  if (msg.includes("duplicate key") || code === '23505' || error?.status === 409) return "Já existe um registro com estes dados para o período selecionado.";
  if (msg.includes("JWT") || msg.includes("session")) return "Sua sessão expirou. Por favor, faça login novamente.";
  
  // Erros de Autenticação específicos
  if (code === 'invalid_credentials' || msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de fazer login.";
  if (msg.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";

  return msg;
};

/**
 * Função para reportar erros a serviços externos (Ex: Sentry) 
 * sem expor detalhes no console do cliente em ambiente de produção.
 */
export const reportError = (error: any, context?: string) => {
  // No futuro, esta função enviará os dados para um serviço de monitoramento (Sentry/LogRocket).
  // No momento, apenas garante o silêncio em produção e o debug em desenvolvimento.
  if (import.meta.env.DEV) {
    console.group(`🚨 Erro Reportado: ${context || 'Geral'}`);
    console.table(error);
    console.groupEnd();
  }
};

/**
 * Mantido para compatibilidade com o sistema de autenticação.
 * Redireciona para o motor de sanitização unificado.
 */
export const sanitizeAuthError = (error: any): string => {
  return sanitizeError(error);
};