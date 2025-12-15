// ... (imports)

const DiretrizesCusteioPage = () => {
  const navigate = useNavigate();
// ... (existing state declarations)
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  const [defaultYear, setDefaultYear] = useState<number | null>(null);
  
  // NOVOS ESTADOS PARA RAW INPUTS (CLASSE I)
  const currentYear = new Date().getFullYear();
// ... (rest of the component logic)

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
// ... (existing JSX)
      
      {/* Diálogo de Gerenciamento de Anos */}
      <YearManagementDialog
        open={isYearManagementDialogOpen}
        onOpenChange={setIsYearManagementDialogOpen}
        availableYears={availableYears}
        currentYear={currentYear}
        defaultYear={defaultYear} {/* <-- Adicionado aqui */}
        onCopy={handleCopyDiretrizes}
        onDelete={handleDeleteDiretrizes}
        loading={loading}
      />
    </div>
  );
};

export default DiretrizesCusteioPage;