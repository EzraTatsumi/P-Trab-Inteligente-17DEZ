import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MainLayout from "@/components/MainLayout";
import VerbaOperacionalFormContent from "@/components/ptrab/forms/VerbaOperacionalFormContent";

const VerbaOperacionalForm = () => {
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const navigate = useNavigate();

  if (!ptrabId) {
    return (
      <MainLayout>
        <Card className="mt-8 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">P Trab não Encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p>O ID do Plano de Trabalho não foi fornecido na URL.</p>
            <Button onClick={() => navigate("/ptrab")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o Gerenciador
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Verba Operacional (ND 30/39)</h1>
        <VerbaOperacionalFormContent ptrabId={ptrabId} />
      </div>
    </MainLayout>
  );
};

export default VerbaOperacionalForm;