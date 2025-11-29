import { z } from 'zod';

/**
 * Validation schemas for form inputs
 * Prevents invalid data entry and ensures data integrity
 */

/**
 * Schema de validação para Login e Cadastro (Signup).
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email muito longo" }),
  password: z
    .string()
    .min(6, { message: "Senha deve ter no mínimo 6 caracteres" })
    .max(100, { message: "Senha muito longa" }),
});

/**
 * Schema de validação para o código UG (Unidade Gestora).
 * Deve estar exatamente no formato XXX.XXX (6 dígitos).
 */
export const ugCodeSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}$/, { message: "UG deve ter formato XXX.XXX (6 dígitos)" });

/**
 * Schema de validação para o formulário de registro de Classe I (Subsistência).
 */
export const classeIFormSchema = z.object({
  organizacao: z
    .string()
    .trim()
    .min(1, { message: "Informe a Organização Militar" })
    .max(200, { message: "Nome da OM muito longo (máx 200 caracteres)" }),
  ug: z
    .string()
    .regex(/^\d{3}\.\d{3}$/, { message: "UG deve ter formato XXX.XXX (6 dígitos)" }),
  om_qs: z
    .string()
    .trim()
    .min(1, { message: "Informe a OM que receberá o QS" })
    .max(200, { message: "Nome da OM muito longo (máx 200 caracteres)" }),
  ug_qs: z
    .string()
    .regex(/^\d{3}\.\d{3}$/, { message: "UG QS deve ter formato XXX.XXX (6 dígitos)" }),
  efetivo: z
    .number()
    .int({ message: "Efetivo deve ser um número inteiro" })
    .min(1, { message: "Efetivo deve ser no mínimo 1" })
    .max(100000, { message: "Efetivo muito alto (máx 100.000)" }),
  dias_operacao: z
    .number()
    .int({ message: "Dias de operação deve ser um número inteiro" })
    .min(1, { message: "Dias de operação deve ser no mínimo 1" })
    .max(365, { message: "Dias de operação não pode exceder 365" }),
  nr_ref_int: z
    .number()
    .int({ message: "Número de referência deve ser um número inteiro" })
    .min(1, { message: "Número de referência deve ser no mínimo 1" })
    .max(3, { message: "Número de referência não pode exceder 3" }),
  valor_qs: z
    .number()
    .positive({ message: "Valor QS deve ser positivo" })
    .max(1000000, { message: "Valor QS muito alto" }),
  valor_qr: z
    .number()
    .positive({ message: "Valor QR deve ser positivo" })
    .max(1000000, { message: "Valor QR muito alto" }),
});

/**
 * Schema de validação para o formulário principal de criação/edição do P Trab.
 */
export const ptrabSchema = z.object({
  numero_ptrab: z
    .string()
    .trim()
    .min(1, { message: "Informe o número do P Trab" })
    .max(50, { message: "Número do P Trab muito longo (máx 50 caracteres)" }),
  comando_militar_area: z
    .string()
    .trim()
    .min(1, { message: "Informe o Comando Militar de Área" })
    .max(100, { message: "Comando Militar muito longo (máx 100 caracteres)" }),
  nome_om: z
    .string()
    .trim()
    .min(1, { message: "Informe a OM" })
    .max(200, { message: "Nome da OM muito longo (máx 200 caracteres)" }),
  nome_operacao: z
    .string()
    .trim()
    .min(1, { message: "Informe o nome da operação" })
    .max(200, { message: "Nome da operação muito longo (máx 200 caracteres)" }),
  efetivo_empregado: z
    .string()
    .trim()
    .min(1, { message: "Informe o efetivo empregado" })
    .max(50, { message: "Efetivo muito longo (máx 50 caracteres)" }),
  periodo_inicio: z.string().min(1, { message: "Informe a data de início" }),
  periodo_fim: z.string().min(1, { message: "Informe a data de fim" }),
  nome_cmt_om: z
    .string()
    .max(200, { message: "Nome do comandante muito longo (máx 200 caracteres)" })
    .optional(),
  local_om: z
    .string()
    .max(200, { message: "Local muito longo (máx 200 caracteres)" })
    .optional(),
  acoes: z
    .string()
    .max(2000, { message: "Ações muito longas (máx 2000 caracteres)" })
    .optional(),
}).refine(
  (data) => {
    const inicio = new Date(data.periodo_inicio);
    const fim = new Date(data.periodo_fim);
    return fim >= inicio;
  },
  {
    message: "Data de fim deve ser posterior ou igual à data de início",
    path: ["periodo_fim"],
  }
);

/**
 * Schema de validação para o formulário de registro de Classe III (Combustíveis).
 */
export const classeIIIFormSchema = z.object({
  organizacao: z
    .string()
    .trim()
    .min(1, { message: "Informe a Organização Militar" })
    .max(200, { message: "Nome da OM muito longo (máx 200 caracteres)" }),
  ug: z
    .string()
    .regex(/^\d{3}\.\d{3}$/, { message: "UG deve ter formato XXX.XXX (6 dígitos)" }),
  tipo_equipamento: z
    .string()
    .min(1, { message: "Selecione o tipo de equipamento" }),
  quantidade: z
    .number()
    .int({ message: "Quantidade deve ser um número inteiro" })
    .min(1, { message: "Quantidade deve ser no mínimo 1" })
    .max(10000, { message: "Quantidade muito alta (máx 10.000)" }),
  dias_operacao: z
    .number()
    .int({ message: "Dias de operação deve ser um número inteiro" })
    .min(1, { message: "Dias de operação deve ser no mínimo 1" })
    .max(365, { message: "Dias de operação não pode exceder 365" }),
  preco_litro: z
    .number()
    .positive({ message: "Preço deve ser positivo" })
    .max(100, { message: "Preço muito alto (máx R$ 100/litro)" }),
  consumo_hora: z
    .number()
    .positive({ message: "Consumo deve ser positivo" })
    .max(1000, { message: "Consumo muito alto" })
    .optional(),
  horas_dia: z
    .number()
    .positive({ message: "Horas/dia deve ser positivo" })
    .max(24, { message: "Horas/dia não pode exceder 24" })
    .optional(),
  consumo_km_litro: z
    .number()
    .positive({ message: "Consumo deve ser positivo" })
    .max(100, { message: "Consumo muito alto" })
    .optional(),
  km_dia: z
    .number()
    .positive({ message: "KM/dia deve ser positivo" })
    .max(10000, { message: "KM/dia muito alto" })
    .optional(),
});