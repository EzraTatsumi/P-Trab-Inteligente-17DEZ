"use client";

import React, { useState } from 'react';
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
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeAuthError } from "@/lib/errorUtils";
import { z } from "zod";
import { useFormNavigation } from "@/hooks/useFormNavigation";

interface SignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignupSuccess: (email: string) => void;
}

// Schema de validação para o cadastro
const signupSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres."),
  first_name: z.string().min(2, "Nome é obrigatório."),
  last_name: z.string().min(2, "Sobrenome é obrigatório."),
});

export const SignupDialog: React.FC<SignupDialogProps> = ({
  open,
  onOpenChange,
  onSignupSuccess,
}) => {
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { handleEnterToNextField } = useFormNavigation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validationResult = signupSchema.safeParse(form);
      if (!validationResult.success) {
        toast.error(validationResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      const { email, password, first_name, last_name } = validationResult.data;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/ptrab`,
          data: {
            first_name,
            last_name,
          },
        },
      });

      if (error) throw error;

      // Sucesso no cadastro
      onSignupSuccess(email);
      setForm({ email: "", password: "", first_name: "", last_name: "" });
      
    } catch (error: any) {
      toast.error(sanitizeAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Criar Nova Conta
          </DialogTitle>
          <DialogDescription>
            Preencha seus dados para criar sua conta e começar a usar a plataforma.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSignup} className="grid gap-4 py-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nome *</Label>
              <Input
                id="first_name"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="Seu nome"
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Sobrenome *</Label>
              <Input
                id="last_name"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="Seu sobrenome"
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
          </div>

          <div className="space-y-2">
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
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password-signup">Senha *</Label>
            <div className="relative">
              <Input
                id="password-signup"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                minLength={6}
                className="pr-10"
                onKeyDown={handleEnterToNextField}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading}>
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