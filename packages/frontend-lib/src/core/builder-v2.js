/**
 * Survey Builder V2 - Uses Core Study Engine
 * Refactored to use the new study engine architecture
 */

import { loadJSON } from './builder.js';
import { StudyEngine } from './study-engine.js';

/**
 * Survey Builder V2 - Uses Study Engine
 */
export class SurveyBuilderV2 {
    constructor(studyLogic = null) {
        this.studyLogic = studyLogic;
        this.backgroundData = null;
        this._bankData = null;
        this.configData = null;
        this.studyDefinition = null;
        this.apIntroData = null;
        this.diagnosticsData = null;
    }
    
    get bankData() {
        return this._bankData;
    }
    
    set bankData(value) {
        this._bankData = value;
    }
    
    /**
     * Load all external data
     */
    async loadData(config) {
        try {
            // Load configuration
            this.configData = await loadJSON(config.CONFIG_URL);
            
            // Load item bank
            this.bankData = await loadJSON(config.BANK_URL);
            
            // Load study definition (if provided)
            if (config.STUDY_DEFINITION_URL) {
                this.studyDefinition = await loadJSON(config.STUDY_DEFINITION_URL);
            }
            
            // Load background if enabled
            if (this.configData.background?.enabled) {
                this.backgroundData = await loadJSON(config.BACKGROUND_URL);
            }
            
            // Load AP intro if needed (check study definition or config)
            if (this.studyDefinition) {
                const hasApIntro = this.studyDefinition.sections?.some(s => s.source === 'ap_intro.json' || s.id === 'ap_intro');
                if (hasApIntro) {
                    // Use AP_INTRO_URL if provided, otherwise try to derive from BACKGROUND_URL
                    const apIntroUrl = config.AP_INTRO_URL || config.BACKGROUND_URL.replace('background.json', 'ap_intro.json');
                    try {
                        this.apIntroData = await loadJSON(apIntroUrl);
                    } catch (error) {
                        // AP Intro is optional, fail silently
                    }
                }
                
                // Load diagnostics if needed (check study definition)
                const hasDiagnostics = this.studyDefinition.sections?.some(s => s.source === 'diagnostics');
                if (hasDiagnostics) {
                    // Try to load from DIAGNOSTICS_URL or derive from BANK_URL
                    const diagnosticsUrl = config.DIAGNOSTICS_URL || config.BANK_URL.replace('item_bank', 'diagnostics');
                    try {
                        this.diagnosticsData = await loadJSON(diagnosticsUrl);
                        // Merge diagnostics into item bank for compatibility
                        if (this.bankData && !this.bankData.diagnostics) {
                            this.bankData.diagnostics = this.diagnosticsData;
                        }
                    } catch (error) {
                        // Diagnostics are optional, fail silently
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('Failed to load survey data:', error);
            throw error;
        }
    }
    
    /**
     * Build complete survey definition using Study Engine
     */
    buildSurvey(participantData = {}, assignment = null) {
        if (!this.bankData || !this.configData) {
            throw new Error('Data not loaded. Call loadData() first.');
        }
        
        // Use study definition if provided, otherwise use legacy method
        if (this.studyDefinition) {
            return this._buildWithStudyEngine(participantData, assignment);
        } else {
            // Fall back to legacy builder for backward compatibility
            // Note: _buildLegacy is async but we can't await here in sync method
            // This should only happen if study definition fails to load
            throw new Error('Study definition required for SurveyBuilderV2');
        }
    }
    
    // Expose config for compatibility
    get config() {
        return this.configData;
    }
    
    /**
     * Build survey using Study Engine
     */
    _buildWithStudyEngine(participantData, assignment) {
        // Inject background, ap_intro, and diagnostics data into itemBank for the engine
        const itemBankWithExtras = {
            ...this.bankData,
            background: this.backgroundData,
            ap_intro: this.apIntroData,
            diagnostics: this.diagnosticsData || this.bankData?.diagnostics || []
        };
        
        // Create engine with all data
        const engine = new StudyEngine(
            this.studyDefinition,
            itemBankWithExtras,
            this.configData,
            this.studyLogic
        );
        
        // Build pages from study definition
        const allPages = engine.buildSurvey(participantData, assignment);
        
        // Create survey definition
        const surveyDefinition = {
            title: window.__SURVEY_CONFIG__?.TITLE || "Avalanche Survey",
            description: "Please answer all questions to the best of your ability.",
            pages: allPages,
            clearInvisibleValues: "none",
            showQuestionNumbers: "off",
            showProgressBar: this.configData.ui?.progress_bar ? "top" : "off",
            goNextPageAutomatic: this.configData.ui?.auto_advance || false,
            showNavigationButtons: true, // Always show buttons (even with auto-advance as fallback)
            showPrevButton: true,
            enableHTML: true // Enable HTML rendering globally
        };
        
        return surveyDefinition;
    }
    
    /**
     * Legacy build method (for backward compatibility)
     */
    async _buildLegacy() {
        // Import legacy builder
        const { SurveyBuilder } = await import('./builder.js');
        const legacyBuilder = new SurveyBuilder(this.studyLogic);
        legacyBuilder.backgroundData = this.backgroundData;
        legacyBuilder.bankData = this.bankData;
        legacyBuilder.configData = this.configData;
        return legacyBuilder.buildSurvey();
    }
}

