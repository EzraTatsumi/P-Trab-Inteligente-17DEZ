import React from 'react';
import { ArpItemResult } from '@/types/pncp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/formatUtils';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { toast } from 'sonner';

interface ArpUasgResultsProps {
    results: ArpItemResult[];
    onSelectArp: (arp: ArpItemResult) => void;
}

const ArpUasgResults: React.FC<ArpUasgResultsProps> = ({ results, onSelectArp }) => {
    
    if (results.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Nenhuma Ata de Registro de Preços (ARP) encontrada para os critérios de busca.
            </div>
        );
    }
    
    const handleSelect = (arp: ArpItemResult) => {
        // Esta função apenas avança para a próxima view (detalhes)
        onSelectArp(arp);
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="text-lg">Resultados da Busca ({results.length} ARPs)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[40vh] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[150px]">Nº Ata</TableHead>
                                <TableHead>Objeto</TableHead>
                                <TableHead className="w-[120px] text-center">Vigência Início</TableHead>
                                <TableHead className="w-[120px] text-center">Vigência Fim</TableHead>
                                <TableHead className="w-[150px] text-right">Valor Estimado</TableHead>
                                <TableHead className="w-[100px] text-center">Itens</TableHead>
                                <TableHead className="w-[100px] text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.map((arp) => (
                                <TableRow key={arp.id}>
                                    <TableCell className="font-medium">{arp.numeroAta}</TableCell>
                                    <TableCell className="text-sm">{arp.objeto}</TableCell>
                                    <TableCell className="text-center text-sm">{formatDate(arp.dataVigenciaInicial)}</TableCell>
                                    <TableCell className="text-center text-sm">{formatDate(arp.dataVigenciaFinal)}</TableCell>
                                    <TableCell className="text-right font-bold text-primary">
                                        {formatCurrency(arp.valorTotalEstimado)}
                                    </TableCell>
                                    <TableCell className="text-center text-sm">{arp.quantidadeItens}</TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            onClick={() => handleSelect(arp)}
                                        >
                                            <Info className="h-4 w-4 mr-1" />
                                            Detalhes
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

export default ArpUasgResults;