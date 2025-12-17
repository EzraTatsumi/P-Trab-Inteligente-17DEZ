"use client";

import React, { useState, useMemo } from 'react';
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
import { UserPlus, Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeAuthError } from "@/lib/errorUtils";
import { z } from "zod";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import InputMask from 'react-input-mask';
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignupSuccess: (email: string) => void;
}

// Schema de validação para o cadastro
const signupSchema = z.object({
  email: z.string().email("E-mail inválido."),
  nome_completo: z.string().min(5, "Nome completo é obrigatório."),
  nome_guerra: z.string().min(2, "Nome de Guerra é obrigatório."),
  sigla_om: z.string().min(2, "Sigla da OM é obrigatória."),
  funcao_om: z.string().min(2, "Função na OM é obrigatória."),
  // Nova validação para o formato (99) 999999999 (11 dígitos)
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
  
  const { handleEnterToNextField } = useFormNavigation();
  
  const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationErrors({});

    try {
      // Remove caracteres não numéricos do telefone antes da validação, se houver
      const rawForm = {
        ...form,
        telefone: form.telefone.replace(/\D/g, ''),
      };
      
      // Se o telefone estiver vazio, garante que ele passe na validação opcional
      const finalForm = rawForm.telefone.length === 0 ? { ...rawForm, telefone: '' } : rawForm;

      const validationResult = signupSchema.safeParse(finalForm);
      if (!validationResult.success) {
        const errors = validationResult.error.flatten().fieldErrors;
        const fieldErrors: Record<string, string | undefined> = {};
        
        // Mapeia os erros para o estado de validação
        Object.keys(errors).forEach(key => {
            fieldErrors[key] = errors[key]?.[0];
        });
        setValidationErrors(fieldErrors);
        
        // Exibe o primeiro erro como toast
        toast.error(validationResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      const { email, password, nome_completo, nome_guerra, sigla_om, funcao_om, telefone } = validationResult.data;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/ptrab`,
          data: {
            // Mapeamento para o trigger handle_new_user (first_name/last_name)
            first_name: nome_completo, 
            last_name: nome_guerra,
            
            // Dados adicionais para o perfil
            sigla_om,
            funcao_om,
            telefone,
          },
        },
      });

      if (error) throw error;

      // Sucesso no cadastro
      onSignupSuccess(email);
      setForm({ 
        email: "", 
        password: "", 
        confirmPassword: "",
        nome_completo: "", 
        nome_guerra: "",
        sigla_om: "",
        funcao_om: "",
        telefone: "",
      });
      
    } catch (error: any) {
      toast.error(sanitizeAuthError(error));
    } finally {
      setLoading(false);
    }
  };
  
  // Máscara de telefone fixa
  const phoneMask = "(99) 999999999";
  
  const criteriaList = useMemo(() => [
    { key: 'minLength', label: 'Mínimo de 8 caracteres', met: passwordCriteria.minLength },
    { key: 'uppercase', label: 'Uma letra maiúscula (A-Z)', met: passwordCriteria.uppercase },
    { key: 'lowercase', label: 'Uma letra minúscula (a-z)', met: passwordCriteria.lowercase },
    { key: 'number', label: 'Um número (0-9)', met: passwordCriteria.number },
    { key: 'specialChar', label: 'Um caractere especial (!@#$%^&*)', met: passwordCriteria.specialChar },
  ], [passwordCriteria]);

  const renderCriteriaItem = (label: string, met: boolean) => (
    <li className={cn(
      "flex items-center gap-2 transition-colors", 
      met ? "text-green-600" : "text-destructive" // Alterado para text-destructive
    )}>
      {met ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
      {label}
    </li>
  );

  return (
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
          
          {/* Dados Pessoais, Institucionais e Email (3 colunas em desktop) */}
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
            
            {/* Campo Sigla da OM (Select) */}
            <div className="space-y-1">
              <Label htmlFor="sigla_om">Sigla da OM *</Label>
              <Select
                value={form.sigla_om}
                onValueChange={(value) => handleSelectChange("sigla_om", value)}
                disabled={isLoadingOms}
              >
                <SelectTrigger id="sigla_om">
                  {isLoadingOms ? (
                    <div className="flex items-center text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando OMs...
                    </div>
                  ) : (
                    <SelectValue placeholder="Selecione a OM">
                      {form.sigla_om || "Selecione a OM"}
                    </SelectValue>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {oms?.map((om) => (
                    <SelectItem key={om.id} value={om.nome_om}>
                      {om.nome_om}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            
            {/* Campo Telefone (InputMask) */}
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
            
            {/* Email (Movido para cá) */}
            <div className="space-y-1">
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
          </div>
          
          {/* Senha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
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
          
          {/* Critérios de Senha */}
          <Alert className="mt-2 p-3">
            <AlertDescription className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground block mb-1">Critérios de Senha:</span>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 ml-2 mt-1">
                {criteriaList.map(item => renderCriteriaItem(item.label, item.met))}
              </ul>
            </AlertDescription>
          </Alert>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading || isLoadingOms}>
              {loading ? "Cadastrando..." : "Criar Conta"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};