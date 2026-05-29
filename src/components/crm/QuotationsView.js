import React, { useState, useEffect, useMemo } from 'react';
import { Edit, Trash2, Plus, Search, Mail, MessageSquare, Printer, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '../../utils/database';
import { getCompanyLogoUrl } from '../../utils/branding';

const generateQuotationNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `QT-${datePart}-${randomPart}`;
};

const round = (value) => Math.round(value * 100) / 100;

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  const txt = String(value);
  // Remove malformed per-character separators and stray control chars (e.g., broken auto inserted & pairs)
  return txt
    .replace(/&(?=[A-Za-z0-9])/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const normalizeMultilineText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((line) => line.replace(/\s{2,}/g, ' ').trim())
    .join('\n')
    .trim();
};

const formatPdfMoney = (value) => `Rs. ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
const formatPdfQty = (value) => {
  const qty = Number(value || 0);
  if (Number.isNaN(qty)) return '0';
  return Number.isInteger(qty)
    ? qty.toLocaleString('en-IN')
    : qty.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
};

const resolveQuotedProduct = async (item) => {
  const productId = normalizeText(item.productId || '');
  if (productId) {
    const matchById = await db.get(
      `SELECT id, name, code, unit
       FROM products
       WHERE id = ? AND is_active = 1
       LIMIT 1`,
      [productId]
    );
    if (matchById) return matchById;
  }

  const productCode = normalizeText(item.productCode || '');
  if (productCode) {
    const matchByCode = await db.get(
      `SELECT id, name, code, unit
       FROM products
       WHERE LOWER(code) = LOWER(?) AND is_active = 1
       LIMIT 1`,
      [productCode]
    );
    if (matchByCode) return matchByCode;
  }

  const productName = normalizeText(item.product || '');
  if (!productName) return null;

  const exactMatch = await db.get(
    `SELECT id, name, code, unit
     FROM products
     WHERE LOWER(name) = LOWER(?) AND is_active = 1
     LIMIT 1`,
    [productName]
  );
  if (exactMatch) return exactMatch;

  return db.get(
    `SELECT id, name, code, unit
     FROM products
     WHERE name LIKE ? AND is_active = 1
     ORDER BY name
     LIMIT 1`,
    [`%${productName}%`]
  );
};

const fetchDetailedBomSections = async (quote) => {
  const sections = [];

  for (const [index, item] of (quote?.lineItems || []).entries()) {
    const product = await resolveQuotedProduct(item);
    if (!product?.id) continue;

    const bom = await db.get(
      `SELECT b.*, p.name AS product_name, p.code AS product_code
       FROM bom b
       LEFT JOIN products p ON p.id = b.product_id
       WHERE b.product_id = ? AND b.is_active = 1
       ORDER BY b.created_at DESC, b.name
       LIMIT 1`,
      [product.id]
    );
    if (!bom?.id) continue;

    const bomItems = await db.all(
      `SELECT bi.quantity,
              bi.unit,
              bi.notes,
              p.name AS material_name,
              p.code AS material_code,
              p.description AS material_description,
              p.unit AS product_unit,
              p.cost_price,
              COALESCE(i.quantity, 0) AS stock
       FROM bom_items bi
       JOIN products p ON p.id = bi.material_id
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE bi.bom_id = ?
       ORDER BY p.name`,
      [bom.id]
    );
    if (!bomItems?.length) continue;

    const quotedQty = Math.max(Number(item.qty || 0), 1);
    const rows = bomItems.map((component, componentIndex) => {
      const perBomQty = Number(component.quantity || 0);
      const requiredQty = round(perBomQty * quotedQty);
      const unitCost = Number(component.cost_price || 0);
      const extendedCost = round(requiredQty * unitCost);

      return {
        index: componentIndex + 1,
        code: normalizeText(component.material_code || '-'),
        name: normalizeText(component.material_name || 'Component'),
        description: normalizeText(component.material_description || ''),
        perBomQty,
        requiredQty,
        unit: normalizeText(component.unit || component.product_unit || product.unit || 'PCS'),
        stock: Number(component.stock || 0),
        unitCost,
        extendedCost,
        notes: normalizeText(component.notes || '')
      };
    });

    sections.push({
      lineNumber: index + 1,
      masterItemName: normalizeText(item.product || product.name),
      masterItemDescription: normalizeText(item.description || bom.description || ''),
      quotedQty,
      bomName: normalizeText(bom.name || `${product.name} BOM`),
      bomVersion: normalizeText(bom.version || '1.0'),
      productCode: normalizeText(product.code || bom.product_code || '-'),
      componentCount: rows.length,
      estimatedCost: round(rows.reduce((sum, row) => sum + row.extendedCost, 0)),
      rows
    });
  }

  return sections;
};

const formatCurrency = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '₹0';
  return '₹' + Math.round(num).toString();
};

const formatSimpleNumber = (value) => {
  const num = Number(value || 0);
  return Math.round(num).toString();
};

const QuotationsView = () => {
  const { currentUser, settings } = useAppStore();
  const [quotations, setQuotations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [productSuggestions, setProductSuggestions] = useState({});
  const [activeLineSearch, setActiveLineSearch] = useState(null);
  const [bomPreviewSections, setBomPreviewSections] = useState([]);
  const [bomPreviewLoading, setBomPreviewLoading] = useState(false);

  const companyInfo = {
    name: normalizeText(settings.company_name || 'My Company Pvt Ltd'),
    gst: normalizeText(settings.company_gst || '27ABCDE1234F2Z5'),
    address: normalizeText(settings.company_address || '123 Industrial Area, Pune, Maharashtra'),
    email: normalizeText(settings.company_email || 'contact@mycompany.com'),
    phone: normalizeText(settings.company_phone || '+91-9876543210'),
    logo: getCompanyLogoUrl(settings) || 'https://via.placeholder.com/150?text=Company+Logo'
  };

  const [form, setForm] = useState({
    quotationNumber: generateQuotationNumber(),
    lead: '',
    customerEmail: '',
    customerWhatsapp: '',
    issueDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    subject: '',
    mailDraft: 'Dear Sir/Madam,\n\nPlease find attached our quotation for your requirement. Kindly review the commercial and technical details and let us know if you need any changes.\n\nThanks & Regards,',
    overallDiscount: 0,
    notes: '',
    terms: normalizeText('Payment due within 30 days. E.& O.E.'),
    status: 'draft',
    owner: currentUser?.name || '',
    lineItems: [
      { id: `li-${Date.now()}`, product: 'Custom item', description: 'Item description', qty: 1, unitPrice: 0, discount: 0, gst: 18 }
    ]
  });

  useEffect(() => { loadSample(); }, []);
  useEffect(() => { filterTable(); }, [quotations, search]);
  useEffect(() => {
    let cancelled = false;

    const loadBomPreview = async () => {
      if (!openForm) {
        setBomPreviewSections([]);
        setBomPreviewLoading(false);
        return;
      }

      setBomPreviewLoading(true);
      try {
        const sections = await fetchDetailedBomSections(form);
        if (!cancelled) {
          setBomPreviewSections(sections);
        }
      } catch (error) {
        console.error('Error loading BOM preview:', error);
        if (!cancelled) {
          setBomPreviewSections([]);
        }
      } finally {
        if (!cancelled) {
          setBomPreviewLoading(false);
        }
      }
    };

    loadBomPreview();

    return () => {
      cancelled = true;
    };
  }, [form, openForm]);

  const loadSample = () => {
    setQuotations([
      {
        id: 'q1',
        quotationNumber: 'QT-20260401-1234',
        lead: 'Tech Solutions Pvt Ltd',
        customerEmail: 'rajesh@techsolutions.com',
        customerWhatsapp: '+919876543210',
        issueDate: '2026-03-24',
        expiryDate: '2026-04-07',
        subject: 'Quotation for ERP Setup',
        mailDraft: 'Dear Rajesh,\n\nPlease find attached our quotation for ERP setup. Kindly review the scope, pricing, and terms and share your approval or comments.\n\nThanks & Regards,',
        overallDiscount: 5,
        notes: 'First quote example',
        terms: '30-day credit.',
        status: 'sent',
        owner: 'Ravi',
        lineItems: [{ id: 'li-1', product: 'ERP Setup', description: 'Complete ERP setup', qty: 1, unitPrice: 120000, discount: 5, gst: 18 }]
      },
      {
        id: 'q2',
        quotationNumber: 'QT-20260401-5678',
        lead: 'Acme Enterprises',
        customerEmail: 'priya@example.com',
        customerWhatsapp: '+918765432109',
        issueDate: '2026-03-20',
        expiryDate: '2026-04-03',
        subject: 'Quotation for Warehouse Module',
        mailDraft: 'Dear Priya,\n\nPlease find attached our quotation for the warehouse module. Let us know if you would like any revisions.\n\nThanks & Regards,',
        overallDiscount: 0,
        notes: 'Standard quote',
        terms: '50% advance',
        status: 'accepted',
        owner: 'Priya',
        lineItems: [{ id: 'li-2', product: 'Warehouse Module', description: 'Warehouse and Inventory', qty: 1, unitPrice: 280000, discount: 0, gst: 18 }]
      }
    ]);
  };

  const filterTable = () => {
    const term = search.toLowerCase().trim();
    if (!term) return setFiltered(quotations);
    setFiltered(quotations.filter(q =>
      q.lead.toLowerCase().includes(term) ||
      q.quotationNumber.toLowerCase().includes(term) ||
      q.status.toLowerCase().includes(term) ||
      (q.owner || '').toLowerCase().includes(term)
    ));
  };

  const calculateTotals = (quote) => {
    const items = quote.lineItems || [];
    const subtotal = items.reduce((sum, item) => sum + ((item.qty || 0) * (item.unitPrice || 0)), 0);
    const itemDiscount = items.reduce((sum, item) => {
      const line = (item.qty || 0) * (item.unitPrice || 0);
      return sum + (line * (item.discount || 0) / 100);
    }, 0);
    const gstBase = items.reduce((sum, item) => {
      const lineAfterDiscount = ((item.qty || 0) * (item.unitPrice || 0)) * (1 - (item.discount || 0) / 100);
      return sum + (lineAfterDiscount * (item.gst || 0) / 100);
    }, 0);
    const overallDiscount = (quote.overallDiscount || 0) / 100 * (subtotal - itemDiscount);
    const total = subtotal - itemDiscount - overallDiscount + gstBase;
    return {
      subtotal: round(subtotal),
      itemDiscount: round(itemDiscount),
      gstAmount: round(gstBase),
      overallDiscount: round(overallDiscount),
      total: round(total)
    };
  };

  const openEditor = (item = null) => {
    if (item) {
      setForm({ ...item });
      setSelected(item);
    } else {
      setForm({
        quotationNumber: generateQuotationNumber(),
        lead: '',
        customerEmail: '',
        customerWhatsapp: '',
        issueDate: new Date().toISOString().slice(0, 10),
        expiryDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        subject: '',
        mailDraft: 'Dear Sir/Madam,\n\nPlease find attached our quotation for your requirement. Kindly review the commercial and technical details and let us know if you need any changes.\n\nThanks & Regards,',
        overallDiscount: 0,
        notes: '',
        terms: 'Payment due within 30 days. E.& O.E.',
        status: 'draft',
        owner: currentUser?.name || '',
        lineItems: [{ id: `li-${Date.now()}`, product: 'Custom item', description: 'Item description', qty: 1, unitPrice: 0, discount: 0, gst: 18 }]
      });
      setSelected(null);
    }
    setOpenForm(true);
  };

  const updateLineItem = (id, key, value) => {
    setForm(state => ({
      ...state,
      lineItems: state.lineItems.map(item =>
        item.id === id
          ? {
              ...item,
              [key]: key === 'product' || key === 'description' ? value : Number(value || 0),
              ...(key === 'product' ? { productId: '', productCode: '', productUnit: '' } : {})
            }
          : item
      )
    }));
  };

  const addLineItem = () => {
    setForm(state => ({
      ...state,
      lineItems: [...(state.lineItems || []), { id: `li-${Date.now()}`, product: 'Custom item', description: '', qty: 1, unitPrice: 0, discount: 0, gst: 18 }]
    }));
  };

  const removeLineItem = (id) => {
    setForm(state => ({
      ...state,
      lineItems: (state.lineItems || []).filter(item => item.id !== id)
    }));
  };

  const searchProducts = async (searchTerm, lineItemId) => {
    if (!searchTerm || searchTerm.length < 1) {
      setProductSuggestions(prev => ({ ...prev, [lineItemId]: [] }));
      return;
    }

    try {
      const results = await db.all(
        `SELECT id, name, code, unit, selling_price, gst_rate, description 
         FROM products 
         WHERE (name LIKE ? OR code LIKE ?) AND is_active = 1 
         ORDER BY name 
         LIMIT 10`,
        [`%${searchTerm}%`, `%${searchTerm}%`]
      );
      setProductSuggestions(prev => ({ ...prev, [lineItemId]: results || [] }));
    } catch (error) {
      console.error('Error searching products:', error);
      setProductSuggestions(prev => ({ ...prev, [lineItemId]: [] }));
    }
  };

  const selectProduct = (product, lineItemId) => {
    setForm((state) => ({
      ...state,
      lineItems: state.lineItems.map((item) =>
        item.id === lineItemId
          ? {
              ...item,
              product: product.name || '',
              description: product.description || '',
              unitPrice: Number(product.selling_price || 0),
              gst: Number(product.gst_rate || 18),
              productId: product.id || '',
              productCode: product.code || '',
              productUnit: product.unit || ''
            }
          : item
      )
    }));
    setProductSuggestions(prev => ({ ...prev, [lineItemId]: [] }));
    setActiveLineSearch(null);
  };

  const saveQuote = () => {
    if (!form.lead || !form.issueDate || !form.expiryDate || !form.customerEmail || !form.customerWhatsapp) {
      window.alert('Please fill required fields: Lead, email and WhatsApp');
      return;
    }

    const quoteToSave = {
      ...form,
      id: selected ? selected.id : `q${Date.now()}`,
      updatedAt: new Date().toISOString(),
      totals: calculateTotals(form)
    };

    if (selected) {
      setQuotations(prev => prev.map(x => (x.id === selected.id ? quoteToSave : x)));
    } else {
      setQuotations(prev => [...prev, quoteToSave]);
    }

    setOpenForm(false);
    setSelected(null);
  };

  const removeQuote = (id) => {
    if (!window.confirm('Remove quotation?')) return;
    setQuotations(prev => prev.filter(x => x.id !== id));
  };

  const createPdf = async (quote) => {
    try {
      const q = quote || form;
      const stamp = q.quotationNumber || generateQuotationNumber();
      const totals = calculateTotals(q);
      const bomSections = await fetchDetailedBomSections(q);

      // Create PDF document with clean layout
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Set font
      doc.setFont('helvetica');

      // Header - Company Details (centered)
      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175); // Blue color
      doc.setFont('helvetica', 'bold');
      const companyNameWidth = doc.getTextWidth(companyInfo.name);
      doc.text(companyInfo.name, (pageWidth - companyNameWidth) / 2, yPosition);
      yPosition += 8;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      const gstinWidth = doc.getTextWidth(`GSTIN: ${companyInfo.gst}`);
      doc.text(`GSTIN: ${companyInfo.gst}`, (pageWidth - gstinWidth) / 2, yPosition);
      yPosition += 6;

      // Address wrapped text (max 70 chars per line)
      const addressLines = doc.splitTextToSize(companyInfo.address, pageWidth - 40);
      doc.text(addressLines, 20, yPosition);
      yPosition += addressLines.length * 4 + 2;

      const contactWidth = doc.getTextWidth(`${companyInfo.email} | ${companyInfo.phone}`);
      doc.text(`${companyInfo.email} | ${companyInfo.phone}`, (pageWidth - contactWidth) / 2, yPosition);
      yPosition += 15;

      // Quotation Title (centered)
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      const titleWidth = doc.getTextWidth('QUOTATION');
      doc.text('QUOTATION', (pageWidth - titleWidth) / 2, yPosition);
      yPosition += 10;

      // Quote Details (centered)
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      const quoteDetails = `Quote No: ${normalizeText(q.quotationNumber)}    Date: ${normalizeText(q.issueDate)}    Valid Till: ${normalizeText(q.expiryDate)}`;
      const quoteDetailsWidth = doc.getTextWidth(quoteDetails);
      doc.text(quoteDetails, (pageWidth - quoteDetailsWidth) / 2, yPosition);
      yPosition += 15;

      // Customer Details (left aligned)
      doc.setFont('helvetica', 'bold');
      doc.text('To:', 20, yPosition);
      yPosition += 8;

      doc.setFontSize(13);
      doc.text(normalizeText(q.lead), 20, yPosition);
      yPosition += 6;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Email: ${normalizeText(q.customerEmail)}`, 20, yPosition);
      yPosition += 6;

      doc.text(`Mobile: ${normalizeText(q.customerWhatsapp)}`, 20, yPosition);
      yPosition += 8;

      const subjectText = normalizeText(q.subject || '');
      if (subjectText) {
        doc.setFont('helvetica', 'bold');
        doc.text('Subject:', 20, yPosition);
        yPosition += 6;
        doc.setFont('helvetica', 'normal');
        const splitSubject = doc.splitTextToSize(subjectText, pageWidth - 40);
        doc.text(splitSubject, 20, yPosition);
        yPosition += splitSubject.length * 5 + 9;
      } else {
        yPosition += 12;
      }

      const mailDraftText = normalizeMultilineText(q.mailDraft || '');
      if (mailDraftText) {
        doc.setFont('helvetica', 'normal');
        const splitMailDraft = doc.splitTextToSize(mailDraftText, pageWidth - 40);
        doc.text(splitMailDraft, 20, yPosition);
        yPosition += splitMailDraft.length * 5 + 10;
      }

      // Items Table
      const tableData = q.lineItems.map((item, idx) => {
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const discountPct = Number(item.discount || 0);
        const gstPct = Number(item.gst || 0);
        
        const line = qty * unitPrice;
        const discountAmount = line * (discountPct / 100);
        const afterDiscount = line - discountAmount;
        const gstAmount = afterDiscount * (gstPct / 100);
        const finalAmount = afterDiscount + gstAmount;

        return [
          String(idx + 1),
          item.product + (item.description ? `\n${item.description}` : ''),
          String(Math.round(qty)),
          '₹' + String(Math.round(unitPrice)),
          String(Math.round(discountPct)) + '%',
          String(Math.round(gstPct)) + '%',
          '₹' + String(Math.round(finalAmount))
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['S.No', 'Description', 'Qty', 'Rate', 'Disc%', 'GST%', 'Amount']],
        body: tableData.map((row) => row.map((cell, index) => {
          if (index === 3 || index === 6) {
            const amount = String(cell).match(/(\d[\d,]*)$/);
            return amount ? `Rs. ${amount[1]}` : String(cell);
          }
          return normalizeMultilineText(cell);
        })),
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 15 }, // S.No
          1: { cellWidth: 60 }, // Description
          2: { cellWidth: 20 }, // Qty
          3: { cellWidth: 25 }, // Rate
          4: { cellWidth: 20 }, // Disc%
          5: { cellWidth: 20 }, // GST%
          6: { cellWidth: 30 }, // Amount
        },
        margin: { left: 20, right: 20 },
      });

      yPosition = doc.lastAutoTable.finalY + 15;
      const subtotalStartY = yPosition;

      // Subtotal section (left aligned)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      const subtotalVal = Math.round(totals.subtotal);
      doc.text('Subtotal: ₹' + subtotalVal.toString(), 20, yPosition);
      yPosition += 6;

      if (totals.itemDiscount > 0) {
        doc.setTextColor(5, 150, 105);
        const discountVal = Math.round(totals.itemDiscount);
        doc.text('Item Discount: -₹' + discountVal.toString(), 20, yPosition);
        yPosition += 6;
      }

      if (totals.overallDiscount > 0) {
        doc.setTextColor(5, 150, 105);
        const odVal = Math.round(totals.overallDiscount);
        doc.text('Overall Discount: -₹' + odVal.toString(), 20, yPosition);
        yPosition += 6;
      }

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      const gstVal = Math.round(totals.gstAmount);
      doc.text('GST/Tax: ₹' + gstVal.toString(), 20, yPosition);
      yPosition += 8;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      const totalVal = Math.round(totals.total);
      doc.text('Total Amount: ₹' + totalVal.toString(), 20, yPosition);
      yPosition += 20;

      // Repaint totals using plain ASCII money text so the PDF stays readable.
      const cleanTotalsBottomY = yPosition;
      doc.setFillColor(255, 255, 255);
      doc.rect(18, subtotalStartY - 4, pageWidth - 36, cleanTotalsBottomY - subtotalStartY + 6, 'F');

      yPosition = subtotalStartY;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Subtotal: ${formatPdfMoney(totals.subtotal)}`, 20, yPosition);
      yPosition += 6;

      if (totals.itemDiscount > 0) {
        doc.setTextColor(5, 150, 105);
        doc.text(`Item Discount: -${formatPdfMoney(totals.itemDiscount)}`, 20, yPosition);
        yPosition += 6;
      }

      if (totals.overallDiscount > 0) {
        doc.setTextColor(5, 150, 105);
        doc.text(`Overall Discount: -${formatPdfMoney(totals.overallDiscount)}`, 20, yPosition);
        yPosition += 6;
      }

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text(`GST/Tax: ${formatPdfMoney(totals.gstAmount)}`, 20, yPosition);
      yPosition += 8;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(`Total Amount: ${formatPdfMoney(totals.total)}`, 20, yPosition);
      yPosition += 20;

      // Notes
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 20, yPosition);
      yPosition += 6;

      doc.setFont('helvetica', 'normal');
      const notesText = normalizeMultilineText(q.notes || 'Standard terms and conditions apply.');
      const splitNotes = doc.splitTextToSize(notesText, pageWidth - 40);
      doc.text(splitNotes, 20, yPosition);
      yPosition += splitNotes.length * 5 + 10;

      // Terms & Conditions
      doc.setFont('helvetica', 'bold');
      doc.text('Terms & Conditions:', 20, yPosition);
      yPosition += 6;

      doc.setFont('helvetica', 'normal');
      const termsText = normalizeMultilineText(q.terms || 'Payment due within 30 days. E.& O.E.');
      const splitTerms = doc.splitTextToSize(termsText, pageWidth - 40);
      doc.text(splitTerms, 20, yPosition);
      yPosition += splitTerms.length * 5 + 15;

      // Footer
      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      const footerText = `Generated on ${new Date().toLocaleDateString('en-IN')} | ${companyInfo.name}`;
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 20);

      if (bomSections.length > 0) {
        doc.addPage();
        let bomPageY = 18;
        const drawBomPageHeader = () => {
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, pageWidth, 34, 'F');
          doc.setFillColor(37, 99, 235);
          doc.rect(0, 34, pageWidth, 5, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(18);
          doc.setTextColor(255, 255, 255);
          doc.text('Detailed BOM Items', 20, 18);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(219, 234, 254);
          doc.text('Expanded component schedule generated automatically from the active BOM of each quoted master item.', 20, 26);

          doc.setFont('helvetica', 'italic');
          doc.setTextColor(191, 219, 254);
          doc.text('Required quantities below already include the quotation quantity multiplier.', 20, 32);

          bomPageY = 48;
        };

        drawBomPageHeader();

        bomSections.forEach((section) => {
          if (bomPageY > pageHeight - 90) {
            doc.addPage();
            drawBomPageHeader();
          }

          doc.setDrawColor(37, 99, 235);
          doc.setFillColor(239, 246, 255);
          doc.roundedRect(14, bomPageY - 2, pageWidth - 28, 20, 3, 3, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(15, 23, 42);
          doc.text(`${section.lineNumber}. ${section.masterItemName}`, 20, bomPageY + 5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.text(
            [
              `BOM: ${section.bomName}`,
              `Version: ${section.bomVersion}`,
              `Code: ${section.productCode}`,
              `Quoted Qty: ${formatPdfQty(section.quotedQty)}`,
              `Components: ${section.componentCount}`,
              `Estimated Material Value: ${formatPdfMoney(section.estimatedCost)}`
            ].join('   |   '),
            20,
            bomPageY + 12
          );

          if (section.masterItemDescription) {
            const summaryDescription = doc.splitTextToSize(section.masterItemDescription, pageWidth - 40);
            doc.setTextColor(100, 116, 139);
            doc.text(summaryDescription.slice(0, 1), 20, bomPageY + 17);
          }

          bomPageY += 26;

          autoTable(doc, {
            startY: bomPageY,
            head: [['#', 'Component', 'Code', 'Per BOM', 'Req Qty', 'Unit', 'Stock', 'Unit Cost', 'Amount', 'Remarks']],
            body: section.rows.map((component) => ([
              String(component.index),
              component.description ? `${component.name}\n${component.description}` : component.name,
              component.code,
              formatPdfQty(component.perBomQty),
              formatPdfQty(component.requiredQty),
              component.unit,
              formatPdfQty(component.stock),
              formatPdfMoney(component.unitCost),
              formatPdfMoney(component.extendedCost),
              component.notes || '-'
            ])),
            theme: 'grid',
            styles: {
              fontSize: 8,
              cellPadding: 2.5,
              lineColor: [203, 213, 225],
              lineWidth: 0.2,
              valign: 'middle'
            },
            headStyles: {
              fillColor: [30, 64, 175],
              textColor: 255,
              fontStyle: 'bold',
              halign: 'center'
            },
            bodyStyles: {
              textColor: [15, 23, 42]
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            },
            columnStyles: {
              0: { cellWidth: 10, halign: 'center' },
              1: { cellWidth: 41 },
              2: { cellWidth: 18, halign: 'center' },
              3: { cellWidth: 16, halign: 'right' },
              4: { cellWidth: 16, halign: 'right' },
              5: { cellWidth: 14, halign: 'center' },
              6: { cellWidth: 15, halign: 'right' },
              7: { cellWidth: 20, halign: 'right' },
              8: { cellWidth: 20, halign: 'right' },
              9: { cellWidth: 23 }
            },
            margin: { left: 14, right: 14 }
          });

          bomPageY = doc.lastAutoTable.finalY + 10;
        });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Detailed BOM Annex | ${normalizeText(q.quotationNumber)} | ${companyInfo.name}`, 14, pageHeight - 10);
      }

      // Save PDF
      doc.save(`${stamp}.pdf`);
      alert('✓ Professional quotation PDF generated successfully!');

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Check console for details.');
    }
  };

  const sendToCustomer = (quote) => {
    const q = quote || form;
    // Email use mailto for demo; in production use backend email API.
    const subject = encodeURIComponent(normalizeText(q.subject || `Quotation ${q.quotationNumber} from ${companyInfo.name}`));
    const body = encodeURIComponent(`Dear ${q.lead},\n\nPlease find the quotation attached (if email provider supports).` +
      `\nQuotation Number: ${q.quotationNumber}` +
      `\nTotal: ₹${calculateTotals(q).total}` +
      `\n\nBest regards,\n${companyInfo.name}`);
    const composedBody = encodeURIComponent(
      `${q.mailDraft || `Dear ${q.lead},\n\nPlease find the quotation attached (if email provider supports).`}` +
      `\n\nQuotation Number: ${q.quotationNumber}` +
      `\nTotal: Rs. ${calculateTotals(q).total}` +
      `\n\n${companyInfo.name}`
    );
    window.open(`mailto:${q.customerEmail}?subject=${subject}&body=${composedBody || body}`);

    const whatsappText = encodeURIComponent(`Hello ${q.lead}, your quotation ${q.quotationNumber} is ready. Total: ₹${calculateTotals(q).total}`);
    const normalized = q.customerWhatsapp.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=${normalized}&text=${whatsappText}`, '_blank');

    alert('Opened email and WhatsApp links for sending.');
  };

  const reportTotals = useMemo(() => calculateTotals(form), [form]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <h1 style={{ color: 'var(--text)', margin: 0, fontSize: 26 }}>Quotations Module</h1>
          <p style={{ color: 'var(--text-muted)' }}>Professional quotation builder with PDF export and customer delivery.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..."
              style={{ padding: '10px 12px 10px 32px', borderRadius: 8, border: '1px solid var(--border)', minWidth: 250 }} />
          </div>
          <button onClick={() => openEditor()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}><Plus size={16}/>New quotation</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--bg-secondary)' }}>
            <th style={{ padding: '11px 10px', textAlign: 'left' }}>Quote #</th>
            <th style={{ padding: '11px 10px', textAlign: 'left' }}>Customer</th>
            <th style={{ padding: '11px 10px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '11px 10px', textAlign: 'left' }}>Owner</th>
            <th style={{ padding: '11px 10px', textAlign: 'left' }}>Valid Till</th>
            <th style={{ padding: '11px 10px', textAlign: 'right' }}>Total</th>
            <th style={{ padding: '11px 10px', textAlign: 'center' }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>No quotations found.</td></tr>}
            {filtered.map(q => {
              const totals = calculateTotals(q);
              return (
                <tr key={q.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10 }}>{q.quotationNumber}</td>
                  <td style={{ padding: 10 }}>{q.lead}</td>
                  <td style={{ padding: 10 }}>{q.status}</td>
                  <td style={{ padding: 10 }}>{q.owner}</td>
                  <td style={{ padding: 10 }}>{q.expiryDate}</td>
                  <td style={{ padding: 10, textAlign: 'right' }}>₹{totals.total.toLocaleString()}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    <button onClick={() => openEditor(q)} style={{ marginRight: 6, border: '1px solid var(--border)', background: 'var(--primary-dim)', color: 'var(--primary)', borderRadius: 6, padding: 6, cursor: 'pointer' }}><Edit size={14}/></button>
                    <button onClick={() => createPdf(q)} style={{ marginRight: 6, border: '1px solid var(--border)', background: 'var(--success-dim)', color: 'var(--success)', borderRadius: 6, padding: 6, cursor: 'pointer' }}><Printer size={14}/></button>
                    <button onClick={() => sendToCustomer(q)} style={{ border: '1px solid var(--border)', background: 'var(--info-dim)', color: 'var(--info)', borderRadius: 6, padding: 6, cursor: 'pointer' }}><Mail size={14}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(3px)' }}>
          <div style={{ width: '98%', maxWidth: '1300px', background: 'var(--bg-primary)', borderRadius: 16, boxShadow: '0 25px 80px rgba(0,0,0,0.6)', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #1488cc 0%, #1a5fa0 100%)', padding: '24px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>{selected ? '✏️ Edit Quotation' : '➕ Create New Quotation'}</h2>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>Professional quotation builder with instant PDF export</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img src={companyInfo.logo} alt="Logo" style={{ maxHeight: 60, maxWidth: 100, objectFit: 'contain', borderRadius: 8, background: 'rgba(255,255,255,0.1)', padding: 6 }} />
              </div>
              <button onClick={() => { setOpenForm(false); setSelected(null); }} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 18, fontWeight: 'bold', hover: 'background 0.2s' }}>✕</button>
            </div>
            
            {/* Scrollable Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
              
              {/* Company Display */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>From (Your Company)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{companyInfo.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>GSTIN: <span style={{ fontFamily: 'monospace' }}>{companyInfo.gst}</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Address</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6 }}>{companyInfo.address}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Contact</div>
                    <div style={{ fontSize: 12 }}>{companyInfo.email}</div>
                    <div style={{ fontSize: 12 }}>{companyInfo.phone}</div>
                  </div>
                </div>
              </div>
              
              {/* Customer & Quote Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {/* Customer Section */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, letterSpacing: 0.5 }}>Customer Information</h4>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Customer/Company Name *</label>
                      <input value={form.lead} onChange={e => setForm({...form, lead: e.target.value})} placeholder="Enter customer name" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email Address *</label>
                      <input type="email" value={form.customerEmail} onChange={e => setForm({...form, customerEmail: e.target.value})} placeholder="customer@company.com" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>WhatsApp Number *</label>
                      <input value={form.customerWhatsapp} onChange={e => setForm({...form, customerWhatsapp: e.target.value})} placeholder="+91-XXXXXXXXXX" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
                    </div>
                  </div>
                </div>
                
                {/* Quote Details Section */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, letterSpacing: 0.5 }}>Quotation Details</h4>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Quotation Number</label>
                      <input value={form.quotationNumber} onChange={e => setForm({...form, quotationNumber: e.target.value})} placeholder="Auto-generated" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Issue Date</label>
                        <input type="date" value={form.issueDate} onChange={e => setForm({...form, issueDate: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Valid Till</label>
                        <input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject and mail draft */}
              <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: 0.5 }}>
                    Subject
                  </label>
                  <input
                    value={form.subject}
                    onChange={e => setForm({ ...form, subject: e.target.value })}
                    placeholder="Enter quotation subject"
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: 0.5 }}>
                    General Mail Draft
                  </label>
                  <textarea
                    value={form.mailDraft}
                    onChange={e => setForm({ ...form, mailDraft: e.target.value })}
                    placeholder="Write the common email message to send with this quotation..."
                    rows={5}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>
              </div>
              
              {/* Line Items */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, letterSpacing: 0.5 }}>Line Items</h4>
                  <button onClick={addLineItem} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Add Item</button>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'linear-gradient(135deg, #1488cc20, #1a5fa020)' }}>
                      <tr style={{ borderBottom: '2px solid var(--accent)' }}>
                        <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', minWidth: 140 }}>Product</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 130 }}>Description</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 60 }}>Qty</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 100 }}>Rate</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 65 }}>Disc%</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 65 }}>Tax%</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 100 }}>Total</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 50 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.lineItems.map((item, idx) => {
                        const line = (item.qty || 0) * (item.unitPrice || 0);
                        const discounted = line - (line * (item.discount || 0) / 100);
                        const gst = discounted * ((item.gst || 0) / 100);
                        const total = discounted + gst;
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(20,136,204,0.05)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,136,204,0.12)'} onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(20,136,204,0.05)'}>
                            <td style={{ padding: '12px 14px', position: 'relative' }}>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  value={item.product} 
                                  onChange={e => {
                                    updateLineItem(item.id, 'product', e.target.value);
                                    searchProducts(e.target.value, item.id);
                                    setActiveLineSearch(item.id);
                                  }}
                                  onFocus={() => {
                                    setActiveLineSearch(item.id);
                                    if (item.product) searchProducts(item.product, item.id);
                                  }}
                                  onBlur={() => setTimeout(() => setActiveLineSearch(null), 200)}
                                  placeholder="Item name (auto-search)" 
                                  style={{ width: '100%', minWidth: 120, padding: 9, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, fontWeight: 500 }} 
                                />
                                {activeLineSearch === item.id && (productSuggestions[item.id]?.length > 0) && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 6,
                                    marginTop: 4,
                                    maxHeight: 200,
                                    overflowY: 'auto',
                                    zIndex: 1000,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                  }}>
                                    {productSuggestions[item.id]?.map((prod, prodIdx) => (
                                      <div
                                        key={prodIdx}
                                        onClick={() => selectProduct(prod, item.id)}
                                        style={{
                                          padding: '10px 12px',
                                          cursor: 'pointer',
                                          borderBottom: prodIdx < (productSuggestions[item.id]?.length - 1) ? '1px solid var(--border)' : 'none',
                                          background: prodIdx === 0 ? 'rgba(20,136,204,0.1)' : 'transparent',
                                          transition: 'background 0.2s',
                                          fontSize: 12
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,136,204,0.15)'}
                                        onMouseLeave={e => e.currentTarget.style.background = prodIdx === 0 ? 'rgba(20,136,204,0.1)' : 'transparent'}
                                      >
                                        <div style={{ fontWeight: 500, color: 'var(--text)' }}>{prod.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>₹{Math.round(prod.selling_price || 0)} • GST {Math.round(prod.gst_rate || 0)}%{prod.code ? ` • ${prod.code}` : ''}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px' }}><input value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)} placeholder="Details" style={{ width: '100%', minWidth: 110, padding: 9, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13 }} /></td>
                            <td style={{ padding: '12px 14px' }}><input type="number" min="1" value={item.qty} onChange={e => updateLineItem(item.id, 'qty', e.target.value)} style={{ width: '100%', minWidth: 50, padding: 9, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, textAlign: 'center', fontWeight: 600 }} /></td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}><input type="number" min="0" value={item.unitPrice} onChange={e => updateLineItem(item.id, 'unitPrice', e.target.value)} style={{ width: '100%', minWidth: 80, padding: 9, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, textAlign: 'right', fontWeight: 600 }} /></td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}><input type="number" min="0" max="100" value={item.discount} onChange={e => updateLineItem(item.id, 'discount', e.target.value)} style={{ width: '100%', minWidth: 50, padding: 9, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, textAlign: 'center', fontWeight: 600 }} /></td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}><input type="number" min="0" max="100" value={item.gst} onChange={e => updateLineItem(item.id, 'gst', e.target.value)} style={{ width: '100%', minWidth: 50, padding: 9, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, textAlign: 'center', fontWeight: 600 }} /></td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>₹{round(total).toLocaleString()}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}><button onClick={() => removeLineItem(item.id)} style={{ background: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, cursor: 'pointer', padding: '6px 10px', fontSize: 13, fontWeight: 700, transition: 'all 0.2s' }} onMouseEnter={e => { e.target.style.background = 'rgba(239,68,68,0.25)'; }} onMouseLeave={e => { e.target.style.background = 'rgba(239,68,68,0.15)'; }}>✕</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(20,136,204,0.08)', border: '1px solid rgba(20,136,204,0.18)', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
                  Any quoted master item linked to an active BOM will be expanded automatically into a dedicated <strong style={{ color: 'var(--text)' }}>Detailed BOM Items</strong> annex on the last PDF page.
                </div>
              </div>
              
              {/* Notes, Terms & Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: 0.5 }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Add any notes for this quotation..." rows={3} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: 0.5 }}>Terms & Conditions</label>
                    <textarea value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} placeholder="Payment terms, delivery details, etc." rows={3} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                  </div>
                </div>
                
                {/* Summary Box */}
                <div style={{ background: 'linear-gradient(135deg, #1488cc10, #1a5fa010)', border: '2px solid var(--accent)', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: 12, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, letterSpacing: 0.5 }}>Order Summary</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                      <span style={{ fontWeight: 600 }}>₹{reportTotals.subtotal.toLocaleString()}</span>
                    </div>
                    {reportTotals.itemDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--success)' }}>
                        <span>Discount (Item)</span>
                        <span style={{ fontWeight: 600 }}>-₹{reportTotals.itemDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    {reportTotals.overallDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--success)' }}>
                        <span>Discount (Overall)</span>
                        <span style={{ fontWeight: 600 }}>-₹{reportTotals.overallDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>GST/Tax</span>
                      <span style={{ fontWeight: 600 }}>₹{reportTotals.gstAmount.toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: '2px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                      <span>Total</span>
                      <span>₹{reportTotals.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, letterSpacing: 0.5 }}>Detailed BOM Items</h4>
                    <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
                      Related BOM components for each quoted master item appear here automatically.
                    </p>
                  </div>
                  {bomPreviewSections.length > 0 && (
                    <div style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(20,136,204,0.12)', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>
                      {bomPreviewSections.length} linked BOM{bomPreviewSections.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'linear-gradient(180deg, rgba(20,136,204,0.08), rgba(10,14,26,0.22))', overflow: 'hidden' }}>
                  {bomPreviewLoading ? (
                    <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Loading related BOM items...</div>
                  ) : bomPreviewSections.length === 0 ? (
                    <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                      No related BOM items found yet. Select the master item from the product autosuggest, or use a product name/code that already has an active BOM.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14 }}>
                      {bomPreviewSections.map((section) => (
                        <div key={`${section.lineNumber}-${section.bomName}`} style={{ border: '1px solid rgba(20,136,204,0.2)', borderRadius: 14, overflow: 'hidden', background: 'rgba(15,23,42,0.55)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, padding: '14px 16px', background: 'linear-gradient(135deg, rgba(20,136,204,0.16), rgba(26,95,160,0.1))', borderBottom: '1px solid rgba(20,136,204,0.18)' }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{section.masterItemName}</div>
                              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                BOM: {section.bomName} | Version: {section.bomVersion} | Code: {section.productCode}
                              </div>
                              {section.masterItemDescription && (
                                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>{section.masterItemDescription}</div>
                              )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.16)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quoted Qty</div>
                                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{formatPdfQty(section.quotedQty)}</div>
                              </div>
                              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.16)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Components</div>
                                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{section.componentCount}</div>
                              </div>
                              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.16)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mat. Value</div>
                                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{formatPdfMoney(section.estimatedCost)}</div>
                              </div>
                            </div>
                          </div>

                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
                              <thead style={{ background: 'rgba(30,64,175,0.14)' }}>
                                <tr>
                                  <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>#</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Component</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Code</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Per BOM</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Required Qty</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Unit</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Stock</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Unit Cost</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Amount</th>
                                  <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {section.rows.map((component, componentIndex) => (
                                  <tr key={`${section.lineNumber}-${component.code}-${componentIndex}`} style={{ borderTop: '1px solid rgba(148,163,184,0.14)', background: componentIndex % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.28)' }}>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{component.index}</td>
                                    <td style={{ padding: '12px 10px' }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{component.name}</div>
                                      {component.description && <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>{component.description}</div>}
                                    </td>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{component.code}</td>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text)', textAlign: 'right', fontWeight: 600 }}>{formatPdfQty(component.perBomQty)}</td>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text)', textAlign: 'right', fontWeight: 700 }}>{formatPdfQty(component.requiredQty)}</td>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{component.unit}</td>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{formatPdfQty(component.stock)}</td>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{formatPdfMoney(component.unitCost)}</td>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--accent)', textAlign: 'right', fontWeight: 700 }}>{formatPdfMoney(component.extendedCost)}</td>
                                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{component.notes || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer Actions */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button onClick={() => { setOpenForm(false); setSelected(null); }} style={{ background: 'var(--bg-primary)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => createPdf(form)} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Printer size={14} /> PDF</button>
                <button onClick={() => sendToCustomer(form)} style={{ background: '#06b6d4', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> Email</button>
                <button onClick={saveQuote} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{selected ? 'Update' : 'Save'} Quote</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationsView;
