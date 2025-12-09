import React from 'react';
import { PTrabSummary } from '@/types/ptrab';
import { formatCurrency } from '@/lib/formatUtils';
import { usePTrabTotalCost } from '@/hooks/usePTrabTotalCost';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, Share2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface PTrabCardProps {
  ptrab: PTrabSummary;
  onEdit: (id: string) => void;
  onShare: (id: string) => void;
  onPrint: (id: string) => void;
}

const getStatusVariant = (status: PTrabSummary['status']) => {
  switch (status) {
    case 'aprovado': return 'default';
    case 'em_andamento': return 'secondary';
    case 'arquivado': return 'outline';
    case 'minuta': return 'destructive';
    case 'aberto':
    default: return 'default';
  }
};

const PTrabCard: React.FC<PTrabCardProps> = ({ ptrab, onEdit, onShare, onPrint }) => {
  const { data: totalLogistica, isLoading: isLoadingCost } = usePTrabTotalCost(ptrab.id);
  const navigate = useNavigate();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(ptrab.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare(ptrab.id);
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPrint(ptrab.id);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onEdit(ptrab.id)}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">
            {ptrab.numero_ptrab || 'P Trab Sem Número'}
          </CardTitle>
          <Badge variant={getStatusVariant(ptrab.status)} className="capitalize">
            {ptrab.status.replace('_', ' ')}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          {ptrab.nome_operacao} ({ptrab.nome_om})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Período:</span>
          <span className="font-medium">
            {new Date(ptrab.periodo_inicio).toLocaleDateString()} - {new Date(ptrab.periodo_fim).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Logística (GND 3):</span>
          {isLoadingCost ? (
            <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
          ) : (
            <span className="text-orange-600 font-medium">
              {formatCurrency(totalLogistica || 0)}
            </span>
          )}
        </div>
        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <FileText className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" /> Compartilhar
          </Button>
          <Button variant="secondary" size="sm" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-1" /> Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PTrabCard;