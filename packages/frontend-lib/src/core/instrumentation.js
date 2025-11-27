/**
 * Timing Instrumentation Module
 * Captures per-item response times and idle time for survey analysis
 */

/**
 * Timing data storage and management
 */
class TimingInstrument {
    constructor() {
        this.startTimes = new Map();
        this.idleStartTime = null;
        this.totalIdleTime = 0;
        this.isVisible = true;
        this.currentQuestionName = null;
        this.questionIdleTimes = new Map(); // Track idle time per question
        this.excludedFromIdle = new Set(); // Questions to exclude from idle time tracking
        
        // Set up visibility change listener for idle time tracking
        this.setupIdleTracking();
    }
    
    /**
     * Set up idle time tracking using document visibility API
     */
    setupIdleTracking() {
        const handleVisibilityChange = () => {
            const now = Date.now();
            
            if (document.hidden) {
                // Page became hidden - start idle timer
                if (this.isVisible) {
                    this.idleStartTime = now;
                    this.isVisible = false;
                    const isExcluded = this.currentQuestionName && 
                        (this.isExcludedFromIdle(this.currentQuestionName) || this.matchesExclusionPattern(this.currentQuestionName));
                    const excludedMsg = isExcluded ? ` (excluded: ${this.currentQuestionName})` : '';
                }
            } else {
                // Page became visible - stop idle timer
                if (!this.isVisible && this.idleStartTime) {
                    const idleTime = now - this.idleStartTime;
                    
                    // Only add to total idle time if current question is not excluded
                    const isExcluded = this.currentQuestionName && 
                        (this.isExcludedFromIdle(this.currentQuestionName) || this.matchesExclusionPattern(this.currentQuestionName));
                    
                    if (!isExcluded) {
                        this.totalIdleTime += idleTime;
                    } else {
                    }
                    
                    // Always track per-question idle time for analysis (regardless of exclusion)
                    if (this.currentQuestionName) {
                        const currentQuestionIdle = this.questionIdleTimes.get(this.currentQuestionName) || 0;
                        this.questionIdleTimes.set(this.currentQuestionName, currentQuestionIdle + idleTime);
                    }
                    
                    this.isVisible = true;
                }
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Also track focus/blur for additional idle detection
        window.addEventListener('blur', () => {
            if (this.isVisible) {
                this.idleStartTime = Date.now();
                this.isVisible = false;
                const excludedMsg = this.currentQuestionName && this.isExcludedFromIdle(this.currentQuestionName) 
                    ? ` (excluded: ${this.currentQuestionName})` : '';
            }
        });
        
        window.addEventListener('focus', () => {
            if (!this.isVisible && this.idleStartTime) {
                const idleTime = Date.now() - this.idleStartTime;
                
                // Only add to total idle time if current question is not excluded
                const isExcluded = this.currentQuestionName && 
                    (this.isExcludedFromIdle(this.currentQuestionName) || this.matchesExclusionPattern(this.currentQuestionName));
                
                if (!isExcluded) {
                    this.totalIdleTime += idleTime;
                } else {
                }
                
                // Always track per-question idle time for analysis (regardless of exclusion)
                if (this.currentQuestionName) {
                    const currentQuestionIdle = this.questionIdleTimes.get(this.currentQuestionName) || 0;
                    this.questionIdleTimes.set(this.currentQuestionName, currentQuestionIdle + idleTime);
                }
                
                this.isVisible = true;
            }
        });
    }
    
    /**
     * Start timing for a page/question
     */
    startTiming(questionName) {
        const now = Date.now();
        this.startTimes.set(questionName, now);
        this.currentQuestionName = questionName;
    }
    
    /**
     * End timing for a page/question and return the response time
     */
    endTiming(questionName) {
        const now = Date.now();
        const startTime = this.startTimes.get(questionName);
        
        if (startTime) {
            const responseTime = now - startTime;
            this.startTimes.delete(questionName);
            return responseTime;
        }
        
        return null;
    }
    
    /**
     * Get total idle time in milliseconds
     */
    getTotalIdleTime() {
        // If currently idle, add current idle session
        let totalIdle = this.totalIdleTime;
        if (!this.isVisible && this.idleStartTime) {
            totalIdle += Date.now() - this.idleStartTime;
        }
        return totalIdle;
    }
    
    /**
     * Get idle time for a specific question
     * @param {string} questionName - Question name
     * @returns {number} Idle time in milliseconds for this question
     */
    getQuestionIdleTime(questionName) {
        let questionIdle = this.questionIdleTimes.get(questionName) || 0;
        
        // If currently idle and on this question, add current idle session
        if (!this.isVisible && this.idleStartTime && this.currentQuestionName === questionName) {
            questionIdle += Date.now() - this.idleStartTime;
        }
        
        return questionIdle;
    }
    
    /**
     * Get all per-question idle times
     * @returns {Object} Object with question names as keys and idle times as values
     */
    getAllQuestionIdleTimes() {
        const result = {};
        
        // Add all recorded question idle times
        for (const [questionName, idleTime] of this.questionIdleTimes) {
            result[questionName] = idleTime;
        }
        
        // Add current idle time if currently idle
        if (!this.isVisible && this.idleStartTime && this.currentQuestionName) {
            const currentIdle = Date.now() - this.idleStartTime;
            result[this.currentQuestionName] = (result[this.currentQuestionName] || 0) + currentIdle;
        }
        
        return result;
    }
    
    /**
     * Exclude a question from idle time tracking
     * @param {string} questionName - Question name to exclude
     */
    excludeFromIdleTracking(questionName) {
        this.excludedFromIdle.add(questionName);
    }
    
    /**
     * Include a question in idle time tracking (remove from exclusion)
     * @param {string} questionName - Question name to include
     */
    includeInIdleTracking(questionName) {
        this.excludedFromIdle.delete(questionName);
    }
    
    /**
     * Check if a question is excluded from idle time tracking
     * @param {string} questionName - Question name to check
     * @returns {boolean} True if excluded
     */
    isExcludedFromIdle(questionName) {
        return this.excludedFromIdle.has(questionName);
    }
    
    /**
     * Exclude questions by pattern (e.g., all intro pages, demographics, etc.)
     * @param {string|RegExp} pattern - Pattern to match question names
     */
    excludeByPattern(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        
        // Note: This will only apply to future questions since we don't have 
        // a complete list of all questions at this point
        this.excludePattern = regex;
    }
    
    /**
     * Check if a question name matches the exclusion pattern
     * @param {string} questionName - Question name to check
     * @returns {boolean} True if matches exclusion pattern
     */
    matchesExclusionPattern(questionName) {
        return this.excludePattern && this.excludePattern.test(questionName);
    }
    
    /**
     * Reset all timing data
     */
    reset() {
        this.startTimes.clear();
        this.totalIdleTime = 0;
        this.idleStartTime = null;
        this.isVisible = true;
        this.currentQuestionName = null;
    }
}

/**
 * Extract question name from page name or elements
 */
function extractQuestionName(page, survey) {
    // For single-question pages, try to get the question name
    if (page.elements && page.elements.length === 1) {
        const element = page.elements[0];
        if (element.name) {
            return element.name;
        }
    }
    
    // Fallback to page name
    return page.name || 'unknown_page';
}

/**
 * Check if page contains survey questions (not background or completion pages)
 */
function isQuestionPage(page) {
    if (!page.elements || page.elements.length === 0) {
        return false;
    }
    
    // Check if page has actual survey questions
    // SurveyJS elements might not have 'type' property, so check for 'name' and exclude background
    const hasQuestion = page.elements.some(element => {
        const hasName = element.name && typeof element.name === 'string';
        const isNotBackground = !element.name?.startsWith('background_');
        const isNotIntro = !element.name?.includes('_intro');
        return hasName && isNotBackground && isNotIntro;
    });
    
    return hasQuestion;
}

/**
 * Attach timing instrumentation to a SurveyJS survey
 * @param {Survey.Model} survey - SurveyJS survey instance
 */
function attachTiming(survey) {
    if (!survey) {
        console.error('❌ Cannot attach timing: survey instance is null');
        return;
    }
    
    
    // Create timing instrument instance
    const timing = new TimingInstrument();
    
    // Store timing instance on survey for external access
    survey._timingInstrument = timing;
    
    // Track when survey starts
    let surveyStarted = false;
    
    // Handle page changes
    survey.onCurrentPageChanged.add((sender, options) => {
        const currentPage = sender.currentPage;
        const previousPage = options.oldCurrentPage;
        
        // End timing for previous page if it was a question page
        if (previousPage && isQuestionPage(previousPage)) {
            const prevQuestionName = extractQuestionName(previousPage, sender);
            const responseTime = timing.endTiming(prevQuestionName);
            
            if (responseTime !== null) {
                // Store timing data in survey with final timing field name
                const timingFieldName = `rt_${prevQuestionName}_final`;
                sender.setValue(timingFieldName, responseTime);
                
                // Store per-question idle time for analysis
                const questionIdleTime = timing.getQuestionIdleTime(prevQuestionName);
                const idleFieldName = `idle_${prevQuestionName}_ms`;
                sender.setValue(idleFieldName, questionIdleTime);
            }
        }
        
        // Start timing for new page if it's a question page
        if (currentPage && isQuestionPage(currentPage)) {
            const questionName = extractQuestionName(currentPage, sender);
            timing.startTiming(questionName);
        }
    });
    
    // Handle survey start
    survey.onAfterRenderSurvey.add((sender, options) => {
        if (!surveyStarted) {
            surveyStarted = true;
            
            // Start timing for first page if it's a question page
            const firstPage = sender.currentPage;
            if (firstPage && isQuestionPage(firstPage)) {
                const questionName = extractQuestionName(firstPage, sender);
                timing.startTiming(questionName);
            }
        }
    });
    
    // Handle survey completion
    survey.onComplete.add((sender, options) => {
        
        // End timing for last page if needed
        const currentPage = sender.currentPage;
        if (currentPage && isQuestionPage(currentPage)) {
            const questionName = extractQuestionName(currentPage, sender);
            const responseTime = timing.endTiming(questionName);
            
            if (responseTime !== null) {
                const timingFieldName = `rt_${questionName}_final`;
                sender.setValue(timingFieldName, responseTime);
            }
        }
        
        // Store total idle time
        const totalIdleTime = timing.getTotalIdleTime();
        sender.setValue('idle_ms', totalIdleTime);
        
        // Log summary
        const allData = sender.data;
        const timingFields = Object.keys(allData).filter(key => key.startsWith('rt_') || key === 'idle_ms');
    });
    
    // Ensure clearInvisibleValues is set to 'none' to preserve timing data
    if (survey.clearInvisibleValues !== 'none') {
        survey.clearInvisibleValues = 'none';
    }
    
}

/**
 * Get timing data from a survey instance
 * @param {Survey.Model} survey - SurveyJS survey instance
 * @returns {Object} Timing data object
 */
function getTimingData(survey) {
    if (!survey || !survey._timingInstrument) {
        return null;
    }
    
    const timing = survey._timingInstrument;
    const surveyData = survey.data;
    
    // Extract timing fields from survey data
    const timingFields = Object.keys(surveyData).filter(key => 
        key.startsWith('rt_') || key.startsWith('idle_') || key === 'idle_ms'
    );
    
    const timingData = {};
    timingFields.forEach(field => {
        timingData[field] = surveyData[field];
    });
    
    // Add current idle time if available
    if (timing) {
        timingData.current_idle_ms = timing.getTotalIdleTime();
    }
    
    return timingData;
}

// Export for use in other modules
window.attachTiming = attachTiming;
window.getTimingData = getTimingData;
window.TimingInstrument = TimingInstrument;

// Also export as ES module
export { attachTiming, getTimingData, TimingInstrument };
