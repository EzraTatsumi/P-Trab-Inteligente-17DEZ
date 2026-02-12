import React, { useRef, useEffect } from 'react';
import { DetailedArpItem } from '@/types/pncp';
import { formatCodug, formatCurrency, formatDate, formatPregao, capitalizeFirstLetter } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ArpCatmatSearchResultsListProps {
    results: DetailedArpItem[]; 
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    searchedCatmat: string;
    selectedItemIds: string[];
    mode?: 'material' | 'servico'; // NOVO
}

const ArpCatmatSearchResultsList: React.FC<ArpCatmatSearchResultsListProps> = ({ results, onItemPreSelect, searchedCatmat, selectedItemIds, mode = 'material' }) => {
    const resultHeaderRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (results.length > 0 && resultHeaderRef.current) {
            setTimeout(() => { resultHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
        }
    }, [results]);

    const catalogLabel = mode === 'material' ? 'CATMAT' : 'CATSER';

    return (
        <div className="p-4 space-y-4">
            <div ref={resultHeaderRef}>
                <h3 className="text-lg font-semibold flex flex-col">
                    <span>Resultado para {catalogLabel} {searchedCatmat}</span>
                    <span className="text-sm font-normal text-muted-foreground mt-1">{results.length} itens encontrados em diferentes ARPs</span>
                </h3>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <th className="px-4 py-2 text-left font-normal w-[10%]">ARP</th>
                            <th className="px-4 py-2 text-left font-normal w-[15%]">UASG</th>
                            <th className="px-4 py-2 text-left font-normal w-[40%]">Descrição Item</th>
                            <th className="px-4 py-2 text-center font-normal w-[15%]">Vigência</th>
                            <th className="px-4 py-2 text-right font-normal w-[20%]">Valor Unitário</th>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {results.map(item => {
                            const isSelected = selectedItemIds.includes(item.id);
                            return (
                                <TableRow key={item.id} className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`} onClick={() => onItemPreSelect(item, item.pregaoFormatado, item.uasg)}>
                                    <TableCell className="text-xs font-medium py-2">{item.numeroAta}</TableCell>
                                    <TableCell className="text-xs py-2">
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{formatCodug(item.uasg)}</span>
                                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{item.omNome}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[0.7rem] max-w-lg whitespace-normal py-2">
                                        {capitalizeFirstLetter(item.descricaoItem)}
                                        <p className="text-[10px] text-muted-foreground mt-1">Pregão: {formatPregao(item.pregaoFormatado)}</p>
                                    </TableCell>
                                    <TableCell className="text-center text-[10px] py-2">{formatDate(item.dataVigenciaInicial)} - {formatDate(item.dataVigenciaFinal)}</TableCell>
                                    <TableCell className="text-right text-xs font-bold text-primary py-2">{formatCurrency(item.valorUnitario)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default ArpCatmatSearchResultsList;