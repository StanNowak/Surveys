// Environment configuration for the survey application
// Copy this file to env.js and modify as needed

// Auto-detect deployment environment
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const baseUrl = isLocalhost ? '' : window.location.origin;

window.__SURVEY_CONFIG__ = {
    // Survey metadata
    TITLE: "Avalanche Survey Prototype",
    
    // Data source URLs (works for both local and deployed)
    BACKGROUND_URL: `${baseUrl}/item-banks/background.json`,
    BANK_URL: `${baseUrl}/item-banks/bank.full.dummy.json`,
    CONFIG_URL: `${baseUrl}/item-banks/config.demo.json`,
    
    // Backend endpoints (leave empty for local-only mode)
    SAVE_URL: "",
    QUOTA_ENDPOINT: "",
    
    // Deployment info
    IS_DEPLOYED: !isLocalhost,
    BASE_URL: baseUrl
};
