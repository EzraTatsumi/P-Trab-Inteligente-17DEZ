import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { sanitizeAuthError } from '@/lib/errorUtils';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { SignupDialog } from '@/components/SignupDialog';
import { EmailVerificationDialog } from '@/components/EmailVerificationDialog';

const loginSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido.' }),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setUnconfirmedEmail(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
        options: {
          // shouldCreateSession: rememberMe, // REMOVIDO: Propriedade não existe no tipo de opções do Supabase JS
        }
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
            setUnconfirmedEmail(data.email);
            toast.warning("E-mail não confirmado. Verifique sua caixa de entrada.");
        } else {
            toast.error(sanitizeAuthError(error));
        }
        return;
      }
      
      // Se o login for bem-sucedido, o SessionContextProvider cuidará da navegação.

    } catch (e) {
      toast.error('Ocorreu um erro inesperado ao tentar fazer login.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSignupSuccess = (email: string) => {
    setShowSignup(false);
    setUnconfirmedEmail(email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md space-y-8 p-8 bg-card rounded-lg shadow-xl border">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Acessar PTrab Inteligente
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre com suas credenciais
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="seu@email.com"
                      type="email"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="••••••••"
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                />
                <label
                  htmlFor="remember-me"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Lembrar-me
                </label>
              </div>
              <Button 
                type="button" 
                variant="link" 
                className="text-sm p-0 h-auto"
                onClick={() => setShowForgotPassword(true)}
              >
                Esqueceu a senha?
              </Button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </Form>
        
        <div className="text-center text-sm text-muted-foreground">
            Não tem uma conta?{' '}
            <Button 
                type="button" 
                variant="link" 
                className="text-sm p-0 h-auto"
                onClick={() => setShowSignup(true)}
            >
                Cadastre-se
            </Button>
        </div>
      </div>
      
      <ForgotPasswordDialog 
        open={showForgotPassword} 
        onOpenChange={setShowForgotPassword} 
      />
      
      <SignupDialog 
        open={showSignup} 
        onOpenChange={setShowSignup} 
        onSignupSuccess={handleSignupSuccess}
      />
      
      <EmailVerificationDialog
        open={!!unconfirmedEmail}
        onOpenChange={() => setUnconfirmedEmail(null)}
        email={unconfirmedEmail || ''}
      />
    </div>
  );
}

export default Login;