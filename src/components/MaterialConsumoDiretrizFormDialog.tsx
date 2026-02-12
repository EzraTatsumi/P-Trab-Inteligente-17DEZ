{/* ... código anterior ... */}
            <ItemAquisicaoPNCPDialog
                open={isPNCPSearchOpen}
                onOpenChange={setIsPNCPSearchOpen}
                onImport={handlePNCPImport}
                existingItemsInDiretriz={subitemForm.itens_aquisicao}
                onReviewItem={handleReviewItem} 
                selectedYear={selectedYear} 
                mode="material"
            />
        </Dialog>
    );
};

export default MaterialConsumoDiretrizFormDialog;