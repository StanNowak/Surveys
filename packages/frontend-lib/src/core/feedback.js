/**
 * Feedback and grading module for survey responses
 */

/**
 * Grade survey responses against correct answers
 * @param {Object} surveyModel - SurveyJS model with responses
 * @param {Object} itemBank - Item bank with correct answers
 * @returns {Object} Grading results with per-item correctness
 */
export function grade(surveyModel, itemBank) {
    const results = {
        totalItems: 0,
        correctItems: 0,
        items: []
    };
    
    // Get all testlet items AND diagnostic items from the bank for grading
    const allItems = [];
    
    // Add testlet items (assessment questions)
    if (itemBank.testlets) {
        itemBank.testlets.forEach(testlet => {
            if (testlet.items) {
                allItems.push(...testlet.items);
            }
        });
    }
    
    // Add diagnostic items
    if (itemBank.diagnostics) {
        allItems.push(...itemBank.diagnostics);
    }
    
    // Grade each item
    allItems.forEach(item => {
        const userAnswer = surveyModel.data[item.id];
        
        // Skip grading for matrix-type questions (diagnostics with Likert scales)
        // These don't have correct answers, just explanations
        if (item.type === "matrix") {
            results.items.push({
                id: item.id,
                construct: item.construct,
                stem: item.stem,
                userAnswer: userAnswer,
                correctAnswer: null,
                isCorrect: null, // No grading for matrix questions
                explanation: item.explain || 'No explanation provided',
                type: "matrix",
                columns: item.columns || [],
                rows: item.rows || []
            });
            // Don't count matrix questions in total/correct for scoring
            return;
        }
        
        const correctAnswer = item.key;
        
        if (userAnswer !== undefined && correctAnswer !== undefined) {
            const isCorrect = userAnswer === correctAnswer;
            
            results.items.push({
                id: item.id,
                construct: item.construct,
                stem: item.stem,
                userAnswer: userAnswer,
                correctAnswer: correctAnswer,
                isCorrect: isCorrect,
                explanation: item.explain || 'No explanation provided',
                choices: item.choices || []
            });
            
            results.totalItems++;
            if (isCorrect) {
                results.correctItems++;
            }
        }
    });
    
    results.score = results.totalItems > 0 ? 
        Math.round((results.correctItems / results.totalItems) * 100) : 0;
    
    return results;
}

/**
 * Render feedback HTML based on grading results
 * @param {Object} gradingResults - Results from grade() function
 * @param {string} mode - 'full' for detailed table, 'summary' for score only
 * @returns {string} HTML string for feedback display
 */
export function renderFeedback(gradingResults, mode = 'full') {
    
    if (mode === 'summary') {
        return `
            <div class="feedback-summary">
                <h2>Survey Complete!</h2>
                <div class="score-display">
                    <h3>Your Score: ${gradingResults.score}%</h3>
                    <p>${gradingResults.correctItems} out of ${gradingResults.totalItems} correct</p>
                </div>
                <p>Thank you for completing the survey. Your responses have been recorded.</p>
            </div>
        `;
    }
    
    // Full feedback mode with detailed table
    let tableRows = '';
    gradingResults.items.forEach((item, index) => {
        // Handle matrix-type questions (diagnostics) differently
        if (item.type === "matrix") {
            // Format matrix response (object with row:column mappings)
            let userAnswerText = "See responses";
            if (item.userAnswer && typeof item.userAnswer === 'object') {
                const answerParts = Object.entries(item.userAnswer).map(([row, col]) => {
                    const rowLabel = item.rows?.find(r => r.value === row)?.text || row;
                    const colLabel = item.columns?.find(c => c.value === col)?.text || col;
                    return `${rowLabel}: ${colLabel}`;
                }).join("; ");
                userAnswerText = answerParts || "No response";
            }
            
            tableRows += `
                <tr class="feedback-row diagnostic">
                    <td class="question-num">${index + 1}</td>
                    <td class="construct">${item.construct || 'Diagnostic'}</td>
                    <td class="question-stem">${item.stem}</td>
                    <td class="user-answer">${userAnswerText}</td>
                    <td class="correct-answer">—</td>
                    <td class="status">—</td>
                    <td class="explanation">${item.explanation}</td>
                </tr>
            `;
            return;
        }
        
        // Regular multiple choice questions
        const statusIcon = item.isCorrect ? '✅' : '❌';
        const statusClass = item.isCorrect ? 'correct' : 'incorrect';
        
        // Find user's choice text
        let userChoiceText = item.userAnswer;
        let correctChoiceText = item.correctAnswer;
        
        if (item.choices && item.choices.length > 0) {
            const userChoice = item.choices.find(c => c.value === item.userAnswer);
            const correctChoice = item.choices.find(c => c.value === item.correctAnswer);
            
            userChoiceText = userChoice ? userChoice.text : item.userAnswer;
            correctChoiceText = correctChoice ? correctChoice.text : item.correctAnswer;
        }
        
        tableRows += `
            <tr class="feedback-row ${statusClass}">
                <td class="question-num">${index + 1}</td>
                <td class="construct">${item.construct || 'N/A'}</td>
                <td class="question-stem">${item.stem}</td>
                <td class="user-answer">${userChoiceText}</td>
                <td class="correct-answer">${correctChoiceText}</td>
                <td class="status">${statusIcon}</td>
                <td class="explanation">${item.explanation}</td>
            </tr>
        `;
    });
    
    return `
        <div class="feedback-container">
            <div class="feedback-header">
                <h2>Survey Results</h2>
                <div class="score-summary">
                    <div class="score-circle">
                        <span class="score-number">${gradingResults.score}%</span>
                    </div>
                    <div class="score-details">
                        <p><strong>${gradingResults.correctItems}</strong> correct out of <strong>${gradingResults.totalItems}</strong> questions</p>
                        <p class="completion-message">Survey completed successfully!</p>
                    </div>
                </div>
            </div>
            
            <div class="feedback-table-container">
                <h3>Detailed Results</h3>
                <table class="feedback-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Construct</th>
                            <th>Question</th>
                            <th>Your Answer</th>
                            <th>Correct Answer</th>
                            <th>Result</th>
                            <th>Explanation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            
            <div class="feedback-footer">
                <p>Your responses have been automatically downloaded as a JSON file.</p>
                <p>Thank you for participating in this survey!</p>
            </div>
        </div>
    `;
}

/**
 * Download survey data as JSON file
 * @param {Object} surveyData - Complete survey data to download
 * @param {string} uuid - Survey UUID for filename
 */
export function downloadSurveyData(surveyData, uuid) {
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `survey_${uuid}_${timestamp}.json`;
    
    const jsonString = JSON.stringify(surveyData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL
    URL.revokeObjectURL(url);
    
}
