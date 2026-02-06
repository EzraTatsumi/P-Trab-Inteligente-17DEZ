import React from 'react';
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import ArpUasgSearchForm from './ArpUasgSearchForm';

interface ArpUasgSearchProps {
    onSelect: (item: ItemAquisicao) => void;
}

// Este componente atua como um wrapper simples para o formulário
const ArpUasgSearch: React.FC<ArpUasgSearchProps> = ({ onSelect }) => {
    return <ArpUasgSearchForm onSelect={onSelect} />;
};

export default ArpUasgSearch;