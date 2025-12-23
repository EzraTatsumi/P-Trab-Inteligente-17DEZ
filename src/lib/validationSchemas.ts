import * as z from "zod";

// Esquema de validação para login
export const loginSchema = z.object({
  email: z.string().email({ message: "E-mail inválido." }),
  password: z.string().min(6, { message: "A senha deve ter no mínimo 6 caracteres." }),
});

// Esquema de validação para registro (signup)
export const signupSchema = z.object({
  email: z.string().email({ message: "E-mail inválido." }),
  password: z.string().min(8, { message: "A senha deve ter no mínimo 8 caracteres." }),
  posto_graduacao: z.string().min(1, { message: "Posto/Graduação é obrigatório." }),
  nome_guerra: z.string().min(1, { message: "Nome de Guerra é obrigatório." }),
  nome_om: z.string().min(1, { message: "OM de vinculação é obrigatória." }),
});

// Esquema de validação para atualização de perfil
export const profileSchema = z.object({
  first_name: z.string().min(1, { message: "Nome é obrigatório." }),
  last_name: z.string().min(1, { message: "Nome de Guerra é obrigatório." }),
  posto_graduacao: z.string().min(1, { message: "Posto/Graduação é obrigatório." }),
  nome_om: z.string().min(1, { message: "OM de vinculação é obrigatória." }),
});

// Esquema de validação para OM (Organização Militar)
export const omSchema = z.object({
  nome_om: z.string().min(1, "A sigla da OM é obrigatória."),
  codug_om: z.string().min(1, "O CODUG da OM é obrigatório."),
  rm_vinculacao: z.string().min(1, "A RM de vinculação é obrigatória."),
  codug_rm_vinculacao: z.string().min(1, "O CODUG da RM é obrigatório."),
  cidade: z.string().min(1, "A cidade é obrigatória."), // NOVO CAMPO
  ativo: z.boolean().optional(),
});