import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { useQueryClient } from "@tanstack/react-query";
import { generateUniqueMinutaNumber, generateVariationPTrabNumber, generateApprovalPTrabNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrency, formatDateDDMMMAA } from "@/lib/formatUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pencil, Trash2, Plus, FileText, Loader2, Check, X, Share2, Users, RefreshCw, ArrowLeft, Copy, AlertTriangle, MessageSquare, ClipboardList } from "lucide-react";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import ShareLinkDialog from "@/components/ShareLinkDialog";
import ManageSharingDialog from "@/components/ManageSharingDialog";
import UnlinkPTrabDialog from "@/components/UnlinkPTrabDialog";
import LinkPTrabDialog from "@/components/LinkPTrabDialog";
import { sanitizeError } from "@/lib/errorUtils";
import AIChatDrawer from "@/components/AIChatDrawer";
import { FeedbackDialog } from "@/components/FeedbackDialog";

// --- DEFINIÇÕES DE TIPOS ---
type PTrab = Tables<'p_trab'>;

export interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
  status: string;
  origem: string;
  user_id: string;
  shared_with: string[] | null;
  updated_at: string;
}

interface PTrabFormValues extends TablesInsert<'p_trab'> {
  // Campos adicionais para o formulário
  selectedOmId?: string;
}
// --- FIM DEFINIÇÕES DE TIPOS ---


const PTrabManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: loadingSession } = useSession();
  const queryClient = useQueryClient();

  // --- ESTADOS PRINCIPAIS ---
  const [pTrabs, setPTrabs] = useState<SimplePTrab[]>([]);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const [originalPTrabIdToClone, setOriginalPTrabIdToClone] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [ptrabToDelete, setPTrabToDelete] = useState<SimplePTrab | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [ptrabToApprove, setPTrabToApprove] = useState<SimplePTrab | null>(null);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [ptrabToClone, setPTrabToClone] = useState<SimplePTrab | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [ptrabToShare, setPTrabToShare] = useState<SimplePTrab | null>(null);
  const [showManageSharingDialog, setShowManageSharingDialog] = useState(false);
  const [ptrabToManage, setPTrabToManage] = useState<SimplePTrab | null>(null);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [ptrabToUnlink, setPTrabToUnlink] = useState<SimplePTrab | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [selectedPTrabs, setSelectedPTrabs] = useState<SimplePTrab[]>([]);
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  const [consolidationLoading, setConsolidationLoading] = useState(false);
  
  const [formData, setFormData] = useState<PTrabFormValues>({
    numero_ptrab: "",
    comando_militar_area: "",
    nome_om: "",
    nome_om_extenso: "",
    codug_om: "",
    rm_vinculacao: "",
    codug_rm_vinculacao: "",
    nome_operacao: "",
    periodo_inicio: "",
    periodo_fim: "",
    efetivo_empregado: "",
    acoes: "",
    nome_cmt_om: "",
    local_om: "",
    status: "aberto",
    origem: 'original',
    comentario: "",
    rotulo_versao: null,
    user_id: user?.id || "", // Default user_id
    share_token: "", // Default share_token
    shared_with: [], // Default shared_with
  });
  // --- FIM ESTADOS PRINCIPAIS ---

  const { handleEnterToNextField } = useFormNavigation();

  // Função de reset do formulário (usando useCallback para evitar recriação desnecessária)
  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedOmId(undefined); // Mantém undefined para novos PTrabs
    setOriginalPTrabIdToClone(null);
    
    const uniqueMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    
    setFormData({
      numero_ptrab: uniqueMinutaNumber, 
      comando_militar_area: "",
      nome_om: "",
      nome_om_extenso: "",
      codug_om: "",
      rm_vinculacao: "",
      codug_rm_vinculacao: "",
      nome_operacao: "",
      periodo_inicio: "",
      periodo_fim: "",
      efetivo_empregado: "",
      acoes: "",
      nome_cmt_om: "",
      local_om: "",
      status: "aberto",
      origem: 'original',
      comentario: "",
      rotulo_versao: null,
      user_id: user?.id || "",
      share_token: "",
      shared_with: [],
    });
  }, [existingPTrabNumbers, user?.id]);

  // ... (loadPTrabs e outros effects)

  // ... (handleSubmit)

  const handleEdit = (ptrab: PTrab) => {
    setEditingId(ptrab.id);
    
    // NOVO: Força a busca do ID da OM para garantir a exibição correta no OmSelector
    if (ptrab.nome_om && ptrab.codug_om) {
        const lookupOmId = async () => {
            const { data, error } = await supabase
                .from('organizacoes_militares')
                .select('id')
                .eq('nome_om', ptrab.nome_om)
                .eq('codug_om', ptrab.codug_om)
                .maybeSingle();

            if (data && data.id) {
                setSelectedOmId(data.id); // Define o ID para o OmSelector usar a busca robusta
            } else {
                // Se a busca falhar, define como undefined para que o OmSelector use o nome (currentOmName)
                setSelectedOmId(undefined); 
            }
        };
        lookupOmId();
    } else {
        setSelectedOmId(undefined);
    }
    
    setFormData({
      numero_ptrab: ptrab.numero_ptrab,
      comando_militar_area: ptrab.comando_militar_area,
      nome_om: ptrab.nome_om,
      nome_om_extenso: ptrab.nome_om_extenso || "",
      codug_om: ptrab.codug_om || "",
      rm_vinculacao: ptrab.rm_vinculacao || "",
      codug_rm_vinculacao: ptrab.codug_rm_vinculacao || "",
      nome_operacao: ptrab.nome_operacao,
      periodo_inicio: ptrab.periodo_inicio,
      periodo_fim: ptrab.periodo_fim,
      efetivo_empregado: ptrab.efetivo_empregado,
      acoes: ptrab.acoes || "",
      nome_cmt_om: ptrab.nome_cmt_om || "",
      local_om: ptrab.local_om || "",
      status: ptrab.status,
      origem: ptrab.origem,
      comentario: ptrab.comentario || "",
      rotulo_versao: ptrab.rotulo_versao || null,
      user_id: ptrab.user_id,
      share_token: ptrab.share_token,
      shared_with: ptrab.shared_with,
    });
    setDialogOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ... (restante do componente)
};

export default PTrabManager;