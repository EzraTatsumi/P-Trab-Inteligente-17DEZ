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
    // NOVO: Ref do container de rolagem
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

// Este componente atua como um wrapper simples para o formulário
const ArpUasgSearch: React.FC<ArpUasgSearchProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection, scrollContainerRef }) => {
    return (
        <ArpUasgSearchForm 
            onItemPreSelect={onItemPreSelect} 
            selectedItemIds={selectedItemIds} 
            onClearSelection={onClearSelection} 
            scrollContainerRef={scrollContainerRef}
        />
    );
};

export default ArpUasgSearch;