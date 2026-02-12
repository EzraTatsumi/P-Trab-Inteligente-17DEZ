import React from 'react';
import { DetailedArpItem } from '@/types/pncp';
import ArpCatmatSearchForm from './ArpCatmatSearchForm';

interface ArpCatmatSearchProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    mode?: 'material' | 'servico'; // NOVO
}

const ArpCatmatSearch: React.FC<ArpCatmatSearchProps> = ({ 
    onItemPreSelect, 
    selectedItemIds, 
    onClearSelection, 
    scrollContainerRef,
    mode = 'material'
}) => {
    return (
        <ArpCatmatSearchForm 
            onItemPreSelect={onItemPreSelect} 
            selectedItemIds={selectedItemIds} 
            onClearSelection={onClearSelection} 
            scrollContainerRef={scrollContainerRef}
            mode={mode}
        />
    );
};

export default ArpCatmatSearch;