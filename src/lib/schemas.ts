import { z } from 'zod';

export const PTrabFormSchema = z.object({
  numero_ptrab: z.string().min(1, "O número do PTrab é obrigatório."),
  comando_militar_area: z.string().min(1, "O CMA é obrigatório."),
  nome_om: z.string().min(1, "O nome da OM (sigla) é obrigatório."),
  nome_om_extenso: z.string().optional(),
  codug_om: z.string().min(1, "O código UG da OM é obrigatório."),
  rm_vinculacao: z.string().min(1, "A RM de vinculação é obrigatória."),
  codug_rm_vinculacao: z.string().min(1, "O código UG da RM é obrigatório."),
  nome_operacao: z.string().min(1, "O nome da operação é obrigatório."),
  periodo_inicio: z.string().min(1, "A data de início é obrigatória."),
  periodo_fim: z.string().min(1, "A data de fim é obrigatória."),
  efetivo_empregado: z.coerce.number().min(1, "O efetivo deve ser maior que zero."),
  acoes: z.string().optional(),
  status: z.enum(['aberto', 'em_andamento', 'aprovado', 'arquivado', 'cancelado']).default('aberto'),
  nome_cmt_om: z.string().optional(),
  local_om: z.string().optional(),
  comentario: z.string().optional(),
  rotulo_versao: z.string().optional(),
});

export type PTrabFormValues = z.infer<typeof PTrabFormSchema>;