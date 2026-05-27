const ExcelJS = require('exceljs');
const path = require('path');

async function run() {
  const templatePath = path.join(__dirname, '../../template/overrall.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  
  const worksheet = workbook.getWorksheet('KPI_Thang1');
  
  // Need 7 rows. Template has 5.
  const dataRowCount = 5;
  const targetRows = 7;
  const rowsToInsert = targetRows - dataRowCount;
  
  if (rowsToInsert > 0) {
    worksheet.duplicateRow(6 + dataRowCount - 1, rowsToInsert, true);
  }
  
  for (let i = 0; i < targetRows; i++) {
    const row = worksheet.getRow(6 + i);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = 'User ' + (i + 1);
    row.getCell(3).value = 10;
    row.getCell(4).value = 10;
    row.getCell(6).value = 0;
    row.getCell(7).value = 0;
  }
  
  await workbook.xlsx.writeFile('test_out.xlsx');
  console.log('Done');
}
run().catch(console.error);
