"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const scraper_1 = require("./scraper");
const excelExporter_1 = require("./excelExporter");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const downloadsDir = path_1.default.join(__dirname, "../../downloads");
if (!fs_1.default.existsSync(downloadsDir)) {
    fs_1.default.mkdirSync(downloadsDir, { recursive: true });
}
app.use("/downloads", express_1.default.static(downloadsDir));
const frontendDir = path_1.default.join(__dirname, "../../frontend");
app.use(express_1.default.static(frontendDir));
app.post("/api/scrape", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { url } = req.body || {};
    if (!url || typeof url !== "string" || url.trim() === "") {
        return res.status(400).json({ error: "Please provide a valid URL." });
    }
    try {
        const trimmedUrl = url.trim();
        if ((0, scraper_1.isGoogleSearchUrl)(trimmedUrl)) {
            const { query, startOffset, pageNumber } = (0, scraper_1.buildCleanSearchUrl)(trimmedUrl);
            console.log(`[Scrape] Google Search Page ${pageNumber} (start=${startOffset}) query="${query}"`);
            const googleResults = yield (0, scraper_1.scrapeGoogleSearchPlaces)(trimmedUrl);
            const companies = yield (0, scraper_1.enrichGoogleSearchResults)(googleResults);
            if (companies.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "No company listings found for this page. Please try again.",
                });
            }
            const { fileName } = (0, excelExporter_1.generateExcelFile)(companies, downloadsDir);
            return res.json({
                success: true,
                isMulti: true,
                pageNumber,
                startOffset,
                totalCompanies: companies.length,
                data: companies,
                downloadUrl: `/downloads/${fileName}`,
            });
        }
        else {
            console.log(`[Scrape] Single website: ${trimmedUrl}`);
            const result = yield (0, scraper_1.scrapeWebsite)(trimmedUrl);
            const { fileName } = (0, excelExporter_1.generateExcelFile)([result], downloadsDir);
            return res.json({
                success: true,
                isMulti: false,
                data: result,
                downloadUrl: `/downloads/${fileName}`,
            });
        }
    }
    catch (error) {
        console.error("Scrape error:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to scrape the URL.",
        });
    }
}));
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
