/**
 * Core Study Engine
 * Generic study construction engine for building surveys from definitions
 */

import { shuffleArray } from './builder.js';

/**
 * Selection Strategies
 */
export class SelectionStrategies {
    /**
     * Random selection - select N items uniformly at random
     */
    static random(items, count) {
        const shuffled = shuffleArray([...items]);
        return shuffled.slice(0, Math.min(count, items.length));
    }
    
    /**
     * Stratified selection - select based on participant stratum
     * (Implementation would use backend assignment for balanced selection)
     */
    static stratified(items, count, stratum, assignment = null) {
        // If assignment provided (from backend), use it
        if (assignment && assignment.selected) {
            return assignment.selected;
        }
        // Otherwise fall back to random
        return this.random(items, count);
    }
}

/**
 * Randomization Strategies
 */
export class RandomizationStrategies {
    /**
     * Randomize block order
     */
    static randomizeBlocks(blocks) {
        return shuffleArray([...blocks]);
    }
    
    /**
     * Randomize question order within blocks
     */
    static randomizeWithinBlock(questions) {
        return shuffleArray([...questions]);
    }
    
    /**
     * Randomize all questions (flattened)
     */
    static randomizeQuestions(questions) {
        return shuffleArray([...questions]);
    }
}

/**
 * Section Builder
 * Builds pages for a section based on its definition
 */
export class SectionBuilder {
    constructor(sectionDef, itemBank, config) {
        this.def = sectionDef;
        this.itemBank = itemBank;
        this.config = config;
    }
    
    /**
     * Build pages for this section
     */
    buildPages(participantData = {}, assignment = null) {
        switch (this.def.type) {
            case 'intro':
                return this._buildIntroPages();
            case 'background':
                return this._buildBackgroundPages();
            case 'block_group':
                return this._buildBlockGroupPages(participantData, assignment);
            case 'standalone':
                return this._buildStandalonePages();
            case 'feedback':
                return this._buildFeedbackPages();
            default:
                // Unknown section type, skip
                return [];
        }
    }
    
    _buildIntroPages() {
        // Intro sections are typically static content
        // Study-specific logic can override this
        return [];
    }
    
    _buildBackgroundPages() {
        // Background is loaded from external file and passed via itemBank.background
        const backgroundData = this.itemBank.background;
        if (!backgroundData || !backgroundData.pages) {
            return [];
        }
        
        // Helper to strip HTML from all elements
        const stripHTMLFromElements = (elements) => {
            return elements.map(el => {
                const newEl = { ...el };
                // Strip HTML from title
                if (newEl.title) {
                    newEl.title = this._stripHTML(newEl.title);
                    newEl.enableHTML = false;
                }
                // Ensure radiogroup and checkbox are vertical
                if (newEl.type === 'radiogroup' || newEl.type === 'checkbox') {
                    newEl.colCount = 1; // Force vertical layout (1 = single column per SurveyJS docs)
                }
                // Strip HTML from choices
                if (newEl.choices) {
                    newEl.choices = newEl.choices.map(choice => ({
                        value: choice.value,
                        text: this._stripHTML(choice.text),
                        enableHTML: false
                    }));
                }
                // Strip HTML from columns and rows for matrices
                if (newEl.columns) {
                    newEl.columns = newEl.columns.map(col => ({
                        value: col.value,
                        text: this._stripHTML(col.text),
                        enableHTML: false
                    }));
                }
                if (newEl.rows) {
                    newEl.rows = newEl.rows.map(row => ({
                        value: row.value,
                        text: this._stripHTML(row.text),
                        enableHTML: false
                    }));
                }
                return newEl;
            });
        };
        
        const pages = [];
        const splitOnePerPage = this.config?.background?.splitOnePerPage || false;
        
        if (splitOnePerPage) {
            // Split background into individual pages
            for (const page of backgroundData.pages) {
                pages.push({
                    name: `background_${page.name}`,
                    title: this._stripHTML(page.title || ''),
                    elements: stripHTMLFromElements(page.elements || [])
                });
            }
        } else {
            // Add all background pages as provided
            pages.push(...backgroundData.pages.map(page => ({
                ...page,
                name: `background_${page.name}`,
                title: this._stripHTML(page.title || ''),
                elements: stripHTMLFromElements(page.elements || [])
            })));
        }
        
        return pages;
    }
    
