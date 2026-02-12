{/* ... código anterior ... */}
            <ItemAquisicaoPNCPDialog 
                open={isPNCPSearchOpen} 
                onOpenChange={setIsPNCPSearchOpen} 
                onImport={handlePNCPImport} 
                existingItemsInDiretriz={subitemForm.itens_aquisicao as any} 
                selectedYear={selectedYear} 
                mode="servico"
            />
        </Dialog>
    );
};

export default ServicosTerceirosDiretrizFormDialog;