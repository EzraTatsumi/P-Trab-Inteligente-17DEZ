"use client";

import React from 'react';
import { Frown } from 'lucide-react';
import { formatCurrency } from './formatUtils';

/**
 * Interface para os itens de saúde ou remonta
 */
interface ItemRegistro {
  descricao?: string;
  item?: string;
  quantidade?: number;
  valor_unitario?: number;
  [key: string]: any;
}

/**
 * Gera a memória de cálculo textual para uma categoria da Classe VIII.
 */
export function generateCategoryMemoriaCalculo(category: string, items: any[], totalValue: number): string {
    if (!items || items.length === 0) {
        return `Nenhum item registrado para a categoria ${category}.`;
    }

    let memoria = `Detalhamento dos custos para ${category}:\n\n`;
    
    items.forEach((item, index) => {
        const desc = item.item || item.descricao || item.nome_equipamento || 'Item não especificado';
        const qtd = item.quantidade || 1;
        const vlr = item.valor_unitario || 0;
        const total = qtd * vlr;
        
        memoria += `${index + 1}. ${desc}: ${qtd} un x ${formatCurrency(vlr)} = ${formatCurrency(total)}\n`;
    });

    memoria += `\nValor Total da Categoria: ${formatCurrency(totalValue)}`;
    return memoria;
}

/**
 * Componente para exibição quando não há dados no relatório.
 */
interface NoDataFallbackProps {
    reportName: string;
    message?: string;
}

export const NoDataFallback: React.FC<NoDataFallbackProps> = ({ reportName, message }) => (
    <div className="text-center py-16 border border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
        <Frown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground">{reportName}</h3>
        <p className="text-muted-foreground max-w-xs mx-auto mt-2">
            {message || "Não foram encontrados registros para este anexo no Plano de Trabalho selecionado."}
        </p>
    </div>
);

/**
 * Helper para normalizar itens de saúde (KPSI/KPT)
 */
export function normalizeSaudeItems(rawItems: any): ItemRegistro[] {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    return [];
}

/**
 * Helper para normalizar itens de remonta
 */
export function normalizeRemontaItems(rawItems: any): ItemRegistro[] {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    return [];
}