function formatAmount(amount = 0, symbol = 'Rs.') {
  return `${symbol} ${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function buildAccountingSuggestions(metrics, context = {}) {
  const suggestions = [];
  const currency = context.currencySymbol || 'Rs.';

  if ((metrics.overdueReceivables || 0) > 0) {
    suggestions.push({
      id: 'receivable-followup',
      priority: 'high',
      area: 'Accounts Receivable',
      title: 'Overdue customer collections need immediate follow-up',
      detail: `${formatAmount(metrics.overdueReceivables, currency)} is overdue. Prioritize statements, reminders, and credit controls before releasing fresh dispatches.`,
      action: 'Review overdue invoices and trigger collection plan'
    });
  }

  if ((metrics.payablesNext7Days || 0) > (metrics.availableCash || 0)) {
    suggestions.push({
      id: 'cash-coverage',
      priority: 'high',
      area: 'Cash Flow',
      title: 'Upcoming payables exceed visible cash coverage',
      detail: `Next 7 day payables are ${formatAmount(metrics.payablesNext7Days, currency)} against available cash of ${formatAmount(metrics.availableCash, currency)}.`,
      action: 'Stage payments, accelerate collections, or move working capital'
    });
  }

  if ((metrics.inputTax || 0) > (metrics.outputTax || 0)) {
    suggestions.push({
      id: 'itc-monitor',
      priority: 'medium',
      area: 'GST / ITC',
      title: 'Input tax currently exceeds output tax',
      detail: `Potential credit carry-forward of ${formatAmount((metrics.inputTax || 0) - (metrics.outputTax || 0), currency)}. Reconcile vendor bills and GSTR data before claiming benefit.`,
      action: 'Verify ITC-eligible purchase bills and matching records'
    });
  }

  if ((metrics.productsWithoutHsn || 0) > 0) {
    suggestions.push({
      id: 'hsn-compliance',
      priority: 'medium',
      area: 'GST Compliance',
      title: 'Some catalogue items are missing HSN/SAC information',
      detail: `${metrics.productsWithoutHsn} product records do not have HSN/SAC codes, which can weaken invoice quality and GST reporting accuracy.`,
      action: 'Complete tax masters before issuing the next invoices'
    });
  }

  if ((metrics.unpostedJournals || 0) > 0) {
    suggestions.push({
      id: 'posting-discipline',
      priority: 'medium',
      area: 'General Ledger',
      title: 'Draft journals are waiting for review',
      detail: `${metrics.unpostedJournals} journal entries are still in draft or pending approval. This can distort live P&L and balance sheet visibility.`,
      action: 'Approve or reverse pending journals before close'
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      id: 'healthy-books',
      priority: 'low',
      area: 'Financial Control',
      title: 'Books look stable from the current accounting snapshot',
      detail: 'No material exceptions were detected from receivables, payables, GST, or journal status. Continue daily reconciliation and month-end review.',
      action: 'Keep the close calendar and reconciliations current'
    });
  }

  return suggestions;
}

export function answerAccountingQuestion(question, metrics, context = {}) {
  const normalized = `${question || ''}`.toLowerCase();
  const currency = context.currencySymbol || 'Rs.';

  if (!normalized.trim()) {
    return 'Ask about GST, receivables, payables, journals, cash flow, or depreciation and the advisor will respond from the current books.';
  }

  if (normalized.includes('gst') || normalized.includes('itc') || normalized.includes('tax')) {
    const netTax = (metrics.outputTax || 0) - (metrics.inputTax || 0);
    if (netTax > 0) {
      return `Output tax is currently higher than input tax by ${formatAmount(netTax, currency)}. Review invoice tax splits, reconcile vendor credits before filing, and verify HSN/SAC and place-of-supply classification before GSTR submission.`;
    }
    return `Input tax is currently ahead of output tax by ${formatAmount(Math.abs(netTax), currency)}. Focus on vendor invoice matching, ITC eligibility, and documentary completeness before treating the balance as usable credit.`;
  }

  if (normalized.includes('cash') || normalized.includes('bank') || normalized.includes('liquidity')) {
    return `Visible cash is ${formatAmount(metrics.availableCash || 0, currency)} and near-term payables are ${formatAmount(metrics.payablesNext7Days || 0, currency)}. Keep collection calls tight, avoid bunching vendor releases, and post bank transactions daily so the forecast stays credible.`;
  }

  if (normalized.includes('receivable') || normalized.includes('collection') || normalized.includes('customer')) {
    return `Outstanding receivables are ${formatAmount(metrics.receivablesOutstanding || 0, currency)} with overdue balances of ${formatAmount(metrics.overdueReceivables || 0, currency)}. Prioritize oldest invoices first, link collections to exact invoices, and enforce customer credit discipline before dispatching new material.`;
  }

  if (normalized.includes('payable') || normalized.includes('vendor') || normalized.includes('tds')) {
    return `Outstanding payables are ${formatAmount(metrics.payablesOutstanding || 0, currency)}. Sequence payments by due date, discount opportunity, and operational criticality, and confirm TDS/GST treatment before releasing large vendor payments.`;
  }

  if (normalized.includes('depreciation') || normalized.includes('asset')) {
    return `Fixed assets on the books currently stand at ${formatAmount(metrics.assetBase || 0, currency)} gross value. Keep capitalization separate from repairs, review useful life periodically, and ensure depreciation journals are posted consistently at month-end.`;
  }

  if (normalized.includes('journal') || normalized.includes('ledger') || normalized.includes('gl')) {
    return `The general ledger should remain the single source of truth. Use automated postings wherever possible, keep manual journals exception-based, and clear ${metrics.unpostedJournals || 0} pending journals so reporting stays dependable.`;
  }

  return 'The advisor is most useful when the question is tied to GST, receivables, payables, cash flow, journals, or assets. Ask in that form and it will respond from the accounting data currently available.';
}
