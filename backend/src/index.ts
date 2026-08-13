import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import {
  scrapeWebsite,
  scrapeGoogleSearchPlaces,
  enrichGoogleSearchResults,
  isGoogleSearchUrl,
  buildCleanSearchUrl,
  ScrapeResult,
} from "./scraper";
import { generateExcelFile } from "./excelExporter";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, "../../downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

app.use("/downloads", express.static(downloadsDir));

const frontendDir = path.join(__dirname, "../../frontend");
app.use(express.static(frontendDir));

app.post("/api/scrape", async (req, res) => {
  const { url } = req.body || {};

  if (!url || typeof url !== "string" || url.trim() === "") {
    return res.status(400).json({ error: "Please provide a valid URL." });
  }

  try {
    const trimmedUrl = url.trim();

    if (isGoogleSearchUrl(trimmedUrl)) {
      const { query, startOffset, pageNumber } = buildCleanSearchUrl(trimmedUrl);
      console.log(`[Scrape] Google Search Page ${pageNumber} (start=${startOffset}) query="${query}"`);

      const googleResults = await scrapeGoogleSearchPlaces(trimmedUrl);
      const companies = await enrichGoogleSearchResults(googleResults);

      if (companies.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No company listings found for this page. Please try again.",
        });
      }

      const { fileName } = generateExcelFile(companies, downloadsDir);

      return res.json({
        success: true,
        isMulti: true,
        pageNumber,
        startOffset,
        totalCompanies: companies.length,
        data: companies,
        downloadUrl: `/downloads/${fileName}`,
      });
    } else {
      console.log(`[Scrape] Single website: ${trimmedUrl}`);
      const result = await scrapeWebsite(trimmedUrl);
      const { fileName } = generateExcelFile([result], downloadsDir);

      return res.json({
        success: true,
        isMulti: false,
        data: result,
        downloadUrl: `/downloads/${fileName}`,
      });
    }
  } catch (error: any) {
    console.error("Scrape error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to scrape the URL.",
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
