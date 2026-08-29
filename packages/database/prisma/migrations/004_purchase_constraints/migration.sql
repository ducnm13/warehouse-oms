ALTER TABLE purchase_document_links_v1
  ADD CONSTRAINT purchase_links_v1_document_fk
  FOREIGN KEY (purchaseDocumentId) REFERENCES purchase_documents(id) ON DELETE CASCADE;