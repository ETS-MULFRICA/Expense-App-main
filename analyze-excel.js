import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the Excel file
const filePath = path.join(__dirname, 'attached_assets', 'Copy of Annual budget.xlsx');

try {
  // Read the Excel file
  const workbook = xlsx.readFile(filePath);
  
  // Get list of sheet names
  const sheetNames = workbook.SheetNames;
  
  console.log('Excel file analysis:');
  console.log('===================');
  console.log(`Total sheets: ${sheetNames.length}`);
  console.log('===================\n');
  
  // Object to store extracted categories
  const extractedData = {
    expenseCategories: [],
    expenseSubcategories: {},
    incomeCategories: [],
    incomeSubcategories: {},
    months: [],
    timeFormat: 'monthly' // Default assumption
  };
  
  // Analyze each sheet
  sheetNames.forEach(sheetName => {
    console.log(`\nSheet: ${sheetName}`);
    console.log('------------------------');
    
    // Get the worksheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON for easier analysis
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Get dimensions of the sheet
    const rows = jsonData.length;
    const maxCols = Math.max(...jsonData.map(row => row.length));
    
    console.log(`Dimensions: ${rows} rows × ${maxCols} columns`);
    
    // Sample the first few rows to understand structure
    console.log('First 10 rows sample:');
    jsonData.slice(0, 10).forEach((row, idx) => {
      console.log(`Row ${idx + 1}: ${JSON.stringify(row)}`);
    });
    
    // Extract specific data based on sheet type
    if (sheetName.toLowerCase() === 'expenses') {
      // Extract expense categories and subcategories
      let currentMainCategory = null;
      
      for (let i = 3; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        // Check if this is a main category (typically the first column is filled)
        if (row[0] && row[0] !== null && row[0] !== '') {
          currentMainCategory = row[0];
          extractedData.expenseCategories.push(currentMainCategory);
          extractedData.expenseSubcategories[currentMainCategory] = [];
        } 
        // Check if this is a subcategory (typically the third column is filled)
        else if (currentMainCategory && row[2] && row[2] !== null && row[2] !== '') {
          extractedData.expenseSubcategories[currentMainCategory].push(row[2]);
        }
      }
      
      // Extract month columns (typically starting at index 3)
      const headerRow = jsonData.find(row => row && row.some(cell => cell === 'Expenses'));
      if (headerRow) {
        // Extract what appear to be month columns
        // Excel uses numbers for dates, starting after the 'Expenses' column
        const expensesIndex = headerRow.indexOf('Expenses');
        if (expensesIndex !== -1) {
          // Get the columns that seem to be dates (looking at positions after 'Expenses')
          const dateCols = headerRow.slice(expensesIndex + 1);
          // Filter to exclude the 'Total' and 'Average' columns that typically come at the end
          const filteredDateCols = dateCols.filter(col => 
            typeof col === 'number' || 
            (typeof col === 'string' && !['total', 'average'].includes(col.toLowerCase()))
          );
          
          if (filteredDateCols.length > 0) {
            extractedData.months = filteredDateCols;
            // If we have 12 columns, it's likely monthly data
            if (filteredDateCols.length === 12) {
              extractedData.timeFormat = 'monthly';
            } else if (filteredDateCols.length === 4) {
              extractedData.timeFormat = 'quarterly';
            } else if (filteredDateCols.length > 12) {
              extractedData.timeFormat = 'daily or weekly';
            }
          }
        }
      }
    } 
    else if (sheetName.toLowerCase() === 'income') {
      // Extract income categories and subcategories
      let currentMainCategory = null;
      
      for (let i = 3; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        // Check if this is a main category
        if (row[0] && row[0] !== null && row[0] !== '') {
          currentMainCategory = row[0];
          extractedData.incomeCategories.push(currentMainCategory);
          extractedData.incomeSubcategories[currentMainCategory] = [];
        } 
        // Check if this is a subcategory
        else if (currentMainCategory && row[2] && row[2] !== null && row[2] !== '') {
          extractedData.incomeSubcategories[currentMainCategory].push(row[2]);
        }
      }
    }
    
    // Look for calculations or formulas
    const formulaInfo = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false });
    const hasFormulas = formulaInfo.some(row => 
      row.some(cell => typeof cell === 'string' && cell.startsWith('='))
    );
    
    console.log(`\nContains formulas/calculations: ${hasFormulas ? 'Yes' : 'No'}`);
    
    // Try to determine sheet purpose 
    let sheetPurpose = 'Unknown';
    
    if (sheetName.toLowerCase() === 'expenses') {
      sheetPurpose = 'Expense Tracking';
    } else if (sheetName.toLowerCase() === 'income') {
      sheetPurpose = 'Income Tracking';
    } else if (sheetName.toLowerCase() === 'summary') {
      sheetPurpose = 'Budget Summary and Analysis';
    } else if (sheetName.toLowerCase() === 'setup') {
      sheetPurpose = 'Budget Configuration';
    }
    
    console.log(`Sheet purpose: ${sheetPurpose}`);
    console.log('------------------------');
  });
  
  // Output the structured data we extracted
  console.log('\n\nEXTRACTED BUDGET STRUCTURE:');
  console.log('===========================');
  console.log(`Time tracking format: ${extractedData.timeFormat}`);
  
  // Convert to JSON for more compact viewing
  const structuredOutput = {
    expenseCategories: {},
    incomeCategories: {}
  };
  
  // Add all expense categories and subcategories
  extractedData.expenseCategories.forEach(category => {
    structuredOutput.expenseCategories[category] = 
      extractedData.expenseSubcategories[category] || [];
  });
  
  // Add all income categories and subcategories
  extractedData.incomeCategories.forEach(category => {
    structuredOutput.incomeCategories[category] = 
      extractedData.incomeSubcategories[category] || [];
  });
  
  // Output structured data to a file
  fs.writeFileSync('budget-analysis.json', JSON.stringify(structuredOutput, null, 2));
  console.log("Budget structure extracted and saved to budget-analysis.json");
  
  // Suggest features based on the Excel structure
  console.log('\nSUGGESTED FEATURES BASED ON EXCEL STRUCTURE:');
  console.log('===========================================');

  console.log('1. Hierarchical expense categorization (main categories with subcategories)');
  console.log('2. Income tracking with categories');
  console.log('3. Monthly budget planning and tracking');
  console.log('4. Summary dashboard with totals and averages');
  console.log('5. Budget setup and configuration options');
  
  // Check if we need specific features based on categories found
  const allExpenseCategories = extractedData.expenseCategories.join(' ').toLowerCase();
  if (allExpenseCategories.includes('investment') || allExpenseCategories.includes('saving')) {
    console.log('6. Investment and savings tracking');
  }
  
  if (allExpenseCategories.includes('debt') || allExpenseCategories.includes('loan') || allExpenseCategories.includes('credit')) {
    console.log('7. Debt and loan payment tracking');
  }
  
  if (allExpenseCategories.includes('business') || allExpenseCategories.includes('freelance')) {
    console.log('8. Business expense tracking with tax categorization');
  }
  
} catch (error) {
  console.error('Error analyzing Excel file:', error.message);
}