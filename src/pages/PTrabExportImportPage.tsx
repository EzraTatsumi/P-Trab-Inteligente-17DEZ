import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Upload, Lock, AlertCircle, Check, FileText, Loader2, ChevronsUpDown, ArrowDownUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ExportPasswordDialog } from "@/components/ExportPasswordDialog";
import { encryptData, decryptData } from "@/lib/cryptoUtils";
import { OMData } from "@/lib/omUtils";
import { ImportConflictDialog } from "@/components/ImportConflictDialog";
import { generateUniqueMinutaNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils";
import { formatDateDDMMMAA } from "@/lib/formatUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MinutaNumberDialog } from "@/components/MinutaNumberDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Define as tabelas de registros vinculadas ao P Trab
const PTRAB_RECORD_TABLES = [
    'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
    'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
    'classe_viii_saude_registros', 'classe_viii_remonta_registros', 
    'classe_ix_registros', 'passagem_registros', 'diaria_registros', 
    'verba_operacional_registros', 'material_consumo_registros', 
    'complemento_alimentacao_registros', 'servicos_terceiros_registros', 
    'concessionaria_registros', 'horas_voo_registros', 
    'material_permanente_registros', 'dor_registros', 'p_trab_ref_lpc'
];

// Define as tabelas de diretrizes globais
const GLOBAL_DIRECTIVE_TABLES = [
    'organizacoes_militares', 'diretrizes_custeio', 'diretrizes_equipamentos_classe_iii',
    'diretrizes_operacionais', 'diretrizes_material_consumo', 'diretrizes_material_permanente',
    'diretrizes_servicos_terceiros', 'diretrizes_concessionaria', 'diretrizes_passagens',
    'diretrizes_classe_ii', 'diretrizes_classe_ix'
];

interface ExportData {
  version: string;
  timestamp: string;
  userId: string;
  type: 'full_backup' | 'single_ptrab';
  data: {
    p_trab: any; // Pode ser array ou objeto único
    [key: string]: any[]; // Todas as outras tabelas como arrays
  };
}

interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
}

interface ImportSummary {
    type: 'full_backup' | 'single_ptrab';
    details: string;
    omSigla?: string;
    ptrabNumber?: string;
    operationName?: string;
}

