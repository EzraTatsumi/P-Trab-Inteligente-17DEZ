import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageMetadata from "@/components/PageMetadata";
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const LogisticsDirectiveConfig = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata 
        title="Diretriz de Custeio Logístico" 
        description="Gerencie as diretrizes de custeio logístico (Classe I, III, etc.)."
        canonicalPath="/config/diretrizes"
      />
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="outline" onClick={() => navigate('/ptrab')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para P Trabs
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Diretriz de Custeio Logístico</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Esta é a página de configuração das diretrizes de custeio logístico. (Em desenvolvimento)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LogisticsDirectiveConfig;