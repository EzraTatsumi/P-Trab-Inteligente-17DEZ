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
// ... (restante do arquivo)