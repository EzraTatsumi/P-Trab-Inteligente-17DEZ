import React, { useCallback, useRef } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PTrabData, 
  ClasseIRegistro, 
  calculateDays,
  generateClasseIMemoriaCalculoUnificada, 
  formatDate, // <-- IMPORTAÇÃO CORRIGIDA
} from "@/pages/PTrabReportManager"; 

interface PTrabRacaoOperacionalReportProps {
// ... (restante do código)