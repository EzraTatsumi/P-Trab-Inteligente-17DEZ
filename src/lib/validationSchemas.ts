import * as z from "zod";

// Schema para Organizações Militares (OM)
export const omSchema = z.object({
  nome_om: z.string().min(1, "O nome da OM é obrigatório."),
  codug_om: z.string().min(6, "O CODUG deve ter 6 dígitos.").max(6, "O CODUG deve ter 6 dígitos."),
  rm_vinculacao: z.string().min(1, "A RM de vinculação é obrigatória."),
  codug_rm_vinculacao: z.string().min(6, "O CODUG da RM deve ter 6 dígitos.").max(6, "O CODUG da RM deve ter 6 dígitos."),
  cidade: z.string().min(1, "A cidade é obrigatória."),
  ativo: z.boolean().optional(),
});

// Schema para Diretrizes de Custeio
export const diretrizCusteioSchema = z.object({
  ano_referencia: z.number().int().min(2020, "Ano inválido.").max(2050, "Ano inválido."),
  classe_i_valor_qs: z.number().min(0, "Valor QS deve ser positivo."),
  classe_i_valor_qr: z.number().min(0, "Valor QR deve ser positivo."),
  classe_iii_fator_gerador: z.number().min(0, "Fator deve ser positivo."),
  classe_iii_fator_embarcacao: z.number().min(0, "Fator deve ser positivo."),
  classe_iii_fator_equip_engenharia: z.number().min(0, "Fator deve ser positivo."),
  observacoes: z.string().optional(),
});

// NOVO: Schema para Diretrizes Operacionais (Atualizado para Diárias Detalhadas)
export const diretrizOperacionalSchema = z.object({
  ano_referencia: z.number().int().min(2020, "Ano inválido.").max(2050, "Ano inválido."),
  
  // REMOVIDO: valor_diaria_padrao
  
  // NOVOS CAMPOS DE DIÁRIA
  diaria_referencia_legal: z.string().optional(),
  diaria_of_gen_bsb: z.number().min(0, "Valor deve ser positivo."),
  diaria_of_gen_capitais: z.number().min(0, "Valor deve ser positivo."),
  diaria_of_gen_demais: z.number().min(0, "Valor deve ser positivo."),
  diaria_of_sup_bsb: z.number().min(0, "Valor deve ser positivo."),
  diaria_of_sup_capitais: z.number().min(0, "Valor deve ser positivo."),
  diaria_of_sup_demais: z.number().min(0, "Valor deve ser positivo."),
  diaria_of_int_sgt_bsb: z.number().min(0, "Valor deve ser positivo."),
  diaria_of_int_sgt_capitais: z.number().min(0, "Valor deve ser positivo."),
  diaria_of_int_sgt_demais: z.number().min(0, "Valor deve ser positivo."),
  diaria_demais_pracas_bsb: z.number().min(0, "Valor deve ser positivo."),
  diaria_demais_pracas_capitais: z.number().min(0, "Valor deve ser positivo."),
  diaria_demais_pracas_demais: z.number().min(0, "Valor deve ser positivo."),
  
  // CAMPOS EXISTENTES
  fator_passagens_aereas: z.number().min(0, "Fator deve ser positivo."),
  fator_servicos_terceiros: z.number().min(0, "Fator deve ser positivo."),
  valor_verba_operacional_dia: z.number().min(0, "Valor deve ser positivo."),
  valor_suprimentos_fundo_dia: z.number().min(0, "Valor deve ser positivo."),
  valor_complemento_alimentacao: z.number().min(0, "Valor deve ser positivo."),
  valor_fretamento_aereo_hora: z.number().min(0, "Valor deve ser positivo."),
  valor_locacao_estrutura_dia: z.number().min(0, "Valor deve ser positivo."),
  valor_locacao_viaturas_dia: z.number().min(0, "Valor deve ser positivo."),
  fator_material_consumo: z.number().min(0, "Fator deve ser positivo."),
  fator_concessionaria: z.number().min(0, "Fator deve ser positivo."),
  observacoes: z.string().optional(),
});

// Schema para o formulário de Perfil do Usuário
export const profileSchema = z.object({
    first_name: z.string().min(1, "O primeiro nome é obrigatório."),
    last_name: z.string().min(1, "O sobrenome é obrigatório."),
    avatar_url: z.string().url().or(z.literal("")).optional(),
    default_diretriz_year: z.number().nullable().optional(),
    om_id: z.string().nullable().optional(),
    om_name: z.string().optional(),
    om_ug: z.string().optional(),
});

// Schema para Login
export const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

// Schema para Cadastro (Signup)
export const signupSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  confirmPassword: z.string().min(6, "A confirmação de senha é obrigatória."),
  first_name: z.string().min(1, "O primeiro nome é obrigatório."),
  last_name: z.string().min(1, "O sobrenome é obrigatório."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

// Schema para Reset de Senha
export const resetPasswordSchema = z.object({
  password: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres."),
  confirmPassword: z.string().min(6, "A confirmação de senha é obrigatória."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

// Schema para Solicitação de Reset de Senha
export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido."),
});