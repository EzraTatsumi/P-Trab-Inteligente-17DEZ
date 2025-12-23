import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Loader2, FileText, AlertCircle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { OMData, omSchema, analyzeOMData, cleanAndDeduplicateOMs } from "@/lib/omUtils";
import { TablesInsert } from "@/integrations/supabase/types";
import { OmUploadConfirmDialog } from "@/components/OmUploadConfirmDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as z from "zod";

// Define a interface para os dados lidos do CSV/Excel
interface RawOMData {
  'OM (Sigla)': string;
  'CODUG OM': string;
  'RM Vinculação': string;
  'CODUG RM': string;
  'Cidade': string; // NOVO CAMPO
}

const OmBulkUploadPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawOMs, setRawOMs] = useState<RawOMData[]>([]);
  const [analysisResult, setAnalysisResult] = useState<ReturnType<typeof analyzeOMData> | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setRawOMs([]);
      setAnalysisResult(null);
    } else {
      setFile(null);
    }
  };

  const processFile = () => {
    if (!file) {
      toast.error("Selecione um arquivo CSV ou Excel.");
      return;
    }

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Lê os dados, garantindo que os cabeçalhos sejam mapeados corretamente
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (json.length < 2) {
            throw new Error("O arquivo está vazio ou não possui cabeçalho e dados.");
        }
        
        const headers = json[0] as string[];
        // NOVO: Adicionado 'Cidade' aos cabeçalhos obrigatórios
        const requiredHeaders = ['OM (Sigla)', 'CODUG OM', 'RM Vinculação', 'CODUG RM', 'Cidade'];
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            throw new Error(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}`);
        }
        
        // Mapeia os dados para o formato RawOMData
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: requiredHeaders, range: 1 }) as RawOMData[];
        
        if (rawData.length === 0) {
            throw new Error("Nenhum dado de OM encontrado após a leitura.");
        }
        
        setRawOMs(rawData);
        
        // 1. Analisar e limpar os dados
        const analysis = analyzeOMData(rawData);
        setAnalysisResult(analysis);
        
        // 2. Abrir diálogo de confirmação
        setShowConfirmDialog(true);

      } catch (error: any) {
        toast.error(`Erro ao processar arquivo: ${error.message}`);
        setRawOMs([]);
        setAnalysisResult(null);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmUpload = async () => {
    if (!analysisResult) return;

    setLoading(true);
    setShowConfirmDialog(false);

    try {
      // 1. Limpar e deduzir os dados finais
      const finalOMs = cleanAndDeduplicateOMs(rawOMs);
      
      // 2. Obter o ID do usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 3. Preparar para inserção (adicionar user_id e garantir que o ID seja gerado pelo DB)
      const omsToInsert: TablesInsert<'organizacoes_militares'>[] = finalOMs.map(om => ({
        user_id: user.id,
        nome_om: om.nome_om,
        codug_om: om.codug_om,
        rm_vinculacao: om.rm_vinculacao,
        codug_rm_vinculacao: om.codug_rm_vinculacao,
        cidade: om.cidade, // NOVO: Incluir cidade
        ativo: true,
      }));

      // 4. Limpar a tabela existente do usuário antes de inserir
      const { error: deleteError } = await supabase
        .from('organizacoes_militares')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // 5. Inserir os novos dados
      const { error: insertError } = await supabase
        .from('organizacoes_militares')
        .insert(omsToInsert);

      if (insertError) throw insertError;

      toast.success(`Sucesso! ${finalOMs.length} OMs carregadas e dados antigos substituídos.`);
      navigate("/config/om");

    } catch (error: any) {
      console.error("Erro no upload em massa:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const isFileSelected = !!file;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/config/om")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gerenciamento de OM
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Importação em Massa de OMs
            </CardTitle>
            <CardDescription>
              Carregue uma planilha (.csv ou .xlsx) para substituir a lista de Organizações Militares (CODUG) cadastradas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Formato Obrigatório</AlertTitle>
              <AlertDescription>
                O arquivo deve conter as colunas exatas: 
                <span className="font-mono text-sm block mt-1">
                  'OM (Sigla)', 'CODUG OM', 'RM Vinculação', 'CODUG RM', 'Cidade'
                </span>
                <span className="text-xs mt-2 block">
                    Atenção: Todos os dados existentes serão substituídos.
                </span>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="om-file">Selecione o Arquivo</Label>
              <Input
                id="om-file"
                type="file"
                accept=".csv, .xlsx"
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>

            <Button
              onClick={processFile}
              disabled={loading || !isFileSelected}
              className="w-full gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {loading ? "Processando..." : "Analisar e Carregar Dados"}
            </Button>
            
            {/* Exibição do resultado da análise */}
            {analysisResult && (
                <Alert variant="default" className="mt-4">
                    <FileText className="h-4 w-4" />
                    <AlertTitle>Análise Concluída</AlertTitle>
                    <AlertDescription>
                        {analysisResult.total} registros lidos. {analysisResult.duplicatasRemovidas} duplicatas exatas removidas. 
                        {analysisResult.multipleCodugs.length > 0 && (
                            <span className="text-yellow-700 font-medium block">
                                ⚠️ {analysisResult.multipleCodugs.length} OMs com múltiplos CODUGs detectadas.
                            </span>
                        )}
                        Pronto para confirmar o upload.
                    </AlertDescription>
                </Alert>
            )}

          </CardContent>
        </Card>
      </div>
      
      {/* Diálogo de Confirmação de Upload */}
      {analysisResult && (
        <OmUploadConfirmDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          analysisResult={analysisResult}
          onConfirm={handleConfirmUpload}
        />
      )}
    </div>
  );
};

export default OmBulkUploadPage;