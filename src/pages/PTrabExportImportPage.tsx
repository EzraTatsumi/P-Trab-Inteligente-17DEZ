import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Adicionado Label
import { ArrowLeft, Download, Upload, Lock, AlertCircle, Check, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ExportPasswordDialog } from "@/components/ExportPasswordDialog";
import { encryptData, decryptData } from "@/lib/cryptoUtils"; // Importar utilitários de criptografia
import { ImportPTrabOptionsDialog } from "@/components/ImportPTrabOptionsDialog"; // Importar novo diálogo
import { OMData } from "@/lib/omUtils"; // Importar OMData
import { ImportConflictDialog } from "@/components/ImportConflictDialog"; // NOVO IMPORT
import { generateUniqueMinutaNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils"; // Importar utilitários de numeração
import { formatDateDDMMMAA } from "@/lib/formatUtils"; // Importar utilitário de formatação de data

// Define the structure of the exported data
interface ExportData {
  version: string;
  timestamp: string;
  userId: string;
  type: 'full_backup' | 'single_ptrab';
  data: {
    p_trab: Tables<'p_trab'>[] | Tables<'p_trab'>; // Array for full, single object for single
    classe_i_registros: Tables<'classe_i_registros'>[];
    classe_ii_registros: Tables<'classe_ii_registros'>[]; // Adicionado Classe II
    classe_iii_registros: Tables<'classe_iii_registros'>[];
    p_trab_ref_lpc: Tables<'p_trab_ref_lpc'> | null;
    // Global tables only included in full backup
    organizacoes_militares?: Tables<'organizacoes_militares'>[];
    diretrizes_custeio?: Tables<'diretrizes_custeio'>[];
    diretrizes_equipamentos_classe_iii?: Tables<'diretrizes_equipamentos_classe_iii'>[];
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

// NOVO: Função para gerar o nome do arquivo de exportação
const generateExportFileName = (pTrabData: Tables<'p_trab'>): string => {
    const dataAtz = formatDateDDMMMAA(pTrabData.updated_at);
    // Substitui barras por hífens para segurança no nome do arquivo
    const numeroPTrab = pTrabData.numero_ptrab.replace(/\//g, '-'); 
    
    // 1. Usar a sigla da OM diretamente (sem forçar caixa alta)
    const omSigla = pTrabData.nome_om;
    
    // 2. Construir o nome base com a OM em posição padronizada:
    // P Trab Nr [NUMERO] - [OM_SIGLA] - [NOME_OPERACAO]
    let nomeBase = `P Trab Nr ${numeroPTrab} - ${omSigla} - ${pTrabData.nome_operacao}`;
    
    // 3. Adicionar a data de atualização
    nomeBase += ` - Atz ${dataAtz}`;
    
    return `${nomeBase}.json`;
};


const PTrabExportImportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pTrabs, setPTrabs] = useState<SimplePTrab[]>([]);
  const [selectedPTrabId, setSelectedPTrabId] = useState<string | null>(null);
  const [exportPassword, setExportPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [exportType, setExportType] = useState<'single' | 'full'>('single');
  
  // Import States
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [showImportPasswordDialog, setShowImportPasswordDialog] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [decryptedData, setDecryptedData] = useState<ExportData | null>(null);
  
  // Conflict/Options States
  const [showImportOptionsDialog, setShowImportOptionsDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
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

  // =================================================================
  // EXPORT LOGIC
  // =================================================================

  const handleExport = async (password: string) => {
    if (!userId) {
      toast.error("Usuário não autenticado.");
      return;
    }
    
    setLoading(true);
    setShowPasswordDialog(false);
    setExportPassword(password); // Salva a senha para uso

    try {
      let exportData: ExportData['data'];
      let fileName: string;
      let exportTypeFinal: ExportData['type'];

      if (exportType === 'single' && selectedPTrabId) {
        // Exportar P Trab Único
        const { data: pTrab, error: pTrabError } = await supabase
          .from('p_trab')
          .select('*')
          .eq('id', selectedPTrabId)
          .single();
        
        if (pTrabError || !pTrab) throw new Error("P Trab não encontrado.");

        const [
          { data: classeI },
          { data: classeII },
          { data: classeIII },
          { data: refLPC },
        ] = await Promise.all([
          supabase.from('classe_i_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_ii_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_iii_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('p_trab_ref_lpc').select('*').eq('p_trab_id', selectedPTrabId).maybeSingle(),
        ]);

        exportData = {
          p_trab: pTrab,
          classe_i_registros: classeI || [],
          classe_ii_registros: classeII || [],
          classe_iii_registros: classeIII || [],
          p_trab_ref_lpc: refLPC || null,
        };
        fileName = generateExportFileName(pTrab);
        exportTypeFinal = 'single_ptrab';

      } else if (exportType === 'full') {
        // Exportar Backup Completo (inclui dados globais)
        const [
          { data: pTrabsData },
          { data: classeI },
          { data: classeII },
          { data: classeIII },
          { data: refLPC },
          { data: omsData },
          { data: diretrizesCusteio },
          { data: diretrizesEquipamentos },
        ] = await Promise.all([
          supabase.from('p_trab').select('*'),
          supabase.from('classe_i_registros').select('*'),
          supabase.from('classe_ii_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39'),
          supabase.from('classe_iii_registros').select('*'),
          supabase.from('p_trab_ref_lpc').select('*'),
          supabase.from('organizacoes_militares').select('*'),
          supabase.from('diretrizes_custeio').select('*'),
          supabase.from('diretrizes_equipamentos_classe_iii').select('*'),
        ]);

        exportData = {
          p_trab: pTrabsData || [],
          classe_i_registros: classeI || [],
          classe_ii_registros: classeII || [],
          classe_iii_registros: classeIII || [],
          p_trab_ref_lpc: refLPC || null,
          organizacoes_militares: omsData || [],
          diretrizes_custeio: diretrizesCusteio || [],
          diretrizes_equipamentos_classe_iii: diretrizesEquipamentos || [],
        };
        fileName = `PTrab_Backup_Completo_${formatDateDDMMMAA(new Date().toISOString())}.json`;
        exportTypeFinal = 'full_backup';

      } else {
        throw new Error("Selecione um P Trab ou o tipo de exportação.");
      }

      const finalExportObject: ExportData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        userId: await userId as string,
        type: exportTypeFinal,
        data: exportData,
      };

      const encryptedText = encryptData(finalExportObject, password);
      
      if (!encryptedText) {
          throw new Error("Falha na criptografia. Verifique a senha.");
      }

      const blob = new Blob([encryptedText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Exportação concluída e criptografada!");

    } catch (error: any) {
      console.error("Erro na exportação:", error);
      toast.error(error.message || "Erro ao exportar dados.");
    } finally {
      setLoading(false);
      setExportPassword("");
    }
  };

  // =================================================================
  // IMPORT LOGIC
  // =================================================================

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToImport(file);
      setImportSummary({
        type: 'single_ptrab', // Assume single por padrão, será corrigido após descriptografia
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

      if (!decrypted) {
        throw new Error("Senha incorreta ou arquivo corrompido.");
      }

      const importedData = decrypted as ExportData;
      setDecryptedData(importedData);

      if (importedData.type === 'full_backup') {
        // Backup Completo: Não precisa de opções, vai direto para a importação
        setImportSummary({
          type: 'full_backup',
          details: `Backup Completo de ${importedData.data.p_trab.length} P Trabs e configurações globais.`,
        });
        await handleFinalImport(importedData);
        
      } else if (importedData.type === 'single_ptrab') {
        // P Trab Único: Precisa de análise de conflito e opções
        const pTrab = importedData.data.p_trab as Tables<'p_trab'>;
        setImportedPTrab(pTrab);
        
        setImportSummary({
          type: 'single_ptrab',
          details: `P Trab: ${pTrab.numero_ptrab} - ${pTrab.nome_operacao}`,
          ptrabNumber: pTrab.numero_ptrab,
          operationName: pTrab.nome_operacao,
          omSigla: pTrab.nome_om,
        });
        
        // 1. Verificar conflito de numeração oficial
        const isOfficial = pTrab.numero_ptrab && !pTrab.numero_ptrab.startsWith("Minuta");
        const isDuplicate = isPTrabNumberDuplicate(pTrab.numero_ptrab, existingPTrabNumbers);
        
        if (isOfficial && isDuplicate) {
            // Conflito de número oficial: Abre diálogo de Sobrescrever/Criar Novo
            setShowConflictDialog(true);
        } else {
            // Sem conflito ou é Minuta: Abre diálogo de Opções (OM de destino e numeração)
            setShowImportOptionsDialog(true);
        }
      }

    } catch (error: any) {
      console.error("Erro na importação/descriptografia:", error);
      toast.error(error.message || "Erro ao importar arquivo. Verifique a senha.");
    } finally {
      setLoading(false);
    }
  };
  
  // --- Conflict Resolution Handlers ---
  
  // Opção 1: Sobrescrever (Apenas para P Trab Único com conflito oficial)
  const handleOverwrite = () => {
    if (!decryptedData || !importedPTrab) return;
    
    // Sobrescrever significa que o ID do PTrab existente será usado para o UPDATE.
    // 1. Encontrar o ID do PTrab existente com o mesmo número
    const existingPTrab = pTrabs.find(p => p.numero_ptrab === importedPTrab.numero_ptrab);
    
    if (!existingPTrab) {
        toast.error("Erro interno: P Trab existente não encontrado para sobrescrever.");
        setShowConflictDialog(false);
        return;
    }
    
    // 2. Forçar a importação com o ID existente
    handleFinalImport(decryptedData, existingPTrab.id);
    setShowConflictDialog(false);
  };
  
  // Opção 2: Criar Novo (Gera Minuta única e abre o diálogo de opções)
  const handleCreateNew = () => {
    if (!importedPTrab) return;
    
    // 1. Gera um novo número de Minuta
    const newMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    
    // 2. Atualiza o PTrab importado para ser uma Minuta
    const newPTrabAsMinuta = {
        ...importedPTrab,
        numero_ptrab: newMinutaNumber,
        status: 'aberto',
        origem: 'importado',
    };
    
    setImportedPTrab(newPTrabAsMinuta);
    setShowConflictDialog(false);
    setShowImportOptionsDialog(true); // Abre o diálogo de opções com a Minuta
  };
  
  // --- Import Options Handler (Single PTrab) ---
  
  const handleConfirmImportOptions = (newPTrabData: Tables<'p_trab'>) => {
    if (!decryptedData) return;
    
    // 1. Atualiza o PTrab dentro do objeto de dados descriptografados
    const updatedDecryptedData: ExportData = {
        ...decryptedData,
        data: {
            ...decryptedData.data,
            p_trab: newPTrabData, // O PTrab já está com o novo número e OM de destino
        }
    };
    
    // 2. Inicia a importação final (sem ID de sobrescrita)
    handleFinalImport(updatedDecryptedData);
    setShowImportOptionsDialog(false);
  };


  // --- Final Import Logic ---
  
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
        // Lógica de importação de backup completo (substituição de dados globais)
        await importFullBackup(data, currentUserId);
        
      } else if (data.type === 'single_ptrab') {
        // Lógica de importação de P Trab único
        await importSinglePTrab(data, currentUserId, overwriteId);
      }

      toast.success("Importação concluída com sucesso!");
      await loadPTrabsAndOMs(); // Recarrega a lista de P Trabs e OMs
      setFileToImport(null);
      setImportSummary(null);
      setDecryptedData(null);
      setImportPassword("");
      
    } catch (error: any) {
      console.error("Erro na importação final:", error);
      toast.error(error.message || "Erro ao salvar dados no banco.");
    } finally {
      setLoading(false);
    }
  };
  
  // Helper para importação de backup completo
  const importFullBackup = async (data: ExportData, currentUserId: string) => {
    const { p_trab, organizacoes_militares, diretrizes_custeio, diretrizes_equipamentos_classe_iii } = data.data;
    
    // 1. Limpar dados existentes (Apenas para tabelas globais do usuário)
    await supabase.from('organizacoes_militares').delete().eq('user_id', currentUserId);
    await supabase.from('diretrizes_custeio').delete().eq('user_id', currentUserId);
    await supabase.from('diretrizes_equipamentos_classe_iii').delete().eq('user_id', currentUserId);
    
    // 2. Inserir novos dados globais (ajustando user_id)
    if (organizacoes_militares && organizacoes_militares.length > 0) {
        const newOms = organizacoes_militares.map(om => ({ ...om, user_id: currentUserId, id: undefined }));
        await supabase.from('organizacoes_militares').insert(newOms as TablesInsert<'organizacoes_militares'>[]);
    }
    if (diretrizes_custeio && diretrizes_custeio.length > 0) {
        const newDiretrizes = diretrizes_custeio.map(d => ({ ...d, user_id: currentUserId, id: undefined }));
        await supabase.from('diretrizes_custeio').insert(newDiretrizes as TablesInsert<'diretrizes_custeio'>[]);
    }
    if (diretrizes_equipamentos_classe_iii && diretrizes_equipamentos_classe_iii.length > 0) {
        const newEquipamentos = diretrizes_equipamentos_classe_iii.map(e => ({ ...e, user_id: currentUserId, id: undefined }));
        await supabase.from('diretrizes_equipamentos_classe_iii').insert(newEquipamentos as TablesInsert<'diretrizes_equipamentos_classe_iii'>[]);
    }
    
    // 3. Importar P Trabs (com lógica de conflito simplificada: se o número já existe, ele é ignorado)
    const pTrabsToInsert = (p_trab as Tables<'p_trab'>[]).map(p => ({ ...p, user_id: currentUserId, id: undefined }));
    
    for (const ptrab of pTrabsToInsert) {
        const isDuplicate = isPTrabNumberDuplicate(ptrab.numero_ptrab, existingPTrabNumbers);
        if (!isDuplicate) {
            // Insere o PTrab e seus registros relacionados
            const { data: newPTrab, error: insertPTrabError } = await supabase
                .from('p_trab')
                .insert([ptrab as TablesInsert<'p_trab'>])
                .select('id')
                .single();
                
            if (insertPTrabError || !newPTrab) {
                console.error(`Erro ao inserir PTrab ${ptrab.numero_ptrab}:`, insertPTrabError);
                continue;
            }
            
            // Clonar registros relacionados (Classe I, II, III, LPC)
            await cloneImportedRecords(data, ptrab.id!, newPTrab.id);
        }
    }
    
    toast.success(`Backup completo importado! ${pTrabsToInsert.length} P Trabs processados.`);
  };
  
  // Helper para importação de P Trab único
  const importSinglePTrab = async (data: ExportData, currentUserId: string, overwriteId?: string) => {
    const importedPTrab = data.data.p_trab as Tables<'p_trab'>;
    
    // 1. Preparar dados do PTrab
    const { id: originalId, created_at, updated_at, ...restOfPTrab } = importedPTrab;
    
    const ptrabDataToSave: TablesInsert<'p_trab'> | TablesUpdate<'p_trab'> = {
        ...restOfPTrab,
        user_id: currentUserId,
        origem: overwriteId ? importedPTrab.origem : 'importado', // Mantém a origem se for overwrite
        status: overwriteId ? importedPTrab.status : 'aberto', // Novo importado começa como 'aberto'
    };
    
    let finalPTrabId: string;
    
    if (overwriteId) {
        // UPDATE (Sobrescrever)
        const { error: updateError } = await supabase
            .from('p_trab')
            .update(ptrabDataToSave as TablesUpdate<'p_trab'>)
            .eq('id', overwriteId);
        if (updateError) throw updateError;
        finalPTrabId = overwriteId;
        
        // Limpar registros antigos antes de clonar
        await clearRelatedRecords(finalPTrabId);
        
    } else {
        // INSERT (Novo P Trab)
        const { data: newPTrab, error: insertError } = await supabase
            .from('p_trab')
            .insert([ptrabDataToSave as TablesInsert<'p_trab'>])
            .select('id')
            .single();
            
        if (insertError || !newPTrab) throw insertError;
        finalPTrabId = newPTrab.id;
    }
    
    // 2. Clonar registros relacionados (Classe I, II, III, LPC)
    await cloneImportedRecords(data, originalId, finalPTrabId);
    
    toast.success(`P Trab ${importedPTrab.numero_ptrab} importado com sucesso!`);
  };
  
  // Helper para limpar registros relacionados (usado em overwrite)
  const clearRelatedRecords = async (ptrabId: string) => {
    await supabase.from('classe_i_registros').delete().eq('p_trab_id', ptrabId);
    await supabase.from('classe_ii_registros').delete().eq('p_trab_id', ptrabId);
    await supabase.from('classe_iii_registros').delete().eq('p_trab_id', ptrabId);
    await supabase.from('p_trab_ref_lpc').delete().eq('p_trab_id', ptrabId);
    // Adicionar outras classes conforme necessário
    await supabase.from('classe_v_registros').delete().eq('p_trab_id', ptrabId);
    await supabase.from('classe_vi_registros').delete().eq('p_trab_id', ptrabId);
    await supabase.from('classe_vii_registros').delete().eq('p_trab_id', ptrabId);
    await supabase.from('classe_viii_saude_registros').delete().eq('p_trab_id', ptrabId);
    await supabase.from('classe_viii_remonta_registros').delete().eq('p_trab_id', ptrabId);
    await supabase.from('classe_ix_registros').delete().eq('p_trab_id', ptrabId);
  };

  // Helper para clonar registros importados
  const cloneImportedRecords = async (data: ExportData, originalPTrabId: string, newPTrabId: string) => {
    const currentUserId = await userId;
    
    // Helper para filtrar e inserir registros de uma tabela
    const insertFilteredRecords = async (tableName: keyof ExportData['data'], filterKey: string) => {
        const records = (data.data[tableName] as any[] || []).filter(r => r[filterKey] === originalPTrabId);
        
        if (records.length > 0) {
            const newRecords = records.map(r => {
                const { id, created_at, updated_at, ...restOfRecord } = r;
                return { 
                    ...restOfRecord, 
                    p_trab_id: newPTrabId,
                    // Adiciona user_id para tabelas que o requerem (embora as tabelas de registro não precisem, é bom garantir)
                    ...(tableName === 'organizacoes_militares' || tableName.startsWith('diretrizes') ? { user_id: currentUserId } : {})
                };
            });
            
            const { error: insertError } = await supabase
                .from(tableName)
                .insert(newRecords as TablesInsert<typeof tableName>[]);
            
            if (insertError) {
                console.error(`Erro ao inserir registros de ${tableName}:`, insertError);
                throw new Error(`Falha ao importar registros de ${tableName}.`);
            }
        }
    };
    
    // 1. Classe I
    await insertFilteredRecords('classe_i_registros', 'p_trab_id');
    
    // 2. Classe II
    await insertFilteredRecords('classe_ii_registros', 'p_trab_id');
    
    // 3. Classe III
    await insertFilteredRecords('classe_iii_registros', 'p_trab_id');
    
    // 4. LPC
    if (data.data.p_trab_ref_lpc && (data.data.p_trab_ref_lpc as Tables<'p_trab_ref_lpc'>).p_trab_id === originalPTrabId) {
        const { id, created_at, updated_at, ...restOfRefLPC } = data.data.p_trab_ref_lpc as Tables<'p_trab_ref_lpc'>;
        const newRefLPC = { ...restOfRefLPC, p_trab_id: newPTrabId };
        const { error: insertError } = await supabase.from('p_trab_ref_lpc').insert([newRefLPC as TablesInsert<'p_trab_ref_lpc'>]);
        if (insertError) {
            console.error("Erro ao inserir LPC:", insertError);
            throw new Error("Falha ao importar LPC.");
        }
    }
    
    // 5. Classes V, VI, VII, VIII, IX (usando o mesmo padrão de filtro)
    await insertFilteredRecords('classe_v_registros', 'p_trab_id');
    await insertFilteredRecords('classe_vi_registros', 'p_trab_id');
    await insertFilteredRecords('classe_vii_registros', 'p_trab_id');
    await insertFilteredRecords('classe_viii_saude_registros', 'p_trab_id');
    await insertFilteredRecords('classe_viii_remonta_registros', 'p_trab_id');
    await insertFilteredRecords('classe_ix_registros', 'p_trab_id');
  };


  // =================================================================
  // RENDER
  // =================================================================

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
              <Download className="h-5 w-5 text-primary" />
              Exportar e Importar P Trabs
            </CardTitle>
            <CardDescription>
              Faça backup de seus Planos de Trabalho ou importe dados de outros usuários.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Coluna de Exportação */}
            <div className="space-y-4 border-r pr-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar Dados
              </h3>
              
              <div className="space-y-2">
                <Label>Tipo de Exportação</Label>
                <Select
                  value={exportType}
                  onValueChange={(value: 'single' | 'full') => {
                    setExportType(value);
                    setSelectedPTrabId(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">P Trab Único</SelectItem>
                    <SelectItem value="full">Backup Completo (Todos os P Trabs e Configurações)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {exportType === 'single' && (
                <div className="space-y-2">
                  <Label>Selecione o P Trab</Label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedPTrab ? (
                          <span className="truncate">{selectedPTrab.numero_ptrab} - {selectedPTrab.nome_operacao}</span>
                        ) : (
                          <span className="text-muted-foreground">Selecione um P Trab...</span>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0 max-w-lg">
                      <Command>
                        <CommandInput placeholder="Buscar P Trab..." />
                        <CommandList>
                          <CommandEmpty>Nenhum P Trab encontrado.</CommandEmpty>
                          <CommandGroup>
                            {pTrabs.map((ptrab) => (
                              <CommandItem
                                key={ptrab.id}
                                value={`${ptrab.numero_ptrab} ${ptrab.nome_operacao}`}
                                onSelect={() => {
                                  setSelectedPTrabId(ptrab.id);
                                  // Fecha o diálogo de seleção
                                  document.getElementById('radix-:R1p6:')?.click(); 
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedPTrabId === ptrab.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{ptrab.numero_ptrab}</span>
                                  <span className="text-xs text-muted-foreground">{ptrab.nome_operacao}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              
              <Alert variant="default">
                <Lock className="h-4 w-4" />
                <AlertTitle>Criptografia Obrigatória</AlertTitle>
                <AlertDescription>
                  Todos os dados exportados são criptografados com uma senha de segurança.
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => setShowPasswordDialog(true)}
                disabled={loading || isExportDisabled}
                className="w-full gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {loading ? "Preparando..." : "Exportar Arquivo"}
              </Button>
            </div>

            {/* Coluna de Importação */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar Dados
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="import-file">Selecione o Arquivo (.json)</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  disabled={loading}
                />
              </div>
              
              {importSummary && (
                <Alert variant="default">
                  <FileText className="h-4 w-4" />
                  <AlertTitle>Arquivo Carregado</AlertTitle>
                  <AlertDescription className="text-sm">
                    {importSummary.details}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleStartImport}
                disabled={loading || !fileToImport}
                className="w-full gap-2"
                variant="secondary"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? "Aguarde..." : "Iniciar Importação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Diálogo de Senha de Exportação */}
      <ExportPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onConfirm={handleExport}
        title="Senha de Criptografia"
        description="Digite uma senha para criptografar o arquivo de exportação."
        confirmButtonText="Criptografar e Baixar"
      />
      
      {/* Diálogo de Senha de Importação */}
      <ExportPasswordDialog
        open={showImportPasswordDialog}
        onOpenChange={setShowImportPasswordDialog}
        onConfirm={handleDecryptAndAnalyze}
        title="Senha de Descriptografia"
        description="Digite a senha usada para criptografar o arquivo importado."
        confirmButtonText="Descriptografar e Analisar"
      />
      
      {/* Diálogo de Conflito (Apenas para P Trab Único Oficial Duplicado) */}
      <ImportConflictDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        ptrabNumber={importedPTrab?.numero_ptrab || ''}
        onOverwrite={handleOverwrite}
        onCreateNew={handleCreateNew}
      />
      
      {/* Diálogo de Opções de Importação (Para Minutas ou P Trabs sem conflito) */}
      {importedPTrab && (
        <ImportPTrabOptionsDialog
          open={showImportOptionsDialog}
          onOpenChange={setShowImportOptionsDialog}
          importedPTrab={importedPTrab}
          existingPTrabNumbers={existingPTrabNumbers}
          userOms={userOms}
          onConfirmImport={handleConfirmImportOptions}
        />
      )}
    </div>
  );
};

export default PTrabExportImportPage;