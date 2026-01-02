import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProfilePage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gerenciamento
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Meu Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Esta é a página de perfil. O conteúdo será carregado aqui.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;