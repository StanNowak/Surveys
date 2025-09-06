// Environment configuration for the survey application
// Copy this file to env.js and modify as needed

// Auto-detect deployment environment
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isGitHubPages = window.location.hostname === 'stannowak.github.io';
const baseUrl = isLocalhost ? '' : (isGitHubPages ? '/Surveys' : window.location.origin);

window.__SURVEY_CONFIG__ = {
    TITLE: "Avalanche Canada - Avalanche Problems Research",
    BANK_URL: `${baseUrl}/item-banks/bank.demo.json`,
    CONFIG_URL: `${baseUrl}/item-banks/config.demo.json`,
    BACKGROUND_URL: `${baseUrl}/item-banks/background.json`,

    MODE: "test",                 // "test" | "prod"
    SURVEY_ID: "avalanche_canada_ap_v1",

    // Leave empty in Pages/Netlify to stay client-only (JSON download only)
    ASSIGN_URL: "",
    SAVE_URL:   "",

    // field name where we store derived experience band
    STRATUM_FROM_FIELD: "experience_band"
};
