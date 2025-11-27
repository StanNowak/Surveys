// Environment configuration for the survey application
// Copy this file to env.js and modify as needed

window.__SURVEY_CONFIG__ = {
    // Survey metadata
    TITLE: "Avalanche Survey Prototype",
    
    // Data source URLs (relative to the public directory)
    // Backend API endpoints (preferred)
    BACKGROUND_URL: "/api/studies/avalanche_2025/content/background",
    BANK_URL: "/api/studies/avalanche_2025/content/item_bank",
    CONFIG_URL: "/api/studies/avalanche_2025/config",
    
    // Backend endpoints (leave empty for local-only mode)
    SAVE_URL: "",
    QUOTA_ENDPOINT: ""
};
