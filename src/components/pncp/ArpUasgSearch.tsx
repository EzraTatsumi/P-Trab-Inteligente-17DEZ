import React from 'react';
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import ArpUasgSearchForm from './ArpUasgSearchForm';
import { DetailedArpItem } from '@/types/pncp';

interface ArpUasgSearchProps {
    // MUDANÇA: Função para alternar a seleção de um item detalhado
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    // MUDANÇA: Array de IDs selecionados
    selectedItemIds: string[];
    // NOVO: Função para limpar a seleção
    onClearSelection: () => void;
}

// Este componente atua como um wrapper simples para o formulário
const ArpUasgSearch: React.FC<ArpUasgSearchProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection }) => {
    return (
        <ArpUasgSearchForm 
            onItemPreSelect={onItemPreSelect} 
            selectedItemIds={selectedItemIds} 
            onClearSelection={onClearSelection} 
        />
    );
};

export default ArpUasgSearch;