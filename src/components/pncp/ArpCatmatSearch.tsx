import React from 'react';
import { DetailedArpItem } from '@/types/pncp';
import ArpCatmatSearchForm from './ArpCatmatSearchForm';

interface ArpCatmatSearchProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ArpCatmatSearch: React.FC<ArpCatmatSearchProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection, scrollContainerRef }) => {
    return (
        <ArpCatmatSearchForm 
            onItemPreSelect={onItemPreSelect} 
            selectedItemIds={selectedItemIds} 
            onClearSelection={onClearSelection} 
            scrollContainerRef={scrollContainerRef}
        />
    );
};

export default ArpCatmatSearch;