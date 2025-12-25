/**
 * Error sanitization utility to prevent information leakage
 * Maps technical errors to user-friendly messages
 */

const isDev = import.meta.env.DEV;

export const sanitizeError = (error: any): string => {
  // In development, show full errors for debugging
  if (isDev) {
    console.error('Full error (dev only):', error);
    return error.message || 'Ocorreu um erro';
  }

  // Log full error server-side for debugging (only shown in browser console)
  console.error('Error details:', error.code, error.message);

  // PostgreSQL error codes
  if (error.code === '23505') return 'Este registro já existe';
  if (error.code === '23503') return 'Dados relacionados não encontrados';
  if (error.code === '23502') return 'Campos obrigatórios não preenchidos';
  if (error.code === '22001') return 'Texto muito longo para o campo';
  if (error.code === '22003') return 'Valor numérico fora do intervalo permitido';

  // Supabase/Postgres common patterns
  if (error.message?.includes('policy')) return 'Acesso negado';
  if (error.message?.includes('duplicate key')) return 'Este registro já existe';
  if (error.message?.includes('foreign key')) return 'Dados relacionados não encontrados';
  if (error.message?.includes('violates')) return 'Dados inválidos';
  if (error.message?.includes('not found')) return 'Registro não encontrado';
  if (error.message?.includes('permission')) return 'Permissão negada';

  // Auth errors
  if (error.message?.includes('Invalid login')) return 'Email ou senha incorretos';
  if (error.message?.includes('Email not confirmed')) return 'Confirme seu email antes de fazer login';
  if (error.message?.includes('User already registered')) return 'Este email já está cadastrado';
  if (error.message?.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos';

  // Generic fallback
  return 'Ocorreu um erro. Tente novamente.';
};

/**
 * Sanitize authentication errors specifically
 */
export const sanitizeAuthError = (error: any): string => {
  if (isDev) {
    console.error('Auth error (dev only):', error);
    return error.message || 'Erro ao autenticar';
  }

  // Common auth error patterns
  if (error.message?.includes('Invalid login')) return 'Email ou senha incorretos';
  if (error.message?.includes('Email not confirmed')) return 'Confirme seu email antes de fazer login';
  if (error.message?.includes('already registered')) return 'Este email já está cadastrado';
  if (error.message?.includes('Password')) return 'Senha inválida ou muito fraca';
  if (error.message?.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos';
  if (error.message?.includes('network')) return 'Erro de conexão. Verifique sua internet';
  
  // NOVO: Tradução para erro de e-mail inválido
  if (error.message?.includes('Email address') && error.message?.includes('is invalid')) return 'O endereço de e-mail fornecido é inválido.';

  return 'Erro ao autenticar. Tente novamente.';
};