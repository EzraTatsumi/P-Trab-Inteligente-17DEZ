import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, LogOut, FileText, Printer, Settings, PenSquare, MoreVertical, Pencil, Copy, FileSpreadsheet, Download, MessageSquare, ArrowRight, HelpCircle, CheckCircle, GitBranch, Archive, RefreshCw, User, Loader2, Share2, Link, Users, XCircle, ArrowDownUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/formatUtils";
import { generateUniquePTrabNumber, generateVariationPTrabNumber, isPTrabNumberDuplicate, generateApprovalPTrabNumber, generateUniqueMinutaNumber } from "@/lib/ptrabNumberUtils";
import PTrabConsolidationDialog from "@/components/PTrabConsolidationDialog";
import { ConsolidationNumberDialog } from "@/components/ConsolidationNumberDialog";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { HelpDialog } from "@/components/HelpDialog";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import { updateUserCredits, fetchUserCredits } from "@/lib/creditUtils";
import { cn } from "@/lib/utils";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";
import { useSession } from "@/components/SessionContextProvider";
import AIChatDrawer from "@/components/AIChatDrawer";
import ShareLinkDialog from "@/components/ShareLinkDialog";
import LinkPTrabDialog from "@/components/LinkPTrabDialog";
import ManageSharingDialog from "@/components/ManageSharingDialog";
import UnlinkPTrabDialog from "@/components/UnlinkPTrabDialog";

// Define the union of all table names based on the generated types.ts
type TableName = 
    'classe_i_registros' | 'classe_ii_registros' | 'classe_iii_registros' | 
    'classe_v_registros' | 'classe_vi_registros' | 'classe_vii_registros' | 
    'classe_viii_remonta_registros' | 'classe_viii_saude_registros' | 'classe_ix_registros' |
    'diaria_registros' | 'diretrizes_classe_ii' | 'diretrizes_custeio' | 
    'diretrizes_equipamentos_classe_iii' | 'diretrizes_passagens' | 'organizacoes_militares' | 
    'p_trab' | 'p_trab_ref_lpc' | 'passagem_registros' | 'profiles' | 
    'ptrab_share_requests' | 'verba_operacional_registros';

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'consolidado';
  rotulo_versao: string | null;
};

export interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
}

interface PTrab extends PTrabDB {
  totalLogistica?: number;
  totalOperacional?: number;
  totalMaterialPermanente?: number;
  quantidadeRacaoOp?: number;
  quantidadeHorasVoo?: number;
  // NOVO: Propriedades de compartilhamento
  isOwner: boolean;
  isShared: boolean;
  hasPendingRequests: boolean;
}

// NOVO TIPO: Para gerenciar solicitações
interface ShareRequest extends Tables<'ptrab_share_requests'> {
  requester_profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    raw_user_meta_data: { posto_graduacao?: string, nome_om?: string } | null;
  } | null;
}

// Lista de Comandos Militares de Área (CMA)
const COMANDOS_MILITARES_AREA = [
  "Comando Militar da Amazônia",
  "Comando Militar do Norte",
  "Comando Militar do Nordeste",
  "Comando Militar do Planalto",
  "Comando Militar do Oeste",
  "Comando Militar do Leste",
  "Comando Militar do Sudeste",
  "Comando Militar do Sul",
];

