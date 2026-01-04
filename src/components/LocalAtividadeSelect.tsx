import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { DestinoDiaria } from '@/lib/diariaUtils';
import { DESTINO_OPTIONS } from '@/lib/diariaConstants';

interface LocalAtividadeSelectProps {
    destino: DestinoDiaria;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
}

export const LocalAtividadeSelect: React.FC<LocalAtividadeSelectProps> = ({
    destino,
    value,
    onChange,
    disabled,
}) => {
    const [open, setOpen] = useState(false);

    const currentDestino = useMemo(() => {
        return DESTINO_OPTIONS.find(opt => opt.value === destino);
    }, [destino]);

    const isFreeText = destino === 'demais_dslc';

    if (isFreeText) {
        // Para 'Demais Dslc', usamos um Input simples
        return (
            <Input
                id="local_atividade"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Ex: São Gabriel da Cachoeira/AM"
                required
                disabled={disabled}
            />
        );
    }

    // Para Capitais Especiais e Demais Capitais, usamos um Combobox
    const cities = currentDestino?.cities || [];
    const placeholderText = "Selecione a Cidade";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-10" // Adicionando h-10 aqui
                    disabled={disabled}
                >
                    {value ? (
                        <span className="flex items-center">
                            <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            {value}
                        </span>
                    ) : (
                        placeholderText
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Buscar cidade..." />
                    <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                    <CommandGroup className="max-h-[200px] overflow-y-auto">
                        {cities.map((city) => (
                            <CommandItem
                                key={city}
                                value={city}
                                onSelect={(currentValue) => {
                                    // O currentValue é a cidade em minúsculas. Usamos 'city' para o valor original.
                                    onChange(city);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        'mr-2 h-4 w-4',
                                        value === city ? 'opacity-100' : 'opacity-0'
                                    )}
                                />
                                {city}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
};