    _buildBlockGroupPages(participantData, assignment) {
        const pages = [];
        const blocks = this._getBlocks();
        
        // Select blocks based on strategy
        const selectedBlocks = this._selectBlocks(blocks, participantData, assignment);
        
        // Randomize block order if configured
        const orderedBlocks = this.def.randomization?.blocks 
            ? RandomizationStrategies.randomizeBlocks(selectedBlocks)
            : selectedBlocks;
        
            // Build pages for each block
            for (const block of orderedBlocks) {
                const blockPages = this._buildBlockPages(block);
                pages.push(...blockPages);
                
                // Allow study-specific logic to inject pages after block
                if (this.def.afterBlock) {
                    const afterPages = this._buildAfterBlockPages(block, participantData);
                    if (afterPages && afterPages.length > 0) {
                        pages.push(...afterPages);
                    }
                }
            }
        
        return pages;
    }
    
    _buildBlockPages(block) {
        const questions = this._getBlockQuestions(block);
        
        // Randomize within block if configured
        const orderedQuestions = this.def.randomization?.within_block
            ? RandomizationStrategies.randomizeWithinBlock(questions)
            : questions;
        
        // Build pages based on UI config
        if (this.config?.ui?.one_question_per_page) {
            return orderedQuestions.map((q, idx) => ({
                name: `${block.id || block.ap_type}_question_${idx}`,
                title: block.label || block.title || '',
                elements: [this._questionToSurveyJS(q)]
            }));
        } else {
            return [{
                name: `${block.id || block.ap_type}_page`,
                title: block.label || block.title || '',
                elements: orderedQuestions.map(q => this._questionToSurveyJS(q))
            }];
        }
    }
    
    _buildStandalonePages() {
        // Check if this is a structured standalone (like ap_intro with pages)
        const structuredPages = this._getStandalonePages();
        if (structuredPages.length > 0) {
            return structuredPages;
        }
        
        // Otherwise, treat as question-based standalone (like diagnostics)
        const questions = this._getStandaloneQuestions();
        
        // Randomize if configured
        const orderedQuestions = this.def.randomization?.questions
            ? RandomizationStrategies.randomizeQuestions(questions)
            : questions;
        
        if (this.config?.ui?.one_question_per_page) {
            return orderedQuestions.map((q, idx) => ({
                name: `standalone_${q.id}_page`,
                title: this.def.title || '',
                elements: [this._questionToSurveyJS(q)]
            }));
        } else {
            return [{
                name: 'standalone_page',
                title: this.def.title || '',
                elements: orderedQuestions.map(q => this._questionToSurveyJS(q))
            }];
        }
    }
    
    _buildFeedbackPages() {
        // Feedback is handled by completion handler
        return [];
    }
    
    _buildAfterBlockPages(block, participantData) {
        // Hook for study-specific logic (e.g., meta-cognitive questions)
        // Study logic can override this via customizeSectionBuilder
        // Default: return empty array (no pages)
        return [];
    }
    
    _getBlocks() {
        // Get blocks from item bank based on section definition
        if (this.def.blocks?.source === 'testlets') {
            return this.itemBank.testlets || [];
        }
        // Can extend for other block sources
        return [];
    }
    
    _selectBlocks(blocks, participantData, assignment) {
        const strategy = this.def.blocks?.select?.strategy || 'random';
        const count = this.def.blocks?.select?.count || blocks.length;
        
        // If assignment provided (from backend), use the selected blocks from assignment
        if (assignment && assignment.selectedBlocks) {
            // Map assignment block IDs to actual blocks
            const selectedBlocks = blocks.filter(block => 
                assignment.selectedBlocks.includes(block.id || block.ap_type)
            );
            if (selectedBlocks.length > 0) {
                return selectedBlocks;
            }
        }
        
        switch (strategy) {
            case 'random':
                return SelectionStrategies.random(blocks, count);
            case 'stratified':
                const stratum = participantData[this.def.blocks.select.stratum_field] || 'global';
                return SelectionStrategies.stratified(blocks, count, stratum, assignment);
            default:
                // Unknown selection strategy, return all items
                return SelectionStrategies.random(blocks, count);
        }
    }
    
    _getBlockQuestions(block) {
        // Get all questions from block (no filtering by construct)
        // Study-specific logic can override item selection if needed
        if (this.def.blocks?.item_selection) {
            // Custom item selection logic
            return this._applyItemSelection(block.items || [], this.def.blocks.item_selection);
        }
        
        // Default: return all items (should be 4 questions per block)
        const items = block.items || [];
        if (items.length === 0) {
            // Block has no items
        }
        return items;
    }
    
    _applyItemSelection(items, selectionDef) {
        // Apply item selection strategy
        // For now, just return all items
        // Can extend for custom selection logic
        return items;
    }
    
    _getStandaloneQuestions() {
        if (this.def.source === 'diagnostics') {
            return this.itemBank.diagnostics || [];
        }
        // For other standalone sources, return empty (handled by pages)
        return [];
    }
    
