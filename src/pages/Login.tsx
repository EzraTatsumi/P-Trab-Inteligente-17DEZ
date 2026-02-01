import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LoginPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            Acesso ao P Trab Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(221.2 83.2% 53.3%)', // Primary color equivalent
                    brandAccent: 'hsl(221.2 83.2% 40%)',
                  },
                },
              },
            }}
            theme="light"
            redirectTo={window.location.origin + '/ptrab'}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;