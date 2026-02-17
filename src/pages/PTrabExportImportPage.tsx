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

// Define the structure of the exported data
interface ExportData {
  version: string;
  timestamp: string;
  userId: string;
  type: 'full_backup' | 'single_ptrab';
  data: {
    p_trab: Tables<'p_trab'>[] | Tables<'p_trab'>;
    classe_i_registros: Tables<'classe_i_registros'>[];
    classe_ii_registros: Tables<'classe_ii_registros'>[];
    classe_iii_registros: Tables<'classe_iii_registros'>[];
    classe_v_registros: Tables<'classe_v_registros'>[];
    classe_vi_registros: Tables<'classe_vi_registros'>[];
    classe_vii_registros: Tables<'classe_vii_registros'>[];
    classe_viii_saude_registros: Tables<'classe_viii_saude_registros'>[];
    classe_viii_remonta_registros: Tables<'classe_viii_remonta_registros'>[];
    classe_ix_registros: Tables<'classe_ix_registros'>[];
    passagem_registros: Tables<'passagem_registros'>[];
    diaria_registros: Tables<'diaria_registros'>[];
    verba_operacional_registros: Tables<'verba_operacional_registros'>[];
    material_consumo_registros: Tables<'material_consumo_registros'>[];
    complemento_alimentacao_registros: Tables<'complemento_alimentacao_registros'>[];
    servicos_terceiros_registros: Tables<'servicos_terceiros_registros'>[];
    concessionaria_registros: Tables<'concessionaria_registros'>[];
    horas_voo_registros: Tables<'horas_voo_registros'>[];
    material_permanente_registros: Tables<'material_permanente_registros'>[];
    dor_registros: Tables<'dor_registros'>[];
    p_trab_ref_lpc: Tables<'p_trab_ref_lpc'>[];
    
    // Global tables only included in full backup
    organizacoes_militares?: Tables<'organizacoes_militares'>[];
    diretrizes_custeio?: Tables<'diretrizes_custeio'>[];
    diretrizes_equipamentos_classe_iii?: Tables<'diretrizes_equipamentos_classe_iii'>[];
    diretrizes_operacionais?: Tables<'diretrizes_operacionais'>[];
    diretrizes_material_consumo?: Tables<'diretrizes_material_consumo'>[];
    diretrizes_material_permanente?: Tables<'diretrizes_material_permanente'>[];
    diretrizes_servicos_terceiros?: Tables<'diretrizes_servicos_terceiros'>[];
    diretrizes_concessionaria?: Tables<'diretrizes_concessionaria'>[];
    diretrizes_passagens?: Tables<'diretrizes_passagens'>[];
    diretrizes_classe_ii?: Tables<'diretrizes_classe_ii'>[];
    diretrizes_classe_ix?: Tables<'diretrizes_classe_ix'>[];
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

type SupabaseArrayResponse<T> = { data: T[] | null; error: any };

const PTrabExportImportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pTrabs, setPTrabs] = useState<SimplePTrab[]>([]);
  const [selectedPTrabId, setSelectedPTrabId] = useState<string | null>(null);
  const [exportPassword, setExportPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [exportType, setExportType] = useState<'single' | 'full'>('single');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [showImportPasswordDialog, setShowImportPasswordDialog] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [decryptedData, setDecryptedData] = useState<ExportData | null>(null);
  
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showMinutaNumberDialog, setShowMinutaNumberDialog] = useState(false);
  const [importedPTrab, setImportedPTrab] = useState<Tables<'p_trab'> | null>(null);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  const [userOms, setUserOms] = useState<OMData[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleEnterToNextField } = useFormNavigation();

  const userId = useMemo(() => supabase.auth.getUser().then(res => res.data.user?.id), []);

  useEffect(() => {
    loadPTrabsAndOMs();
  }, []);

