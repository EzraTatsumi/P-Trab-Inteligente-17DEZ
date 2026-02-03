"use client";

import React, { useState, useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignupDialog } from '@/components/SignupDialog';
import { SignupSuccessDialog } from '@/components/SignupSuccessDialog';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session, isLoading } = useSession();
  
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Redireciona se o usuário já estiver logado
  useEffect(() => {
    if (!isLoading && session) {
      navigate('/ptrab', { replace: true });
    }
  }, [session, isLoading, navigate]);

  const handleSignupSuccess = (email: string) => {
    setShowSignupDialog(false);
    setRegisteredEmail(email);
    setShowSuccessDialog(true);
  };

  if (isLoading || session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Acesso ao PTrab Inteligente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          
          {/* Componente de Autenticação do Supabase (Login e Reset de Senha) */}
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(221.2 83.2% 53.3%)', // Cor primária do shadcn/ui
                    brandAccent: 'hsl(221.2 83.2% 40%)',
                  },
                },
              },
            }}
            theme="light"
            localization={{
              variables: {
                sign_in: {
                  email_label: 'E-mail',
                  password_label: 'Senha',
                  button_label: 'Entrar',
                  social_provider_text: 'Entrar com {{provider}}',
                  link_text: 'Já tem uma conta? Faça login',
                },
                forgotten_password: {
                  email_label: 'E-mail',
                  button_label: 'Enviar instruções de recuperação',
                  link_text: 'Esqueceu sua senha?',
                },
                update_password: {
                  password_label: 'Nova Senha',
                  button_label: 'Atualizar Senha',
                },
              },
            }}
            // Desabilita o formulário de Sign Up padrão do Supabase
            view="sign_in" 
          />
          
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Ou
            </span>
          </div>

          {/* Botão Customizado para Abrir o Diálogo de Cadastro */}
          <Button 
            variant="outline" 
            onClick={() => setShowSignupDialog(true)}
            className="w-full"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Criar Nova Conta (Cadastro)
          </Button>
          
        </CardContent>
      </Card>

      {/* Diálogo de Cadastro */}
      <SignupDialog
        open={showSignupDialog}
        onOpenChange={setShowSignupDialog}
        onSignupSuccess={handleSignupSuccess}
      />

      {/* Diálogo de Sucesso (Abre após o cadastro ser concluído) */}
      <SignupSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        email={registeredEmail}
      />
    </div>
  );
};

export default Login;