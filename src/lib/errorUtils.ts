import { AuthApiError } from "@supabase/supabase-js";

/**
 * Sanitiza e traduz mensagens de erro de autenticação do Supabase para o usuário.
 * @param error O objeto de erro retornado pelo Supabase.
 * @returns Uma string de erro amigável em português.
 */
export const sanitizeAuthError = (error: Error | AuthApiError): string => {
  // Erro genérico de rede ou servidor
  if (error instanceof Error && !(error instanceof AuthApiError)) {
    return 'Ocorreu um erro de rede ou servidor. Tente novamente.';
  }

  // Erros de API do Supabase
  const message = error.message || '';

  // Auth errors
  if (message.includes('Invalid login credentials')) return 'Email ou senha incorretos';
  
  // Ajuste para garantir que a tradução seja capturada
  if (message.includes('Email not confirmed')) return 'Email não confirmado. Verifique sua caixa de entrada.';
  
  if (message.includes('User already registered')) return 'Este email já está cadastrado';
  if (message.includes('Password recovery requires a valid email')) return 'Recuperação de senha requer um email válido';
  if (message.includes('User not found')) return 'Usuário não encontrado';
  if (message.includes('A user with this email address has already been registered')) return 'Este email já está cadastrado';
  if (message.includes('Password should be at least 6 characters')) return 'A senha deve ter no mínimo 8 caracteres';
  
  // Erro de rate limit
  if (message.includes('For security purposes, you can only request a password reset once every 60 seconds')) {
    return 'Você pode solicitar a recuperação de senha apenas uma vez a cada 60 segundos.';
  }
  
  // Erro de rate limit de email
  if (message.includes('For security purposes, you can only request a new confirmation email once every 60 seconds')) {
    return 'Você pode solicitar um novo email de confirmação apenas uma vez a cada 60 segundos.';
  }

  // Erro genérico de autenticação
  return 'Ocorreu um erro de autenticação. Tente novamente ou entre em contato com o suporte.';
};