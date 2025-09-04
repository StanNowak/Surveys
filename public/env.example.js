// Environment configuration for the survey application
// Copy this file to env.js and modify as needed

window.__SURVEY_CONFIG__ = {
    // Survey metadata
    TITLE: "Avalanche Survey Prototype",
    
    // Data source URLs (relative to the public directory)
    BACKGROUND_URL: "/item-banks/background.json",
    BANK_URL: "/item-banks/bank.demo.json",
    CONFIG_URL: "/item-banks/config.demo.json",
    
    // Backend endpoints (leave empty for local-only mode)
    SAVE_URL: "",
    QUOTA_ENDPOINT: ""
};
