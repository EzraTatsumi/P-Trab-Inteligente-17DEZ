"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, FileText, Package, Briefcase, Plane, ClipboardList, HardDrive, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isGhostMode, GHOST_DATA } from "@/lib/ghostStore";
import PTrabOperacionalReport from "@/components/reports/PTrabOperacionalReport";
import { runMission06 } from "@/tours/missionTours";

// Tipos básicos para o Gerenciador de Relatórios
export type PTrabData = any;
export type DiariaRegistro = any;
export type VerbaOperacionalRegistro = any;
export type PassagemRegistro = any;
export type MaterialConsumoRegistro = any;
export type ComplementoAlimentacaoRegistro = any;
export type ServicoTerceiroRegistro = any;
export type GrupoOMOperacional = any;

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const [selectedReport, setSelectedReport] = useState("operacional");
  const [loading, setLoading] = useState(true);
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (isGhostMode()) {
        setPtrabData(GHOST_DATA.p_trab_exemplo);
        setLoading(false);
        
        // Iniciar Tour da Missão 06 se solicitado
        if (searchParams.get('startTour') === 'true') {
          setTimeout(() => {
            runMission06(() => {
              navigate('/ptrab?showHub=true');
            });
          }, 800);
        }
        return;
      }

      if (!ptrabId) {
        toast.error("P Trab não selecionado.");
        navigate("/ptrab");
        return;
      }

      const { data, error } = await supabase.from("p_trab").select("*").eq("id", ptrabId).single();
      if (error || !data) {
        toast.error("Falha ao carregar P Trab.");
        navigate("/ptrab");
        return;
      }
      setPtrabData(data);
      setLoading(false);
    };
    loadData();
  }, [ptrabId, navigate, searchParams]);

  if (loading || !ptrabData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-lg text-muted-foreground">Gerando relatórios...</span>
      </div>
    );
  }

  // Dados mockados para o relatório Operacional (Tour)
  const mockOms = ["1º BIS"];
  const mockGrupos = {
    "1º BIS": {
      diarias: [],
      verbaOperacional: [],
      suprimentoFundos: [],
      passagens: [],
      concessionarias: [],
      materialConsumo: [{
        id: 'ghost-mat',
        organizacao: '1º BIS',
        ug: '160222',
        efetivo: 150,
        dias_operacao: 15,
        valor_total: 1250.50,
        valor_nd_30: 1250.50,
        valor_nd_39: 0,
        group_name: 'Material de Construção'
      }],
      complementoAlimentacao: [],
      servicosTerceiros: []
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 print:p-0 print:bg-white">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Formulário
          </Button>

          <div className="flex items-center gap-3">
            <Select value={selectedReport} onValueChange={setSelectedReport}>
              {/* XEQUE-MATE: Adicionando classes para o Driver.js iluminar corretamente */}
              <SelectTrigger className="w-[320px] tour-report-selector relative bg-background">
                <SelectValue placeholder="Selecione o Relatório" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="logistico"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-orange-600" /> P Trab Logístico</div></SelectItem>
                <SelectItem value="racao"><div className="flex items-center gap-2"><Utensils className="h-4 w-4 text-amber-600" /> P Trab Cl I - Ração Operacional</div></SelectItem>
                <SelectItem value="operacional"><div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-blue-600" /> P Trab Operacional</div></SelectItem>
                <SelectItem value="permanente"><div className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-green-600" /> P Trab Material Permanente</div></SelectItem>
                <SelectItem value="avex"><div className="flex items-center gap-2"><Plane className="h-4 w-4 text-purple-600" /> P Trab Hora de Voo</div></SelectItem>
                <SelectItem value="dor"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-gray-600" /> DOR</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="shadow-2xl border-none print:shadow-none">
          <CardContent className="p-0">
            {selectedReport === "operacional" && (
              <PTrabOperacionalReport 
                ptrabData={ptrabData}
                omsOrdenadas={mockOms}
                gruposPorOM={mockGrupos}
                registrosDiaria={[]}
                registrosVerbaOperacional={[]}
                registrosSuprimentoFundos={[]}
                registrosPassagem={[]}
                registrosConcessionaria={[]}
                registrosMaterialConsumo={mockGrupos["1º BIS"].materialConsumo}
                registrosComplementoAlimentacao={[]}
                registrosServicosTerceiros={[]}
                diretrizesOperacionais={null}
                diretrizesPassagens={[]}
                fileSuffix="Operacional"
                generateDiariaMemoriaCalculo={() => ""}
                generateVerbaOperacionalMemoriaCalculo={() => ""}
                generateSuprimentoFundosMemoriaCalculo={() => ""}
                generatePassagemMemoriaCalculo={() => ""}
                generateConcessionariaMemoriaCalculo={() => ""}
                generateMaterialConsumoMemoriaCalculo={() => ""}
                generateComplementoMemoriaCalculo={() => ""}
                generateServicoMemoriaCalculo={() => ""}
              />
            )}
            {selectedReport !== "operacional" && (
              <div className="p-12 text-center text-muted-foreground italic">
                Este relatório ({selectedReport}) está disponível na versão completa do sistema.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PTrabReportManager;