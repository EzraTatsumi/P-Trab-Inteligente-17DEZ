import React from 'react';
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MoreVertical, FileText, Printer, Pencil, Copy, Archive, RefreshCw, Trash2, MessageSquare, CheckCircle, GitBranch, Users, Loader2, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatUtils";
import { PTrab, PTrabDB, statusConfig, formatDateTime, getOriginBadge, cleanOperationName, getShareStatusBadge, needsNumbering, isFinalStatus } from "@/pages/PTrabManager";

// Helper function to calculate days (kept local for simplicity, but relies on PTrabManager logic)
const calculateDays = (inicio: string, fim: string) => {
    const start = new Date(inicio);
    const end = new Date(fim);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
};

interface PTrabTableProps {
    pTrabs: PTrab[];
    user: SupabaseUser | null;
    loading: boolean;
    handleSelectPTrab: (ptrab: PTrab) => void;
    handleOpenComentario: (ptrab: PTrab) => void;
    handleOpenApproveDialog: (ptrab: PTrab) => void;
    handleNavigateToPrintOrExport: (ptrabId: string) => void;
    handleEdit: (ptrab: PTrab) => void;
    handleOpenCloneOptions: (ptrab: PTrab) => void;
    handleArchive: (ptrabId: string, ptrabName: string) => void;
    handleUnshare: (ptrabId: string, ptrabName: string) => void;
    handleDelete: (ptrabId: string) => void;
    setShowReactivateStatusDialog: (show: boolean) => void;
    setPtrabToReactivateId: (id: string | null) => void;
    setPtrabToReactivateName: (name: string | null) => void;
    handleOpenShareDialog: (ptrab: PTrab) => void;
    handleOpenShareRequestsDialog: (ptrabId: string) => void;
}

