#!/usr/bin/env node

/**
 * Bank linter for avalanche survey item banks
 * Validates JSON schema and business rules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple JSON Schema validator (basic implementation)
class SchemaValidator {
    validate(data, schema) {
        const errors = [];
        this._validateObject(data, schema, '', errors);
        return { valid: errors.length === 0, errors };
    }

    _validateObject(data, schema, path, errors) {
        if (schema.type === 'object') {
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                errors.push(`${path}: Expected object, got ${typeof data}`);
                return;
            }

            // Check required properties
            if (schema.required) {
                for (const prop of schema.required) {
                    if (!(prop in data)) {
                        errors.push(`${path}.${prop}: Required property missing`);
                    }
                }
            }

            // Validate properties
            if (schema.properties) {
                for (const [prop, propSchema] of Object.entries(schema.properties)) {
                    if (prop in data) {
                        this._validateObject(data[prop], propSchema, path ? `${path}.${prop}` : prop, errors);
                    }
                }
            }
        } else if (schema.type === 'array') {
            if (!Array.isArray(data)) {
                errors.push(`${path}: Expected array, got ${typeof data}`);
                return;
            }

            if (schema.minItems && data.length < schema.minItems) {
                errors.push(`${path}: Array must have at least ${schema.minItems} items, got ${data.length}`);
            }

            if (schema.items) {
                data.forEach((item, index) => {
                    this._validateObject(item, schema.items, `${path}[${index}]`, errors);
                });
            }
        } else if (schema.type === 'string') {
            if (typeof data !== 'string') {
                errors.push(`${path}: Expected string, got ${typeof data}`);
                return;
            }

            if (schema.minLength && data.length < schema.minLength) {
                errors.push(`${path}: String must be at least ${schema.minLength} characters, got ${data.length}`);
            }

            if (schema.enum && !schema.enum.includes(data)) {
                errors.push(`${path}: Value "${data}" not in allowed values: ${schema.enum.join(', ')}`);
            }

            if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
                errors.push(`${path}: String "${data}" does not match pattern ${schema.pattern}`);
            }
        } else if (schema.type === 'boolean') {
            if (typeof data !== 'boolean') {
                errors.push(`${path}: Expected boolean, got ${typeof data}`);
            }
        } else if (schema.type === 'integer') {
            if (!Number.isInteger(data)) {
                errors.push(`${path}: Expected integer, got ${typeof data}`);
                return;
            }

            if (schema.minimum !== undefined && data < schema.minimum) {
                errors.push(`${path}: Value ${data} is less than minimum ${schema.minimum}`);
            }
        }

        // Handle $ref (simplified)
        if (schema.$ref && schema.$ref.startsWith('#/definitions/')) {
            const defName = schema.$ref.replace('#/definitions/', '');
            const rootSchema = this._findRootSchema(schema);
            if (rootSchema?.definitions?.[defName]) {
                this._validateObject(data, rootSchema.definitions[defName], path, errors);
            }
        }
    }

    _findRootSchema(schema) {
        // Simple approach: assume the schema object has definitions at root
        let current = schema;
        while (current && !current.definitions) {
            current = current.parent || this._rootSchema;
        }
        return current;
    }

    setRootSchema(schema) {
        this._rootSchema = schema;
    }
}

/**
 * Load and parse JSON file
 */
function loadJSON(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Failed to load ${filePath}: ${error.message}`);
    }
}

/**
 * Validate business rules for item bank
 */
function validateBusinessRules(bank) {
    const errors = [];

    // Check unique IDs across all questions
    const allIds = new Set();
    const duplicateIds = new Set();

    // Collect IDs from testlets
    for (const testlet of bank.testlets || []) {
        for (const item of testlet.items || []) {
            if (allIds.has(item.id)) {
                duplicateIds.add(item.id);
            }
            allIds.add(item.id);
        }
    }

    // Collect IDs from diagnostics
    for (const diagnostic of bank.diagnostics || []) {
        if (allIds.has(diagnostic.id)) {
            duplicateIds.add(diagnostic.id);
        }
        allIds.add(diagnostic.id);
    }

    if (duplicateIds.size > 0) {
        errors.push(`Duplicate question IDs found: ${Array.from(duplicateIds).join(', ')}`);
    }

    // Check that each testlet has all four constructs
    for (const testlet of bank.testlets || []) {
        const constructs = new Set();
        for (const item of testlet.items || []) {
            constructs.add(item.construct);
        }

        const requiredConstructs = ['development', 'behaviour', 'assessment', 'mitigation'];
        const missingConstructs = requiredConstructs.filter(c => !constructs.has(c));
        
        if (missingConstructs.length > 0) {
            errors.push(`Testlet "${testlet.ap_type}" missing constructs: ${missingConstructs.join(', ')}`);
        }
    }

    // Check that each item has a valid key present in choices
    const allQuestions = [
        ...(bank.testlets || []).flatMap(t => t.items || []),
        ...(bank.diagnostics || [])
    ];

    for (const question of allQuestions) {
        if (!question.choices || !question.key) continue;
        
        const choiceValues = question.choices.map(c => c.value);
        if (!choiceValues.includes(question.key)) {
            errors.push(`Question "${question.id}" has key "${question.key}" not found in choices: ${choiceValues.join(', ')}`);
        }
    }

    // Check non-empty explanations
    for (const question of allQuestions) {
        if (!question.explain || question.explain.trim().length === 0) {
            errors.push(`Question "${question.id}" has empty or missing explanation`);
        }
    }

    return errors;
}

/**
 * Main linting function
 */
async function lintBank(bankPath) {
    console.log(`🔍 Linting bank: ${bankPath}`);

    try {
        // Load schema
        const schemaPath = path.join(__dirname, '../packages/shared/schemas/bank.schema.json');
        const schema = loadJSON(schemaPath);
        
        // Load bank
        const bank = loadJSON(bankPath);

        // Validate schema
        const validator = new SchemaValidator();
        validator.setRootSchema(schema);
        const schemaResult = validator.validate(bank, schema);

        if (!schemaResult.valid) {
            console.error('❌ Schema validation failed:');
            schemaResult.errors.forEach(error => console.error(`  - ${error}`));
            return false;
        }

        console.log('✅ Schema validation passed');

        // Validate business rules
        const businessErrors = validateBusinessRules(bank);
        if (businessErrors.length > 0) {
            console.error('❌ Business rule validation failed:');
            businessErrors.forEach(error => console.error(`  - ${error}`));
            return false;
        }

        console.log('✅ Business rule validation passed');

        // Summary
        const testletCount = bank.testlets?.length || 0;
        const questionCount = (bank.testlets || []).reduce((sum, t) => sum + (t.items?.length || 0), 0);
        const diagnosticCount = bank.diagnostics?.length || 0;

        console.log(`📊 Summary:`);
        console.log(`  - Testlets: ${testletCount}`);
        console.log(`  - Questions: ${questionCount}`);
        console.log(`  - Diagnostics: ${diagnosticCount}`);
        console.log('🎉 All validations passed!');

        return true;

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return false;
    }
}

// CLI execution
if (process.argv.length < 3) {
    console.error('Usage: node lint-bank.mjs <path-to-bank.json>');
    process.exit(1);
}

const bankPath = process.argv[2];
const success = await lintBank(bankPath);
process.exit(success ? 0 : 1);
