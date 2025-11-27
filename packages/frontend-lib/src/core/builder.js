/**
 * Survey Builder Module
 * Loads external data and constructs SurveyJS survey definition
 */

/**
 * Load JSON data from URL
 */
async function loadJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        throw new Error(`Failed to load ${url}: ${error.message}`);
    }
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Select items from testlet
 * @param {Object} testlet - Testlet object with items
 * @param {boolean} randomizeWithinBlock - Whether to randomize order
 * @returns {Array} Selected items (all items, randomized if requested)
 * 
 * Note: No longer filters by construct - all items in block are used.
 * Construct is now just metadata for analysis.
 */
function selectItemsFromTestlet(testlet, randomizeWithinBlock = true) {
    const items = testlet.items || [];
    
    // Randomize order within block if requested
    return randomizeWithinBlock ? shuffleArray([...items]) : items;
}

/**
 * Convert question to SurveyJS format
 * Handles both multiple choice (radiogroup) and matrix-type questions
 */
/**
 * Strip HTML tags from text
 */
function stripHTML(text) {
    if (!text || typeof text !== 'string') return text;
    // Replace <br> and <br/> with newline, then strip all other HTML tags
    return text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

function questionToSurveyJS(question, pagePerQuestion = true) {
    // Strip HTML from question stem
    const cleanStem = stripHTML(question.stem);
    
    // Handle matrix-type questions (for diagnostics)
    if (question.type === "matrix") {
        const rows = question.rows || [];
        const columns = question.columns || [];
        
        return {
            type: "matrix",
            name: question.id,
            title: cleanStem,
            enableHTML: false,
            columns: columns.map(col => ({
                value: col.value,
                text: stripHTML(col.text),
                enableHTML: false
            })),
            rows: rows.map(row => ({
                value: row.value,
                text: stripHTML(row.text),
                enableHTML: false
            })),
            isRequired: true,
            explanation: question.explain,
            construct: question.construct
        };
    }
    
    // Handle regular multiple choice questions
    if (!question.choices || !Array.isArray(question.choices)) {
        // Question missing choices array, fallback to text input
        return {
            type: "text",
            name: question.id,
            title: cleanStem || "Question",
            isRequired: false,
            explanation: question.explain,
            construct: question.construct,
            enableHTML: false
        };
    }
    
    const surveyQuestion = {
        type: "radiogroup",
        name: question.id,
        title: cleanStem,
        enableHTML: false, // No HTML - we stripped it
        choices: question.choices.map(choice => ({
            value: choice.value,
            text: stripHTML(choice.text),
            enableHTML: false
        })),
        isRequired: true,
        correctAnswer: question.key,
        colCount: 1 // Vertical layout (1 = single column per SurveyJS docs)
    };
    
    surveyQuestion.explanation = question.explain;
    surveyQuestion.construct = question.construct;
    
    return surveyQuestion;
}

/**
 * Build survey pages from selected content (Legacy method - kept for compatibility)
 * New code should use StudyEngine instead
 */
function buildSurveyPages(backgroundData, selectedTestlets, diagnostics, config) {
    const pages = [];
    
    // Add background pages if enabled
    if (config.background.enabled && backgroundData) {
        if (config.background.splitOnePerPage) {
            // Split background into individual pages
            for (const page of backgroundData.pages) {
                pages.push({
                    name: `background_${page.name}`,
                    title: page.title,
                    elements: page.elements
                });
            }
        } else {
            // Add all background pages as provided
            pages.push(...backgroundData.pages.map(page => ({
                ...page,
                name: `background_${page.name}`
            })));
        }
    }
    
    // Add testlet pages (all items, no construct filtering)
    for (let i = 0; i < selectedTestlets.length; i++) {
        const testlet = selectedTestlets[i];
        const testletItems = selectItemsFromTestlet(testlet, config.routing.randomize_within_block);
        
        if (config.ui.one_question_per_page) {
            // Create one page per question
            for (let j = 0; j < testletItems.length; j++) {
                const question = testletItems[j];
                pages.push({
                    name: `${testlet.ap_type}_question_${j}`,
                    title: testlet.label,
                    elements: [questionToSurveyJS(question)]
                });
            }
        } else {
            // Create one page per testlet
            pages.push({
                name: `${testlet.ap_type}_page`,
                title: testlet.label,
                elements: testletItems.map(question => questionToSurveyJS(question))
            });
        }
    }
    
    // Add diagnostic pages if enabled
    if (config.routing.include_diagnostics && diagnostics && diagnostics.length > 0) {
        if (config.ui.one_question_per_page) {
            // Create one page per diagnostic
            for (const diagnostic of diagnostics) {
                pages.push({
                    name: `diagnostic_${diagnostic.id}_page`,
                    title: "Assessment Questions",
                    elements: [questionToSurveyJS(diagnostic)]
                });
            }
        } else {
            // Create one page for all diagnostics
            pages.push({
                name: "diagnostics_page",
                title: "Assessment Questions",
                elements: diagnostics.map(diagnostic => questionToSurveyJS(diagnostic))
            });
        }
    }
    
    return pages;
}

/**
 * Main survey builder class
 */
class SurveyBuilder {
    constructor(logic = null) {
        this.logic = logic;
        this.backgroundData = null;
        this.bankData = null;
        this.configData = null;
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
            
            // Load background if enabled
            if (this.configData.background.enabled) {
                this.backgroundData = await loadJSON(config.BACKGROUND_URL);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to load survey data:', error);
            throw error;
        }
    }
    
    /**
     * Select testlets using configured logic
     */
    selectTestlets() {
        if (!this.bankData || !this.configData) {
            throw new Error('Data not loaded. Call loadData() first.');
        }
        
        const availableTestlets = [...this.bankData.testlets];
        const blocksToSelect = Math.min(this.configData.routing.blocks_to_draw, availableTestlets.length);
        
        let selectedTestlets;
        
        // Use custom logic if provided
        if (this.logic && typeof this.logic.selectBlocks === 'function') {
            selectedTestlets = this.logic.selectBlocks(availableTestlets, blocksToSelect);
        } else {
            // Default: uniform random selection
            const shuffled = shuffleArray(availableTestlets);
            selectedTestlets = shuffled.slice(0, blocksToSelect);
        }
        
        // Randomize order if configured
        if (this.configData.routing.randomize_blocks) {
            selectedTestlets = shuffleArray(selectedTestlets);
        }
        
        return selectedTestlets;
    }
    
    /**
     * Build complete survey definition
     */
    buildSurvey() {
        if (!this.bankData || !this.configData) {
            throw new Error('Data not loaded. Call loadData() first.');
        }
        
        // Apply custom logic hooks
        if (this.logic && typeof this.logic.onInit === 'function') {
            this.logic.onInit(this.bankData, this.configData, this.backgroundData);
        }
        
        // Select testlets
        const selectedTestlets = this.selectTestlets();
        
        // Get diagnostics
        const diagnostics = this.bankData.diagnostics || [];
        
        // Build pages
        const pages = buildSurveyPages(
            this.backgroundData,
            selectedTestlets,
            diagnostics,
            this.configData
        );
        
        // Create survey definition
        const surveyDefinition = {
            title: window.__SURVEY_CONFIG__?.TITLE || "Avalanche Survey",
            description: "Please answer all questions to the best of your ability.",
            pages: pages,
            clearInvisibleValues: "none",
            showQuestionNumbers: "off",
            showProgressBar: this.configData.ui.progress_bar ? "top" : "off",
            goNextPageAutomatic: this.configData.ui.auto_advance || false,
            showNavigationButtons: true, // Always show buttons (even with auto-advance as fallback)
            showPrevButton: true,
            enableHTML: true // Enable HTML rendering globally
        };
        
        // Apply custom logic hooks
        if (this.logic && typeof this.logic.beforeRender === 'function') {
            this.logic.beforeRender(surveyDefinition);
        }
        
        return surveyDefinition;
    }
}

// Export for use in other modules
window.SurveyBuilder = SurveyBuilder;

// ES module export
export { SurveyBuilder, loadJSON, shuffleArray, selectItemsFromTestlet, questionToSurveyJS, buildSurveyPages };
