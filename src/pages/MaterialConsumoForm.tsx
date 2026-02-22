"use client";

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MaterialConsumoForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(false);
  const [selectedOm, setSelectedOm] = useState<OMData | null>(null);
  const [fase, setFase] = useState("");

  useEffect(() => {
    if (!ptrabId && !isGhostMode()) {
      navigate('/ptrab');
    }
  }, [ptrabId, navigate]);

  const handleSave = () => {
    toast.success("Dados salvos com sucesso!");
    navigate(`/ptrab/form?ptrabId=${ptrabId}`);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="secao-1-form-material">
          <CardHeader>
            <CardTitle>Seção 1: Identificação e Fase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organização Militar Responsável</Label>
                <OmSelector 
                  selectedOmId={selectedOm?.id}
                  onChange={setSelectedOm}
                  placeholder="Selecione a OM..."
                />
              </div>
              <div className="space-y-2">
                <Label>Fase da Atividade</Label>
                <Select value={fase} onValueChange={setFase}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fase..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparacao">Preparação</SelectItem>
                    <SelectItem value="execucao">Execução</SelectItem>
                    <SelectItem value="desmobilizacao">Desmobilização</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Salvar e Continuar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MaterialConsumoForm;