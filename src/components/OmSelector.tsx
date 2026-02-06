import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tables } from "@/integrations/supabase/types";
import { formatCodug } from '@/lib/formatUtils';

// Tipo de dados da OM (baseado na tabela organizacoes_militares)
export type OMData = Tables<'organizacoes_militares'>;

interface OmSelectorProps {
    selectedOmId?: string;
    initialOmName?: string;
    initialOmCodug?: string; // Novo prop para inicializar pelo CODUG (usado no PNCP)
    onChange: (omData: OMData | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
}

const fetchOms = async (): Promise<OMData[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    // Busca OMs do usuário e OMs padrão (user_id IS NULL)
    const { data, error } = await supabase
        .from('organizacoes_militares')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('ativo', true)
        .order('nome_om', { ascending: true });

    if (error) throw error;
    return data as OMData[];
};

export const OmSelector: React.FC<OmSelectorProps> = ({
    selectedOmId,
    initialOmName,
    initialOmCodug,
    onChange,
    placeholder = "Selecione uma OM...",
    disabled = false,
}) => {
    const { data: oms, isLoading } = useQuery({
        queryKey: ['organizacoesMilitares'],
        queryFn: fetchOms,
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [open, setOpen] = useState(false);
    
    // Estado interno para o valor selecionado (CODUG)
    const [internalCodug, setInternalCodug] = useState<string | undefined>(initialOmCodug);

    // Efeito para sincronizar o valor inicial do CODUG
    useEffect(() => {
        if (initialOmCodug !== internalCodug) {
            setInternalCodug(initialOmCodug);
        }
    }, [initialOmCodug]);

    const filteredOms = (oms || []).filter(om => 
        om.nome_om.toLowerCase().includes(searchTerm.toLowerCase()) ||
        om.codug_om.includes(searchTerm)
    );
    
    const selectedOm = oms?.find(om => om.codug_om === internalCodug);

    const handleSelectChange = (codug: string) => {
        setInternalCodug(codug);
        const om = oms?.find(o => o.codug_om === codug);
        onChange(om);
        setOpen(false);
        setSearchTerm('');
    };
    
    // Se o componente for usado fora do PTrabManager, ele precisa de um fallback para o nome
    const displayValue = selectedOm 
        ? `${selectedOm.nome_om} (${formatCodug(selectedOm.codug_om)})` 
        : (initialOmName || placeholder);

    if (isLoading) {
        return (
            <div className="flex items-center space-x-2 p-2 border rounded-md bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando OMs...</span>
            </div>
        );
    }

    return (
        <Select 
            open={open} 
            onOpenChange={setOpen} 
            value={internalCodug} 
            onValueChange={handleSelectChange}
            disabled={disabled}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder}>
                    {displayValue}
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
                <div className="p-2 sticky top-0 bg-background z-10 border-b">
                    <Input
                        placeholder="Buscar OM ou CODUG..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8"
                        onClick={(e) => e.stopPropagation()} // Previne o fechamento ao clicar no input
                    />
                </div>
                {filteredOms.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                        Nenhuma OM encontrada.
                    </div>
                ) : (
                    filteredOms.map((om) => (
                        <SelectItem key={om.id} value={om.codug_om}>
                            {om.nome_om} ({formatCodug(om.codug_om)}) - {om.rm_vinculacao}
                        </SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
    );
};