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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OPCOES_PADRAO = ["Militares", "OSP", "Civis"];

interface PublicoSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PublicoSelect({ value, onChange, disabled }: PublicoSelectProps) {
  const [open, setOpen] = React.useState(false);
  const isCustom = value && !OPCOES_PADRAO.includes(value);
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
            {value || "Selecione o público..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandGroup>
            {OPCOES_PADRAO.map((opcao) => (
              <CommandItem
                key={opcao}
                value={opcao}
                onSelect={() => handleSelect(opcao)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === opcao ? "opacity-100" : "opacity-0"
                  )}
                />
                {opcao}
              </CommandItem>
            ))}
          </CommandGroup>
          <div className="p-2 border-t">
            <Label className="text-xs text-muted-foreground mb-1 block">Outro Público</Label>
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