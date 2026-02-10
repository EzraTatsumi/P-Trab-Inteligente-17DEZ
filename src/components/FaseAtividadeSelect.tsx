import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FASES_PADRAO } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FaseAtividadeSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function FaseAtividadeSelect({ value, onChange, disabled }: FaseAtividadeSelectProps) {
  const [open, setOpen] = React.useState(false);
  const isCustom = value && !FASES_PADRAO.includes(value);
  const [tempCustom, setTempCustom] = React.useState(isCustom ? value : "");

  const handleSelect = (val: string) => {
    onChange(val);
    setTempCustom("");
    setOpen(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTempCustom(val);
    onChange(val);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10"
          disabled={disabled}
        >
          <span className="truncate">
            {value || "Selecione a fase..."}
          </span>
          <div className="flex items-center">
            <Check className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandGroup>
            {FASES_PADRAO.map((fase) => (
              <CommandItem
                key={fase}
                value={fase}
                onSelect={() => handleSelect(fase)}
                className="cursor-pointer"
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
          <div className="p-2 border-t">
            <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade</Label>
            <Input
              value={tempCustom}
              onChange={handleCustomChange}
              placeholder="Digite aqui..."
              className="h-8 text-sm"
            />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}