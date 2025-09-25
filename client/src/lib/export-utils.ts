// CSV generation functions for browser environment
function createCSV(rows: string[][]): string {
  return rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma, newline or quote
      if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
};
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Expense, Income, Budget, ExpenseCategory } from '@shared/schema';
import { formatCurrency } from './currency-formatter';

// Helper function to format a date for export
const formatDate = (dateObj: Date | string): string => {
  const date = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  return format(date, 'MMM dd, yyyy');
};

// Helper function to create a filename with timestamp
const createFilename = (prefix: string, extension: string): string => {
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
  return `${prefix}-${timestamp}.${extension}`;
};

// Type definition for expenses with category name
export type EnrichedExpense = Expense & { category: string };

// CSV Export Functions
export const exportExpensesToCSV = (expenses: EnrichedExpense[], currency: string = 'XAF'): void => {
  const headers = ['Date', 'Description', 'Category', 'Merchant', 'Amount', 'Notes'];
  
  const rows = expenses.map(expense => [
    formatDate(expense.date),
    expense.description,
    expense.category,
    expense.merchant || '',
    formatCurrency(expense.amount, currency),
    expense.notes || ''
  ]);
  
  const csv = createCSV([headers, ...rows]);
  downloadFile(csv, createFilename('expenses', 'csv'), 'text/csv');
};

// Type definition for incomes with category name
export type EnrichedIncome = Income & { category: string };

export const exportIncomesToCSV = (incomes: EnrichedIncome[], currency: string = 'XAF'): void => {
  const headers = ['Date', 'Description', 'Category', 'Amount', 'Source', 'Notes'];
  
  const rows = incomes.map(income => [
    formatDate(income.date),
    income.description,
    income.category,
    formatCurrency(income.amount, currency),
    income.source || '',
    income.notes || ''
  ]);
  
  const csv = createCSV([headers, ...rows]);
  downloadFile(csv, createFilename('incomes', 'csv'), 'text/csv');
};

export const exportBudgetsToCSV = (budgets: Budget[], currency: string = 'XAF'): void => {
  const headers = ['Name', 'Period', 'Start Date', 'End Date', 'Allocated Amount', 'Notes'];
  
  const rows = budgets.map(budget => [
    budget.name,
    budget.period,
    formatDate(budget.startDate),
    formatDate(budget.endDate),
    formatCurrency(budget.amount, currency),
    budget.notes || ''
  ]);
  
  const csv = createCSV([headers, ...rows]);
  downloadFile(csv, createFilename('budgets', 'csv'), 'text/csv');
};

// PDF Export Functions
export const exportExpensesToPDF = (expenses: EnrichedExpense[], currency: string = 'XAF'): void => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(20);
  doc.text('Expense Report', 14, 22);
  
  // Add date range and generation info
  doc.setFontSize(12);
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
  
  const tableColumns = ['Date', 'Description', 'Category', 'Amount'];
  const tableRows = expenses.map(expense => [
    formatDate(expense.date),
    expense.description,
    expense.category,
    formatCurrency(expense.amount, currency),
  ]);
  
  autoTable(doc, {
    head: [tableColumns],
    body: tableRows,
    startY: 40,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
  });
  
  // Add total at the bottom
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${formatCurrency(total, currency)}`, 150, finalY, { align: 'right' });
  
  downloadFile(doc.output('blob'), createFilename('expenses', 'pdf'), 'application/pdf');
};

export const exportIncomesToPDF = (incomes: EnrichedIncome[], currency: string = 'XAF'): void => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(20);
  doc.text('Income Report', 14, 22);
  
  // Add date range and generation info
  doc.setFontSize(12);
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
  
  const tableColumns = ['Date', 'Description', 'Category', 'Amount'];
  const tableRows = incomes.map(income => [
    formatDate(income.date),
    income.description,
    income.category,
    formatCurrency(income.amount, currency),
  ]);
  
  autoTable(doc, {
    head: [tableColumns],
    body: tableRows,
    startY: 40,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
  });
  
  // Add total at the bottom
  const total = incomes.reduce((sum, income) => sum + income.amount, 0);
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${formatCurrency(total, currency)}`, 150, finalY, { align: 'right' });
  
  downloadFile(doc.output('blob'), createFilename('incomes', 'pdf'), 'application/pdf');
};

export const exportBudgetsToPDF = (budgets: Budget[], currency: string = 'XAF'): void => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(20);
  doc.text('Budget Report', 14, 22);
  
  // Add generation info
  doc.setFontSize(12);
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
  
  const tableColumns = ['Name', 'Period', 'Start Date', 'End Date', 'Amount'];
  const tableRows = budgets.map(budget => [
    budget.name,
    budget.period,
    formatDate(budget.startDate),
    formatDate(budget.endDate),
    formatCurrency(budget.amount, currency),
  ]);
  
  autoTable(doc, {
    head: [tableColumns],
    body: tableRows,
    startY: 40,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
  });
  
  // Add total at the bottom
  const total = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${formatCurrency(total, currency)}`, 150, finalY, { align: 'right' });
  
  downloadFile(doc.output('blob'), createFilename('budgets', 'pdf'), 'application/pdf');
};

// Helper function to download a file
const downloadFile = (content: BlobPart, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
};