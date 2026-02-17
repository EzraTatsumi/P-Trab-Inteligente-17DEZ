"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Eye, EyeOff, Loader2, Check, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeAuthError } from "@/lib/errorUtils";
import { z } from "zod";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import InputMask from 'react-input-mask';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EmailConfirmationDialog } from './EmailConfirmationDialog';

interface SignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignupSuccess: (email: string) => void;
}

const MILITARY_RANKS = [
  "Gen Ex", "Gen Div", "Gen Bda", "Cel", "TC", "Maj", "Cap", 
  "1º Ten", "2º Ten", "Asp Of", "ST", "1º Sgt", "2º Sgt", 
  "3º Sgt", "Cb", "Sd"
] as const;

const signupSchema = z.object({
  email: z.string().email("E-mail inválido."),
  nome_completo: z.string().min(5, "Nome completo é obrigatório."),
  nome_guerra: z.string().min(2, "Nome de Guerra é obrigatório."),
  posto_graduacao: z.enum(MILITARY_RANKS as unknown as [string, ...string[]], { message: "Posto/Graduação é obrigatório." }),
  sigla_om: z.string().min(2, "Sigla da OM é obrigatória."),
  funcao_om: z.string().min(2, "Função na OM é obrigatória."),
  telefone: z.string().regex(/^\(?\d{2}\)?\s?\d{9}$/, "Telefone inválido (Ex: (99) 999999999).").optional().or(z.literal('')),
  password: z.string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula.")
    .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula.")
    .regex(/[0-9]/, "A senha deve conter pelo menos um número.")
    .regex(/[^a-zA-Z0-9]/, "A senha deve conter pelo menos um caractere especial."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

interface PasswordCriteria {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  specialChar: boolean;
}

const DOMAIN_CORRECTIONS: Record<string, string> = {
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gmil.com": "gmail.com",
    "gmai.lcom": "gmail.com", 
    "gmailcom": "gmail.com", 
    "gmail.com.br": "gmail.com",
    "hotmai.com": "hotmail.com",
    "hotmal.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "outloock.com": "outlook.com",
    "outlookcom": "outlook.com", 
    "live.com.br": "live.com",
    "live.com": "live.com",
    "yaho.com": "yahoo.com",
    "yhoo.com": "yahoo.com",
    "yahho.com": "yahoo.com",
    "yahoo.com.br": "yahoo.com", 
    "yahoocom": "yahoo.com", 
    "ebmil.br": "eb.mil.br",
    "eb.milbr": "eb.mil.br",
    "eb.mil.brr": "eb.mil.br",
    "eb.mi.lbr": "eb.mil.br", 
    "eb.mil.br.": "eb.mil.br", 
    "ebmilbr": "eb.mil.br", 
    "eb.mil": "eb.mil.br", 
    "eb.com.br": "eb.mil.br",
    "ebmilbr.com": "eb.mil.br", 
};

export const SignupDialog: React.FC<SignupDialogProps> = ({
  open,
  onOpenChange,
  onSignupSuccess,
}) => {
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    nome_completo: "",
    nome_guerra: "",
    posto_graduacao: "",
    sigla_om: "",
    funcao_om: "",
    telefone: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [passwordCriteria, setPasswordCriteria] = useState<PasswordCriteria>({
    minLength: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false,
  });
  
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [ignoredCorrection, setIgnoredCorrection] = useState<string | null>(null);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  
  const { handleEnterToNextField } = useFormNavigation();

  const suggestedEmailCorrection = useMemo(() => {
    const watchedEmail = form.email;
    if (!watchedEmail || !watchedEmail.includes('@')) return null;
    
    const parts = watchedEmail.split('@');
    if (parts.length !== 2) return null;
    
    const domain = parts[1].toLowerCase();
    
    for (const [typo, correct] of Object.entries(DOMAIN_CORRECTIONS)) {
        if (domain === typo) {
            return `${parts[0]}@${correct}`;
        }
    }
    return null;
  }, [form.email]);
  
  useEffect(() => {
    if (ignoredCorrection && form.email !== ignoredCorrection) {
        setIgnoredCorrection(null);
    }
  }, [form.email, ignoredCorrection]);

  const checkPasswordCriteria = (password: string) => {
    setPasswordCriteria({
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      specialChar: /[^a-zA-Z0-9]/.test(password),
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    
    if (name === 'password') {
      checkPasswordCriteria(value);
    }
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
    setValidationErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleFinalSubmission = async () => {
    setLoading(true);
    setSubmissionError(null);
    setShowEmailConfirmation(false);

    try {
        const normalizedForm = {
            ...form,
            telefone: form.telefone.replace(/\D/g, ""),
        };
        const parsed = signupSchema.safeParse({
            ...normalizedForm,
            telefone: normalizedForm.telefone || "",
        });
        if (!parsed.success) {
            throw new Error("Erro de validação interna. Tente novamente.");
        }
        
        const {
            email,
            password,
            nome_completo,
            nome_guerra,
            posto_graduacao,
            sigla_om,
            funcao_om,
            telefone,
        } = parsed.data;
        
        const { error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/ptrab`,
                data: {
                    first_name: nome_completo,
                    last_name: nome_guerra,
                    posto_graduacao,
                    sigla_om,
                    funcao_om,
                    telefone,
                },
            },
        });

        if (signupError) {
            throw signupError;
        }

        onSignupSuccess(email);

        setForm({
            email: "",
            password: "",
            confirmPassword: "",
            nome_completo: "",
            nome_guerra: "",
            posto_graduacao: "",
            sigla_om: "",
            funcao_om: "",
            telefone: "",
        });
        
    } catch (err: any) {
        console.error("Final submission error:", err);
        const msg = sanitizeAuthError(err);
        toast.error(msg);
        setSubmissionError(msg);
    } finally {
        setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationErrors({});
    setSubmissionError(null); 

    try {
      if (suggestedEmailCorrection && form.email !== ignoredCorrection) {
        const msg = "O e-mail digitado parece incorreto. Corrija ou confirme a digitação.";
        toast.error(msg);
        setSubmissionError(msg);
        return;
      }

      const normalizedForm = {
        ...form,
        telefone: form.telefone.replace(/\D/g, ""),
      };

      const parsed = signupSchema.safeParse({
        ...normalizedForm,
        telefone: normalizedForm.telefone || "",
      });

      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const fieldErrors: Record<string, string | undefined> = {};

        Object.entries(errors).forEach(([key, value]) => {
          if (value?.[0]) fieldErrors[key] = value[0];
        });

        setValidationErrors(fieldErrors);

        const firstError = parsed.error.errors[0].message;
        toast.error(firstError);
        setSubmissionError(firstError);
        return;
      }

      const { data: emailCheck, error: emailCheckError } =
          await supabase.functions.invoke("email-exists", {
              body: { email: parsed.data.email },
          });

      if (emailCheckError) {
          console.error("Email check error:", emailCheckError);
          throw new Error("Falha ao verificar e-mail no servidor.");
      }

      if (emailCheck?.exists) {
          const msg = "Este e-mail já está cadastrado. Utilize outro ou faça login.";
          toast.error(msg);
          setSubmissionError(msg);
          return;
      }
      
      setShowEmailConfirmation(true);

    } catch (err: any) {
      console.error("Signup validation error:", err);
      const msg = sanitizeAuthError(err);
      toast.error(msg);
      setSubmissionError(msg);
    } finally {
      setLoading(false);
    }
  };
  
  const phoneMask = "(99) 999999999";
  
  const criteriaList = useMemo(() => [
    { key: 'minLength', label: 'Mínimo de 8 caracteres', met: passwordCriteria.minLength },
    { key: 'uppercase', label: 'Uma letra maiúscula (A-Z)', met: passwordCriteria.uppercase },
    { key: 'lowercase', label: 'Uma letra minúscula (a-z)', met: passwordCriteria.lowercase },
    { key: 'number', label: 'Um número (0-9)', met: passwordCriteria.number },
    { key: 'specialChar', label: 'Um caractere especial (!@#$%^&*)', met: passwordCriteria.specialChar },
  ], [passwordCriteria]);

  const renderCriteriaItem = (label: string, met: boolean) => (
    <li key={label} className={cn(
      "flex items-center gap-2 transition-colors", 
      met ? "text-green-600" : "text-destructive"
    )}>
      {met ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
      {label}
    </li>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Criar Nova Conta
            </DialogTitle>
            <DialogDescription>
              Preencha seus dados institucionais para criar sua conta.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSignup} className="grid gap-4 py-3">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nome_completo">Nome Completo *</Label>
                <Input
                  id="nome_completo"
                  name="nome_completo"
                  value={form.nome_completo}
                  onChange={handleChange}
                  placeholder="Seu nome completo"
                  required
                  onKeyDown={handleEnterToNextField}
                />
                {validationErrors.nome_completo && <p className="text-xs text-destructive">{validationErrors.nome_completo}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="nome_guerra">Nome de Guerra *</Label>
                <Input
                  id="nome_guerra"
                  name="nome_guerra"
                  value={form.nome_guerra}
                  onChange={handleChange}
                  placeholder="Seu nome de guerra"
                  required
                  onKeyDown={handleEnterToNextField}
                />
                {validationErrors.nome_guerra && <p className="text-xs text-destructive">{validationErrors.nome_guerra}</p>}
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="posto_graduacao">Posto/Graduação *</Label>
                <Select
                  value={form.posto_graduacao}
                  onValueChange={(value) => handleSelectChange("posto_graduacao", value)}
                >
                  <SelectTrigger id="posto_graduacao" className="justify-start">
                    <SelectValue placeholder="Seu Posto/Grad">
                      {form.posto_graduacao || "Seu Posto/Grad"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MILITARY_RANKS.map((rank) => (
                      <SelectItem key={rank} value={rank}>
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {validationErrors.posto_graduacao && <p className="text-xs text-destructive">{validationErrors.posto_graduacao}</p>}
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="sigla_om">Sigla da OM *</Label>
                <Input
                  id="sigla_om"
                  name="sigla_om"
                  value={form.sigla_om}
                  onChange={handleChange}
                  placeholder="Ex: 1ª RM, CML"
                  required
                  onKeyDown={handleEnterToNextField}
                />
                {validationErrors.sigla_om && <p className="text-xs text-destructive">{validationErrors.sigla_om}</p>}
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="funcao_om">Função na OM *</Label>
                <Input
                  id="funcao_om"
                  name="funcao_om"
                  value={form.funcao_om}
                  onChange={handleChange}
                  placeholder="Ex: S4, Ch Sec Log"
                  required
                  onKeyDown={handleEnterToNextField}
                />
                {validationErrors.funcao_om && <p className="text-xs text-destructive">{validationErrors.funcao_om}</p>}
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="telefone">Telefone (Opcional)</Label>
                <InputMask
                  mask={phoneMask}
                  value={form.telefone}
                  onChange={handleChange}
                  maskChar={null}
                >
                  {(inputProps: any) => (
                    <Input
                      {...inputProps}
                      id="telefone"
                      name="telefone"
                      placeholder="(99) 999999999"
                      onKeyDown={handleEnterToNextField}
                    />
                  )}
                </InputMask>
                {validationErrors.telefone && <p className="text-xs text-destructive">{validationErrors.telefone}</p>}
              </div>
            </div>
            
            <div className="md:col-span-3 flex flex-col md:flex-row gap-3 items-start">
              <div className="space-y-1 w-full md:w-1/3">
                <Label htmlFor="email-signup">Email *</Label>
                <Input
                  id="email-signup"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  required
                  onKeyDown={handleEnterToNextField}
                />
                {validationErrors.email && <p className="text-xs text-destructive">{validationErrors.email}</p>}
              </div>
              
              {submissionError && (
                  <Alert variant="destructive" className="mt-7 p-2 w-full md:w-2/3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Erro de Cadastro</AlertTitle>
                      <AlertDescription className="text-xs font-medium">
                          {submissionError}
                      </AlertDescription>
                  </Alert>
              )}
              
              {!submissionError && suggestedEmailCorrection && form.email !== ignoredCorrection && (
                  <Alert variant="default" className="mt-7 p-2 bg-yellow-50 border-yellow-200 w-full md:w-2/3">
                      <AlertCircle className="h-4 w-4 text-yellow-700" />
                      <AlertDescription className="text-xs text-yellow-700 flex items-center justify-between">
                          <p>Domínio incorreto? Sugestão:</p>
                          <div className="flex gap-2 items-center">
                              <Button 
                                  type="button" 
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => {
                                      setForm(prev => ({ ...prev, email: suggestedEmailCorrection }));
                                      setValidationErrors(prev => ({ ...prev, email: undefined }));
                                      setIgnoredCorrection(null); 
                                  }}
                              >
                                  <Check className="h-3 w-3 mr-1" />
                                  Usar {suggestedEmailCorrection.split('@')[1]}
                              </Button>
                              <Button 
                                  type="button" 
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                      setIgnoredCorrection(form.email); 
                                      toast.info("Correção ignorada. Clique em 'Criar Conta' para continuar.");
                                  }}
                              >
                                  Manter Digitação
                              </Button>
                          </div>
                      </AlertDescription>
                  </Alert>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 md:col-span-3">
              <div className="space-y-1">
                <Label htmlFor="password-signup">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password-signup"
                    name="password"
                    type={showPassword1 ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="pr-10"
                    onKeyDown={handleEnterToNextField}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onMouseDown={() => setShowPassword1(true)}
                    onMouseUp={() => setShowPassword1(false)}
                    tabIndex={-1}
                  >
                    {showPassword1 ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
                {validationErrors.password && <p className="text-xs text-destructive">{validationErrors.password}</p>}
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword2 ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="pr-10"
                    onKeyDown={handleEnterToNextField}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onMouseDown={() => setShowPassword2(true)}
                    onMouseUp={() => setShowPassword2(false)}
                    tabIndex={-1}
                  >
                    {showPassword2 ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
                {validationErrors.confirmPassword && <p className="text-xs text-destructive">{validationErrors.confirmPassword}</p>}
              </div>
            </div>
            
            <Alert className="mt-2 p-3 md:col-span-3">
              <AlertDescription className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground block mb-1">Critérios de Senha:</span>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 ml-2 mt-1">
                  {criteriaList.map(item => renderCriteriaItem(item.label, item.met))}
                </ul>
              </AlertDescription>
            </Alert>

            <DialogFooter className="mt-4 md:col-span-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Verificando..." : "Criar Conta"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <EmailConfirmationDialog
        open={showEmailConfirmation}
        onOpenChange={setShowEmailConfirmation}
        email={form.email}
        onConfirm={handleFinalSubmission}
        onBack={() => {
            setShowEmailConfirmation(false);
            setLoading(false);
        }}
        loading={loading}
      />
    </>
  );
};