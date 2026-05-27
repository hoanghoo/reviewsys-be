const ExcelJS = require('exceljs');
const path = require('path');

async function run() {
  const templatePath = path.join(__dirname, '../../template/overrall.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  
  const worksheet = workbook.getWorksheet('KPI_Thang1');
  
  const members = ['User A', 'User B', 'User C', 'User D', 'User E', 'User F', 'User G'];
  const dataRowCount = 5;
  const rowsToInsert = members.length > dataRowCount ? members.length - dataRowCount : 0;
  
  if (rowsToInsert > 0) {
    worksheet.duplicateRow(6 + dataRowCount - 1, rowsToInsert, true);
  }
  
  members.forEach((member, index) => {
    const rowIndex = 6 + index;
    const row = worksheet.getRow(rowIndex);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = member;
  });
  
  await workbook.xlsx.writeFile('test_out2.xlsx');
  
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile('test_out2.xlsx');
  const ws2 = wb2.getWorksheet('KPI_Thang1');
  for(let i=6; i<6+members.length; i++) {
    console.log(`Row ${i}: ${ws2.getRow(i).getCell(1).value} - ${ws2.getRow(i).getCell(2).value}`);
  }
}
run().catch(console.error);
