import React from 'react';
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import ArpUasgSearchForm from './ArpUasgSearchForm';
import { DetailedArpItem } from '@/types/pncp';

interface ArpUasgSearchProps {
    // Alterado para onItemPreSelect
    onItemPreSelect: (item: DetailedArpItem | null, pregaoFormatado: string, uasg: string) => void;
    selectedItemId: string | null;
}

// Este componente atua como um wrapper simples para o formulário
const ArpUasgSearch: React.FC<ArpUasgSearchProps> = ({ onItemPreSelect, selectedItemId }) => {
    return <ArpUasgSearchForm onItemPreSelect={onItemPreSelect} selectedItemId={selectedItemId} />;
};

export default ArpUasgSearch;