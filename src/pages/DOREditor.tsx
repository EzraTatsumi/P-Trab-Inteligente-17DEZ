"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, ClipboardList, Mail, Phone, Info } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { isGhostMode } from "@/lib/ghostStore";
import { runMission05 } from "@/tours/missionTours";
import { markMissionCompleted } from "@/lib/missionUtils";
import { toast } from "sonner";

const DOREditor = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const ptrabId = searchParams.get('ptrabId');
  const startTour = searchParams.get('startTour') === 'true';
  const [loading, setLoading] = useState(false);

  // Tour da Missão 05
  useEffect(() => {
    if (startTour && isGhostMode() && user?.id) {
      const timer = setTimeout(() => {
        runMission05(user.id, () => {
          markMissionCompleted(5, user.id);
          navigate('/ptrab?showHub=true');
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [startTour, user?.id]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>

        <Card className="shadow-lg tour-dor-document">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <ClipboardList className="h-6 w-6 text-primary" />
                  Documento de Oficialização da Requisição (DOR)
                </CardTitle>
                <p className="text-muted-foreground">Preencha as justificativas e agrupe os itens do P Trab.</p>
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-md border shadow-sm" id="tour-dor-number">
                <Label htmlFor="dor-nr" className="font-bold">DOR Nº</Label>
                <Input id="dor-nr" defaultValue="01" className="w-16 h-8 text-center" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {/* Seção de Contato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 tour-dor-contato">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> E-mail do Requisitante</Label>
                <Input defaultValue="requisitante@exercito.mil.br" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Telefone/Ramal</Label>
                <Input defaultValue="(91) 3211-1234" />
              </div>
            </div>

            {/* Justificativas */}
            <div className="space-y-6">
              <div className="space-y-2 tour-dor-finalidade">
                <Label className="font-bold">1. Finalidade técnica e estratégica</Label>
                <Textarea defaultValue="Atender às necessidades de infraestrutura da OPERAÇÃO SENTINELA, garantindo a manutenção da capacidade operativa das frações desdobradas em ambiente de selva." rows={3} />
              </div>

              <div className="space-y-2 tour-dor-motivacao">
                <Label className="font-bold">2. Motivação da demanda</Label>
                <Textarea defaultValue="Necessidade identificada conforme Plano de Trabalho Anual e reforçada pela Msg Op nº 196 - CCOp/CMN, visando a recomposição de estoques críticos de material de construção." rows={3} />
              </div>

              <div className="space-y-2 tour-dor-consequencia">
                <Label className="font-bold">3. Consequência do não atendimento</Label>
                <Textarea defaultValue="O não atendimento comprometerá a segurança das instalações temporárias e poderá causar a interrupção das atividades de patrulhamento de fronteira por falta de suporte logístico adequado." rows={3} />
              </div>

              <div className="space-y-2 tour-dor-observacoes">
                <Label className="font-bold">4. Observações gerais</Label>
                <Textarea defaultValue="Os itens solicitados seguem rigorosamente os preços médios de mercado obtidos via Painel de Preços e APIs do PNCP, conforme memórias de cálculo anexas ao P Trab." rows={4} />
              </div>
            </div>

            {/* Itens e Importação */}
            <div className="border-t pt-8 space-y-4">
              <div className="flex justify-between items-center tour-dor-descricao-item">
                <h3 className="text-lg font-bold">5. Descrição Detalhada dos Itens</h3>
                <Button variant="secondary" className="btn-importar-dados-dor">
                  Importar Dados do P Trab
                </Button>
              </div>

              <div className="bg-muted/20 border-2 border-dashed rounded-xl p-12 text-center tour-dor-items-section">
                <div className="max-w-sm mx-auto space-y-4">
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <ClipboardList className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Clique em importar para carregar os grupos de custo e gerar a tabela do documento.</p>
                </div>
              </div>
            </div>
          </CardContent>
          <div className="p-6 border-t bg-muted/10 flex justify-end">
            <Button className="btn-salvar-dor gap-2" size="lg" onClick={() => toast.success("DOR salvo com sucesso!")}>
              <Save className="h-5 w-5" />
              Salvar Documento
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DOREditor;