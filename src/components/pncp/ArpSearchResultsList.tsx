import React, { useState, useMemo } from 'react';
import { ArpItemResult } from '@/types/pncp'; // CORRIGIDO: Usando ArpItemResult
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
    itens: ArpItemResult[]; // CORRIGIDO: Usando ArpItemResult
    // Dados representativos do grupo (do primeiro item)
    objetoRepresentativo: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
}

interface ArpSearchResultsListProps {
    results: ArpItemResult[]; // CORRIGIDO: Usando ArpItemResult
    onSelect: (item: ItemAquisicao) => void;
    // NOVAS PROPS para o cabeçalho
    searchedUasg: string;
    searchedOmName: string;
}

const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ results, onSelect, searchedUasg, searchedOmName }) => {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const [selectedArp, setSelectedArp] = useState<ArpItemResult | null>(null); // CORRIGIDO: Usando ArpItemResult

    // 1. Lógica de Agrupamento
    const groupedArps = useMemo(() => {
        const groupsMap = new Map<string, ArpGroup>();

        results.forEach(arp => {
            // A chave de agrupamento é o pregaoFormatado, que já foi calculado no API.ts
            const pregaoKey = arp.pregaoFormatado;
            
            // 2. Criação ou atualização do grupo
            if (!groupsMap.has(pregaoKey)) {
                groupsMap.set(pregaoKey, {
                    pregao: pregaoKey,
                    uasg: arp.uasg,
                    omNome: arp.omNome,
                    itens: [],
                    // Captura os dados representativos do primeiro item
                    objetoRepresentativo: arp.objeto || 'Objeto não especificado',
                    dataVigenciaInicial: arp.dataVigenciaInicial || '',
                    dataVigenciaFinal: arp.dataVigenciaFinal || '',
                });
            }

            const group = groupsMap.get(pregaoKey)!;
            group.itens.push(arp);
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
    
    // Mantemos a pré-seleção, mas o botão de importação será o único ponto de ação
    const handlePreSelect = (arp: ArpItemResult) => {
        // Usamos o ID da Compra (id) para rastrear a seleção
        setSelectedArp(arp.id === selectedArp?.id ? null : arp);
    };
    
    const handleConfirmImport = () => {
        if (!selectedArp) {
            toast.error("Selecione uma ARP para importar.");
            return;
        }
        
        // Garantir que os campos necessários para ItemAquisicao não sejam nulos
        if (!selectedArp.pregaoFormatado || !selectedArp.uasg) {
            toast.error("Dados da ARP incompletos (Pregão ou UASG). Não é possível importar.");
            return;
        }
        
        // Mapeamento do ArpItemResult para ItemAquisicao
        const itemAquisicao: ItemAquisicao = {
            id: selectedArp.id, // Usar ID da Compra como ID temporário
            descricao_item: `ARP ${selectedArp.numeroAta || 'N/A'} - ${selectedArp.objeto || 'Objeto não especificado'}`,
            descricao_reduzida: `ARP ${selectedArp.numeroAta || 'N/A'}`,
            // Valor unitário é o valor total estimado dividido pela quantidade de itens
            valor_unitario: selectedArp.valorTotalEstimado / (selectedArp.quantidadeItens || 1), 
            numero_pregao: selectedArp.pregaoFormatado,
            uasg: selectedArp.uasg,
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
    
    // Lógica de exibição do nome da OM no cabeçalho:
    // 1. Tenta usar o nome da OM do primeiro resultado (que veio da API)
    const omNameFromApi = groupedArps.length > 0 ? groupedArps[0].omNome : searchedOmName;
    
    // 2. Define o nome a ser exibido:
    // Se o nome da API for válido (não vazio e não for o fallback genérico 'UASG XXX.XXX'), usa ele.
    // Caso contrário, usa o nome pesquisado (que pode ser o nome do catálogo ou 'UASG XXX.XXX').
    const omNameDisplay = (omNameFromApi && !omNameFromApi.startsWith('UASG ')) 
        ? omNameFromApi 
        : searchedOmName;
    
    const omUasg = searchedUasg;

    return (
        <div className="p-4 space-y-4">
            {/* CABEÇALHO DA PESQUISA - CORRIGIDO CONFORME SOLICITADO */}
            <h3 className="text-lg font-semibold">
                Resultado para {omNameDisplay} ({formatCodug(omUasg)})
                <span className="text-sm font-normal text-muted-foreground ml-2">
                    - {groupedArps.length} Pregões encontrados
                </span>
            </h3>
            
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[150px]">Pregão</TableHead>
                            <TableHead>Objeto</TableHead>
                            <TableHead className="w-[200px] text-center">Vigência (Início - Fim)</TableHead>
                            <TableHead className="w-[50px]"></TableHead> {/* Coluna para o ícone de expansão */}
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
                                            {displayPregao}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-xs truncate">
                                            {group.objetoRepresentativo}
                                        </TableCell>
                                        <TableCell className="text-center text-sm">
                                            {formatDate(group.dataVigenciaInicial)} - {formatDate(group.dataVigenciaFinal)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {isGroupOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                        </TableCell>
                                    </TableRow>
                                    
                                    {/* Conteúdo Colapsável com a lista de ARPs individuais (Nível 2) */}
                                    <TableRow className="p-0">
                                        <TableCell colSpan={4} className="p-0">
                                            <Collapsible open={isGroupOpen}>
                                                <CollapsibleContent>
                                                    <div className="p-4 bg-muted/50 border-t border-border">
                                                        <Table className="bg-background border rounded-md">
                                                            <thead>
                                                                <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                                                    <th className="px-4 py-2 text-left font-normal w-[70%]">Número da ARP</th>
                                                                    <th className="px-4 py-2 text-center font-normal w-[30%]">Qtd. Itens</th>
                                                                    {/* Removidas colunas Valor Total e Ação */}
                                                                </TableRow>
                                                            </thead>
                                                            <TableBody>
                                                                {group.itens.map(arp => {
                                                                    const isSelected = selectedArp?.id === arp.id;
                                                                    return (
                                                                        <TableRow 
                                                                            key={arp.id}
                                                                            className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                                                            onClick={() => handlePreSelect(arp)}
                                                                        >
                                                                            <TableCell className="text-sm font-medium">
                                                                                {arp.numeroAta || 'N/A'}
                                                                            </TableCell>
                                                                            <TableCell className="text-center text-sm">
                                                                                {arp.quantidadeItens || 0}
                                                                            </TableCell>
                                                                            {/* Removidas células Valor Total e Ação */}
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