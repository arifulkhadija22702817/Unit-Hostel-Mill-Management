import * as XLSX from 'xlsx';

export function exportToExcel(filename: string, sheetName: string, dataRows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function triggerPrint() {
  window.print();
}
