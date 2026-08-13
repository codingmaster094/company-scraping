import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { ScrapeResult } from "./scraper";

export function generateExcelFile(
  results: ScrapeResult[],
  outputFolder: string
): { fileName: string; filePath: string } {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `scraped_companies_${timestamp}.xlsx`;
  const filePath = path.join(outputFolder, fileName);

  const formattedRows = results.map((item, index) => {
    const services =
      Array.isArray(item.detectedServices) && item.detectedServices.length > 0
        ? item.detectedServices.join(", ")
        : item.service || "N/A";

    return {
      "S.No": index + 1,
      "Company Name": item.companyName || "N/A",
      "Company Website": item.companyUrl || "N/A",
      "Email": item.companyEmail || "N/A",
      "Phone Number": item.companyPhone || "N/A",
      "Services / Description": services,
      "Technologies Stack": Array.isArray(item.technologies)
        ? item.technologies.join(", ")
        : "N/A",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedRows);

  worksheet["!cols"] = [
    { wch: 6 },  // S.No
    { wch: 32 }, // Company Name
    { wch: 45 }, // Company Website
    { wch: 32 }, // Email
    { wch: 22 }, // Phone Number
    { wch: 70 }, // Services
    { wch: 45 }, // Technologies
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Company_data");

  XLSX.writeFile(workbook, filePath);

  return { fileName, filePath };
}