const PTrabTable = ({
    pTrabs,
    user,
    loading,
    handleSelectPTrab,
    handleOpenComentario,
    handleOpenApproveDialog,
    handleNavigateToPrintOrExport,
    handleEdit,
    handleOpenCloneOptions,
    handleArchive,
    handleUnshare,
    handleDelete,
    setShowReactivateStatusDialog,
    setPtrabToReactivateId,
    setPtrabToReactivateName,
    handleOpenShareDialog,
    handleOpenShareRequestsDialog,
}: PTrabTableProps) => {
    if (loading) {
        return (
            <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2 mx-auto" />
                <h3 className="text-lg font-semibold text-foreground">Carregando P Trabs...</h3>
                <p className="text-sm text-muted-foreground mt-1">Calculando totais de classes.</p>
            </div>
        );
    }

    if (pTrabs.length === 0) {
        return (
            <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">Nenhum Plano de Trabalho Registrado</h3>
                <p className="text-muted-foreground mt-2">
                    Clique em "Novo P Trab" para começar a configurar seu primeiro Plano de Trabalho.
                </p>
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="text-center border-b border-border">Número</TableHead>
                    <TableHead className="text-center border-b border-border">Operação</TableHead>
                    <TableHead className="text-center border-b border-border">Período</TableHead>
                    <TableHead className="text-center border-b border-border">Status</TableHead>
                    <TableHead className="text-center border-b border-border">Valor P Trab</TableHead>
                    <TableHead className="text-center border-b border-border w-[50px]"></TableHead>
                    <TableHead className="text-center border-b border-border">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pTrabs.map((ptrab) => {
                    const isOwner = ptrab.user_id === user?.id;
                    const originBadge = getOriginBadge(ptrab.origem);
                    const shareStatusBadge = getShareStatusBadge(ptrab, user?.id);
                    const isMinuta = ptrab.numero_ptrab.startsWith("Minuta");
                    const isEditable = (ptrab.status !== 'aprovado' && ptrab.status !== 'arquivado') && (isOwner || ptrab.isShared);
                    const isApprovedOrArchived = isFinalStatus(ptrab);
                    
                    const totalGeral = (ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0) + (ptrab.totalMaterialPermanente || 0);
                    const displayOperationName = cleanOperationName(ptrab.nome_operacao, ptrab.origem);
                    
                    return (
                        <TableRow key={ptrab.id}>
                            <TableCell className="font-medium">
                                <div className="flex flex-col items-center">
                                    {ptrab.status === 'arquivado' && isMinuta ? (
                                        <span className="text-gray-500 font-bold">MINUTA</span>
                                    ) : ptrab.status === 'aprovado' || ptrab.status === 'arquivado' ? (
                                        <span>{ptrab.numero_ptrab}</span>
                                    ) : (
                                        <span className="text-red-500 font-bold">
                                            {isMinuta ? "MINUTA" : "PENDENTE"}
                                        </span>
                                    )}
                                    <Badge 
                                        variant="outline" 
                                        className={`mt-1 text-xs font-semibold ${originBadge.className}`}
                                    >
                                        {originBadge.label}
                                    </Badge>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col items-start">
                                    <span>{displayOperationName}</span>
                                    {ptrab.rotulo_versao && (
                                        <Badge variant="secondary" className="mt-1 text-xs bg-secondary text-secondary-foreground">
                                            <GitBranch className="h-3 w-3 mr-1" />
                                            {ptrab.rotulo_versao}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                    <span className="block">
                                        {new Date(ptrab.periodo_inicio).toLocaleDateString('pt-BR')}
                                    </span>
                                    <span className="block font-bold text-sm">-</span>
                                    <span className="block">
                                        {new Date(ptrab.periodo_fim).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {calculateDays(ptrab.periodo_inicio, ptrab.periodo_fim)} dias
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col items-center">
                                    <Badge 
                                        className={cn(
                                            "w-[140px] h-7 text-xs flex items-center justify-center",
                                            statusConfig[ptrab.status as keyof typeof statusConfig]?.className || 'bg-background'
                                        )}
                                    >
                                        {statusConfig[ptrab.status as keyof typeof statusConfig]?.label || ptrab.status}
                                    </Badge>
                                    {shareStatusBadge && (
                                        <Badge 
                                            variant="outline" 
                                            className={cn(
                                                "mt-1 text-xs font-semibold w-[140px] h-7 flex items-center justify-center cursor-pointer",
                                                shareStatusBadge.className
                                            )}
                                            onClick={() => {
                                                if (isOwner) {
                                                    handleOpenShareRequestsDialog(ptrab.id);
                                                }
                                            }}
                                        >
                                            <Users className="h-3 w-3 mr-1" />
                                            {shareStatusBadge.label}
                                            {isOwner && ptrab.pendingRequestsCount > 0 && (
                                                <span className="ml-2 bg-red-500 text-white rounded-full px-2 text-[10px]">
                                                    {ptrab.pendingRequestsCount}
                                                </span>
                                            )}
                                        </Badge>
                                    )}
                                    <div className="text-xs text-muted-foreground mt-1 flex flex-col items-center">
                                        <span className="block">Última alteração:</span>
                                        <span className="block">{formatDateTime(ptrab.updated_at)}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-left w-[200px]">
                                <div className="flex flex-col text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Log:</span>
                                        <span className="text-orange-600 font-medium">
                                            {formatCurrency(ptrab.totalLogistica || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Op:</span>
                                        <span className="text-blue-600 font-medium">
                                            {formatCurrency(ptrab.totalOperacional || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Mat Perm:</span>
                                        <span className="text-green-600 font-medium">
                                            {formatCurrency(ptrab.totalMaterialPermanente || 0)}
                                        </span>
                                    </div>
                                    <>
                                        <div className="w-full h-px bg-muted-foreground/30 my-1" />
                                        <div className="flex justify-between font-bold text-sm text-foreground">
                                            <span>Total:</span>
                                            <span>{formatCurrency(totalGeral)}</span>
                                        </div>
                                    </>
                                    <div className="w-full h-px bg-muted-foreground/30 my-1" />
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Rç Op:</span>
                                        <span className="font-medium">
                                            {`${ptrab.quantidadeRacaoOp || 0} Unid.`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">HV:</span>
                                        <span className="font-medium">
                                            {`${ptrab.quantidadeHorasVoo || 0} h`}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-center">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleOpenComentario(ptrab)}
                                            >
                                                <MessageSquare 
                                                    className={`h-5 w-5 transition-all ${
                                                        ptrab.comentario && ptrab.status !== 'arquivado'
                                                            ? "text-green-600 fill-green-600" 
                                                            : "text-gray-300"
                                                    }`}
                                                />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{ptrab.comentario && ptrab.status !== 'arquivado' ? "Editar comentário" : "Adicionar comentário"}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    
                                    {(needsNumbering(ptrab) || isApprovedOrArchived) && isOwner && (
                                        <Button
                                            onClick={() => handleOpenApproveDialog(ptrab)}
                                            size="sm"
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                            disabled={loading || isApprovedOrArchived}
                                        >
                                            <CheckCircle className="h-4 w-4" />
                                            Aprovar
                                        </Button>
                                    )}

                                    <Button
                                        onClick={() => handleSelectPTrab(ptrab)}
                                        size="sm"
                                        className="flex items-center gap-2"
                                        disabled={!isEditable}
                                    >
                                        <FileText className="h-4 w-4" />
                                        Preencher
                                    </Button>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            
                                            {isOwner ? (
                                                <DropdownMenuItem 
                                                    onClick={() => handleOpenShareDialog(ptrab)}
                                                    disabled={ptrab.status === 'arquivado'}
                                                >
                                                    <Link className="mr-2 h-4 w-4" />
                                                    Compartilhar
                                                </DropdownMenuItem>
                                            ) : ptrab.isShared ? (
                                                <DropdownMenuItem 
                                                    onClick={() => handleUnshare(ptrab.id, `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`)}
                                                    className="text-destructive"
                                                >
                                                    <Users className="mr-2 h-4 w-4" />
                                                    Desvincular
                                                </DropdownMenuItem>
                                            ) : null}
                                            
                                            {isOwner && <DropdownMenuSeparator />}
                                            
                                            <DropdownMenuItem 
                                                onClick={() => handleNavigateToPrintOrExport(ptrab.id)}
                                            >
                                                <Printer className="mr-2 h-4 w-4" />
                                                Visualizar Impressão
                                            </DropdownMenuItem>
                                            
                                            <DropdownMenuItem 
                                                onClick={() => isEditable && handleEdit(ptrab)}
                                                disabled={!isEditable}
                                                className={!isEditable ? "opacity-50 cursor-not-allowed" : ""}
                                            >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Editar P Trab
                                            </DropdownMenuItem>
                                            
                                            <DropdownMenuItem 
                                                onClick={() => ptrab.status !== 'arquivado' && handleOpenCloneOptions(ptrab)}
                                                disabled={ptrab.status === 'arquivado'}
                                                className={ptrab.status === 'arquivado' ? "opacity-50 cursor-not-allowed" : ""}
                                            >
                                                <Copy className="mr-2 h-4 w-4" />
                                                Clonar P Trab
                                            </DropdownMenuItem>
                                            
                                            {ptrab.status !== 'arquivado' && isOwner && (
                                                <DropdownMenuItem 
                                                    onClick={() => handleArchive(ptrab.id, `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`)}
                                                >
                                                    <Archive className="mr-2 h-4 w-4" />
                                                    Arquivar
                                                </DropdownMenuItem>
                                            )}
                                            
                                            {ptrab.status === 'arquivado' && isOwner && (
                                                <DropdownMenuItem 
                                                    onClick={() => {
                                                        setPtrabToReactivateId(ptrab.id);
                                                        setPtrabToReactivateName(`${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`);
                                                        setShowReactivateStatusDialog(true);
                                                    }}
                                                >
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                    Reativar
                                                </DropdownMenuItem>
                                            )}
                                            
                                            <DropdownMenuSeparator />
                                            
                                            <DropdownMenuItem 
                                                onClick={() => handleDelete(ptrab.id)}
                                                className={isOwner ? "text-red-600" : "opacity-50 cursor-not-allowed"}
                                                disabled={!isOwner}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
};

export default PTrabTable;