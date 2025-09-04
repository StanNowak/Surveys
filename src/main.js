// Main application entry point
// ES module for the survey application

// Import builder, logic, instrumentation, and feedback modules
import './builder.js';
import './instrumentation.js';
import defaultLogic from './logic.default.js';
import { grade, renderFeedback, downloadSurveyData } from './feedback.js';


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
        
        console.log('🚀 Initializing Avalanche Survey Application');
        console.log('Survey configuration:', window.__SURVEY_CONFIG__);
        
        // Create survey builder with default logic
        const builder = new window.SurveyBuilder(defaultLogic);
        
        // Load external data
        await builder.loadData(window.__SURVEY_CONFIG__);
        
        // Build survey definition
        const surveyDefinition = builder.buildSurvey();
        
        // Create SurveyJS model
        const survey = new Survey.Model(surveyDefinition);
        
        // Configure survey behavior
        survey.clearInvisibleValues = "none";
        survey.showQuestionNumbers = "off";
        
        // Configure UI settings based on config
        if (builder.config?.ui?.auto_advance) {
            survey.goNextPageAutomatic = true;
            survey.showNavigationButtons = false;
            console.log('✅ Auto-advance enabled, navigation hidden');
        }
        
        // Configure progress bar
        if (builder.config?.ui?.progress_bar) {
            survey.showProgressBar = 'top';
            console.log('✅ Progress bar enabled');
        }
        
        // Ensure one question per page if configured
        if (builder.config?.ui?.one_question_per_page) {
            console.log('✅ One question per page mode');
        }
        
        // Attach timing instrumentation
        window.attachTiming(survey);
        
        // Set up UUID for response tracking
        const urlParams = new URLSearchParams(window.location.search);
        const uuid = urlParams.get('uuid') || defaultLogic.generateUUID();
        survey.setValue('response_uuid', uuid);
        survey.setValue('survey_start_time', defaultLogic.getCurrentTimestamp());
        
        // Set up completion handler
        survey.onComplete.add(function(sender, options) {
            console.log('✅ Survey completed!');
            
            // Get timing data
            const timingData = window.getTimingData(sender);
            
            // Grade the survey responses
            const gradingResults = grade(sender, builder.bankData);
            console.log('🎯 Grading results:', gradingResults);
            
            const responseData = {
                ts: defaultLogic.getCurrentTimestamp(),
                uuid: uuid,
                surveyVersion: "1.0.0",
                bankVersion: builder.bankData?.schema_version || "unknown",
                data: {
                    ...sender.data,
                    ...timingData
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
            
            // Trigger JSON download
            downloadSurveyData(responseData, uuid);
            
            console.log('🎉 Survey completion process finished!');
        });
        
        // Clear loading screen and render survey
        container.innerHTML = '';
        console.log('🎨 Container cleared, rendering survey...');
        console.log('Survey definition:', surveyDefinition);
        console.log('Survey model:', survey);
        
        // Use the correct SurveyJS jQuery rendering approach
        console.log('Using SurveyJS jQuery version');
        
        // Clear container and use jQuery to render
        container.innerHTML = '';
        
        // Use jQuery SurveyJS rendering
        if (window.$ && window.$.fn.Survey) {
            $(container).Survey({ model: survey });
            console.log('✅ Survey rendered using jQuery SurveyJS');
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
        
        console.log('✅ Survey rendered successfully');
        console.log('Container content after render:', container.innerHTML.substring(0, 200) + '...');
        
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
                console.log('✅ Survey is visible in container');
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
