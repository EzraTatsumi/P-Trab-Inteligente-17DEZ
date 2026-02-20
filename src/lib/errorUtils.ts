/**
 * Error sanitization utility to prevent information leakage
 * Maps technical errors to user-friendly messages
 */

const isDev = import.meta.env.DEV;

export const sanitizeError = (error: any): string => {
  // Log full error for debugging (visible in browser console)
  console.error('Error details:', error.code, error.message, error);

  // In development, show full errors for debugging
  if (isDev) {
    return error.message || 'Ocorreu um erro inesperado';
  }

  // PostgreSQL error codes
  if (error.code === '23505') return 'Este registro já existe para o ano selecionado';
  if (error.code === '23503') return 'Dados relacionados não encontrados';
  if (error.code === '23502') return 'Campos obrigatórios não preenchidos no banco';
  if (error.code === '42501') return 'Acesso negado pelas políticas de segurança (RLS)';

  // Supabase/Postgres common patterns
  if (error.message?.includes('policy')) return 'Acesso negado: você não tem permissão para esta ação';
  if (error.message?.includes('duplicate key')) return 'Já existe um registro com estes dados';
  if (error.message?.includes('JWT')) return 'Sessão expirada. Por favor, faça login novamente';

  // Generic fallback with a bit more context
  return error.message || 'Ocorreu um erro ao processar a solicitação. Tente novamente.';
};

/**
 * Sanitize authentication errors specifically
 */
export const sanitizeAuthError = (error: any): string => {
  const message = error.message || '';

  if (message.includes('Invalid login')) return 'Email ou senha incorretos';
  if (message.includes('Email not confirmed')) return 'Confirme seu email antes de fazer login';
  if (message.includes('already registered')) return 'Este email já está cadastrado';
  if (message.includes('Password')) return 'Senha inválida ou muito fraca';
  if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos';
  
  if (isDev) return message;
  return 'Erro ao autenticar. Verifique seus dados e tente novamente.';
};