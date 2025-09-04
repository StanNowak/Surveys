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
                    console.log('📱 Page hidden - starting idle timer');
                }
            } else {
                // Page became visible - stop idle timer
                if (!this.isVisible && this.idleStartTime) {
                    const idleTime = now - this.idleStartTime;
                    this.totalIdleTime += idleTime;
                    this.isVisible = true;
                    console.log(`📱 Page visible - added ${idleTime}ms idle time (total: ${this.totalIdleTime}ms)`);
                }
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Also track focus/blur for additional idle detection
        window.addEventListener('blur', () => {
            if (this.isVisible) {
                this.idleStartTime = Date.now();
                this.isVisible = false;
                console.log('🔍 Window blur - starting idle timer');
            }
        });
        
        window.addEventListener('focus', () => {
            if (!this.isVisible && this.idleStartTime) {
                const idleTime = Date.now() - this.idleStartTime;
                this.totalIdleTime += idleTime;
                this.isVisible = true;
                console.log(`🔍 Window focus - added ${idleTime}ms idle time (total: ${this.totalIdleTime}ms)`);
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
        console.log(`⏱️  Started timing for: ${questionName}`);
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
            console.log(`⏱️  Completed timing for: ${questionName} (${responseTime}ms)`);
            return responseTime;
        }
        
        console.warn(`⚠️  No start time found for: ${questionName}`);
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
     * Reset all timing data
     */
    reset() {
        this.startTimes.clear();
        this.totalIdleTime = 0;
        this.idleStartTime = null;
        this.isVisible = true;
        this.currentQuestionName = null;
        console.log('🔄 Timing data reset');
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
    
    // Check if page has actual survey questions (not just HTML elements)
    return page.elements.some(element => 
        element.type && 
        element.type !== 'html' && 
        element.name && 
        !element.name.startsWith('background_')
    );
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
    
    console.log('⏱️  Attaching timing instrumentation to survey');
    
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
                console.log(`💾 Stored timing: ${timingFieldName} = ${responseTime}ms`);
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
            console.log('🚀 Survey started - beginning timing instrumentation');
            
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
        console.log('✅ Survey completed - finalizing timing data');
        
        // End timing for last page if needed
        const currentPage = sender.currentPage;
        if (currentPage && isQuestionPage(currentPage)) {
            const questionName = extractQuestionName(currentPage, sender);
            const responseTime = timing.endTiming(questionName);
            
            if (responseTime !== null) {
                const timingFieldName = `rt_${questionName}_final`;
                sender.setValue(timingFieldName, responseTime);
                console.log(`💾 Stored final timing: ${timingFieldName} = ${responseTime}ms`);
            }
        }
        
        // Store total idle time
        const totalIdleTime = timing.getTotalIdleTime();
        sender.setValue('idle_ms', totalIdleTime);
        console.log(`💾 Stored idle time: idle_ms = ${totalIdleTime}ms`);
        
        // Log summary
        const allData = sender.data;
        const timingFields = Object.keys(allData).filter(key => key.startsWith('rt_') || key === 'idle_ms');
        console.log('📊 Timing summary:', timingFields.map(key => `${key}: ${allData[key]}ms`));
    });
    
    // Ensure clearInvisibleValues is set to 'none' to preserve timing data
    if (survey.clearInvisibleValues !== 'none') {
        console.log('🔧 Setting clearInvisibleValues to "none" to preserve timing data');
        survey.clearInvisibleValues = 'none';
    }
    
    console.log('✅ Timing instrumentation attached successfully');
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
        key.startsWith('rt_') || key === 'idle_ms'
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
