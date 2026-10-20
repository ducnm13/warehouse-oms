DELETE l FROM production_order_document_links_v1 l
LEFT JOIN inventorytransactions t ON t.id = l.linkedId
WHERE t.id IS NULL;

DELETE l FROM assembly_order_document_links l
LEFT JOIN inventorytransactions t ON t.id = l.linkedId
WHERE t.id IS NULL;

DELETE l FROM disassembly_order_document_links l
LEFT JOIN inventorytransactions t ON t.id = l.linkedId
WHERE t.id IS NULL;
