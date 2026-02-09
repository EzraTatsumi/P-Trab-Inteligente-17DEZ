import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageMetadata from "@/components/PageMetadata";
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const OmRelationConfig = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata 
        title="Relação de OM (CODUG)" 
        description="Gerencie as Organizações Militares e seus códigos CODUG."
        canonicalPath="/config/om"
      />
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="outline" onClick={() => navigate('/ptrab')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para P Trabs
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Relação de OM (CODUG)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Esta é a página de configuração da relação de OM. (Em desenvolvimento)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OmRelationConfig;