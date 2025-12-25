import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lock, CheckCircle, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { sanitizeAuthError } from '@/lib/errorUtils';
import { useFormNavigation } from '@/hooks/useFormNavigation';

// Esquema de validação de senha atualizado para ser mais rigoroso
const passwordValidation = z.string()
  .min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  .regex(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula.' })
  .regex(/[0-9]/, { message: 'A senha deve conter pelo menos um número.' })
  .regex(/[^a-zA-Z0-9]/, { message: 'A senha deve conter pelo menos um caractere especial.' });

const resetPasswordSchema = z.object({
  password: passwordValidation,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true); // Começa como true
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false); // Novo estado para rastrear a validade do token
  const { handleEnterToNextField } = useFormNavigation();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // 1. Listener para o evento de recuperação de senha
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        // Se o evento for de recuperação OU se já houver uma sessão (token válido na URL)
        setIsTokenValid(true);
        setLoading(false);
      } else if (event === 'SIGNED_OUT' && !session) {
        // Se o usuário for deslogado ou não houver sessão inicial, e não for recuperação
        if (window.location.hash.includes('access_token')) {
             // Se houver token na URL, mas o Supabase não conseguiu processar, 
             // pode ser um erro de token expirado ou já usado.
             toast.error("Link de redefinição inválido ou expirado. Tente novamente.");
             navigate('/login');
        }
        setLoading(false);
      } else if (event === 'INITIAL_SESSION' && !session) {
        // Se a sessão inicial não retornar nada, e não houver token na URL, redireciona.
        if (!window.location.hash.includes('access_token')) {
            setLoading(false);
            navigate('/login');
        }
      }
    });
    
    // Tenta obter a sessão inicial imediatamente para cobrir o caso de carregamento direto
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            setIsTokenValid(true);
        }
        setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setLoading(true);

    try {
      // O updateUser usa a sessão ativa (obtida do token na URL) para atualizar a senha.
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(sanitizeAuthError(error));
        console.error("Password update error:", error);
      } else {
        setIsSuccess(true);
        // Força o logout da sessão temporária de recuperação
        await supabase.auth.signOut(); 
        toast.success('Senha redefinida com sucesso! Faça login com sua nova senha.');
        setTimeout(() => {
            navigate('/login');
        }, 3000);
      }
    } catch (e) {
      toast.error('Ocorreu um erro inesperado ao redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Verificando link de redefinição...</span>
      </div>
    );
  }
  
  // Se o token não for válido e o loading terminou, redireciona para login (tratado no useEffect)
  if (!isTokenValid && !loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <span className="ml-2 text-muted-foreground">Link inválido. Redirecionando...</span>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Lock className="h-6 w-6 text-primary" />
            Redefinir Senha
          </CardTitle>
          <CardDescription>
            {isSuccess ? "Sua senha foi alterada." : "Digite sua nova senha para continuar."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="text-center p-6 space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Você será redirecionado para a página de login em breve.
              </p>
              <Button onClick={() => navigate('/login')} className="w-full">
                Ir para Login
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Mínimo 8 caracteres"
                            autoComplete="new-password"
                            {...field}
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
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground mt-1">
                        A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, número e caractere especial.
                      </p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirme a Nova Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirme a senha"
                          autoComplete="new-password"
                          {...field}
                          onKeyDown={handleEnterToNextField}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Redefinir Senha'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;