    _getStandalonePages() {
        // Handle standalone sections that have their own page structure (like ap_intro)
        if (this.def.source === 'ap_intro.json' || this.def.source === 'ap_intro') {
            const apIntroData = this.itemBank.ap_intro;
            if (apIntroData && apIntroData.pages) {
                // Helper to strip HTML from all elements
                const stripHTMLFromElements = (elements) => {
                    return elements.map(el => {
                        const newEl = { ...el };
                        // Strip HTML from title
                        if (newEl.title) {
                            newEl.title = this._stripHTML(newEl.title);
                            newEl.enableHTML = false;
                        }
                        // Ensure radiogroup and checkbox are vertical
                        if (newEl.type === 'radiogroup' || newEl.type === 'checkbox') {
                            newEl.colCount = 1; // Force vertical layout (1 = single column per SurveyJS docs)
                        }
                        // Strip HTML from choices
                        if (newEl.choices) {
                            newEl.choices = newEl.choices.map(choice => ({
                                value: choice.value,
                                text: this._stripHTML(choice.text),
                                enableHTML: false
                            }));
                        }
                        // Strip HTML from columns and rows for matrices
                        if (newEl.columns) {
                            newEl.columns = newEl.columns.map(col => ({
                                value: col.value,
                                text: this._stripHTML(col.text),
                                enableHTML: false
                            }));
                        }
                        if (newEl.rows) {
                            newEl.rows = newEl.rows.map(row => ({
                                value: row.value,
                                text: this._stripHTML(row.text),
                                enableHTML: false
                            }));
                        }
                        return newEl;
                    });
                };
                
                return apIntroData.pages.map(page => ({
                    ...page,
                    name: page.name.startsWith('ap_intro_') ? page.name : `ap_intro_${page.name}`,
                    title: this._stripHTML(page.title || ''),
                    elements: stripHTMLFromElements(page.elements || [])
                }));
            }
        }
        return [];
    }
    
    /**
     * Strip HTML tags from text
     */
    _stripHTML(text) {
        if (!text || typeof text !== 'string') return text;
        // Replace <br> and <br/> with newline, then strip all other HTML tags
        return text
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }
    
    _questionToSurveyJS(question) {
        // Strip HTML from question stem
        const cleanStem = this._stripHTML(question.stem);
        
        // Handle matrix-type questions (for diagnostics)
        if (question.type === "matrix") {
            return {
                type: "matrix",
                name: question.id,
                title: cleanStem,
                enableHTML: false,
                columns: (question.columns || []).map(col => ({
                    value: col.value,
                    text: this._stripHTML(col.text),
                    enableHTML: false
                })),
                rows: (question.rows || []).map(row => ({
                    value: row.value,
                    text: this._stripHTML(row.text),
                    enableHTML: false
                })),
                isRequired: true,
                explanation: question.explain,
                construct: question.construct,
                tags: question.tags || []
            };
        }
        
        // Default: radiogroup for multiple choice questions
        return {
            type: "radiogroup",
            name: question.id,
            title: cleanStem,
            enableHTML: false,
            choices: question.choices.map(choice => ({
                value: choice.value,
                text: this._stripHTML(choice.text),
                enableHTML: false
            })),
            isRequired: true,
            correctAnswer: question.key,
            explanation: question.explain,
            construct: question.construct,
            tags: question.tags || [],
            colCount: 1 // Vertical layout (1 = single column per SurveyJS docs)
        };
    }
}

/**
 * Study Engine
 * Main engine for building surveys from study definitions
 */
export class StudyEngine {
    constructor(studyDefinition, itemBank, config, studyLogic = null) {
        this.definition = studyDefinition;
        this.itemBank = itemBank;
        this.config = config;
        this.studyLogic = studyLogic; // Study-specific logic hooks
    }
    
    /**
     * Build complete survey for a participant
     */
    buildSurvey(participantData = {}, assignment = null) {
        const pages = [];
        
        for (const sectionDef of this.definition.sections) {
            // Check conditional
            if (!this._evaluateConditional(sectionDef, participantData)) {
                continue;
            }
            
            // Build section
            const sectionBuilder = new SectionBuilder(sectionDef, this.itemBank, this.config);
            
            // Allow study logic to customize section builder
            if (this.studyLogic && this.studyLogic.customizeSectionBuilder) {
                this.studyLogic.customizeSectionBuilder(sectionBuilder, sectionDef);
            }
            
            const sectionPages = sectionBuilder.buildPages(participantData, assignment);
            pages.push(...sectionPages);
        }
        
        return pages;
    }
    
    _evaluateConditional(sectionDef, participantData) {
        if (!sectionDef.conditional) {
            return true;
        }
        
        const field = sectionDef.conditional.field;
        const value = sectionDef.conditional.value;
        
        // Support nested field access (e.g., "routing.include_diagnostics")
        const fieldValue = this._getNestedValue(this.config, field);
        
        return fieldValue === value;
    }
    
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
}

