import React from 'react';
import { DetailedArpItem } from '@/types/pncp';
import ArpUasgSearchForm from './ArpUasgSearchForm';

interface ArpUasgSearchProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    mode?: 'material' | 'servico';
}

const ArpUasgSearch: React.FC<ArpUasgSearchProps> = ({
    onItemPreSelect,
    selectedItemIds,
    onClearSelection,
    scrollContainerRef,
    mode = 'material'
}) => {
    return (
        <ArpUasgSearchForm
            onItemPreSelect={onItemPreSelect}
            selectedItemIds={selectedItemIds}
            onClearSelection={onClearSelection}
            scrollContainerRef={scrollContainerRef}
            mode={mode}
        />
    );
};

export default ArpUasgSearch;