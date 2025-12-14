import { z } from "zod";

export const RefLPCFormSchema = z.object({
  data_inicio_consulta: z.string().min(1, "Data de início é obrigatória."),
  data_fim_consulta: z.string().min(1, "Data de fim é obrigatória."),
  ambito: z.enum(['Nacional', 'Estadual', 'Municipal'], {
    required_error: "Âmbito é obrigatório.",
  }),
  nome_local: z.string().optional(),
  preco_diesel: z.number().min(0.01, "Preço do Diesel deve ser maior que zero."),
  preco_gasolina: z.number().min(0.01, "Preço da Gasolina deve ser maior que zero."),
  source: z.enum(['Manual', 'API']),
}).refine(data => {
  if (data.ambito !== 'Nacional' && (!data.nome_local || data.nome_local.trim().length === 0)) {
    return false; // Must provide local name if not national
  }
  return true;
}, {
  message: "Nome do local é obrigatório para âmbito Estadual/Municipal.",
  path: ["nome_local"],
});

export type RefLPCFormValues = z.infer<typeof RefLPCFormSchema>;