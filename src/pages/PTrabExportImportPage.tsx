import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Upload, Lock, AlertCircle, Check, FileText, Loader2, ChevronsUpDown } from "lucide-react";
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
import { OMData } from "@/lib/omUtils"; // Importar OMData
import { ImportConflictDialog } from "@/components/ImportConflictDialog"; // NOVO IMPORT
import { generateUniqueMinutaNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils"; // Importar utilitários de numeração
import { formatDateDDMMMAA } from "@/lib/formatUtils"; // Importar utilitário de formatação de data
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MinutaNumberDialog } from "@/components/MinutaNumberDialog"; // NOVO IMPORT
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // NOVO IMPORT

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
    classe_v_registros: Tables<'classe_v_registros'>[]; // NOVO
    classe_vi_registros: Tables<'classe_vi_registros'>[]; // NOVO
    classe_vii_registros: Tables<'classe_vii_registros'>[]; // NOVO
    classe_viii_saude_registros: Tables<'classe_viii_saude_registros'>[]; // NOVO
    classe_viii_remonta_registros: Tables<'classe_viii_remonta_registros'>[]; // NOVO
    classe_ix_registros: Tables<'classe_ix_registros'>[]; // NOVO
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
    
    const isMinuta = pTrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(pTrabData.periodo_inicio).getFullYear();
    
    // 1. Construir o nome base
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    
    if (isMinuta) {
        // Se for Minuta, adiciona o ano e a sigla da OM
        nomeBase += ` - ${currentYear} - ${pTrabData.nome_om}`;
    } else {
        // Se for Aprovado, o número já contém o ano e a sigla da OM (ex: 1-2025-23ª Bda Inf Sl)
        // Apenas adiciona a sigla da OM para clareza, mas sem o separador extra
        // Ex: P Trab Nr 1-2025-23ª Bda Inf Sl - Op MARAJOARA...
    }
    
    // 2. Adicionar o nome da operação
    nomeBase += ` - ${pTrabData.nome_operacao}`;
    
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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false); // Estado para controlar o Popover
  
  // Import States
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [showImportPasswordDialog, setShowImportPasswordDialog] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [decryptedData, setDecryptedData] = useState<ExportData | null>(null);
  
  // Conflict/Options States
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showMinutaNumberDialog, setShowMinutaNumberDialog] = useState(false); // NOVO
  const [importedPTrab, setImportedPTrab] = useState<Tables<'p_trab'> | null>(null);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  const [userOms, setUserOms] = useState<OMData[]>([]); // Mantido, mas não usado no fluxo simplificado
  
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
      const currentUserId = await userId;

      if (exportType === 'single' && selectedPTrabId) {
        // Exportar P Trab Único
        const { data: pTrab, error: pTrabError } = await supabase
          .from('p_trab')
          .select('*, updated_at') // Seleciona explicitamente updated_at
          .eq('id', selectedPTrabId)
          .single();
        
        if (pTrabError || !pTrab) throw new Error("P Trab não encontrado.");

        const [
          { data: classeI },
          { data: classeII },
          { data: classeIII },
          { data: classeV },
          { data: classeVI },
          { data: classeVII },
          { data: classeVIIISaude },
          { data: classeVIIIRemonta },
          { data: classeIX },
          { data: refLPC },
        ] = await Promise.all([
          supabase.from('classe_i_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_ii_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_iii_registros').select('*').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_v_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_vi_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_vii_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_viii_saude_registros').select('*, itens_saude, valor_nd_30, valor_nd_39').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_viii_remonta_registros').select('*, itens_remonta, valor_nd_30, valor_nd_39').eq('p_trab_id', selectedPTrabId),
          supabase.from('classe_ix_registros').select('*, itens_motomecanizacao, valor_nd_30, valor_nd_39').eq('p_trab_id', selectedPTrabId),
          supabase.from('p_trab_ref_lpc').select('*').eq('p_trab_id', selectedPTrabId).maybeSingle(),
        ]);

        exportData = {
          p_trab: pTrab,
          classe_i_registros: classeI || [],
          classe_ii_registros: classeII || [],
          classe_iii_registros: classeIII || [],
          classe_v_registros: classeV || [],
          classe_vi_registros: classeVI || [],
          classe_vii_registros: classeVII || [],
          classe_viii_saude_registros: classeVIIISaude || [],
          classe_viii_remonta_registros: classeVIIIRemonta || [],
          classe_ix_registros: classeIX || [],
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
          { data: classeV },
          { data: classeVI },
          { data: classeVII },
          { data: classeVIIISaude },
          { data: classeVIIIRemonta },
          { data: classeIX },
          { data: refLPC },
          { data: omsData },
          { data: diretrizesCusteio },
          { data: diretrizesEquipamentos },
        ] = await Promise.all([
          supabase.from('p_trab').select('*, updated_at').eq('user_id', currentUserId),
          supabase.from('classe_i_registros').select('*'),
          supabase.from('classe_ii_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39'),
          supabase.from('classe_iii_registros').select('*'),
          supabase.from('classe_v_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39'),
          supabase.from('classe_vi_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39'),
          supabase.from('classe_vii_registros').select('*, itens_equipamentos, valor_nd_30, valor_nd_39'),
          supabase.from('classe_viii_saude_registros').select('*, itens_saude, valor_nd_30, valor_nd_39'),
          supabase.from('classe_viii_remonta_registros').select('*, itens_remonta, valor_nd_30, valor_nd_39'),
          supabase.from('classe_ix_registros').select('*, itens_motomecanizacao, valor_nd_30, valor_nd_39'),
          supabase.from('p_trab_ref_lpc').select('*'),
          supabase.from('organizacoes_militares').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_custeio').select('*').eq('user_id', currentUserId),
          supabase.from('diretrizes_equipamentos_classe_iii').select('*').eq('user_id', currentUserId),
        ]);

        exportData = {
          p_trab: pTrabsData || [],
          classe_i_registros: classeI || [],
          classe_ii_registros: classeII || [],
          classe_iii_registros: classeIII || [],
          classe_v_registros: classeV || [],
          classe_vi_registros: classeVI || [],
          classe_vii_registros: classeVII || [],
          classe_viii_saude_registros: classeVIIISaude || [],
          classe_viii_remonta_registros: classeVIIIRemonta || [],
          classe_ix_registros: classeIX || [],
          p_trab_ref_lpc: refLPC || null,
          organizacoes_militares: omsData || [],
          diretrizes_custeio: diretrizesCusteio || [],
          diretrizes_equipamentos_classe_iii: diretrizesEquipamentos || [],
        };
        
        // Cria um PTrab temporário para usar a função de nome de arquivo
        const tempPTrab: Tables<'p_trab'> = {
            id: 'backup',
            numero_ptrab: 'Backup Completo',
            nome_om: 'USER',
            nome_operacao: 'Configurações',
            periodo_inicio: new Date().toISOString().split('T')[0],
            periodo_fim: new Date().toISOString().split('T')[0],
            efetivo_empregado: 'N/A',
            comando_militar_area: 'N/A',
            status: 'arquivado',
            user_id: currentUserId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Adicionar campos obrigatórios que podem estar faltando no tipo Tables<'p_trab'>
            codug_om: null,
            codug_rm_vinculacao: null,
            nome_om_extenso: null,
            nome_cmt_om: null,
            local_om: null,
            acoes: null,
            rm_vinculacao: null,
            rotulo_versao: null,
            comentario: null,
            share_token: 'temp',
            shared_with: null,
            origem: 'original',
        } as Tables<'p_trab'>;
        
        fileName = `PTrab_Backup_Completo_${formatDateDDMMMAA(tempPTrab.updated_at)}.json`;
        exportTypeFinal = 'full_backup';

      } else {
        throw new Error("Selecione um P Trab ou o tipo de exportação.");
      }

      const finalExportObject: ExportData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        userId: currentUserId as string,
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
        // Backup Completo: Vai direto para a importação
        setImportSummary({
          type: 'full_backup',
          details: `Backup Completo de ${(importedData.data.p_trab as Tables<'p_trab'>[]).length} P Trabs e configurações globais.`,
        });
        await handleFinalImport(importedData);
        
      } else if (importedData.type === 'single_ptrab') {
        // P Trab Único: Precisa de análise de conflito
        const pTrab = importedData.data.p_trab as Tables<'p_trab'>;
        setImportedPTrab(pTrab);
        
        setImportSummary({
          type: 'single_ptrab',
          details: `P Trab: ${pTrab.numero_ptrab} - ${pTrab.nome_operacao}`,
          ptrabNumber: pTrab.numero_ptrab,
          operationName: pTrab.nome_operacao,
          omSigla: pTrab.nome_om,
        });
        
        // 1. Verificar conflito de numeração
        const isDuplicate = isPTrabNumberDuplicate(pTrab.numero_ptrab, existingPTrabNumbers);
        
        if (isDuplicate) {
            // Cenário 2: Conflito - Abre diálogo de Sobrescrever/Criar Minuta
            setShowConflictDialog(true);
        } else {
            // Cenário 1: Sem conflito - Importa diretamente
            await handleFinalImport(importedData);
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
  
  // Opção 1: Sobrescrever (Apenas para P Trab Único com conflito)
  const handleOverwrite = () => {
    if (!decryptedData || !importedPTrab) return;
    
    // Sobrescrever significa que o ID do PTrab existente será usado para o UPDATE.
    const existingPTrab = pTrabs.find(p => p.numero_ptrab === importedPTrab.numero_ptrab);
    
    if (!existingPTrab) {
        toast.error("Erro interno: P Trab existente não encontrado para sobrescrever.");
        setShowConflictDialog(false);
        return;
    }
    
    // 1. Forçar a importação com o ID existente
    handleFinalImport(decryptedData, existingPTrab.id);
    setShowConflictDialog(false);
  };
  
  // Opção 2: Iniciar Criação de Minuta (Abre o diálogo de numeração)
  const handleStartCreateNew = () => {
    if (!importedPTrab) return;
    
    // 1. Gera um novo número de Minuta sugerido
    const newMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    
    // 2. Abre o diálogo de numeração da minuta
    setShowConflictDialog(false);
    setImportedPTrab(prev => prev ? { ...prev, numero_ptrab: newMinutaNumber } : null); // Atualiza o número sugerido no estado
    setShowMinutaNumberDialog(true);
  };
  
  // Opção 3: Confirmação da Minuta (Chamado pelo MinutaNumberDialog)
  const handleConfirmMinutaNumber = (finalMinutaNumber: string) => {
    if (!decryptedData || !importedPTrab) return;
    
    // 1. Atualiza o PTrab importado para ser uma Minuta com o número final
    const newPTrabAsMinuta = {
        ...importedPTrab,
        numero_ptrab: finalMinutaNumber,
        status: 'aberto',
        origem: 'importado',
    };
    
    // 2. Atualiza o PTrab dentro do objeto de dados descriptografados
    const updatedDecryptedData: ExportData = {
        ...decryptedData,
        data: {
            ...decryptedData.data,
            p_trab: newPTrabAsMinuta,
        }
    };
    
    // 3. Inicia a importação final (sem ID de sobrescrita)
    handleFinalImport(updatedDecryptedData);
    setShowMinutaNumberDialog(false);
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
    const pTrabsToInsert = (p_trab as Tables<'p_trab'>[]).map(p => {
        const { id, share_token, ...rest } = p; // FIX: Exclui id e share_token
        return { ...rest, user_id: currentUserId };
    });
    
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
    // FIX: Exclui id e share_token
    const { id: originalId, created_at, updated_at, share_token, ...restOfPTrab } = importedPTrab; 
    
    // Determine the status for the new record
    let newStatus: string;
    
    if (overwriteId) {
        // If overwriting, use the status from the imported file
        newStatus = importedPTrab.status;
    } else {
        // If inserting a new record:
        const isMinuta = importedPTrab.numero_ptrab.startsWith("Minuta");
        
        if (isMinuta) {
            // If it's a Minuta (either original or newly generated Minuta-N), start as 'aberto'
            newStatus = 'aberto';
        } else {
            // If it has an official number:
            // If the imported status is 'aprovado' or 'arquivado', set it to 'aprovado' 
            // (treating it as finalized but allowing local re-archiving).
            if (importedPTrab.status === 'aprovado' || importedPTrab.status === 'arquivado') {
                newStatus = 'aprovado';
            } else {
                // Otherwise, use the imported status (e.g., 'aberto', 'em_andamento')
                newStatus = importedPTrab.status;
            }
        }
    }
    
    const ptrabDataToSave: TablesInsert<'p_trab'> | TablesUpdate<'p_trab'> = {
        ...restOfPTrab,
        user_id: currentUserId,
        origem: overwriteId ? importedPTrab.origem : 'importado',
        status: newStatus, // Use the determined status
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
    
    // 4. Classe V
    await insertFilteredRecords('classe_v_registros', 'p_trab_id');
    
    // 5. Classe VI
    await insertFilteredRecords('classe_vi_registros', 'p_trab_id');
    
    // 6. Classe VII
    await insertFilteredRecords('classe_vii_registros', 'p_trab_id');
    
    // 7. Classe VIII Saúde
    await insertFilteredRecords('classe_viii_saude_registros', 'p_trab_id');
    
    // 8. Classe VIII Remonta
    await insertFilteredRecords('classe_viii_remonta_registros', 'p_trab_id');
    
    // 9. Classe IX
    await insertFilteredRecords('classe_ix_registros', 'p_trab_id');
    
    // 10. LPC
    if (data.data.p_trab_ref_lpc && (data.data.p_trab_ref_lpc as Tables<'p_trab_ref_lpc'>).p_trab_id === originalPTrabId) {
        const { id, created_at, updated_at, ...restOfRefLPC } = data.data.p_trab_ref_lpc as Tables<'p_trab_ref_lpc'>;
        const newRefLPC = { ...restOfRefLPC, p_trab_id: newPTrabId };
        const { error: insertError } = await supabase.from('p_trab_ref_lpc').insert([newRefLPC as TablesInsert<'p_trab_ref_lpc'>]);
        if (insertError) {
            console.error("Erro ao inserir LPC:", insertError);
            throw new Error("Falha ao importar LPC.");
        }
    }
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
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isPopoverOpen}
                        className="w-full justify-between"
                      >
                        {selectedPTrab ? (
                          <span className="truncate">{selectedPTrab.numero_ptrab} - {selectedPTrab.nome_operacao}</span>
                        ) : (
                          <span className="text-muted-foreground">Selecione um P Trab...</span>
                        )}
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
                              <CommandItem
                                key={ptrab.id}
                                value={`${ptrab.numero_ptrab} ${ptrab.nome_operacao}`}
                                onSelect={() => {
                                  setSelectedPTrabId(ptrab.id);
                                  setIsPopoverOpen(false);
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
                    </PopoverContent>
                  </Popover>
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
      
      {/* Diálogo de Conflito (Cenário 2) */}
      <ImportConflictDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        ptrabNumber={importedPTrab?.numero_ptrab || ''}
        onOverwrite={handleOverwrite}
        onStartCreateNew={handleStartCreateNew}
      />
      
      {/* Diálogo de Numeração de Minuta (Após escolher 'Criar Minuta') */}
      {importedPTrab && (
        <MinutaNumberDialog
          open={showMinutaNumberDialog}
          onOpenChange={setShowMinutaNumberDialog}
          suggestedNumber={importedPTrab.numero_ptrab} // O número já foi atualizado para a sugestão de minuta em handleStartCreateNew
          originalNumber={importedPTrab.numero_ptrab}
          existingNumbers={existingPTrabNumbers}
          onConfirm={handleConfirmMinutaNumber}
        />
      )}
    </div>
  );
};

export default PTrabExportImportPage;