const generateExportFileName = (pTrabData: Tables<'p_trab'>): string => {
    const dataAtz = formatDateDDMMMAA(pTrabData.updated_at);
    const numeroPTrab = pTrabData.numero_ptrab.replace(/\//g, '-'); 
    const isMinuta = pTrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(pTrabData.periodo_inicio).getFullYear();
    
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    if (isMinuta) {
        nomeBase += ` - ${currentYear} - ${pTrabData.nome_om}`;
    }
    nomeBase += ` - ${pTrabData.nome_operacao}`;
    nomeBase += ` - Atz ${dataAtz}`;
    
    return `${nomeBase}.json`;
};

const PTrabExportImportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pTrabs, setPTrabs] = useState<SimplePTrab[]>([]);
  const [selectedPTrabId, setSelectedPTrabId] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [exportType, setExportType] = useState<'single' | 'full'>('single');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [showImportPasswordDialog, setShowImportPasswordDialog] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [decryptedData, setDecryptedData] = useState<ExportData | null>(null);
  
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showMinutaNumberDialog, setShowMinutaNumberDialog] = useState(false);
  const [importedPTrab, setImportedPTrab] = useState<Tables<'p_trab'> | null>(null);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    loadPTrabs();
  }, []);

  const loadPTrabs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("p_trab").select("id, numero_ptrab, nome_operacao");
      if (error) throw error;
      setPTrabs((data || []) as SimplePTrab[]);
      setExistingPTrabNumbers((data || []).map(p => p.numero_ptrab));
    } catch (error) {
      console.error("Erro ao carregar P Trabs:", error);
      toast.error("Erro ao carregar lista de P Trabs.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (password: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }
    
    setLoading(true);
    setShowPasswordDialog(false);

    try {
      let exportData: ExportData['data'] = { p_trab: null };
      let fileName: string;
      let exportTypeFinal: ExportData['type'];

      if (exportType === 'single' && selectedPTrabId) {
        const { data: pTrab, error: pTrabError } = await supabase
          .from('p_trab')
          .select('*, updated_at')
          .eq('id', selectedPTrabId)
          .single();
        
        if (pTrabError || !pTrab) throw new Error("P Trab não encontrado.");

        exportData.p_trab = pTrab;
        fileName = generateExportFileName(pTrab);
        exportTypeFinal = 'single_ptrab';

        // Busca registros de todas as tabelas vinculadas
        for (const table of PTRAB_RECORD_TABLES) {
            const { data, error } = await (supabase.from(table as any)).select('*').eq('p_trab_id', selectedPTrabId);
            if (!error) exportData[table] = data || [];
        }

      } else if (exportType === 'full') {
        const { data: pTrabsData } = await supabase.from('p_trab').select('*, updated_at').eq('user_id', user.id);
        exportData.p_trab = pTrabsData || [];
        fileName = `PTrab_Backup_Completo_${formatDateDDMMMAA(new Date().toISOString())}.json`;
        exportTypeFinal = 'full_backup';

        // Busca todos os registros de todas as tabelas vinculadas ao usuário
        for (const table of PTRAB_RECORD_TABLES) {
            const { data, error } = await (supabase.from(table as any)).select('*');
            if (!error) exportData[table] = data || [];
        }

        // Busca todas as diretrizes globais
        for (const table of GLOBAL_DIRECTIVE_TABLES) {
            const { data, error } = await (supabase.from(table as any)).select('*').eq('user_id', user.id);
            if (!error) exportData[table] = data || [];
        }

      } else {
        throw new Error("Selecione um P Trab ou o tipo de exportação.");
      }

      const finalExportObject: ExportData = {
        version: "1.2",
        timestamp: new Date().toISOString(),
        userId: user.id,
        type: exportTypeFinal,
        data: exportData,
      };

      const encryptedText = encryptData(finalExportObject, password);
      if (!encryptedText) throw new Error("Falha na criptografia.");

      const blob = new Blob([encryptedText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Exportação concluída!");

    } catch (error: any) {
      console.error("Erro na exportação:", error);
      toast.error(error.message || "Erro ao exportar dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToImport(file);
      setImportSummary({ type: 'single_ptrab', details: `Arquivo selecionado: ${file.name}` });
    } else {
      setFileToImport(null);
      setImportSummary(null);
    }
  };

  const handleDecryptAndAnalyze = async (password: string) => {
    if (!fileToImport) return;
    setLoading(true);
    setShowImportPasswordDialog(false);

    try {
      const fileContent = await fileToImport.text();
      const decrypted = decryptData(fileContent, password);
      if (!decrypted) throw new Error("Senha incorreta ou arquivo corrompido.");

      const importedData = decrypted as ExportData;
      setDecryptedData(importedData);

      if (importedData.type === 'full_backup') {
        setImportSummary({
          type: 'full_backup',
          details: `Backup Completo de ${(importedData.data.p_trab as any[]).length} P Trabs e configurações globais.`,
        });
        await handleFinalImport(importedData);
      } else if (importedData.type === 'single_ptrab') {
        const pTrab = importedData.data.p_trab;
        setImportedPTrab(pTrab);
        setImportSummary({
          type: 'single_ptrab',
          details: `P Trab: ${pTrab.numero_ptrab} - ${pTrab.nome_operacao}`,
          ptrabNumber: pTrab.numero_ptrab,
          operationName: pTrab.nome_operacao,
          omSigla: pTrab.nome_om,
        });
        
        if (isPTrabNumberDuplicate(pTrab.numero_ptrab, existingPTrabNumbers)) {
            setShowConflictDialog(true);
        } else {
            await handleFinalImport(importedData);
        }
      }
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(error.message || "Erro ao importar arquivo.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleOverwrite = () => {
    if (!decryptedData || !importedPTrab) return;
    const existingPTrab = pTrabs.find(p => p.numero_ptrab === importedPTrab.numero_ptrab);
    if (!existingPTrab) {
        toast.error("P Trab existente não encontrado.");
        return;
    }
    handleFinalImport(decryptedData, existingPTrab.id);
    setShowConflictDialog(false);
  };
  
  const handleStartCreateNew = () => {
    if (!importedPTrab) return;
    const newMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    setShowConflictDialog(false);
    setImportedPTrab(prev => prev ? { ...prev, numero_ptrab: newMinutaNumber } : null);
    setShowMinutaNumberDialog(true);
  };
  
  const handleConfirmMinutaNumber = (finalMinutaNumber: string) => {
    if (!decryptedData || !importedPTrab) return;
    const newPTrabAsMinuta = { ...importedPTrab, numero_ptrab: finalMinutaNumber, status: 'aberto', origem: 'importado' };
    const updatedDecryptedData: ExportData = { ...decryptedData, data: { ...decryptedData.data, p_trab: newPTrabAsMinuta } };
    handleFinalImport(updatedDecryptedData);
    setShowMinutaNumberDialog(false);
  };

  const handleFinalImport = async (data: ExportData, overwriteId?: string) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        toast.error("Usuário não autenticado.");
        setLoading(false);
        return;
    }

    try {
      if (data.type === 'full_backup') {
        await importFullBackup(data, user.id);
      } else if (data.type === 'single_ptrab') {
        await importSinglePTrab(data, user.id, overwriteId);
      }
      toast.success("Importação concluída!");
      await loadPTrabs();
      setFileToImport(null);
      setImportSummary(null);
      setDecryptedData(null);
    } catch (error: any) {
      console.error("Erro na importação final:", error);
      toast.error(error.message || "Erro ao salvar dados.");
    } finally {
      setLoading(false);
    }
  };
  
  const importFullBackup = async (data: ExportData, currentUserId: string) => {
    // 1. Importar Diretrizes Globais
    for (const table of GLOBAL_DIRECTIVE_TABLES) {
        const items = data.data[table];
        if (items && items.length > 0) {
            await (supabase.from(table as any)).delete().eq('user_id', currentUserId);
            const newItems = items.map(item => ({ ...item, user_id: currentUserId, id: undefined }));
            await (supabase.from(table as any)).insert(newItems);
        }
    }
    
    // 2. Importar P Trabs e seus registros
    const pTrabsOriginal = data.data.p_trab as any[];
    for (const originalPTrab of pTrabsOriginal) {
        if (!isPTrabNumberDuplicate(originalPTrab.numero_ptrab, existingPTrabNumbers)) {
            const { id: originalId, share_token, shared_with, created_at, updated_at, ...rest } = originalPTrab; 
            const { data: newPTrab } = await supabase
                .from('p_trab')
                .insert([{ ...rest, user_id: currentUserId, shared_with: [], origem: 'importado' }])
                .select('id')
                .single();
                
            if (newPTrab) await cloneImportedRecords(data, originalId, newPTrab.id);
        }
    }
  };
  
  const importSinglePTrab = async (data: ExportData, currentUserId: string, overwriteId?: string) => {
    const importedPTrab = data.data.p_trab;
    const { id: originalId, created_at, updated_at, share_token, shared_with, ...restOfPTrab } = importedPTrab; 
    
    let newStatus = importedPTrab.status;
    if (!overwriteId) {
        if (importedPTrab.numero_ptrab.startsWith("Minuta")) newStatus = 'aberto';
        else if (['aprovado', 'arquivado'].includes(importedPTrab.status)) newStatus = 'aprovado';
    }
    
    const ptrabDataToSave = { ...restOfPTrab, user_id: currentUserId, origem: overwriteId ? importedPTrab.origem : 'importado', status: newStatus, shared_with: [] };
    
    let finalPTrabId: string;
    if (overwriteId) {
        await supabase.from('p_trab').update(ptrabDataToSave).eq('id', overwriteId);
        finalPTrabId = overwriteId;
        // Limpa registros antigos antes de re-importar
        for (const table of PTRAB_RECORD_TABLES) {
            await (supabase.from(table as any)).delete().eq('p_trab_id', finalPTrabId);
        }
    } else {
        const { data: newPTrab, error } = await supabase.from('p_trab').insert([ptrabDataToSave]).select('id').single();
        if (error || !newPTrab) throw error;
        finalPTrabId = newPTrab.id;
    }
    
    await cloneImportedRecords(data, originalId, finalPTrabId);
  };

  const cloneImportedRecords = async (data: ExportData, originalPTrabId: string, newPTrabId: string) => {
    for (const table of PTRAB_RECORD_TABLES) {
        const records = (data.data[table] || []).filter((r: any) => r.p_trab_id === originalPTrabId);
        if (records.length > 0) {
            const newRecords = records.map((r: any) => {
                const { id, created_at, updated_at, ...rest } = r;
                return { ...rest, p_trab_id: newPTrabId };
            });
            const { error } = await (supabase.from(table as any)).insert(newRecords);
            if (error) console.error(`Erro ao importar tabela ${table}:`, error);
        }
    }
  };

  const selectedPTrab = pTrabs.find(p => p.id === selectedPTrabId);
  const isExportDisabled = exportType === 'single' && !selectedPTrabId;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gerenciamento
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownUp className="h-5 w-5 text-primary" />
              Exportar e Importar P Trabs
            </CardTitle>
            <CardDescription>
              Faça backup de seus Planos de Trabalho ou importe dados de outros usuários.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 border-r pr-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Upload className="h-4 w-4" />Exportar Dados</h3>
              <div className="space-y-2">
                <Label>Tipo de Exportação</Label>
                <Select value={exportType} onValueChange={(value: 'single' | 'full') => { setExportType(value); setSelectedPTrabId(null); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">P Trab Único</SelectItem>
                    <SelectItem value="full">Backup Completo (Todos os P Trabs e Configurações)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {exportType === 'single' && (
                <div className="space-y-2">
                  <Label>Selecione o P Trab</Label>
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        {selectedPTrab ? <span className="truncate">{selectedPTrab.numero_ptrab} - {selectedPTrab.nome_operacao}</span> : <span className="text-muted-foreground">Selecione um P Trab...</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar P Trab..." />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>Nenhum P Trab encontrado.</CommandEmpty>
                          <CommandGroup>
                            {pTrabs.map((ptrab) => (
                              <CommandItem key={ptrab.id} value={`${ptrab.numero_ptrab} ${ptrab.nome_operacao}`} onSelect={() => { setSelectedPTrabId(ptrab.id); setIsPopoverOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedPTrabId === ptrab.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col"><span>{ptrab.numero_ptrab}</span><span className="text-xs text-muted-foreground">{ptrab.nome_operacao}</span></div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <Alert variant="default"><Lock className="h-4 w-4" /><AlertTitle>Criptografia Obrigatória</AlertTitle><AlertDescription>Todos os dados exportados são criptografados com uma senha.</AlertDescription></Alert>
              <Button onClick={() => setShowPasswordDialog(true)} disabled={loading || isExportDisabled} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {loading ? "Preparando..." : "Exportar Arquivo"}
              </Button>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Download className="h-4 w-4" />Importar Dados</h3>
              <div className="space-y-2">
                <Label htmlFor="import-file">Selecione o Arquivo (.json)</Label>
                <Input id="import-file" type="file" accept=".json" onChange={handleFileChange} ref={fileInputRef} disabled={loading} />
              </div>
              {importSummary && <Alert variant="default"><FileText className="h-4 w-4" /><AlertTitle>Arquivo Carregado</AlertTitle><AlertDescription className="text-sm">{importSummary.details}</AlertDescription></Alert>}
              <Button onClick={() => setShowImportPasswordDialog(true)} disabled={loading || !fileToImport} className="w-full gap-2" variant="secondary">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? "Aguarde..." : "Iniciar Importação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <ExportPasswordDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog} onConfirm={handleExport} title="Senha de Criptografia" description="Digite uma senha para criptografar o arquivo." confirmButtonText="Criptografar e Baixar" autoComplete="new-password" />
      <ExportPasswordDialog open={showImportPasswordDialog} onOpenChange={setShowImportPasswordDialog} onConfirm={handleDecryptAndAnalyze} title="Senha de Descriptografia" description="Digite a senha usada para criptografar o arquivo." confirmButtonText="Descriptografar e Analisar" autoComplete="current-password" />
      <ImportConflictDialog open={showConflictDialog} onOpenChange={setShowConflictDialog} ptrabNumber={importedPTrab?.numero_ptrab || ''} onOverwrite={handleOverwrite} onStartCreateNew={handleStartCreateNew} />
      {importedPTrab && <MinutaNumberDialog open={showMinutaNumberDialog} onOpenChange={setShowMinutaNumberDialog} suggestedNumber={importedPTrab.numero_ptrab} originalNumber={importedPTrab.numero_ptrab} existingNumbers={existingPTrabNumbers} onConfirm={handleConfirmMinutaNumber} />}
    </div>
  );
};

export default PTrabExportImportPage;