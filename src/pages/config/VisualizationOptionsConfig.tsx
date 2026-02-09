import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageMetadata from "@/components/PageMetadata";
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const VisualizationOptionsConfig = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata 
        title="Opções de Visualização" 
        description="Ajuste as configurações de visualização da aplicação."
        canonicalPath="/config/visualizacao"
      />
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="outline" onClick={() => navigate('/ptrab')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para P Trabs
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Opções de Visualização</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Esta é a página de configuração de opções de visualização. (Em desenvolvimento)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VisualizationOptionsConfig;