const PTrabManager = () => {
// ... (rest of PTrabManager component setup)

// ... (around line 1084)
  const cloneRelatedRecords = async (originalPTrabId: string, newPTrabId: string) => {
    
    const cloneClassRecords = async <T extends TableName>(tableName: T, jsonbField: string, numericFields: string[]) => {
        const { data: originalRecords, error: fetchError } = await supabase
            .from(tableName as T)
            .select(`*, ${jsonbField}`);

        if (fetchError) {
            console.error(`Erro ao carregar registros da ${tableName}:`, fetchError);
            return 0;
        }

        const newRecords = (originalRecords || []).map(record => {
            const typedRecord = record as Tables<T>;
            const { id, created_at, updated_at, ...restOfRecord } = typedRecord;
            
            const newRecord: Record<string, any> = {
                ...restOfRecord,
                p_trab_id: newPTrabId,
                [jsonbField]: typedRecord[jsonbField] ? JSON.parse(JSON.stringify(typedRecord[jsonbField])) : null,
            };
            
            numericFields.forEach(field => {
                if (newRecord[field] === null || newRecord[field] === undefined) {
                    newRecord[field] = 0;
                }
            });
            
            return newRecord;
        });

        if (newRecords.length > 0) {
            const { error: insertError } = await supabase
                .from(tableName)
                .insert(newRecords as TablesInsert<T>[]);
            
            if (insertError) {
                console.error(`ERRO DE INSERÇÃO ${tableName}:`, insertError);
                toast.error(`Erro ao clonar registros da ${tableName}: ${sanitizeError(insertError)}`);
            }
        }
        return newRecords.length;
    };

    const classeINumericFields = [
        'complemento_qr', 'complemento_qs', 'dias_operacao', 'efetivo', 'etapa_qr', 'etapa_qs', 
        'nr_ref_int', 'total_geral', 'total_qr', 'total_qs', 'valor_qr', 'valor_qs', 
        'quantidade_r2', 'quantidade_r3'
    ];
    
    const { data: originalClasseIRecords, error: fetchClasseIError } = await supabase
      .from("classe_i_registros")
      .select("*")
      .eq("p_trab_id", originalPTrabId);

    if (fetchClasseIError) {
      console.error("Erro ao carregar registros da Classe I:", fetchClasseIError);
    } else {
      const newClasseIRecords = (originalClasseIRecords || []).map(record => {
        const { id, created_at, updated_at, ...restOfRecord } = record;
        
        const newRecord: Record<string, any> = {
            ...restOfRecord,
            p_trab_id: newPTrabId,
        };
        
        classeINumericFields.forEach(field => {
            if (newRecord[field] === null || newRecord[field] === undefined) {
                newRecord[field] = 0;
            }
        });
        
        return newRecord;
      });

      if (newClasseIRecords.length > 0) {
        const { error: insertClasseIError } = await supabase
          .from("classe_i_registros")
          .insert(newClasseIRecords as TablesInsert<'classe_i_registros'>[]);
        if (insertClasseIError) {
          console.error("ERRO DE INSERÇÃO CLASSE I:", insertClasseIError);
          toast.error(`Erro ao clonar registros da Classe I: ${sanitizeError(insertClasseIError)}`);
        }
      }
    }
    
    const genericNumericFields = ['dias_operacao', 'valor_total', 'valor_nd_30', 'valor_nd_39'];

    await cloneClassRecords('classe_ii_registros', 'itens_equipamentos', genericNumericFields);

    const classeIIINumericFields = [
        'dias_operacao', 'preco_litro', 'quantidade', 'total_litros', 'valor_total', 
        'consumo_lubrificante_litro', 'preco_lubrificante', 'valor_nd_30', 'valor_nd_39'
    ];
    
    const { data: originalClasseIIIRecords, error: fetchClasseIIIError } = await supabase
      .from("classe_iii_registros")
      .select("*")
      .eq("p_trab_id", originalPTrabId);

    if (fetchClasseIIIError) {
      console.error("Erro ao carregar registros da Classe III:", fetchClasseIIIError);
    } else {
      const newClasseIIIRecords = (originalClasseIIIRecords || []).map(record => {
        const { id, created_at, updated_at, ...restOfRecord } = record;
        
        const newRecord: Record<string, any> = {
            ...restOfRecord,
            p_trab_id: newPTrabId,
            itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null,
        };
        
        classeIIINumericFields.forEach(field => {
            if (newRecord[field] === null || newRecord[field] === undefined) {
                newRecord[field] = 0;
            }
        });
        
        return newRecord;
      });

      if (newClasseIIIRecords.length > 0) {
        const { error: insertClasseIIIError } = await supabase
          .from("classe_iii_registros")
          .insert(newClasseIIIRecords as TablesInsert<'classe_iii_registros'>[]);
        if (insertClasseIIIError) {
          console.error("ERRO DE INSERÇÃO CLASSE III:", insertClasseIIIError);
          toast.error(`Erro ao clonar registros da Classe III: ${sanitizeError(insertClasseIIIError)}`);
        }
      }
    }
    
    await cloneClassRecords('classe_v_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_vi_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_vii_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_viii_saude_registros', 'itens_saude', genericNumericFields);
    await cloneClassRecords('classe_viii_remonta_registros', 'itens_remonta', [...genericNumericFields, 'quantidade_animais']);
    await cloneClassRecords('classe_ix_registros', 'itens_motomecanizacao', genericNumericFields);

    const { data: originalRefLPC, error: fetchRefLPCError } = await supabase
      .from("p_trab_ref_lpc")
      .select("*")
      .eq("p_trab_id", originalPTrabId)
      .maybeSingle();

    if (fetchRefLPCError) {
      console.error("Erro ao carregar referência LPC:", fetchRefLPCError);
    } else if (originalRefLPC) {
      const { id, created_at, updated_at, ...restOfRefLPC } = originalRefLPC;
      const newRefLPCData = {
        ...restOfRefLPC,
        p_trab_id: newPTrabId,
        preco_diesel: restOfRefLPC.preco_diesel ?? 0,
        preco_gasolina: restOfRefLPC.preco_gasolina ?? 0,
      };
      const { error: insertRefLPCError } = await supabase
        .from("p_trab_ref_lpc")
        .insert([newRefLPCData as TablesInsert<'p_trab_ref_lpc'>]);
      if (insertRefLPCError) {
        console.error("ERRO DE INSERÇÃO REF LPC:", insertRefLPCError);
        toast.error(`Erro ao clonar referência LPC: ${sanitizeError(insertRefLPCError)}`);
      }
    }
  };

// ... (around line 1230)
        const tablesToConsolidate: TableName[] = [
            'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
            'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
            'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros',
            'diaria_registros', // Incluindo diárias
            'verba_operacional_registros', // Incluindo verba operacional
            'passagem_registros', // Incluindo passagens
        ];
        
        for (const tableName of tablesToConsolidate) {
            const { data: records, error: recordsError } = await supabase
                .from(tableName as TableName)
                .select('*')
                .in('p_trab_id', selectedPTrabsToConsolidate);
                
            if (recordsError) {
                console.error(`Erro ao buscar registros de ${tableName} para consolidação:`, recordsError);
                toast.warning(`Aviso: Falha ao consolidar registros de ${tableName}.`);
                continue;
            }
            
            if (records && records.length > 0) {
                const newRecords = records.map(record => {
                    const { id, created_at, updated_at, ...restOfRecord } = record;
                    
                    const newRecord: TablesInsert<typeof tableName> = {
                        ...restOfRecord,
                        p_trab_id: newPTrabId,
                        ...(record.itens_equipamentos ? { itens_equipamentos: JSON.parse(JSON.stringify(record.itens_equipamentos)) } : {}),
                        ...(record.itens_saude ? { itens_saude: JSON.parse(JSON.stringify(record.itens_saude)) } : {}),
                        ...(record.itens_remonta ? { itens_remonta: JSON.parse(JSON.stringify(record.itens_remonta)) } : {}),
                        ...(record.itens_motomecanizacao ? { itens_motomecanizacao: JSON.parse(JSON.stringify(record.itens_motomecanizacao)) } : {}),
                    } as TablesInsert<typeof tableName>;
                    
                    return newRecord;
                });
                
                const { error: insertRecordsError } = await supabase
                    .from(tableName)
                    .insert(newRecords);
                    
                if (insertRecordsError) {
                    console.error(`Erro ao inserir registros consolidados de ${tableName}:`, insertRecordsError);
                    toast.warning(`Aviso: Falha ao inserir registros consolidados de ${tableName}.`);
                }
            }
        }
// ... (rest of the file)