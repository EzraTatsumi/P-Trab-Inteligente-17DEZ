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
    // Dados representativos do grupo (do primeiro item)
    objetoRepresentativo: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
}

interface ArpSearchResultsListProps {
    results: ArpRawResult[];
    onSelect: (item: ItemAquisicao) => void;
    // NOVAS PROPS para o cabeçalho
    searchedUasg: string;
    searchedOmName: string;
}

const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ results, onSelect, searchedUasg, searchedOmName }) => {
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
    
    // 1. Tenta usar o nome da OM do primeiro grupo (que veio da API)
    let omNameDisplay = groupedArps.length > 0 ? groupedArps[0].omNome : searchedOmName;
    
    // 2. Se o nome da API for o fallback genérico 'OM Desconhecida', usa o nome pesquisado
    if (omNameDisplay === 'OM Desconhecida') {
        omNameDisplay = searchedOmName;
    }
    
    const omUasg = searchedUasg;

    return (
        <div className="p-4 space-y-4">
            {/* CABEÇALHO DA PESQUISA */}
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
                                                                    const isSelected = selectedArp?.idCompra === arp.idCompra;
                                                                    return (
                                                                        <TableRow 
                                                                            key={arp.idCompra}
                                                                            className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                                                            onClick={() => handlePreSelect(arp)}
                                                                        >
                                                                            <TableCell className="text-sm font-medium">
                                                                                {arp.numeroAtaRegistroPreco || 'N/A'}
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