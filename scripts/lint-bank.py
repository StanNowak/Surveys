#!/usr/bin/env python3
"""
Bank linter for avalanche survey item banks
Validates JSON schema and business rules
"""

import json
import sys
import os
from pathlib import Path

def load_json(file_path):
    """Load and parse JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise Exception(f"Failed to load {file_path}: {e}")

def validate_schema_basic(data, required_fields, field_name=""):
    """Basic schema validation"""
    errors = []
    
    if not isinstance(data, dict):
        errors.append(f"{field_name}: Expected object, got {type(data).__name__}")
        return errors
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            errors.append(f"{field_name}.{field}: Required field missing")
    
    return errors

def validate_business_rules(bank):
    """Validate business rules for item bank"""
    errors = []
    
    # Check unique IDs across all questions
    all_ids = set()
    duplicate_ids = set()
    
    # Collect IDs from testlets
    for testlet in bank.get('testlets', []):
        for item in testlet.get('items', []):
            item_id = item.get('id')
            if item_id:
                if item_id in all_ids:
                    duplicate_ids.add(item_id)
                all_ids.add(item_id)
    
    # Collect IDs from diagnostics
    for diagnostic in bank.get('diagnostics', []):
        diagnostic_id = diagnostic.get('id')
        if diagnostic_id:
            if diagnostic_id in all_ids:
                duplicate_ids.add(diagnostic_id)
            all_ids.add(diagnostic_id)
    
    if duplicate_ids:
        errors.append(f"Duplicate question IDs found: {', '.join(duplicate_ids)}")
    
    # Check that each testlet has all four constructs
    required_constructs = {'development', 'behaviour', 'assessment', 'mitigation'}
    
    for testlet in bank.get('testlets', []):
        constructs = set()
        for item in testlet.get('items', []):
            construct = item.get('construct')
            if construct:
                constructs.add(construct)
        
        missing_constructs = required_constructs - constructs
        if missing_constructs:
            testlet_type = testlet.get('ap_type', 'unknown')
            errors.append(f"Testlet \"{testlet_type}\" missing constructs: {', '.join(missing_constructs)}")
    
    # Check that each item has a valid key present in choices
    all_questions = []
    for testlet in bank.get('testlets', []):
        all_questions.extend(testlet.get('items', []))
    all_questions.extend(bank.get('diagnostics', []))
    
    for question in all_questions:
        question_id = question.get('id', 'unknown')
        choices = question.get('choices', [])
        key = question.get('key')
        
        if choices and key:
            choice_values = [choice.get('value') for choice in choices if isinstance(choice, dict)]
            if key not in choice_values:
                errors.append(f"Question \"{question_id}\" has key \"{key}\" not found in choices: {', '.join(choice_values)}")
        
        # Check non-empty explanations
        explain = question.get('explain', '').strip()
        if not explain:
            errors.append(f"Question \"{question_id}\" has empty or missing explanation")
    
    return errors

def lint_bank(bank_path):
    """Main linting function"""
    print(f"🔍 Linting bank: {bank_path}")
    
    try:
        # Load bank
        bank = load_json(bank_path)
        
        # Basic schema validation
        schema_errors = []
        schema_errors.extend(validate_schema_basic(bank, ['schema_version', 'testlets', 'diagnostics']))
        
        # Validate testlets
        for i, testlet in enumerate(bank.get('testlets', [])):
            testlet_errors = validate_schema_basic(testlet, ['ap_type', 'label', 'items'], f"testlets[{i}]")
            schema_errors.extend(testlet_errors)
            
            # Validate items in testlet
            for j, item in enumerate(testlet.get('items', [])):
                item_errors = validate_schema_basic(item, ['id', 'construct', 'stem', 'choices', 'key', 'explain'], f"testlets[{i}].items[{j}]")
                schema_errors.extend(item_errors)
        
        # Validate diagnostics
        for i, diagnostic in enumerate(bank.get('diagnostics', [])):
            diagnostic_errors = validate_schema_basic(diagnostic, ['id', 'construct', 'stem', 'choices', 'key', 'explain'], f"diagnostics[{i}]")
            schema_errors.extend(diagnostic_errors)
        
        if schema_errors:
            print('❌ Schema validation failed:')
            for error in schema_errors:
                print(f"  - {error}")
            return False
        
        print('✅ Schema validation passed')
        
        # Validate business rules
        business_errors = validate_business_rules(bank)
        if business_errors:
            print('❌ Business rule validation failed:')
            for error in business_errors:
                print(f"  - {error}")
            return False
        
        print('✅ Business rule validation passed')
        
        # Summary
        testlet_count = len(bank.get('testlets', []))
        question_count = sum(len(t.get('items', [])) for t in bank.get('testlets', []))
        diagnostic_count = len(bank.get('diagnostics', []))
        
        print(f'📊 Summary:')
        print(f'  - Testlets: {testlet_count}')
        print(f'  - Questions: {question_count}')
        print(f'  - Diagnostics: {diagnostic_count}')
        print('🎉 All validations passed!')
        
        return True
    
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: python3 lint-bank.py <path-to-bank.json>')
        sys.exit(1)
    
    bank_path = sys.argv[1]
    success = lint_bank(bank_path)
    sys.exit(0 if success else 1)
