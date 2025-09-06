// Main application entry point
// ES module for the survey application

// Import builder, logic, instrumentation, and feedback modules
import './builder.js';
import './instrumentation.js';
import defaultLogic from './logic.default.js';
import { grade, renderFeedback, downloadSurveyData } from './feedback.js';

// Get configuration
const cfg = window.__SURVEY_CONFIG__ || {};

// Force Avalanche Canada styling
function forceAvalancheCanadaStyling() {
    // Apply styles directly to elements
    const titleElements = document.querySelectorAll('.sv-title, .sv-header__text, .sv-page__title');
    titleElements.forEach(el => {
        el.style.color = '#1e3a5f';
        el.style.fontFamily = 'DM Sans, sans-serif';
        el.style.fontWeight = '600';
        el.style.borderBottom = '2px solid #1e3a5f';
    });
    
    const questionTitles = document.querySelectorAll('.sv-question__title');
    questionTitles.forEach(el => {
        el.style.color = '#1e3a5f';
        el.style.fontFamily = 'DM Sans, sans-serif';
        el.style.fontWeight = '600';
    });
    
    const progressBars = document.querySelectorAll('.sv-progress__bar');
    progressBars.forEach(el => {
        el.style.backgroundColor = '#1e3a5f';
    });
    
    // Apply DM Sans to all survey elements
    const surveyElements = document.querySelectorAll('#surveyContainer, #surveyContainer *');
    surveyElements.forEach(el => {
        el.style.fontFamily = 'DM Sans, sans-serif';
    });
}

function backendEnabled() {
  return cfg.MODE === "prod" && !!cfg.ASSIGN_URL && !!cfg.SAVE_URL;
}

async function rpc(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function downloadJSON(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename
  });
  document.body.appendChild(a); a.click(); a.remove();
}

function deriveExperienceBand(years, training) {
  const y = String(years || ""); 
  const t = String(training || "");
  
  // Novice: 0-1 years OR no formal training/awareness only
  if (["0-1"].includes(y) || ["none", "awareness"].includes(t)) return "novice";
  
  // Intermediate: 2-5 years OR level 1 training
  if (["2-5"].includes(y) || ["level1"].includes(t)) return "intermediate";
  
  // Advanced: 6+ years OR level 2+ training
  return "advanced";
}

async function getAssignedPair(bank, survey) {
  const apList = (bank.testlets || []).map(t => t.ap_type).filter(Boolean);
  const years = survey.getValue("experience_years");
  const training = survey.getValue("highest_training");
  const stratum = deriveExperienceBand(years, training) || "global";
  survey.setValue(cfg.STRATUM_FROM_FIELD, stratum);

  if (backendEnabled()) {
    const uuid = new URLSearchParams(location.search).get("uuid") || crypto.randomUUID();
    try {
      const out = await rpc(cfg.ASSIGN_URL, { p_uuid: uuid, p_stratum: stratum, p_ap_list: apList });
      survey.setValue("__assigned_pair", out.pair);
      survey.setValue("__assigned_stratum", out.stratum || stratum);
      return out;
    } catch (e) {
      console.warn("assign_pair failed, falling back to local:", e);
    }
  }
  // local fallback
  const pairs = [];
  for (let i=0;i<apList.length;i++) for (let j=i+1;j<apList.length;j++) pairs.push([apList[i], apList[j]]);
  const pick = pairs[Math.floor(Math.random() * pairs.length)];
  survey.setValue("__assigned_pair", pick);
  survey.setValue("__assigned_stratum", stratum);
  return { pair: pick, stratum };
}

async function onCompleteSubmit(survey, assigned) {
  const uuid = new URLSearchParams(location.search).get("uuid") || crypto.randomUUID();
  const payload = {
    uuid,
    survey_id: cfg.SURVEY_ID || "ap_v1",
    pair: assigned?.pair || survey.getValue("__assigned_pair"),
    stratum: assigned?.stratum || survey.getValue("__assigned_stratum") || "global",
    panel_member: !!survey.getValue("__panel_member"),
    bank_version: survey.getValue("__bank_version"),
    config_version: survey.getValue("__config_version"),
    answers: survey.data,
    timings: window.__timings || {}
  };

  if (backendEnabled()) {
    try { await rpc(cfg.SAVE_URL, { p_payload: payload }); } catch (e) { console.warn("submit_response failed:", e); }
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
        
        // Apply minimal Avalanche Canada theming - fonts and colors only
        // Don't override the entire CSS structure to avoid breaking functionality
        
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
        
        // Store bank and config versions for backend tracking
        survey.setValue('__bank_version', builder.bankData?.schema_version || 'unknown');
        survey.setValue('__config_version', builder.config?.version || 'unknown');
        
        // Variable to store assignment for completion
        let assignedPair = null;
        
        // Minimal styling approach - let SurveyJS handle structure, we'll just override colors/fonts
        
        // Set up page change handler for pair assignment
        survey.onCurrentPageChanged.add(async function(sender, options) {
            // Force Avalanche Canada styling on page change
            setTimeout(forceAvalancheCanadaStyling, 50);
            
            // Check if we just completed the background section and need to assign pairs
            if (!assignedPair && sender.getValue("experience_years") && sender.getValue("highest_training")) {
                console.log('🎯 Background questions completed, assigning pair...');
                console.log('Experience years:', sender.getValue("experience_years"));
                console.log('Training level:', sender.getValue("highest_training"));
                try {
                    assignedPair = await getAssignedPair(builder.bankData, sender);
                    console.log('✅ Pair assigned:', assignedPair);
                } catch (error) {
                    console.error('❌ Failed to assign pair:', error);
                    // Continue with local fallback - getAssignedPair handles this
                }
            }
        });
        
        // Set up completion handler
        survey.onComplete.add(async function(sender, options) {
            console.log('✅ Survey completed!');
            
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
                            console.log(`💾 Final page timing: ${timingFieldName} = ${responseTime}ms`);
                            
                            // Store final question's idle time
                            const questionIdleTime = sender._timingInstrument.getQuestionIdleTime(questionName);
                            const idleFieldName = `idle_${questionName}_ms`;
                            sender.setValue(idleFieldName, questionIdleTime);
                            console.log(`💾 Final page idle time: ${idleFieldName} = ${questionIdleTime}ms`);
                        }
                    }
                }
            }
            
            // Ensure idle time is captured
            if (sender._timingInstrument) {
                const totalIdle = sender._timingInstrument.getTotalIdleTime();
                sender.setValue('idle_ms', totalIdle);
                console.log(`💤 Total idle time: ${totalIdle}ms`);
            }
            
            // Get updated timing data after adding idle_ms
            const finalTimingData = window.getTimingData(sender);
            console.log('⏱️ Complete timing data:', finalTimingData);
            
            // Grade the survey responses
            const gradingResults = grade(sender, builder.bankData);
            console.log('🎯 Grading results:', gradingResults);
            
            // Backend integration: submit response if enabled
            try {
                await onCompleteSubmit(sender, assignedPair);
                console.log('✅ Response submitted to backend (if enabled)');
            } catch (error) {
                console.error('❌ Failed to submit to backend:', error);
            }
            
            const responseData = {
                ts: defaultLogic.getCurrentTimestamp(),
                uuid: uuid,
                surveyVersion: "1.0.0",
                bankVersion: builder.bankData?.schema_version || "unknown",
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
            
            // Force Avalanche Canada styling after render
            setTimeout(forceAvalancheCanadaStyling, 100);
            setTimeout(forceAvalancheCanadaStyling, 500);
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
