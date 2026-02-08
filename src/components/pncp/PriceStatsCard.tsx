import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceStats } from '@/types/pncp';
import { formatCurrency } from '@/lib/formatUtils';
import { TrendingUp, TrendingDown, Scale, BarChart } from 'lucide-react';

interface PriceStatsCardProps {
    stats: PriceStats | null;
    totalRegistros: number;
    isLoading: boolean;
}

const PriceStatsCard: React.FC<PriceStatsCardProps> = ({ stats, totalRegistros, isLoading }) => {
    
    if (isLoading) {
        return (
            <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Calculando estatísticas...</p>
            </Card>
        );
    }

    if (!stats || totalRegistros === 0) {
        return (
            <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma estatística disponível.</p>
            </Card>
        );
    }

    const data = [
        { icon: <Scale className="h-4 w-4 text-blue-500" />, label: 'Preço Médio', value: stats.avgPrice },
        { icon: <BarChart className="h-4 w-4 text-purple-500" />, label: 'Mediana', value: stats.medianPrice },
        { icon: <TrendingDown className="h-4 w-4 text-green-500" />, label: 'Mínimo', value: stats.minPrice },
        { icon: <TrendingUp className="h-4 w-4 text-red-500" />, label: 'Máximo', value: stats.maxPrice },
    ];

    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-semibold">
                    Estatísticas de Preço ({totalRegistros} registros)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {item.icon}
                                <span>{item.label}</span>
                            </div>
                            <span className="font-bold text-sm text-foreground">
                                {formatCurrency(item.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default PriceStatsCard;