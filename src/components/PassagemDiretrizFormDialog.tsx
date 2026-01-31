// ... (código anterior)
            const om = (oms as OMData[] | undefined)?.find(o => o.nome_om === diretrizToEdit.om_referencia && o.codug_om === diretrizToEdit.ug_referencia);
            setSelectedOmReferenciaId(om?.id);
// ... (código restante)