  const loadPTrabsAndOMs = async () => {
    setLoading(true);
    try {
      const [
        { data: pTrabsData, error: pTrabsError },
        { data: omsData, error: omsError }
      ] = await Promise.all([
        supabase.from("p_trab").select("id, numero_ptrab, nome_operacao"),
        supabase.from("organizacoes_militares").select("*").eq('ativo', true),
      ]);

      if (pTrabsError) throw pTrabsError;
      if (omsError) throw omsError;

      setPTrabs((pTrabsData || []) as SimplePTrab[]);
      setExistingPTrabNumbers((pTrabsData || []).map(p => p.numero_ptrab));
      setUserOms((omsData || []) as OMData[]);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar lista de P Trabs ou OMs.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (password: string) => {
    if (!userId) {
      toast.error("Usuário não autenticado.");
      return;
    }
    
    setLoading(true);
    setShowPasswordDialog(false);
    setExportPassword(password);

    try {
      let exportData: ExportData['data'];
      let fileName: string;
      let exportTypeFinal: ExportData['type'];
      const currentUserId = await userId;

      if (exportType === 'single' && selectedPTrabId) {
        const { data: pTrab, error: pTrabError } = await supabase
          .from('p_trab')
          .select('*, updated_at')
          .eq('id', selectedPTrabId)
          .single();
        
        if (pTrabError || !pTrab) throw new Error("P Trab não encontrado.");

        const [
          classeI, classeII, classeIII, classeV, classeVI, classeVII, 
          classeVIIISaude, classeVIIIRemonta, classeIX, passagem, diaria, 
          verbaOp, materialConsumo, complemento, servicos, concessionaria, 
          horasVoo, materialPermanente, dor, refLPC
        ] = await Promise.all([
          supabase.from('classe_i_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_ii_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_iii_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_v_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_vi_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_vii_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_viii_saude_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_viii_remonta_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_ix_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('passagem_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('diaria_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('verba_operacional_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('material_consumo_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('complemento_alimentacao_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('servicos_terceiros_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('concessionaria_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('horas_voo_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('material_permanente_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('dor_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('p_trab_ref_lpc').select('*').eq('p_trab_id', selectedPTrabId),
        ]);

        exportData = {
          p_trab: pTrab,
          classe_i_registros: classeI.data || [],
          classe_ii_registros: classeII.data || [],
          classe_iii_registros: classeIII.data || [],
          classe_v_registros: classeV.data || [],
          classe_vi_registros: classeVI.data || [],
          classe_vii_registros: classeVII.data || [],
          classe_viii_saude_registros: classeVIIISaude.data || [],
          classe_viii_remonta_registros: classeVIIIRemonta.data || [],
          classe_ix_registros: classeIX.data || [],
          passagem_registros: passagem.data || [],
          diaria_registros: diaria.data || [],
          verba_operacional_registros: verbaOp.data || [],
          material_consumo_registros: materialConsumo.data || [],
          complemento_alimentacao_registros: complemento.data || [],
          servicos_terceiros_registros: servicos.data || [],
          concessionaria_registros: concessionaria.data || [],
          horas_voo_registros: horasVoo.data || [],
          material_permanente_registros: materialPermanente.data || [],
          dor_registros: dor.data || [],
          p_trab_ref_lpc: refLPC.data || [],
        };
        fileName = generateExportFileName(pTrab);
        exportTypeFinal = 'single_ptrab';

      } else if (exportType === 'full') {
        const [
          pTrabsData, classeI, classeII, classeIII, classeV, classeVI, classeVII, 
          classeVIIISaude, classeVIIIRemonta, classeIX, passagem, diaria, 
          verbaOp, materialConsumo, complemento, servicos, concessionaria, 
          horasVoo, materialPermanente, dor, refLPC,
          omsData, custeio, equipamentos, operacionais, matConsumoDir, 
          matPermDir, servicosDir, concessionariaDir, passagensDir, 
          classeIIDir, classeIXDir
        ] = await Promise.all([
          supabase.from('p_trab').select('*, updated_at').eq('user_id', currentUserId),
          supabase.from('classe_i_registros').select('*'),
          supabase.from('classe_ii_registros').select('*'),
          supabase.from('classe_iii_registros').select('*'),
          supabase.from('classe_v_registros').select('*'),
          supabase.from('classe_vi_registros').select('*'),
          supabase.from('classe_vii_registros').select('*'),
          supabase.from('classe_viii_saude_registros').select('*'),
          supabase.from('classe_viii_remonta_registros').select('*'),
          supabase.from('classe_ix_registros').select('*'),
          supabase.from('passagem_registros').select('*'),
          supabase.from('diaria_registros').select('*'),
          supabase.from('verba_operacional_registros').select('*'),
          supabase.from('material_consumo_registros').select('*'),
          supabase.from('complemento_alimentacao_registros').select('*'),
          supabase.from('servicos_terceiros_registros').select('*'),
          supabase.from('concessionaria_registros').select('*'),
          supabase.from('horas_voo_registros').select('*'),
          supabase.from('material_permanente_registros').select('*'),
          supabase.from('dor_registros').select('*'),
          supabase.from('p_trab_ref_lpc').select('*'),
          supabase.from('organizacoes_militares').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_custeio').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_equipamentos_classe_iii').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_operacionais').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_material_consumo').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_material_permanente').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_servicos_terceiros').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_concessionaria').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_passagens').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_classe_ii').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_classe_ix').select('*').eq('user_id', currentUserId),
        ]);

        exportData = {
          p_trab: pTrabsData.data || [],
          classe_i_registros: classeI.data || [],
          classe_ii_registros: classeII.data || [],
          classe_iii_registros: classeIII.data || [],
          classe_v_registros: classeV.data || [],
          classe_vi_registros: classeVI.data || [],
          classe_vii_registros: classeVII.data || [],
          classe_viii_saude_registros: classeVIIISaude.data || [],
          classe_viii_remonta_registros: classeVIIIRemonta.data || [],
          classe_ix_registros: classeIX.data || [],
          passagem_registros: passagem.data || [],
          diaria_registros: diaria.data || [],
          verba_operacional_registros: verbaOp.data || [],
          material_consumo_registros: materialConsumo.data || [],
          complemento_alimentacao_registros: complemento.data || [],
          servicos_terceiros_registros: servicos.data || [],
          concessionaria_registros: concessionaria.data || [],
          horas_voo_registros: horasVoo.data || [],
          material_permanente_registros: materialPermanente.data || [],
          dor_registros: dor.data || [],
          p_trab_ref_lpc: refLPC.data || [],
          organizacoes_militares: omsData.data || [],
          diretrizes_custeio: custeio.data || [],
          diretrizes_equipamentos_classe_iii: equipamentos.data || [],
          diretrizes_operacionais: operacionais.data || [],
          diretrizes_material_consumo: matConsumoDir.data || [],
          diretrizes_material_permanente: matPermDir.data || [],
          diretrizes_servicos_terceiros: servicosDir.data || [],
          diretrizes_concessionaria: concessionariaDir.data || [],
          diretrizes_passagens: passagensDir.data || [],
          diretrizes_classe_ii: classeIIDir.data || [],
          diretrizes_classe_ix: classeIXDir.data || [],
        };
        
        fileName = `PTrab_Backup_Completo_${formatDateDDMMMAA(new Date().toISOString())}.json`;
        exportTypeFinal = 'full_backup';

      } else {
        throw new Error("Selecione um P Trab ou o tipo de exportação.");
      }

      const finalExportObject: ExportData = {
        version: "1.1",
        timestamp: new Date().toISOString(),
        userId: currentUserId as string,
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
      setExportPassword("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToImport(file);
      setImportSummary({
        type: 'single_ptrab',
        details: `Arquivo selecionado: ${file.name}`,
      });
    } else {
      setFileToImport(null);
      setImportSummary(null);
    }
  };

  const handleStartImport = () => {
    if (!fileToImport) {
      toast.error("Selecione um arquivo para importar.");
      return;
    }
    setShowImportPasswordDialog(true);
  };

  const handleDecryptAndAnalyze = async (password: string) => {
    if (!fileToImport) return;
    setLoading(true);
    setShowImportPasswordDialog(false);
    setImportPassword(password);

    try {
      const fileContent = await fileToImport.text();
      const decrypted = decryptData(fileContent, password);
      if (!decrypted) throw new Error("Senha incorreta ou arquivo corrompido.");

      const importedData = decrypted as ExportData;
      setDecryptedData(importedData);

      if (importedData.type === 'full_backup') {
        setImportSummary({
          type: 'full_backup',
          details: `Backup Completo de ${(importedData.data.p_trab as Tables<'p_trab'>[]).length} P Trabs e configurações globais.`,
        });
        await handleFinalImport(importedData);
      } else if (importedData.type === 'single_ptrab') {
        const pTrab = importedData.data.p_trab as Tables<'p_trab'>;
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
    const newPTrabAsMinuta = {
        ...importedPTrab,
        numero_ptrab: finalMinutaNumber,
        status: 'aberto',
        origem: 'importado',
    };
    const updatedDecryptedData: ExportData = {
        ...decryptedData,
        data: { ...decryptedData.data, p_trab: newPTrabAsMinuta }
    };
    handleFinalImport(updatedDecryptedData);
    setShowMinutaNumberDialog(false);
  };

  const handleFinalImport = async (data: ExportData, overwriteId?: string) => {
    setLoading(true);
    const currentUserId = await userId;
    if (!currentUserId) {
        toast.error("Usuário não autenticado.");
        setLoading(false);
        return;
    }

    try {
      if (data.type === 'full_backup') {
        await importFullBackup(data, currentUserId);
      } else if (data.type === 'single_ptrab') {
        await importSinglePTrab(data, currentUserId, overwriteId);
      }
      toast.success("Importação concluída!");
      await loadPTrabsAndOMs();
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
    const { 
        p_trab, organizacoes_militares, diretrizes_custeio, 
        diretrizes_equipamentos_classe_iii, diretrizes_operacionais,
        diretrizes_material_consumo, diretrizes_material_permanente,
        diretrizes_servicos_terceiros, diretrizes_concessionaria,
        diretrizes_passagens, diretrizes_classe_ii, diretrizes_classe_ix
    } = data.data;
    
    // Limpar dados globais existentes
    const globalTables = [
        'organizacoes_militares', 'diretrizes_custeio', 'diretrizes_equipamentos_classe_iii',
        'diretrizes_operacionais', 'diretrizes_material_consumo', 'diretrizes_material_permanente',
        'diretrizes_servicos_terceiros', 'diretrizes_concessionaria', 'diretrizes_passagens',
        'diretrizes_classe_ii', 'diretrizes_classe_ix'
    ];
    
    for (const table of globalTables) {
        await supabase.from(table).delete().eq('user_id', currentUserId);
    }
    
    // Inserir novos dados globais
    const insertGlobal = async (table: string, items: any[] | undefined) => {
        if (items && items.length > 0) {
            const newItems = items.map(item => ({ ...item, user_id: currentUserId, id: undefined }));
            await supabase.from(table).insert(newItems);
        }
    };

    await insertGlobal('organizacoes_militares', organizacoes_militares);
    await insertGlobal('diretrizes_custeio', diretrizes_custeio);
    await insertGlobal('diretrizes_equipamentos_classe_iii', diretrizes_equipamentos_classe_iii);
    await insertGlobal('diretrizes_operacionais', diretrizes_operacionais);
    await insertGlobal('diretrizes_material_consumo', diretrizes_material_consumo);
    await insertGlobal('diretrizes_material_permanente', diretrizes_material_permanente);
    await insertGlobal('diretrizes_servicos_terceiros', diretrizes_servicos_terceiros);
    await insertGlobal('diretrizes_concessionaria', diretrizes_concessionaria);
    await insertGlobal('diretrizes_passagens', diretrizes_passagens);
    await insertGlobal('diretrizes_classe_ii', diretrizes_classe_ii);
    await insertGlobal('diretrizes_classe_ix', diretrizes_classe_ix);
    
    const pTrabsOriginal = p_trab as Tables<'p_trab'>[];
    for (const originalPTrab of pTrabsOriginal) {
        if (!isPTrabNumberDuplicate(originalPTrab.numero_ptrab, existingPTrabNumbers)) {
            const { id: originalId, share_token, shared_with, created_at, updated_at, ...rest } = originalPTrab; 
            const { data: newPTrab, error } = await supabase
                .from('p_trab')
                .insert([{ ...rest, user_id: currentUserId, shared_with: [], origem: 'importado' }])
                .select('id')
                .single();
                
            if (newPTrab) await cloneImportedRecords(data, originalId, newPTrab.id);
        }
    }
  };
  
  const importSinglePTrab = async (data: ExportData, currentUserId: string, overwriteId?: string) => {
    const importedPTrab = data.data.p_trab as Tables<'p_trab'>;
    const { id: originalId, created_at, updated_at, share_token, shared_with, ...restOfPTrab } = importedPTrab; 
    
    let newStatus = importedPTrab.status;
    if (!overwriteId) {
        if (importedPTrab.numero_ptrab.startsWith("Minuta")) newStatus = 'aberto';
        else if (['aprovado', 'arquivado'].includes(importedPTrab.status)) newStatus = 'aprovado';
    }
    
    const ptrabDataToSave = {
        ...restOfPTrab,
        user_id: currentUserId,
        origem: overwriteId ? importedPTrab.origem : 'importado',
        status: newStatus,
        shared_with: [],
    };
    
    let finalPTrabId: string;
    if (overwriteId) {
        await supabase.from('p_trab').update(ptrabDataToSave).eq('id', overwriteId);
        finalPTrabId = overwriteId;
        await clearRelatedRecords(finalPTrabId);
    } else {
        const { data: newPTrab, error } = await supabase.from('p_trab').insert([ptrabDataToSave]).select('id').single();
        if (error || !newPTrab) throw error;
        finalPTrabId = newPTrab.id;
    }
    
    await cloneImportedRecords(data, originalId, finalPTrabId);
  };
  
  const clearRelatedRecords = async (ptrabId: string) => {
    const tables = [
        'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
        'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
        'classe_viii_saude_registros', 'classe_viii_remonta_registros', 
        'classe_ix_registros', 'passagem_registros', 'diaria_registros', 
        'verba_operacional_registros', 'material_consumo_registros', 
        'complemento_alimentacao_registros', 'servicos_terceiros_registros', 
        'concessionaria_registros', 'horas_voo_registros', 
        'material_permanente_registros', 'dor_registros', 'p_trab_ref_lpc'
    ];
    for (const table of tables) {
        await supabase.from(table).delete().eq('p_trab_id', ptrabId);
    }
  };

  const cloneImportedRecords = async (data: ExportData, originalPTrabId: string, newPTrabId: string) => {
    const tables = [
        'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
        'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
        'classe_viii_saude_registros', 'classe_viii_remonta_registros', 
        'classe_ix_registros', 'passagem_registros', 'diaria_registros', 
        'verba_operacional_registros', 'material_consumo_registros', 
        'complemento_alimentacao_registros', 'servicos_terceiros_registros', 
        'concessionaria_registros', 'horas_voo_registros', 
        'material_permanente_registros', 'dor_registros', 'p_trab_ref_lpc'
    ];

    for (const table of tables) {
        const records = (data.data[table as keyof ExportData['data']] as any[] || []).filter(r => r.p_trab_id === originalPTrabId);
        if (records.length > 0) {
            const newRecords = records.map(r => {
                const { id, created_at, updated_at, ...rest } = r;
                return { ...rest, p_trab_id: newPTrabId };
            });
            await supabase.from(table).insert(newRecords);
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
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Exportar Dados
              </h3>
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
              <Button onClick={handleStartImport} disabled={loading || !fileToImport} className="w-full gap-2" variant="secondary">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? "Aguarde..." : "Iniciar Importação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <ExportPasswordDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog} onConfirm={handleExport} title="Senha de Criptografia" description="Digite uma senha para criptografar o arquivo." confirmButtonText="Criptografar e Baixar" />
      <ExportPasswordDialog open={showImportPasswordDialog} onOpenChange={setShowImportPasswordDialog} onConfirm={handleDecryptAndAnalyze} title="Senha de Descriptografia" description="Digite a senha usada para criptografar o arquivo." confirmButtonText="Descriptografar e Analisar" />
      <ImportConflictDialog open={showConflictDialog} onOpenChange={setShowConflictDialog} ptrabNumber={importedPTrab?.numero_ptrab || ''} onOverwrite={handleOverwrite} onStartCreateNew={handleStartCreateNew} />
      {importedPTrab && <MinutaNumberDialog open={showMinutaNumberDialog} onOpenChange={setShowMinutaNumberDialog} suggestedNumber={importedPTrab.numero_ptrab} originalNumber={importedPTrab.numero_ptrab} existingNumbers={existingPTrabNumbers} onConfirm={handleConfirmMinutaNumber} />}
    </div>
  );
};

export default PTrabExportImportPage;