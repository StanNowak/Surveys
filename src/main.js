// Main application entry point
// ES module for the survey application

// Import core modules from new package structure
import '../packages/frontend-lib/src/core/builder.js';
import '../packages/frontend-lib/src/core/instrumentation.js';
import { grade, renderFeedback, downloadSurveyData } from '../packages/frontend-lib/src/core/feedback.js';
import { submitResponse } from '../packages/frontend-lib/src/core/api.js';
import { deriveExperienceBand, getAssignedPair } from '../packages/frontend-lib/src/studies/avalanche_2025/logic.js';
import defaultLogic from './logic.default.js';

// Get configuration
const cfg = window.__SURVEY_CONFIG__ || {};

// Removed forceAvalancheCanadaStyling - using SurveyJS defaults

function backendEnabled() {
  return cfg.MODE === "prod" && !!cfg.ASSIGN_URL && !!cfg.SAVE_URL;
}

// Log configuration on startup
if (backendEnabled()) {
} else {
}

function downloadJSON(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename
  });
  document.body.appendChild(a); a.click(); a.remove();
}

async function onCompleteSubmit(survey, assigned) {
  const uuid = new URLSearchParams(location.search).get("uuid") || crypto.randomUUID();
  
  // Extract timing data from survey (response times and idle times)
  const timingData = window.getTimingData ? window.getTimingData(survey) : {};
  
  // Separate answers from timing data
  const answers = {};
  const timings = {};
  
  Object.keys(survey.data || {}).forEach(key => {
    if (key.startsWith('rt_') || key.startsWith('idle_') || key === 'idle_ms') {
      // Timing data goes to timings
      timings[key] = survey.data[key];
    } else if (!key.startsWith('__') && key !== 'response_uuid' && key !== 'survey_start_time') {
      // All actual survey answers (exclude internal __ fields and metadata)
      answers[key] = survey.data[key];
    }
    // Internal fields (__*) are excluded from both
  });
  
  // Merge any additional timing data from getTimingData
  Object.assign(timings, timingData);
  
  const payload = {
    uuid,
    survey_id: cfg.SURVEY_ID || "ap_v1",
    pair: assigned?.pair || survey.getValue("__assigned_pair"),
    stratum: assigned?.stratum || survey.getValue("__assigned_stratum") || "global",
    panel_member: !!survey.getValue("__panel_member"),
    bank_version: survey.getValue("__bank_version"),
    config_version: survey.getValue("__config_version"),
    answers: answers,
    timings: timings
  };

  console.log("💾 SURVEY SUBMISSION:");
  console.log("  UUID:", payload.uuid);
  console.log("  Survey ID:", payload.survey_id);
  console.log("  Final pair:", payload.pair);
  console.log("  Final stratum:", payload.stratum);
  console.log("  Panel member:", payload.panel_member);
  console.log("  Answers count:", Object.keys(payload.answers || {}).length);
  console.log("  Timings count:", Object.keys(payload.timings || {}).length);
  console.log("  Timing fields:", Object.keys(payload.timings || {}).filter(k => k.startsWith('rt_')).slice(0, 5).join(', '), "...");

  if (backendEnabled()) {
    console.log("  🌐 Submitting to BACKEND:", cfg.SAVE_URL);
    try { 
      const result = await submitResponse(cfg.SAVE_URL, payload);
      console.log("  ✅ Backend submission successful!", result);
    } catch (e) {
      console.error("  ❌ Backend submission failed:", e);
      console.error("  Error details:", e.message, e.stack);
    }
  } else {
    console.log("  🏠 Backend disabled, local download only");
  }
  
  downloadJSON(`survey_${payload.uuid}_${Date.now()}.json`, payload);
}


/**
 * Initialize the survey application
 */
