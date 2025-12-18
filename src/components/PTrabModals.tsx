import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, RefreshCw, MessageSquare, Users } from "lucide-react";
import { OmSelector } from "@/components/OmSelector";
import PTrabConsolidationDialog from "@/components/PTrabConsolidationDialog";
import { ConsolidationNumberDialog } from "@/components/ConsolidationNumberDialog";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import { ShareDialog } from "@/components/ShareDialog";
import { ShareRequestDialog } from "@/components/ShareRequestDialog";
import { ShareRequestsDialog } from "@/components/ShareRequestsDialog";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { OMData } from "@/lib/omUtils";
import { Tables } from "@/integrations/supabase/types";
import { PTrab, SimplePTrab } from "@/pages/PTrabManager";
import { useSession } from "@/components/SessionContextProvider";

interface PTrabModalsProps {
    // New/Edit Dialog
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    editingId: string | null;
    formData: any; // Using 'any' for simplicity, but should be PTrabForm type
    setFormData: (data: any) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    loading: boolean;
    originalPTrabIdToClone: string | null;
    selectedOmId: string | undefined;
    setSelectedOmId: (id: string | undefined) => void;
    
    // Archive Dialog
    showArchiveStatusDialog: boolean;
    setShowArchiveStatusDialog: (show: boolean) => void;
    ptrabToArchiveName: string | null;
    handleConfirmArchiveStatus: () => Promise<void>;
    handleCancelArchiveStatus: () => void;

    // Reactivate Dialog
    showReactivateStatusDialog: boolean;
    setShowReactivateStatusDialog: (show: boolean) => void;
    ptrabToReactivateName: string | null;
    handleConfirmReactivateStatus: () => Promise<void>;
    handleCancelReactivateStatus: () => void;

    // Clone Dialogs
    showCloneOptionsDialog: boolean;
    setShowCloneOptionsDialog: (show: boolean) => void;
    ptrabToClone: PTrab | null;
    cloneType: 'new' | 'variation';
    setCloneType: (type: 'new' | 'variation') => void;
    suggestedCloneNumber: string;
    handleConfirmCloneOptions: () => Promise<void>;
    showCloneVariationDialog: boolean;
    setShowCloneVariationDialog: (show: boolean) => void;
    handleConfirmCloneVariation: (versionName: string) => Promise<void>;

    // Approve Dialog
    showApproveDialog: boolean;
    setShowApproveDialog: (show: boolean) => void;
    ptrabToApprove: PTrab | null;
    suggestedApproveNumber: string;
    setSuggestedApproveNumber: (number: string) => void;
    handleApproveAndNumber: () => Promise<void>;
    currentYear: number;
    yearSuffix: string;

    // Comentario Dialog
    showComentarioDialog: boolean;
    setShowComentarioDialog: (show: boolean) => void;
    ptrabComentario: PTrab | null;
    comentarioText: string;
    setComentarioText: (text: string) => void;
    handleSaveComentario: () => Promise<void>;

    // Consolidation Dialogs
    showConsolidationDialog: boolean;
    setShowConsolidationDialog: (show: boolean) => void;
    pTrabsList: SimplePTrab[];
    existingPTrabNumbers: string[];
    handleOpenConsolidationNumberDialog: (selectedPTrabs: string[]) => void;
    showConsolidationNumberDialog: boolean;
    setShowConsolidationNumberDialog: (show: boolean) => void;
    suggestedConsolidationNumber: string;
    simplePTrabsToConsolidate: SimplePTrab[];
    handleConfirmConsolidation: (finalMinutaNumber: string) => Promise<void>;

    // Share Dialogs
    showShareDialog: boolean;
    setShowShareDialog: (show: boolean) => void;
    ptrabToShare: Tables<'p_trab'> | null;
    showShareRequestDialog: boolean;
    setShowShareRequestDialog: (show: boolean) => void;
    handleProcessShareLink: (link: string) => Promise<void>;
    showShareRequestsDialog: boolean;
    setShowShareRequestsDialog: (show: boolean) => void;
    ptrabToManageRequests: string | null;
    onUpdate: () => void; // For reloading PTrabs after share management
}

