/**
 * Utility para sanitizar erros e evitar vazamento de informações técnicas.
 * Mapeia erros técnicos para mensagens amigáveis ao usuário.
 */

const isDev = import.meta.env.DEV;

export const sanitizeError = (error: any): string => {
  console.error('Error details:', error.code, error.message, error);

  if (isDev) {
    return error.message || 'Ocorreu um erro inesperado';
  }

  // Erros comuns do PostgreSQL
  if (error.code === '23505') return 'Este registro já existe para o ano selecionado';
  if (error.code === '23503') return 'Dados relacionados não encontrados';
  if (error.code === '42501') return 'Acesso negado pelas políticas de segurança (RLS)';

  if (error.message?.includes('policy')) return 'Acesso negado: você não tem permissão para esta ação';
  if (error.message?.includes('duplicate key')) return 'Já existe um registro com estes dados';
  
  return 'Ocorreu um erro ao processar a solicitação. Tente novamente.';
};

/**
 * Sanitiza erros específicos de autenticação
 */
export const sanitizeAuthError = (error: any): string => {
  const message = error?.message || '';
  const code = error?.code || '';

  // Tratamento por código (mais preciso)
  if (code === 'invalid_credentials' || message.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.';
  }
  
  if (code === 'email_not_confirmed') return 'Confirme seu e-mail antes de fazer login.';
  if (code === 'user_already_exists') return 'Este e-mail já está cadastrado.';
  if (code === 'over_email_send_rate_limit') return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  
  // Fallbacks por mensagem
  if (message.includes('Password')) return 'Senha inválida ou muito fraca.';
  
  if (isDev) return message;
  return 'Erro ao autenticar. Verifique seus dados e tente novamente.';
};