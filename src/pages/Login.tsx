import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { sanitizeAuthError } from '@/lib/errorUtils';
import { loginSchema } from '@/lib/validationSchemas';
import { useSession } from '@/components/SessionContextProvider';
import { useNavigate } from 'react-router-dom';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { EmailVerificationDialog } from '@/components/EmailVerificationDialog';
import { SignupDialog } from '@/components/SignupDialog'; // Importar o diálogo de cadastro
import { SignupSuccessDialog } from '@/components/SignupSuccessDialog'; // Importar o diálogo de sucesso

type LoginFormValues = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const { user, isLoading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Estados para Login/Verificação
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // NOVOS ESTADOS para Cadastro
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);
  const [newlyRegisteredEmail, setNewlyRegisteredEmail] = useState('');

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true, // Default to true for better UX
    },
  });
  
  // Redirect if already logged in
  useEffect(() => {
    if (!sessionLoading && user) {
      navigate('/ptrab');
    }
  }, [user, sessionLoading, navigate]);

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setUnconfirmedEmail('');
    setShowEmailVerification(false);

    try {
      const rememberMe = data.rememberMe ?? true;
      
      // CORREÇÃO: signInWithPassword agora aceita um único objeto que contém credenciais e opções.
      const { error } = await supabase.auth.signInWithPassword(
        {
          email: data.email,
          password: data.password,
          options: {
            // FIX: Casting the options object to 'any' to resolve TS2353 error 
            // related to 'shouldCreateSession' not existing in the inferred type.
            // Se for false, a sessão é de curta duração (session cookie).
            shouldCreateSession: rememberMe,
          } as any,
        }
      );

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setUnconfirmedEmail(data.email);
          setShowEmailVerification(true);
          // Do not show toast error here, the dialog handles the next step
        } else {
          toast.error(sanitizeAuthError(error));
        }
        console.error("Login error:", error);
      } else {
        // Success handled by SessionContextProvider redirect
      }
    } catch (e) {
      toast.error('Ocorreu um erro inesperado ao tentar fazer login.');
    } finally {
      setLoading(false);
    }
  };
  
  // NOVO: Handler para sucesso no cadastro
  const handleSignupSuccess = (email: string) => {
    setShowSignupDialog(false);
    setNewlyRegisteredEmail(email);
    setShowSignupSuccess(true);
  };

  // If session is loading, show a spinner
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <LogIn className="h-6 w-6 text-primary" />
            Acesso à Plataforma
          </CardTitle>
          <CardDescription>
            Entre com seu e-mail e senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                        disabled={loading}
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
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="••••••••"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          {...field}
                          disabled={loading}
                          className="pr-10"
                        />
                      </FormControl>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Checkbox Remember Me (Added to support shouldCreateSession logic) */}
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={loading}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        Manter-me conectado
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
              </Button>
            </form>
          </Form>
          
          <div className="mt-4 text-center text-sm space-y-2">
            <Button 
              variant="link" 
              className="p-0 h-auto text-primary hover:text-primary/80"
              onClick={() => setShowForgotPassword(true)}
            >
              Esqueceu sua senha?
            </Button>
            <p className="text-muted-foreground">
              Não tem uma conta?{' '}
              <Button 
                variant="link" 
                className="p-0 h-auto text-primary hover:text-primary/80"
                onClick={() => setShowSignupDialog(true)} // ABRINDO O DIÁLOGO
              >
                Cadastre-se
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Diálogo de Cadastro */}
      <SignupDialog
        open={showSignupDialog}
        onOpenChange={setShowSignupDialog}
        onSignupSuccess={handleSignupSuccess}
      />
      
      {/* Diálogo de Sucesso no Cadastro */}
      <SignupSuccessDialog
        open={showSignupSuccess}
        onOpenChange={setShowSignupSuccess}
        email={newlyRegisteredEmail}
      />
      
      {/* Diálogo de Verificação de E-mail */}
      <EmailVerificationDialog
        open={showEmailVerification}
        onOpenChange={setShowEmailVerification}
        email={unconfirmedEmail}
      />
      
      {/* Diálogo de Recuperação de Senha */}
      <ForgotPasswordDialog
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      />
    </div>
  );
};

export default Login;