const PTrabModals = ({
    dialogOpen, setDialogOpen, editingId, formData, setFormData, handleSubmit, loading, originalPTrabIdToClone, selectedOmId, setSelectedOmId,
    showArchiveStatusDialog, setShowArchiveStatusDialog, ptrabToArchiveName, handleConfirmArchiveStatus, handleCancelArchiveStatus,
    showReactivateStatusDialog, setShowReactivateStatusDialog, ptrabToReactivateName, handleConfirmReactivateStatus, handleCancelReactivateStatus,
    showCloneOptionsDialog, setShowCloneOptionsDialog, ptrabToClone, cloneType, setCloneType, suggestedCloneNumber, handleConfirmCloneOptions,
    showCloneVariationDialog, setShowCloneVariationDialog, handleConfirmCloneVariation,
    showApproveDialog, setShowApproveDialog, ptrabToApprove, suggestedApproveNumber, setSuggestedApproveNumber, handleApproveAndNumber, yearSuffix,
    showComentarioDialog, setShowComentarioDialog, ptrabComentario, comentarioText, setComentarioText, handleSaveComentario,
    showConsolidationDialog, setShowConsolidationDialog, pTrabsList, existingPTrabNumbers, handleOpenConsolidationNumberDialog,
    showConsolidationNumberDialog, setShowConsolidationNumberDialog, suggestedConsolidationNumber, simplePTrabsToConsolidate, handleConfirmConsolidation,
    showShareDialog, setShowShareDialog, ptrabToShare, showShareRequestDialog, setShowShareRequestDialog, handleProcessShareLink,
    showShareRequestsDialog, setShowShareRequestsDialog, ptrabToManageRequests, onUpdate,
}: PTrabModalsProps) => {
    const { handleEnterToNextField } = useFormNavigation();

    return (
        <>
            {/* 1. New/Edit PTrab Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar P Trab" : "Novo P Trab"}</DialogTitle>
                        {originalPTrabIdToClone && (
                            <DialogDescription className="text-green-600 font-medium">
                                Clonando dados de classes do P Trab original. Edite o cabeçalho e clique em Criar.
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="numero_ptrab">Número do P Trab *</Label>
                                <Input
                                    id="numero_ptrab"
                                    value={formData.numero_ptrab}
                                    onChange={(e) => setFormData({ ...formData, numero_ptrab: e.target.value })}
                                    placeholder="Minuta"
                                    maxLength={50}
                                    required
                                    onKeyDown={handleEnterToNextField}
                                    disabled={formData.numero_ptrab.startsWith("Minuta") && !editingId}
                                    className={formData.numero_ptrab.startsWith("Minuta") && !editingId ? "bg-muted/50 cursor-not-allowed" : ""}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {formData.numero_ptrab.startsWith("Minuta") 
                                        ? "A numeração oficial (padrão: número/ano/OM) será atribuída após a aprovação."
                                        : "O número oficial já foi atribuído."
                                    }
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nome_operacao">Nome da Operação *</Label>
                                <Input
                                    id="nome_operacao"
                                    value={formData.nome_operacao}
                                    onChange={(e) => setFormData({ ...formData, nome_operacao: e.target.value })}
                                    required
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="comando_militar_area">Comando Militar de Área *</Label>
                                <Input
                                    id="comando_militar_area"
                                    value={formData.comando_militar_area}
                                    onChange={(e) => setFormData({ ...formData, comando_militar_area: e.target.value })}
                                    placeholder="Ex: Comando Militar da Amazônia"
                                    maxLength={100}
                                    required
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nome_om_extenso">Nome da OM (por extenso) *</Label>
                                <Input
                                    id="nome_om_extenso"
                                    value={formData.nome_om_extenso}
                                    onChange={(e) => setFormData({ ...formData, nome_om_extenso: e.target.value })}
                                    placeholder="Ex: Comando da 23ª Brigada de Infantaria de Selva"
                                    maxLength={300}
                                    required
                                    onKeyDown={handleEnterToNextField}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Este nome será usado no cabeçalho do P Trab impresso
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="nome_om">Nome da OM (sigla) *</Label>
                                <OmSelector
                                    selectedOmId={selectedOmId}
                                    onChange={(omData: OMData | undefined) => {
                                        if (omData) {
                                            setSelectedOmId(omData.id);
                                            setFormData({
                                                ...formData,
                                                nome_om: omData.nome_om,
                                                nome_om_extenso: formData.nome_om_extenso,
                                                codug_om: omData.codug_om,
                                                rm_vinculacao: omData.rm_vinculacao,
                                                codug_rm_vinculacao: omData.codug_rm_vinculacao,
                                            });
                                        } else {
                                            setSelectedOmId(undefined);
                                            setFormData({
                                                ...formData,
                                                nome_om: "",
                                                nome_om_extenso: formData.nome_om_extenso,
                                                codug_om: "",
                                                rm_vinculacao: "",
                                                codug_rm_vinculacao: "",
                                            });
                                        }
                                    }}
                                    placeholder="Selecione uma OM..."
                                    disabled={loading}
                                />
                                {formData.codug_om && (
                                    <p className="text-xs text-muted-foreground">
                                        CODUG: {formData.codug_om} | RM: {formData.rm_vinculacao}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="efetivo_empregado">Efetivo Empregado *</Label>
                                <Input
                                    id="efetivo_empregado"
                                    value={formData.efetivo_empregado}
                                    onChange={(e) => setFormData({ ...formData, efetivo_empregado: e.target.value })}
                                    placeholder="Ex: 110 militares e 250 OSP"
                                    required
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="periodo_inicio">Período Início *</Label>
                                <Input
                                    id="periodo_inicio"
                                    type="date"
                                    value={formData.periodo_inicio}
                                    onChange={(e) => setFormData({ ...formData, periodo_inicio: e.target.value })}
                                    required
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="periodo_fim">Período Fim *</Label>
                                <Input
                                    id="periodo_fim"
                                    type="date"
                                    value={formData.periodo_fim}
                                    onChange={(e) => setFormData({ ...formData, periodo_fim: e.target.value })}
                                    required
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="local_om">Local da OM *</Label>
                                <Input
                                    id="local_om"
                                    value={formData.local_om}
                                    onChange={(e) => setFormData({ ...formData, local_om: e.target.value })}
                                    placeholder="Ex: Marabá/PA"
                                    maxLength={200}
                                    required
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nome_cmt_om">Nome do Comandante da OM *</Label>
                                <Input
                                    id="nome_cmt_om"
                                    value={formData.nome_cmt_om}
                                    onChange={(e) => setFormData({ ...formData, nome_cmt_om: e.target.value })}
                                    maxLength={200}
                                    required
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="acoes">Ações realizadas ou a serem realizadas *</Label>
                            <Textarea
                                id="acoes"
                                value={formData.acoes}
                                onChange={(e) => setFormData({ ...formData, acoes: e.target.value })}
                                rows={4}
                                maxLength={2000}
                                required
                                onKeyDown={handleEnterToNextField}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Aguarde..." : (editingId ? "Atualizar" : "Criar")}
                            </Button>
                            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                                Cancelar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* 2. Archive Status Dialog */}
            <AlertDialog open={showArchiveStatusDialog} onOpenChange={setShowArchiveStatusDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arquivar P Trab?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O P Trab "{ptrabToArchiveName}" está com status "Aprovado" há mais de 10 dias. Deseja arquivá-lo?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancelArchiveStatus}>Agora não</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmArchiveStatus}>Sim, arquivar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 3. Reactivate Status Dialog */}
            <AlertDialog open={showReactivateStatusDialog} onOpenChange={setShowReactivateStatusDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reativar P Trab?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja reativar o P Trab "{ptrabToReactivateName}"? Ele retornará ao status de "Aprovado" (se já numerado) ou "Aberto" (se for Minuta), permitindo novas edições.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleConfirmReactivateStatus} disabled={loading}>
                            {loading ? "Aguarde..." : "Confirmar Reativação"}
                        </AlertDialogAction>
                        <AlertDialogCancel onClick={handleCancelReactivateStatus} disabled={loading}>
                            Cancelar
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 4. Clone Options Dialog */}
            <Dialog open={showCloneOptionsDialog} onOpenChange={setShowCloneOptionsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Clonar Plano de Trabalho</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Clonando: <span className="font-medium">{ptrabToClone?.numero_ptrab} - {ptrabToClone?.nome_operacao}</span>
                        </p>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <RadioGroup 
                            value={cloneType} 
                            onValueChange={(value: 'new' | 'variation') => setCloneType(value)}
                            className="grid grid-cols-2 gap-4"
                        >
                            <Label
                                htmlFor="clone-new"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                            >
                                <RadioGroupItem id="clone-new" value="new" className="sr-only" />
                                <span className="mb-3 text-lg font-semibold">Novo P Trab</span>
                                <p className="text-sm text-muted-foreground text-center">
                                    Cria um P Trab totalmente novo, iniciando como Minuta para posterior numeração.
                                </p>
                            </Label>
                            <Label
                                htmlFor="clone-variation"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                            >
                                <RadioGroupItem id="clone-variation" value="variation" className="sr-only" />
                                <span className="mb-3 text-lg font-semibold">Variação do Trabalho</span>
                                <p className="text-sm text-muted-foreground text-center">
                                    Cria uma variação do P Trab atual, gerando um novo número de Minuta.
                                </p>
                            </Label>
                        </RadioGroup>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleConfirmCloneOptions}>Continuar</Button>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancelar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 5. Clone Variation Dialog */}
            {ptrabToClone && (
                <CloneVariationDialog
                    open={showCloneVariationDialog}
                    onOpenChange={setShowCloneVariationDialog}
                    originalNumber={ptrabToClone.numero_ptrab}
                    suggestedCloneNumber={suggestedCloneNumber}
                    onConfirm={handleConfirmCloneVariation}
                />
            )}

            {/* 6. Comentario Dialog */}
            <Dialog open={showComentarioDialog} onOpenChange={setShowComentarioDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Comentário do P Trab</DialogTitle>
                        {ptrabComentario && (
                            <p className="text-sm text-muted-foreground">
                                {ptrabComentario.numero_ptrab} - {ptrabComentario.nome_operacao}
                            </p>
                        )}
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="Digite seu comentário sobre este P Trab..."
                            value={comentarioText}
                            onChange={(e) => setComentarioText(e.target.value)}
                            className="min-h-[150px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveComentario}>
                            Salvar
                        </Button>
                        <Button variant="outline" onClick={() => setShowComentarioDialog(false)}>
                            Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 7. Approve Dialog */}
            <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Aprovar e Numerar P Trab
                        </DialogTitle>
                        <DialogDescription>
                            Atribua o número oficial ao P Trab "{ptrabToApprove?.nome_operacao}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="approve-number">Número Oficial do P Trab *</Label>
                            <Input
                                id="approve-number"
                                value={suggestedApproveNumber}
                                onChange={(e) => setSuggestedApproveNumber(e.target.value)}
                                placeholder={`Ex: 1${yearSuffix}/${ptrabToApprove?.nome_om}`}
                                maxLength={50}
                                onKeyDown={handleEnterToNextField}
                            />
                            <p className="text-xs text-muted-foreground">
                                Padrão sugerido: Número/Ano/Sigla da OM.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleApproveAndNumber} disabled={loading || !suggestedApproveNumber.trim()}>
                            {loading ? "Aguarde..." : "Confirmar Aprovação"}
                        </Button>
                        <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                            Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 8. Consolidation Dialog (Selection) */}
            <PTrabConsolidationDialog
                open={showConsolidationDialog}
                onOpenChange={setShowConsolidationDialog}
                pTrabsList={pTrabsList}
                existingPTrabNumbers={existingPTrabNumbers}
                onConfirm={handleOpenConsolidationNumberDialog}
                loading={loading}
            />
            
            {/* 9. Consolidation Number Dialog */}
            <ConsolidationNumberDialog
                open={showConsolidationNumberDialog}
                onOpenChange={setShowConsolidationNumberDialog}
                suggestedNumber={suggestedConsolidationNumber}
                existingNumbers={existingPTrabNumbers}
                selectedPTrabs={simplePTrabsToConsolidate}
                onConfirm={handleConfirmConsolidation}
                loading={loading}
            />
            
            {/* 10. Share Dialog */}
            {ptrabToShare && (
                <ShareDialog
                    open={showShareDialog}
                    onOpenChange={setShowShareDialog}
                    ptrab={ptrabToShare}
                />
            )}
            
            {/* 11. Share Request Dialog */}
            <ShareRequestDialog
                open={showShareRequestDialog}
                onOpenChange={setShowShareRequestDialog}
                onConfirm={handleProcessShareLink}
                loading={loading}
            />
            
            {/* 12. Share Requests Management Dialog */}
            {ptrabToManageRequests && (
                <ShareRequestsDialog
                    open={showShareRequestsDialog}
                    onOpenChange={setShowShareRequestsDialog}
                    ptrabId={ptrabToManageRequests}
                    onUpdate={onUpdate}
                />
            )}
        </>
    );
};

export default PTrabModals;