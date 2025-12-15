import { z } from "zod";

export const RefLPCDataSchema = z.object({
  id: z.string().uuid().optional(),
  p_trab_id: z.string().uuid(),
  ambito: z.enum(["Nacional", "Estadual", "Municipal"]),
  nome_local: z.string().optional(),
  data_inicio_consulta: z.string().min(1, "Data de início é obrigatória"),
  data_fim_consulta: z.string().min(1, "Data de fim é obrigatória"),
  preco_diesel: z.coerce.number().min(0, "Preço do Diesel deve ser positivo"),
  preco_gasolina: z.coerce.number().min(0, "Preço da Gasolina deve ser positivo"),
  source: z.enum(["Manual", "LPC"]).default("Manual"),
});

export type RefLPCData = z.infer<typeof RefLPCDataSchema>;