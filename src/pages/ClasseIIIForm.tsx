import { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, Pencil, XCircle, Sparkles, Check, ChevronsUpDown, Info, Download, Loader2, DollarSign } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { classeIIIFormSchema } from "@/lib/validationSchemas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { RefLPCForm, RefLPC } from "@/types/refLPC";
import { fetchPrecosCombustivel } from "@/integrations/api/precoCombustivel";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { Tables } from "@/integrations/supabase/types";

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

// Tipos de Equipamento
const TIPOS_EQUIPAMENTO = [
  { value: "MOTOMECANIZACAO", label: "Motomecanização (Vtr)" },
  { value: "GERADOR", label: "Grupo Gerador" },
  { value: "EMBARCACAO", label: "Embarcação" },
  { value: "EQUIPAMENTO_ENGENHARIA", label: "Equipamento de Engenharia" },
  { value: "OUTROS", label: "Outros" },
];

interface ClasseIIIRegistro {
  id: string;
  tipoEquipamento: string;
  organizacao: string;
  ug: string;
  quantidade: number;
  potenciaHP?: number;
  horasDia?: number;
  diasOperacao: number;
  consumoHora?: number;
  consumoKmLitro?: number;
  kmDia?: number;
  tipoCombustivel: 'GAS' | 'OD';
  precoLitro: number;
  tipoEquipamentoDetalhe?: string;
  detalhamento?: string;
  detalhamentoCustomizado?: string;
  faseAtividade?: string;
  calculos: {
    totalLitrosSemMargem: number;
    totalLitros: number;
    valorTotal: number;
  };
}

const defaultRefLPC: RefLPCForm = {
  ambito: 'Nacional',
  data_inicio_consulta: new Date().toISOString().split('T')[0],
  data_fim_consulta: new Date().toISOString().split('T')[0],
  nome_local: '',
  preco_diesel: 0,
  preco_gasolina: 0,
};

// Fator de Margem de 30%
const MARGEM_CLASSE_III = 1.3;

export default function ClasseIIIForm() {
  const navigate = useNavigate();
// ... (restante do componente)