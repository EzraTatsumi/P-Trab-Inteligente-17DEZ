import React, { useState, useEffect } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { formatNumberToCurrency, parseCurrencyToNumber } from '@/lib/utils';

interface DecimalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label?: string;
  placeholder?: string;
}

const DecimalInput: React.FC<DecimalInputProps> = ({ name, label, placeholder, ...props }) => {
  const { control } = useFormContext();
  const { field } = useController({ name, control });

  // Internal state to manage the string representation (allowing commas during typing)
  const [displayValue, setDisplayValue] = useState('');

  // Effect to synchronize RHF numeric value (field.value) with displayValue string
  useEffect(() => {
    // Only format if the field value is a valid number (not null/undefined/empty string)
    if (field.value !== null && field.value !== undefined && typeof field.value === 'number') {
      // Format the numeric value for display
      setDisplayValue(formatNumberToCurrency(field.value));
    } else if (field.value === null || field.value === undefined || field.value === '') {
      setDisplayValue('');
    }
  }, [field.value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // 1. Update internal display state immediately to allow free typing (including commas)
    setDisplayValue(rawValue);

    // 2. Parse the value to a number for RHF state update
    const numericValue = parseCurrencyToNumber(rawValue);
    
    // 3. Update RHF field value (this is the numeric value)
    field.onChange(numericValue);
  };

  const handleBlur = () => {
    // On blur, re-format the display value based on the numeric value stored in RHF
    if (field.value !== null && field.value !== undefined && typeof field.value === 'number') {
      setDisplayValue(formatNumberToCurrency(field.value));
    } else {
      setDisplayValue('');
    }
  };

  return (
    <Input
      {...props}
      type="text" // Must be text to allow comma input
      inputMode="decimal"
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      name={field.name}
      ref={field.ref}
    />
  );
};

export default DecimalInput;