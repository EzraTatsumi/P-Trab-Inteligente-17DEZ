"use client";

import React from 'react';
import ArpCatmatSearchForm from './ArpCatmatSearchForm';
import { DetailedArpItem } from '@/types/pncp';

interface ArpCatmatSearchProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    mode?: 'material' | 'servico';
}

const ArpCatmatSearch: React.FC<ArpCatmatSearchProps> = ({ 
    onItemPreSelect, 
    selectedItemIds, 
    onClearSelection, 
    scrollContainerRef,
    mode = 'material'
}) => {
    return (
        <div className="space-y-4">
            <ArpCatmatSearchForm 
                onItemPreSelect={onItemPreSelect}
                selectedItemIds={selectedItemIds}
                onClearSelection={onClearSelection}
                scrollContainerRef={scrollContainerRef}
                mode={mode}
            />
        </div>
    );
};

export default ArpCatmatSearch;