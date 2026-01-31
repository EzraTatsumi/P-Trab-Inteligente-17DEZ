import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { SelectSingleEventHandler } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input"; // Importando Input

interface DatePickerProps {
  date: Date | undefined;
  setDate: SelectSingleEventHandler;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function DatePicker({ date, setDate, placeholder = "Selecione uma data", disabled = false, id }: DatePickerProps) {
  const [inputValue, setInputValue] = React.useState(date ? format(date, "dd/MM/yyyy") : "");

  React.useEffect(() => {
    setInputValue(date ? format(date, "dd/MM/yyyy") : "");
  }, [date]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setInputValue(rawValue);

    // Tenta parsear a data no formato dd/MM/yyyy
    if (rawValue.length === 10) {
      const parsedDate = parse(rawValue, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        // Se a data for válida, atualiza o estado principal
        // SelectSingleEventHandler espera 3 argumentos: day, modifiers, event
        setDate(parsedDate, undefined, undefined); 
      }
    } else if (rawValue.length === 0) {
        // Permite limpar a data
        setDate(undefined, undefined, undefined);
    }
  };

  const handleSelectDate: SelectSingleEventHandler = (selectedDate, modifiers, e) => {
    // handleSelectDate é chamado pelo DayPicker (3 argumentos) e chama o prop setDate (3 argumentos)
    setDate(selectedDate, modifiers, e); 
    if (selectedDate) {
      setInputValue(format(selectedDate, "dd/MM/yyyy"));
    } else {
      setInputValue("");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            id={id}
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            className={cn(
              "w-full justify-start text-left font-normal pr-10", // Adiciona padding à direita para o ícone
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          />
          <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelectDate}
          initialFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}