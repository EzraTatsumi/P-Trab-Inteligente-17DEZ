import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, AlertCircle, XCircle, ChevronDown, ChevronUp, Sparkles, ClipboardList, Check, Cloud, Droplet } from "lucide-react"; // Alterado de OilCan para Droplet
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC, RefLPCForm } from "@/types/refLPC";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils"; // Importar a nova função
import { formatCurrency, formatNumber } from "@/lib/formatUtils"; // Importar formatCurrency e formatNumber
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";

// ... (rest of the file remains the same)

// ... (inside the JSX for the selection screen)

                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('LUBRIFICANTE')}
                >
                  <Droplet className="mr-3 h-6 w-6" />
                  Lubrificante
                </Button>

// ... (rest of the file remains the same)