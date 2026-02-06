import React, { useState, useMemo } from 'react';
import { ArpRawResult } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { formatCodug, formatCurrency, formatDate } from '@/lib/formatUtils';
import { Card, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Import, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Tipo para o grupo de ARPs (agrupado por Pregão)
interface ArpGroup {
    pregao: string;
    uasg: string;
    omNome: string;
    itens: ArpRawResult[];
    totalValor: number;
}

interface ArpSearchResultsListProps {
    results: ArpRawResult[];
    onSelect: (item: ItemAquisicao) => void;
}

const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ results, onSelect }) => {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const [selectedArp, setSelectedArp] = useState<ArpRawResult | null>(null);

    // 1. Lógica de Agrupamento
    const groupedArps = useMemo(() => {
        const groupsMap = new Map<string, ArpGroup>();

        results.forEach(arp => {
            // 1. Sanitização e Fallback para campos chave
            const numeroCompraStr = String(arp.numeroCompra || '').trim();
            const anoCompraStr = String(arp.anoCompra || '').trim();
            const uasgStr = String(arp.codigoUnidadeGerenciadora || '').replace(/\D/g, '');
            
            // Se faltar o número da compra ou o ano, usamos um fallback para agrupar
            let pregaoKey: string;
            if (numeroCompraStr && anoCompraStr) {
                const numeroCompraFormatado = formatCodug(numeroCompraStr);
                const anoCompraDoisDigitos = anoCompraStr.slice(-2);
                pregaoKey = `${numeroCompraFormatado}/${anoCompraDoisDigitos}`;
            } else {
                // Agrupa registros incompletos em uma chave única
                pregaoKey = 'DADOS_INCOMPLETOS';
            }
            
            // 2. Criação ou atualização do grupo
            if (!groupsMap.has(pregaoKey)) {
                groupsMap.set(pregaoKey, {
                    pregao: pregaoKey,
                    uasg: uasgStr,
                    omNome: arp.nomeUnidadeGerenciadora || 'OM Desconhecida',
                    itens: [],
                    totalValor: 0,
                });
            }

            const group = groupsMap.get(pregaoKey)!;
            group.itens.push(arp);
            group.totalValor += arp.valorTotal;
        });

        // Converte o mapa de volta para um array e ordena por Pregão
        return Array.from(groupsMap.values()).sort((a, b) => a.pregao.localeCompare(b.pregao));
    }, [results]);
    
    const handleToggleGroup = (pregaoKey: string) => {
        setOpenGroups(prev => ({
            ...prev,
            [pregaoKey]: !prev[pregaoKey],
        }));
    };
    
    const handlePreSelect = (arp: ArpRawResult) => {
        setSelectedArp(arp.idCompra === selectedArp?.idCompra ? null : arp);
    };
    
    const handleConfirmImport = () => {
        if (!selectedArp) {
            toast.error("Selecione uma ARP para importar.");
            return;
        }
        
        // Garantir que os campos necessários para ItemAquisicao não sejam nulos
        const numeroCompraStr = String(selectedArp.numeroCompra || '').trim();
        const anoCompraStr = String(selectedArp.anoCompra || '').trim();
        const uasgStr = String(selectedArp.codigoUnidadeGerenciadora || '').replace(/\D/g, '');
        
        if (!numeroCompraStr || !anoCompraStr || !uasgStr) {
            toast.error("Dados da ARP incompletos (Número da Compra, Ano ou UASG). Não é possível importar.");
            return;
        }
        
        // Mapeamento do ArpRawResult para ItemAquisicao
        const itemAquisicao: ItemAquisicao = {
            id: selectedArp.idCompra, // Usar ID da Compra como ID temporário
            descricao_item: `ARP ${selectedArp.numeroAtaRegistroPreco || 'N/A'} - ${selectedArp.objeto || 'Objeto não especificado'}`,
            descricao_reduzida: `ARP ${selectedArp.numeroAtaRegistroPreco || 'N/A'}`,
            // Valor médio por item (se quantidadeItens for 0, evita divisão por zero)
            valor_unitario: selectedArp.valorTotal / (selectedArp.quantidadeItens || 1), 
            numero_pregao: `${formatCodug(numeroCompraStr)}/${anoCompraStr.slice(-2)}`,
            uasg: uasgStr,
            codigo_catmat: 'PNCP_REF', // Placeholder
        };
        
        onSelect(itemAquisicao);
    };

    if (results.length === 0) {
        return (
            <Card className="p-4 text-center text-muted-foreground">
                Nenhuma Ata de Registro de Preços encontrada para os critérios informados.
            </Card>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-semibold">Resultados Agrupados por Pregão ({groupedArps.length} Pregões)</h3>
            
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[200px]">Pregão</TableHead>
                            <TableHead>OM Gerenciadora</TableHead>
                            <TableHead className="w-[150px] text-right">Valor Total</TableHead>
                            <TableHead className="w-[100px] text-center">ARPs</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedArps.map(group => {
                            const isGroupOpen = openGroups[group.pregao];
                            
                            // Se a chave for DADOS_INCOMPLETOS, exibe um rótulo de aviso
                            const displayPregao = group.pregao === 'DADOS_INCOMPLETOS' 
                                ? <span className="text-red-500 font-bold">DADOS INCOMPLETOS</span> 
                                : group.pregao;
                                
                            return (
                                <React.Fragment key={group.pregao}>
                                    <TableRow 
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleToggleGroup(group.pregao)}
                                    >
                                        <TableCell className="font-semibold">
                                            <div className="flex items-center gap-2">
                                                {displayPregao}
                                                {isGroupOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {group.omNome} ({formatCodug(group.uasg)})
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-primary">
                                            {formatCurrency(group.totalValor)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {group.itens.length}
                                        </TableCell>
                                    </TableRow>
                                    
                                    {/* Conteúdo Colapsável com a lista de ARPs individuais */}
                                    <TableRow className="p-0">
                                        <TableCell colSpan={4} className="p-0">
                                            <Collapsible open={isGroupOpen}>
                                                <CollapsibleContent>
                                                    <div className="p-4 bg-muted/50 border-t border-border">
                                                        <Table className="bg-background border rounded-md">
                                                            <thead>
                                                                <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                                                    <th className="px-4 py-2 text-left font-normal w-[50%]">Objeto da Ata</th>
                                                                    <th className="px-4 py-2 text-center font-normal w-[15%]">Vigência</th>
                                                                    <th className="px-4 py-2 text-right font-normal w-[15%]">Valor Total</th>
                                                                    <th className="px-4 py-2 text-center font-normal w-[10%]">Ação</th>
                                                                </TableRow>
                                                            </thead>
                                                            <TableBody>
                                                                {group.itens.map(arp => {
                                                                    const isSelected = selectedArp?.idCompra === arp.idCompra;
                                                                    return (
                                                                        <TableRow 
                                                                            key={arp.idCompra}
                                                                            className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                                                            onClick={() => handlePreSelect(arp)}
                                                                        >
                                                                            <TableCell className="text-sm max-w-xs truncate">{arp.objeto || 'N/A'}</TableCell>
                                                                            <TableCell className="text-center text-xs">
                                                                                {formatDate(arp.dataVigenciaInicial || '')} - {formatDate(arp.dataVigenciaFinal || '')}
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-sm">
                                                                                {formatCurrency(arp.valorTotal)}
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                <Button
                                                                                    variant={isSelected ? "default" : "outline"}
                                                                                    size="sm"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation(); 
                                                                                        handlePreSelect(arp);
                                                                                    }}
                                                                                >
                                                                                    {isSelected ? <Check className="h-4 w-4" /> : <Import className="h-4 w-4" />}
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            
            <div className="flex justify-end pt-2">
                <Button 
                    onClick={handleConfirmImport} 
                    disabled={!selectedArp}
                >
                    <Import className="h-4 w-4 mr-2" />
                    Importar ARP Selecionada
                </Button>
            </div>
        </div>
    );
};

export default ArpSearchResultsList;