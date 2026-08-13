const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
}

/**
 * @param {Array<object>} data - The array of scraped company data.
 * @param {string} [fileBase] - Optional stable name (e.g. scrape-in-progress) so Export can download mid-scrape.
 * @returns {Promise<object>} - An object with paths to the exported files.
 */
async function exportData(data, fileBase) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fileBase = fileBase || `scrape-results-${timestamp}`;

    const records = data.map(d => {
        const companyName = d.name || d.companyName || d.title || '';
        const website = d.websiteUrl || d.companyUrl || d.website || d.url || '';
        const email = Array.isArray(d.emails)
            ? d.emails.join(', ')
            : d.companyEmail || d.email || '';
        const phone = Array.isArray(d.phoneNumbers)
            ? d.phoneNumbers.join(', ')
            : d.companyPhone || d.phone || '';
        let servicesArr = [];
        if (Array.isArray(d.detectedServices) && d.detectedServices.length > 0) {
            servicesArr = d.detectedServices;
        } else if (Array.isArray(d.services) && d.services.length > 0) {
            servicesArr = d.services;
        } else if (typeof d.services === 'string' && d.services) {
            servicesArr = d.services.split(',').map(s => s.trim());
        } else if (typeof d.service === 'string' && d.service) {
            servicesArr = d.service.split(',').map(s => s.trim());
        }
        const services = servicesArr.join(', ');
        const techStack = Array.isArray(d.technologies)
            ? d.technologies.join(', ')
            : d.techStack || '';

        return {
            companyName,
            website,
            email,
            phone,
            services,
            techStack,
        };
    });

    const csvPath = await exportToCsv(records, fileBase);
    const excelPath = await exportToExcel(records, fileBase);
    const jsonPath = await exportToJson(data, fileBase);

    return {
        csv: path.basename(csvPath),
        excel: path.basename(excelPath),
        json: path.basename(jsonPath),
    };
}

async function exportToCsv(records, fileBase) {
    const filePath = path.join(exportsDir, `${fileBase}.csv`);
    const csvWriter = createCsvWriter({
        path: filePath,
        header: [
            { id: 'companyName', title: 'Company Name' },
            { id: 'website', title: 'Website' },
            { id: 'email', title: 'Email' },
            { id: 'phone', title: 'Phone' },
            { id: 'services', title: 'Services' },
            { id: 'techStack', title: 'Tech Stack' },
        ],
    });

    await csvWriter.writeRecords(records);
    return filePath;
}

async function exportToExcel(records, fileBase) {
    const filePath = path.join(exportsDir, `${fileBase}.xlsx`);
    const columns = [
        { id: 'companyName', title: 'Company Name' },
        { id: 'website', title: 'Website' },
        { id: 'email', title: 'Email' },
        { id: 'phone', title: 'Phone' },
        { id: 'services', title: 'Services' },
        { id: 'techStack', title: 'Tech Stack' },
    ];

    const headerKeys = columns.map(col => col.id);
    const headerTitles = columns.map(col => col.title);

    const worksheet = xlsx.utils.json_to_sheet(records, {
        header: headerKeys,
        skipHeader: true,
    });

    xlsx.utils.sheet_add_aoa(worksheet, [headerTitles], { origin: 'A1' });

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Company_data');
    xlsx.writeFile(workbook, filePath);
    return filePath;
}

async function exportToJson(data, fileBase) {
    const filePath = path.join(exportsDir, `${fileBase}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
}

module.exports = { exportData, exportsDir };
