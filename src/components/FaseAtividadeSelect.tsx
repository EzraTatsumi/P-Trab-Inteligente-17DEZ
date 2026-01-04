import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FASES_PADRAO } from "@/lib/constants";

interface FaseAtividadeSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export function FaseAtividadeSelect({ value, onChange, disabled }: FaseAtividadeSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedFase = FASES_PADRAO.find((fase) => fase === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedFase ? selectedFase : "Selecione a fase..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar fase..." />
          <CommandEmpty>Nenhuma fase encontrada.</CommandEmpty>
          <CommandGroup>
            {FASES_PADRAO.map((fase) => (
              <CommandItem
                key={fase}
                value={fase}
                onSelect={(currentValue) => {
                  onChange(currentValue === value ? "" : currentValue);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === fase ? "opacity-100" : "opacity-0"
                  )}
                />
                {fase}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}