async function initSurvey() {
    const container = document.getElementById('surveyContainer');
    
    if (!container) {
        console.error('Survey container not found');
        return;
    }
    
    // Show loading state
    container.innerHTML = '<div class="loading">Loading survey</div>';
    
    try {
        // Check if SurveyJS is loaded
        if (typeof Survey === 'undefined') {
            throw new Error('SurveyJS library not loaded');
        }
        
        // Check if configuration is available
        if (!window.__SURVEY_CONFIG__) {
            throw new Error('Survey configuration not found. Please copy env.example.js to env.js');
        }
        
        
        // Create survey builder - use new Study Engine if definition available
        let builder;
        let useStudyEngine = false;
        if (window.__SURVEY_CONFIG__?.STUDY_DEFINITION_URL) {
            try {
                const { SurveyBuilderV2 } = await import('../packages/frontend-lib/src/core/builder-v2.js');
                const { Avalanche2025StudyLogic } = await import('../packages/frontend-lib/src/studies/avalanche_2025/logic.js');
                builder = new SurveyBuilderV2(new Avalanche2025StudyLogic());
                useStudyEngine = true;
            } catch (error) {
                console.error('❌ Failed to load Study Engine, falling back to legacy:', error);
                console.error('Error details:', error.message, error.stack);
                builder = new window.SurveyBuilder(defaultLogic);
            }
        } else {
            builder = new window.SurveyBuilder(defaultLogic);
        }
        
        // Load external data
        await builder.loadData(window.__SURVEY_CONFIG__);
        
        // Build survey definition (assignment happens after background questions)
        const surveyDefinition = builder.buildSurvey();
        
        // Create SurveyJS model
        const survey = new Survey.Model(surveyDefinition);
        
        // Apply minimal Avalanche Canada theming - fonts and colors only
        // Don't override the entire CSS structure to avoid breaking functionality
        
        // Configure survey behavior
        survey.clearInvisibleValues = "none";
        survey.showQuestionNumbers = "off";
        
        // Enable HTML rendering globally
        survey.enableHTML = true;
        
        // Configure UI settings based on config
        if (builder.config?.ui?.auto_advance) {
            survey.goNextPageAutomatic = true;
            survey.showNavigationButtons = true; // Always show buttons as fallback
            survey.showPrevButton = true;
        } else {
            survey.showNavigationButtons = true;
            survey.showPrevButton = true;
        }
        
        // Configure progress bar
        if (builder.config?.ui?.progress_bar) {
            survey.showProgressBar = 'top';
        }
        
        // Ensure one question per page if configured
        if (builder.config?.ui?.one_question_per_page) {
        }
        
        // Attach timing instrumentation
        window.attachTiming(survey);
        
        // Set up UUID for response tracking
        const urlParams = new URLSearchParams(window.location.search);
        const uuid = urlParams.get('uuid') || defaultLogic.generateUUID();
        survey.setValue('response_uuid', uuid);
        survey.setValue('survey_start_time', defaultLogic.getCurrentTimestamp());
        
        // Store bank and config versions for backend tracking
        const bankData = builder.bankData || builder.itemBank;
        survey.setValue('__bank_version', bankData?.schema_version || 'unknown');
        survey.setValue('__config_version', builder.config?.version || builder.configData?.version || 'unknown');
        
        // Minimal styling approach - let SurveyJS handle structure, we'll just override colors/fonts
        
        // Variable to store assignment for completion
        let assignedPair = null;
        
        // Set up page change handler for pair assignment
        survey.onCurrentPageChanged.add(async function(sender, options) {
            
            // Check if we just completed the background section and need to assign pairs
            // This happens after background section, before experimental blocks
            const currentPageName = sender.currentPage?.name || '';
            const previousPageName = options.oldCurrentPage?.name || '';
            
            // Detect transition from background to experimental section
            // Check for new or old field names
            const hasExperience = sender.getValue("experience_matrix") || sender.getValue("experience_years");
            const hasTraining = sender.getValue("highest_training");
            
            if (!assignedPair && previousPageName.startsWith('background_') && 
                !currentPageName.startsWith('background_') &&
                hasExperience && hasTraining) {
                try {
                    const bankData = builder.bankData || builder.itemBank;
                    assignedPair = await getAssignedPair(bankData, sender, cfg);
                    
                    // If using study engine, we may need to rebuild survey with assignment
                    // For now, assignment is used for tracking, blocks are already selected
                } catch (error) {
                    console.error('❌ Failed to assign pair:', error);
                    // Continue with local fallback - getAssignedPair handles this
                }
            }
        });
        
        // Set up completion handler
        survey.onComplete.add(async function(sender, options) {
            
            // Ensure final page timing is captured
            if (sender._timingInstrument && sender.currentPage) {
                const currentPage = sender.currentPage;
                if (currentPage.elements && currentPage.elements.length > 0) {
                    // Find the question name from the current page
                    const questionElement = currentPage.elements.find(el => el.name && !el.name.includes('_intro'));
                    if (questionElement) {
                        const questionName = questionElement.name;
                        const responseTime = sender._timingInstrument.endTiming(questionName);
                        if (responseTime !== null) {
                            const timingFieldName = `rt_${questionName}_final`;
                            sender.setValue(timingFieldName, responseTime);
                            
                            // Store final question's idle time
                            const questionIdleTime = sender._timingInstrument.getQuestionIdleTime(questionName);
                            const idleFieldName = `idle_${questionName}_ms`;
                            sender.setValue(idleFieldName, questionIdleTime);
                        }
                    }
                }
            }
            
            // Ensure idle time is captured
            if (sender._timingInstrument) {
                const totalIdle = sender._timingInstrument.getTotalIdleTime();
                sender.setValue('idle_ms', totalIdle);
            }
            
            // Get updated timing data after adding idle_ms
            const finalTimingData = window.getTimingData(sender);
            
            // Grade the survey responses
            const bankDataForGrading = builder.bankData || builder.itemBank;
            const gradingResults = grade(sender, bankDataForGrading);
            
            // Backend integration: submit response if enabled
            try {
                await onCompleteSubmit(sender, assignedPair);
            } catch (error) {
                console.error('❌ Failed to submit to backend:', error);
            }
            
            const bankDataForResponse = builder.bankData || builder.itemBank;
            const responseData = {
                ts: defaultLogic.getCurrentTimestamp(),
                uuid: uuid,
                surveyVersion: "1.0.0",
                bankVersion: bankDataForResponse?.schema_version || "unknown",
                data: {
                    ...sender.data,
                    ...finalTimingData
                },
                grading: gradingResults
            };
            
            // Call completion hook
            if (defaultLogic.onComplete) {
                defaultLogic.onComplete(sender, responseData);
            }
            
            // Generate and display feedback
            const feedbackMode = builder.config?.quiz?.feedback_mode || 'full';
            const feedbackHtml = renderFeedback(gradingResults, feedbackMode);
            
            // Set the completion HTML to show feedback
            sender.completedHtml = feedbackHtml;
            
            // Also manually update the container to show feedback
            // This ensures it displays even if SurveyJS completedHtml doesn't work as expected
            setTimeout(() => {
                const container = document.getElementById('surveyContainer');
                if (container) {
                    container.innerHTML = feedbackHtml;
                }
            }, 100);
            
        });
        
        // Clear loading screen and render survey
        container.innerHTML = '';
        
        // Use the correct SurveyJS jQuery rendering approach
        
        // Clear container and use jQuery to render
        container.innerHTML = '';
        
        // Use jQuery SurveyJS rendering
        if (window.$ && window.$.fn.Survey) {
            $(container).Survey({ model: survey });
        } else {
            console.error('❌ jQuery or SurveyJS jQuery not available');
            container.innerHTML = `
                <div style="color: red; text-align: center; padding: 40px;">
                    <h3>❌ SurveyJS jQuery Not Available</h3>
                    <p>jQuery: ${typeof window.$ !== 'undefined'}</p>
                    <p>Survey jQuery: ${typeof window.$.fn?.Survey !== 'undefined'}</p>
                </div>
            `;
        }
        
        
        // Check if survey actually rendered
        setTimeout(() => {
            if (container.innerHTML.trim() === '' || container.children.length === 0) {
                console.error('❌ Survey did not render properly - container is empty');
                container.innerHTML = `
                    <div style="color: orange; text-align: center; padding: 40px;">
                        <h3>⚠️ Survey Rendering Issue</h3>
                        <p>The survey loaded but did not render properly.</p>
                        <details style="margin-top: 15px; text-align: left;">
                            <summary>Debug Information</summary>
                            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
Survey pages: ${surveyDefinition.pages.length}
Survey title: ${surveyDefinition.title}
Container ID: ${container.id}
SurveyJS loaded: ${typeof Survey !== 'undefined'}
                            </pre>
                        </details>
                    </div>
                `;
            } else {
            }
        }, 1000);
        
    } catch (error) {
        console.error('Failed to initialize survey:', error);
        container.innerHTML = `
            <div style="color: red; text-align: center; padding: 40px;">
                <h3>❌ Error initializing survey</h3>
                <p>${error.message}</p>
                <details style="margin-top: 15px; text-align: left;">
                    <summary>Technical Details</summary>
                    <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
${error.stack || error.toString()}
                    </pre>
                </details>
            </div>
        `;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSurvey);
} else {
    initSurvey();
}
