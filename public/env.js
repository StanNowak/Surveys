// Environment configuration for the survey application
// Copy this file to env.js and modify as needed

// Auto-detect deployment environment
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isGitHubPages = window.location.hostname === 'stannowak.github.io';
const baseUrl = isLocalhost ? '' : (isGitHubPages ? '/Surveys' : window.location.origin);

window.__SURVEY_CONFIG__ = {
    TITLE: "Avalanche Canada - Avalanche Problems Research",
    // Backend API endpoints (preferred - served from study content)
    BANK_URL: `${baseUrl}/api/studies/avalanche_2025/content/item_bank`,
    CONFIG_URL: `${baseUrl}/api/studies/avalanche_2025/config`,
    BACKGROUND_URL: `${baseUrl}/api/studies/avalanche_2025/content/background`,
    AP_INTRO_URL: `${baseUrl}/api/studies/avalanche_2025/content/ap_intro`,
    DIAGNOSTICS_URL: `${baseUrl}/api/studies/avalanche_2025/content/diagnostics`,
    STUDY_DEFINITION_URL: `${baseUrl}/packages/frontend-lib/src/studies/avalanche_2025/study-definition.json`,

    MODE: "test",                 // "test" | "prod"
    SURVEY_ID: "avalanche_canada_ap_v1",

    // Leave empty in Pages/Netlify to stay client-only (JSON download only)
    ASSIGN_URL: "",
    SAVE_URL:   "",

    // field name where we store derived experience band
    STRATUM_FROM_FIELD: "experience_band"
};
