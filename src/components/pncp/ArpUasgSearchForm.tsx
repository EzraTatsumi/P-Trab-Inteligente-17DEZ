import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { fetchArpsByUasg } from '@/integrations/supabase/api';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp';
import ArpSearchResultsList from './ArpSearchResultsList';
import OmSelectorDialog from '@/components/OmSelectorDialog';

interface ArpUasgSearchFormProps {
    onItemPreSelect: (item: DetailedArpItem, pregao: string, uasg: string) => void;
    onClearSelection: () => void;
    selectedItemIds: string[];
    mode: 'material' | 'servico';
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ onItemPreSelect, onClearSelection, selectedItemIds, mode }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isOmOpen, setIsOmOpen] = useState(false);
    const [results, setResults] = useState<ArpItemResult[]>([]);

    const form = useForm({
        defaultValues: { uasg: "", dataInicio: "", dataFim: "" }
    });

    const onSubmit = async (values: any) => {
        setIsSearching(true);
        onClearSelection();
        try {
            const data = await fetchArpsByUasg({
                codigoUnidadeGerenciadora: values.uasg,
                dataVigenciaInicialMin: values.dataInicio,
                dataVigenciaInicialMax: values.dataFim,
            });
            setResults(data);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                    <FormField
                        control={form.control}
                        name="uasg"
                        render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel>UASG do Órgão</FormLabel>
                                <div className="flex gap-2">
                                    <FormControl><Input {...field} maxLength={6} /></FormControl>
                                    <Button type="button" variant="outline" onClick={() => setIsOmOpen(true)}><BookOpen className="h-4 w-4" /></Button>
                                </div>
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="md:mt-8" disabled={isSearching}>
                        {isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4 mr-2" />}
                        Buscar ARPs
                    </Button>
                </form>
            </Form>

            {results.length > 0 && (
                <ArpSearchResultsList 
                    results={results} 
                    onItemPreSelect={onItemPreSelect} 
                    selectedItemIds={selectedItemIds}
                    searchedUasg={form.getValues('uasg')}
                    searchedOmName=""
                />
            )}

            <OmSelectorDialog open={isOmOpen} onOpenChange={setIsOmOpen} onSelect={om => form.setValue('uasg', om.codug_om)} />
        </div>
    );
};

export default ArpUasgSearchForm;