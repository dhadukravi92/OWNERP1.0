export const DEFAULT_DOCUMENT_TEMPLATES = {
  quotation: {
    subject: 'Quotation for your approval',
    mailDraft: 'Dear Sir/Madam,\n\nPlease find attached our quotation for your review. Kindly confirm the commercials and share your approval to proceed.\n\nThanks & Regards,',
    terms: 'Prices are valid until the quotation validity date. Taxes, freight, installation, and delivery terms are applicable as mentioned in the quotation.'
  },
  proforma: {
    subject: 'Proforma invoice for your approval',
    mailDraft: 'Dear Sir/Madam,\n\nPlease find attached our proforma invoice for your review. Kindly confirm the commercials and revert with your approval.\n\nThanks & Regards,',
    terms: 'This is a proforma invoice and not a tax invoice. Material dispatch and final tax invoice will follow confirmation and payment terms.'
  }
};

export function getDocumentTemplateDefaults(settings = {}, type = 'quotation') {
  const fallback = DEFAULT_DOCUMENT_TEMPLATES[type] || DEFAULT_DOCUMENT_TEMPLATES.quotation;
  const prefix = type === 'proforma' ? 'proforma' : 'quotation';

  return {
    subject: settings[`${prefix}_default_subject`] || fallback.subject,
    mailDraft: settings[`${prefix}_default_mail_draft`] || fallback.mailDraft,
    terms: settings[`${prefix}_default_terms`] || fallback.terms
  };
}
