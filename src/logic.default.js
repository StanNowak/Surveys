/**
 * Default Logic Module
 * Provides hooks for customizing survey behavior while maintaining defaults
 */

/**
 * Default survey logic with customizable hooks
 */
class DefaultSurveyLogic {
    constructor() {
        this.name = "Default Logic";
        this.version = "1.0.0";
    }
    
    /**
     * Hook: Called when survey data is initialized
     * @param {Object} bankData - Item bank data
     * @param {Object} configData - Configuration data
     * @param {Object} backgroundData - Background questionnaire data
     */
    onInit(bankData, configData, backgroundData) {
    }
    
    /**
     * Hook: Select which testlet blocks to include in the survey
     * Default: Uniform random selection
     * @param {Array} availableTestlets - All available testlets
     * @param {number} blocksToSelect - Number of blocks to select
     * @returns {Array} Selected testlets
     */
    selectBlocks(availableTestlets, blocksToSelect) {
        
        // Shuffle and select
        const shuffled = this.shuffleArray([...availableTestlets]);
        const selected = shuffled.slice(0, blocksToSelect);
        
        return selected;
    }
    
    /**
     * Hook: Select which items to include from a testlet
     * Default: One item per construct, randomly selected if multiple available
     * @param {Object} testlet - The testlet to select from
     * @param {boolean} randomizeOrder - Whether to randomize the order
     * @returns {Array} Selected items
     */
    selectItems(testlet, randomizeOrder = true) {
        const constructs = ['development', 'behaviour', 'assessment', 'mitigation'];
        const selectedItems = [];
        
        for (const construct of constructs) {
            const constructItems = testlet.items.filter(item => item.construct === construct);
            
            if (constructItems.length > 0) {
                // Random selection if multiple items available
                const randomIndex = Math.floor(Math.random() * constructItems.length);
                selectedItems.push(constructItems[randomIndex]);
            }
        }
        
        // Randomize order if requested
        return randomizeOrder ? this.shuffleArray(selectedItems) : selectedItems;
    }
    
    /**
     * Hook: Called before survey is rendered
     * @param {Object} surveyDefinition - Complete survey definition
     */
    beforeRender(surveyDefinition) {
        
        // Add any last-minute modifications here
        // For example, could add custom CSS classes, modify titles, etc.
    }
    
    /**
     * Hook: Called when survey is completed and graded
     * @param {Object} surveyModel - SurveyJS model instance
     * @param {Object} results - Grading results
     */
    onGrade(surveyModel, results) {
        
        // Could implement custom scoring logic here
        return results;
    }
    
    /**
     * Hook: Called when survey is completed
     * @param {Object} surveyModel - SurveyJS model instance
     * @param {Object} responseData - Complete response data
     */
    onComplete(surveyModel, responseData) {
        
        // Could implement custom completion logic here
        // For example, custom data transformation, additional metadata, etc.
    }
    
    /**
     * Utility: Shuffle array using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled copy of array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    /**
     * Utility: Generate UUID for response tracking
     * @returns {string} UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * Utility: Get current timestamp in ISO format
     * @returns {string} ISO timestamp
     */
    getCurrentTimestamp() {
        return new Date().toISOString();
    }
}

/**
 * Create and export default logic instance
 */
const defaultLogic = new DefaultSurveyLogic();

// Make available globally for easy access
window.DefaultSurveyLogic = DefaultSurveyLogic;
window.defaultSurveyLogic = defaultLogic;

// Export default instance
export default defaultLogic;
