import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UploadCloud, AlertCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseOmCsv, OMData, validateCODUG } from "@/lib/omUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OmUploadConfirmDialog } from "@/components/OmUploadConfirmDialog";

const OmBulkUploadPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [csvData, setCsvData] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    total: number;
    totalAposDeduplicacao: number;
    duplicatasRemovidas: number;
    unique: Partial<OMData>[];
    multipleCodugs: { nome: string; registros: Partial<OMData>[] }[];
  } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [parsedOmsCache, setParsedOmsCache] = useState<Partial<OMData>[]>([]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para acessar esta página.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }
      setUserId(user.id);
    };
    fetchUser();
  }, [navigate, toast]);

  const removeDuplicates = (oms: Partial<OMData>[]) => {
    const uniqueOms = new Map<string, Partial<OMData>>();
    const codugSet = new Set<string>();
    let removedCount = 0;
    
    oms.forEach(om => {
      // Chave de unicidade baseada no CODUG, que é a restrição do banco
      const codugKey = om.codug_om!; 
      
      // Chave de unicidade baseada em todos os campos (para contar duplicatas exatas)
      const exactKey = `${om.nome_om}|${om.codug_om}|${om.rm_vinculacao}|${om.codug_rm_vinculacao}`;

      if (!codugSet.has(codugKey)) {
        codugSet.add(codugKey);
        uniqueOms.set(codugKey, om);
      } else {
        // Se o CODUG já existe, verifica se é uma duplicata exata
        const existingOm = uniqueOms.get(codugKey);
        const existingExactKey = `${existingOm?.nome_om}|${existingOm?.codug_om}|${existingOm?.rm_vinculacao}|${existingOm?.codug_rm_vinculacao}`;
        
        if (exactKey === existingExactKey) {
          removedCount++;
        } else {
          // Se o CODUG já existe, mas os outros dados são diferentes, 
          // mantemos o primeiro registro encontrado para esse CODUG, mas contamos como duplicata de CODUG.
          // A lógica de 'multipleCodugs' abaixo tratará isso.
        }
      }
    });
    
    return {
      uniqueOmsByCodug: Array.from(uniqueOms.values()),
      removedExactDuplicates: removedCount
    };
  };

  const analyzeOmData = (parsedOms: Partial<OMData>[]) => {
    const totalOriginal = parsedOms.length;
    
    // 1. Remover duplicatas exatas e obter lista única por CODUG
    const { uniqueOmsByCodug, removedExactDuplicates } = removeDuplicates(parsedOms);
    
    // 2. Agrupar por nome para identificar OMs com múltiplos CODUGs (características especiais)
    const groupedByName = new Map<string, Partial<OMData>[]>();
    uniqueOmsByCodug.forEach(om => {
      const existing = groupedByName.get(om.nome_om!) || [];
      existing.push(om);
      groupedByName.set(om.nome_om!, existing);
    });
    
    // 3. Classificar
    const unique: Partial<OMData>[] = [];
    const multipleCodugs: { nome: string; registros: Partial<OMData>[] }[] = [];
    
    const finalOmsForUpload: Partial<OMData>[] = [];

    groupedByName.forEach((oms, nome) => {
      if (oms.length === 1) {
        unique.push(oms[0]);
        finalOmsForUpload.push(oms[0]);
      } else {
        // OMs com mesmo nome mas CODUGs diferentes (características especiais)
        multipleCodugs.push({ nome, registros: oms });
        // Incluímos todos os registros com CODUGs diferentes, pois eles são válidos
        finalOmsForUpload.push(...oms);
      }
    });
    
    return { 
      total: totalOriginal,
      totalAposDeduplicacao: finalOmsForUpload.length,
      duplicatasRemovidas: totalOriginal - finalOmsForUpload.length, // Recalcula com base no resultado final
      unique, 
      multipleCodugs,
      deduplicatedOms: finalOmsForUpload // Retornar os dados limpos para o upload
    };
  };

  const handleAnalyze = async () => {
    if (!csvData.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, cole os dados CSV na caixa de texto.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const parsedOms = parseOmCsv(csvData);

      if (parsedOms.length === 0) {
        throw new Error("Nenhum dado de OM válido foi encontrado no CSV.");
      }

      // Validação adicional dos CODUGs
      for (const om of parsedOms) {
        if (!validateCODUG(om.codug_om!)) {
          throw new Error(`CODUG da OM inválido para "${om.nome_om}": ${om.codug_om}. Formato esperado: XXX.XXX`);
        }
        if (!validateCODUG(om.codug_rm_vinculacao!)) {
          throw new Error(`CODUG da RM inválido para "${om.rm_vinculacao}" (OM: ${om.nome_om}): ${om.codug_rm_vinculacao}. Formato esperado: XXX.XXX`);
        }
      }

      // Analisar dados
      const analysis = analyzeOmData(parsedOms);
      setAnalysisResult(analysis);
      setParsedOmsCache(analysis.deduplicatedOms);

      // Informar sobre deduplicação se houver
      if (analysis.duplicatasRemovidas > 0) {
        toast({
          title: "Duplicatas removidas",
          description: `${analysis.duplicatasRemovidas} registro(s) idêntico(s) ou com CODUG duplicado foi(foram) automaticamente removido(s).`,
        });
      }

      // Se houver OMs com múltiplos CODUGs, mostrar modal para revisão
      if (analysis.multipleCodugs.length > 0) {
        setShowConfirmDialog(true);
        toast({
          title: "Análise concluída",
          description: `${analysis.multipleCodugs.length} OMs com múltiplos CODUGs detectadas. Revise e confirme.`,
        });
      } else {
        // Se não houver múltiplos CODUGs, carregar diretamente
        await performUpload(analysis.deduplicatedOms);
      }
    } catch (error: any) {
      console.error("Erro na análise:", error);
      toast({
        title: "Erro na análise",
        description: error.message || "Ocorreu um erro ao analisar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const performUpload = async (parsedOms: Partial<OMData>[]) => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "ID do usuário não encontrado. Tente fazer login novamente.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {

      // 1. Excluir OMs existentes do usuário
      const { error: deleteError } = await supabase
        .from('organizacoes_militares')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 2. Inserir novas OMs
      const omsToInsert = parsedOms.map(om => ({
        nome_om: om.nome_om!,
        codug_om: om.codug_om!,
        rm_vinculacao: om.rm_vinculacao!,
        codug_rm_vinculacao: om.codug_rm_vinculacao!,
        ativo: om.ativo ?? true,
        user_id: userId,
      }));

      const { error: insertError } = await supabase
        .from('organizacoes_militares')
        .insert(omsToInsert);

      if (insertError) throw insertError;

      const multipleCodugsCount = analysisResult 
        ? analysisResult.multipleCodugs.reduce((sum, dup) => sum + dup.registros.length, 0)
        : 0;

      toast({
        title: "Sucesso",
        description: `${parsedOms.length} registros de OMs carregados com sucesso!${multipleCodugsCount > 0 ? ` (incluindo ${analysisResult!.multipleCodugs.length} OMs com múltiplos CODUGs)` : ''}`,
      });
      
      // Limpar estados
      setCsvData("");
      setAnalysisResult(null);
      setParsedOmsCache([]);
      setShowConfirmDialog(false);
      
      navigate("/config/om");
    } catch (error: any) {
      console.error("Erro no upload em massa:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Ocorreu um erro ao carregar as OMs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpload = async () => {
    setShowConfirmDialog(false);
    await performUpload(parsedOmsCache);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/config/om")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gerenciamento de OMs
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Upload em Massa de Organizações Militares</CardTitle>
            <CardDescription>
              Cole os dados da sua planilha "LISTA OM-CODUG" no formato CSV.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Importante!</AlertTitle>
              <AlertDescription>
                Ao realizar o upload, **todos os dados de OMs existentes** associados à sua conta serão **substituídos** pelos dados que você colar aqui.
                Certifique-se de que seu CSV contenha as colunas: "Nome da OM", "CODUG OM", "RM vinculacao", "CODUG RM".
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="csv-data">Cole os dados CSV aqui:</Label>
              <Textarea
                id="csv-data"
                rows={15}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={`Exemplo:\nNome da OM;CODUG OM;RM vinculacao;CODUG RM\nCmdo 23ª Bda Inf Sl;160.170;8º RM;160.163\n50º BIS;160.103;8º RM;160.163`}
                className="font-mono text-sm"
              />
            </div>

            <Button onClick={handleAnalyze} disabled={loading || !userId} className="w-full">
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Analisando..." : "Analisar Dados"}
            </Button>
          </CardContent>
        </Card>

        {analysisResult && (
          <OmUploadConfirmDialog
            open={showConfirmDialog}
            onOpenChange={setShowConfirmDialog}
            analysisResult={analysisResult}
            onConfirm={handleConfirmUpload}
          />
        )}
      </div>
    </div>
  );
};

export default OmBulkUploadPage;