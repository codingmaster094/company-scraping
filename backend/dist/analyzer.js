"use strict";
/**
 * Strict analyzer entry: services/tech come only from extractVerified.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeContent = analyzeContent;
exports.detectServices = detectServices;
exports.detectTechnologies = detectTechnologies;
const { extractVerified } = require("./strictExtract");

function analyzeContent(options) {
    return extractVerified({
        mainHtml: options.mainHtml,
        servicePageHtmls: options.servicePageHtmls,
        headerText: options.headerText,
    });
}
function detectServices(options) {
    return analyzeContent(options).services;
}
function detectTechnologies(options) {
    return analyzeContent(options).technologies;
}
