import { AuthApiError } from '@supabase/supabase-js';

/**
 * Sanitiza e traduz mensagens de erro comuns do Supabase Auth.
 * @param error O objeto de erro.
 * @returns Uma string de erro amigável.
 */
export const sanitizeAuthError = (error: any): string => {
  if (error instanceof AuthApiError) {
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid login credentials')) {
      return 'Credenciais inválidas. Verifique seu e-mail e senha.';
    }
    if (message.includes('email not confirmed')) {
      return 'E-mail não confirmado. Verifique sua caixa de entrada.';
    }
    if (message.includes('user already registered')) {
      return 'Este e-mail já está cadastrado.';
    }
    if (message.includes('password should be at least 6 characters')) {
      return 'A senha deve ter no mínimo 8 caracteres.';
    }
    if (message.includes('rate limit exceeded')) {
      return 'Limite de tentativas excedido. Tente novamente mais tarde.';
    }
    
    // Fallback para erros de API
    return error.message;
  }
  
  // Fallback para erros genéricos
  if (error && typeof error.message === 'string') {
    return error.message;
  }
  
  return 'Ocorreu um erro desconhecido.';
};

/**
 * Sanitiza e traduz mensagens de erro genéricas.
 * @param error O objeto de erro.
 * @returns Uma string de erro amigável.
 */
export const sanitizeError = (error: any): string => {
  if (error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Ocorreu um erro desconhecido.';
};