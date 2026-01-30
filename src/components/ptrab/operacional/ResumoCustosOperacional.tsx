"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { useDiariaResumo } from "@/hooks/useDiariaResumo";
import { useVerbaOperacionalResumo } from "@/hooks/useVerbaOperacionalResumo";
import { usePassagemResumo } from "@/hooks/usePassagemResumo"; // Importando o novo hook
import { Loader2 } from "lucide-react";

interface ResumoCustosOperacionalProps {
  ptrabId: string;
}

const ResumoCustosOperacional = ({ ptrabId }: ResumoCustosOperacionalProps) => {
  const { data: diariaResumo, isLoading: isLoadingDiaria } = useDiariaResumo(ptrabId);
  const { data: verbaResumo, isLoading: isLoadingVerba } = useVerbaOperacionalResumo(ptrabId);
  const { data: passagemResumo, isLoading: isLoadingPassagem } = usePassagemResumo(ptrabId); // Usando o novo hook

  const isLoading = isLoadingDiaria || isLoadingVerba || isLoadingPassagem;

  const totalGeral = (diariaResumo?.total_nd_15 || 0) + (diariaResumo?.total_nd_30 || 0) + (verbaResumo?.total_nd_30 || 0) + (verbaResumo?.total_nd_39 || 0) + (passagemResumo?.total_nd_33 || 0);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Resumo de Custos Operacionais</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Resumo de Custos Operacionais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Diárias */}
        <div className="space-y-2">
          <h4 className="text-md font-semibold text-gray-700">Diárias</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <p>ND 15 (Diárias):</p>
            <p className="text-right font-medium">{formatCurrency(diariaResumo?.total_nd_15 || 0)}</p>
            <p>ND 30 (Taxa Embarque):</p>
            <p className="text-right font-medium">{formatCurrency(diariaResumo?.total_nd_30 || 0)}</p>
            <p className="font-bold">Total Diárias:</p>
            <p className="text-right font-bold text-primary">{formatCurrency((diariaResumo?.total_nd_15 || 0) + (diariaResumo?.total_nd_30 || 0))}</p>
          </div>
        </div>

        <Separator />

        {/* Verba Operacional */}
        <div className="space-y-2">
          <h4 className="text-md font-semibold text-gray-700">Verba Operacional</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <p>ND 30 (Material Consumo):</p>
            <p className="text-right font-medium">{formatCurrency(verbaResumo?.total_nd_30 || 0)}</p>
            <p>ND 39 (Serviços Terceiros):</p>
            <p className="text-right font-medium">{formatCurrency(verbaResumo?.total_nd_39 || 0)}</p>
            <p className="font-bold">Total Verba Operacional:</p>
            <p className="text-right font-bold text-primary">{formatCurrency((verbaResumo?.total_nd_30 || 0) + (verbaResumo?.total_nd_39 || 0))}</p>
          </div>
        </div>

        <Separator />

        {/* Passagens (Novo) */}
        <div className="space-y-2">
          <h4 className="text-md font-semibold text-gray-700">Passagens</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <p>Quantidade de Passagens:</p>
            <p className="text-right font-medium">{passagemResumo?.total_passagens || 0}</p>
            <p>ND 33 (Passagens):</p>
            <p className="text-right font-medium">{formatCurrency(passagemResumo?.total_nd_33 || 0)}</p>
            <p className="font-bold">Total Passagens:</p>
            <p className="text-right font-bold text-primary">{formatCurrency(passagemResumo?.total_nd_33 || 0)}</p>
          </div>
        </div>

        <Separator />

        {/* Total Geral */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-lg font-bold pt-2">
          <p>TOTAL GERAL OPERACIONAL:</p>
          <p className="text-right text-green-600">{formatCurrency(totalGeral)}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResumoCustosOperacional;