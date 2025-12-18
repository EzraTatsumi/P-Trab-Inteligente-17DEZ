import React from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, ArrowRight, Link, Bell, Settings, LogOut, User, Download, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "sonner";
import { HelpDialog } from "./HelpDialog"; // Importar HelpDialog

interface PTrabHeaderActionsProps {
    loading: boolean;
    userName: string;
    user: SupabaseUser | null;
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    resetForm: () => void;
    isConsolidationDisabled: boolean;
    getConsolidationDisabledMessage: () => string;
    setShowConsolidationDialog: (show: boolean) => void;
    handleOpenShareRequestDialog: () => void;
    totalPendingRequests: number;
    settingsDropdownOpen: boolean;
    setSettingsDropdownOpen: (open: boolean) => void;
    handleLogout: () => void;
}

const PTrabHeaderActions = ({
    loading,
    userName,
    user,
    dialogOpen,
    setDialogOpen,
    resetForm,
    isConsolidationDisabled,
    getConsolidationDisabledMessage,
    setShowConsolidationDialog,
    handleOpenShareRequestDialog,
    totalPendingRequests,
    settingsDropdownOpen,
    setSettingsDropdownOpen,
    handleLogout,
}: PTrabHeaderActionsProps) => {
    const navigate = useNavigate();
    const consolidationTooltipText = "Selecione múltiplos P Trabs para consolidar seus custos em um novo P Trab.";

    return (
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Planos de Trabalho</h1>
                    <p className="text-muted-foreground">Gerencie seu P Trab</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                
                <div className="flex items-center gap-2 px-4 h-10 rounded-md bg-muted/50 border border-border">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                        {userName || (user ? 'Perfil Incompleto' : 'Carregando...')}
                    </span>
                </div>
                
                <Button 
                    onClick={() => { 
                        resetForm(); 
                        setDialogOpen(true); 
                        window.scrollTo({ top: 0, behavior: 'smooth' }); 
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Novo P Trab
                </Button>
                
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-block">
                                <Button 
                                    onClick={() => {
                                        if (!isConsolidationDisabled) {
                                            setShowConsolidationDialog(true);
                                        } else {
                                            toast.info(getConsolidationDisabledMessage());
                                        }
                                    }} 
                                    variant="secondary"
                                    disabled={isConsolidationDisabled}
                                    style={isConsolidationDisabled ? { pointerEvents: 'auto' } : {}} 
                                >
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Consolidar P Trab
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isConsolidationDisabled ? (
                                <p className="text-xs text-orange-400 max-w-xs">
                                    {getConsolidationDisabledMessage()}
                                </p>
                            ) : (
                                <p>{consolidationTooltipText}</p>
                            )}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                
                <Button 
                    onClick={handleOpenShareRequestDialog} 
                    variant="outline"
                    className="flex items-center gap-2"
                >
                    <Link className="h-4 w-4" />
                    Vincular P Trab
                </Button>
                
                {totalPendingRequests > 0 && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    onClick={() => {
                                        // A lógica de abertura do diálogo de solicitações será tratada no PTrabManager
                                        toast.info(`Você tem ${totalPendingRequests} solicitações de acesso pendentes.`);
                                    }} 
                                    variant="destructive"
                                    size="icon"
                                    className="relative"
                                >
                                    <Bell className="h-5 w-5" />
                                    <Badge 
                                        variant="default" 
                                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-700 text-white"
                                    >
                                        {totalPendingRequests}
                                    </Badge>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{totalPendingRequests} solicitações de acesso pendentes.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                <HelpDialog />

                <DropdownMenu open={settingsDropdownOpen} onOpenChange={setSettingsDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                        align="end" 
                        className="w-56"
                        onPointerLeave={() => setSettingsDropdownOpen(false)}
                    >
                        <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem onClick={() => navigate("/config/profile")}>
                            Perfil do Usuário
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={() => navigate("/config/diretrizes")}>
                            Diretriz de Custeio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/config/visualizacao")}>
                            Opção de Visualização
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/config/om")}>
                            Relação de OM (CODUG)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate("/config/ptrab-export-import")}>
                            <Download className="mr-2 h-4 w-4" />
                            Exportar/Importar P Trab
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button onClick={handleLogout} variant="outline">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                </Button>
            </div>
        </div>
    );
};

export default PTrabHeaderActions;