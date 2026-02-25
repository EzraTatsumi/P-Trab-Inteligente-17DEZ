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
import { markMissionCompleted } from "@/lib/missionUtils";
import { useSession } from "@/components/SessionContextProvider";

const REPORT_OPTIONS = [
  { value: "logistico", label: "P Trab Logístico", icon: Package, iconClass: "text-orange-600" },
  { value: "racao", label: "P Trab Cl I - Ração Operacional", icon: Utensils, iconClass: "text-amber-600" },
  { value: "operacional", label: "P Trab Operacional", icon: Briefcase, iconClass: "text-blue-600" },
  { value: "permanente", label: "P Trab Material Permanente", icon: HardDrive, iconClass: "text-green-600" },
  { value: "avex", label: "P Trab Hora de Voo", icon: Plane, iconClass: "text-purple-600" },
  { value: "dor", label: "DOR", icon: ClipboardList, iconClass: "text-gray-600" },
];

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const ptrabId = searchParams.get("ptrabId");
  const [selectedReport, setSelectedReport] = useState("operacional");
  const [loading, setLoading] = useState(true);
  const [ptrabData, setPtrabData] = useState<any | null>(null);
  
  // Estado para controle remoto do menu (Tour)
  const [isReportMenuOpen, setIsReportMenuOpen] = useState(false);

  // Expondo funções para o Driver.js conseguir abrir a lista de relatórios
  useEffect(() => {
    (window as any).openReportMenu = () => setIsReportMenuOpen(true);
    (window as any).closeReportMenu = () => setIsReportMenuOpen(false);
    
    return () => {
      delete (window as any).openReportMenu;
      delete (window as any).closeReportMenu;
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (isGhostMode()) {
        setPtrabData(GHOST_DATA.p_trab_exemplo);
        setLoading(false);
        
        const startTour = searchParams.get('startTour') === 'true';
        if (startTour && user?.id) {
          setTimeout(() => {
            runMission06(user.id, () => {
              markMissionCompleted(6, user.id);
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
  }, [ptrabId, navigate, searchParams, user?.id]);

  if (loading || !ptrabData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-lg text-muted-foreground">Gerando relatórios...</span>
      </div>
    );
  }

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

          <div className="tour-report-selector bg-background rounded-md relative">
            <Select 
              value={selectedReport} 
              onValueChange={setSelectedReport}
              open={isReportMenuOpen}
              onOpenChange={setIsReportMenuOpen}
            >
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Selecione o Relatório" />
              </SelectTrigger>
              <SelectContent className="z-[999999]">
                {REPORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className={`h-4 w-4 ${option.iconClass}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
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