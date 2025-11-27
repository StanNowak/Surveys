# Survey Designer Guide

This guide is for researchers and survey designers who want to create or modify surveys using the Study Engine.

## Overview

The Study Engine is a modular system that separates:
- **Core logic** (reusable across all studies)
- **Study-specific content** (questions, configuration, logic)

## Creating a New Study

### 1. Study Directory Structure

Create a new study directory following this structure:

```
packages/
├── backend/
│   └── studies/
│       └── your_study_name/
│           ├── __init__.py
│           ├── config.json          # Study configuration
│           ├── logic.py              # Study-specific backend logic
│           └── content/
│               ├── background.json   # Background questionnaire
│               ├── item_bank.json   # Main question bank (testlets/blocks)
│               ├── ap_intro.json    # Optional intro section
│               └── diagnostics.json # Optional assessment questions
└── frontend-lib/
    └── src/
        └── studies/
            └── your_study_name/
                ├── logic.js          # Study-specific frontend logic
                └── study-definition.json  # Study structure definition
```

### 2. Study Definition (`study-definition.json`)

This JSON file defines the structure and flow of your survey:

```json
{
  "sections": [
    {
      "id": "background",
      "type": "background",
      "title": "Background Information",
      "source": "background.json"
    },
    {
      "id": "experimental",
      "type": "block_group",
      "title": "Main Assessment",
      "blocks": {
        "source": "testlets",
        "select": {
          "strategy": "stratified",
          "stratum_field": "experience_band",
          "count": 2
        }
      },
      "randomization": {
        "blocks": true,
        "within_block": true
      },
      "afterBlock": true
    }
  ]
}
```

**Section Types:**
- `background`: Background/demographic questions
- `block_group`: Randomized blocks (e.g., testlets)
- `standalone`: Fixed set of questions

**Block Selection Strategies:**
- `stratified`: Balanced selection within strata (e.g., experience levels)
- `random`: Uniform random selection

### 3. Question Bank Format (`item_bank.json`)

The item bank contains all questions organized into testlets/blocks:

```json
{
  "testlets": [
    {
      "ap_type": "storm_slab",
      "label": "Storm Slab",
      "items": [
        {
          "id": "storm_development_01",
          "construct": "development",
          "stem": "Question text here",
          "type": "radiogroup",
          "choices": [
            { "value": "A", "text": "Option A" },
            { "value": "B", "text": "Option B" }
          ],
          "key": "A",
          "explain": "Explanation shown in feedback"
        }
      ]
    }
  ]
}
```

**Question Types:**
- `radiogroup`: Single choice (multiple choice)
- `checkbox`: Multiple selection
- `matrix`: Likert scale / matrix questions
- `ranking`: Drag-and-drop ranking
- `dropdown`: Dropdown selection

**Important:**
- Remove all HTML markup from `stem`, `text`, `choices` (use plain text)
- Set `enableHTML: false` in question definitions
- Use `colCount: 1` for vertical radio/checkbox layouts

### 4. Background Questionnaire (`background.json`)

SurveyJS page format:

```json
{
  "pages": [
    {
      "name": "background_page",
      "elements": [
        {
          "type": "radiogroup",
          "name": "primary_activity",
          "title": "What is your primary activity?",
          "isRequired": true,
          "colCount": 1,
          "enableHTML": false,
          "choices": [
            { "value": "skiing", "text": "Backcountry Skiing" }
          ]
        }
      ]
    }
  ]
}
```

### 5. Study Configuration (`config.json`)

```json
{
  "routing": {
    "randomize_blocks": true,
    "blocks_to_draw": 2,
    "randomize_within_block": true,
    "include_diagnostics": true
  },
  "ui": {
    "one_question_per_page": true,
    "auto_advance": true,
    "progress_bar": true
  },
  "quiz": {
    "feedback_mode": "full",
    "show_explanations": true
  },
  "background": {
    "enabled": true
  }
}
```

### 6. Study-Specific Logic

**Frontend Logic** (`logic.js`):
- Experience band calculation
- Pair assignment logic
- Meta-cognitive questions
- Custom section builders

**Backend Logic** (`logic.py`):
- Stratum calculation
- Custom assignment rules

## Modifying Existing Studies

### Adding Questions

1. **To a testlet**: Edit `item_bank.json`, add to the testlet's `items` array
2. **To background**: Edit `background.json`, add to page `elements`
3. **New section**: Add to `study-definition.json` sections array

### Adding Meta-cognitive Questions

Meta-cognitive questions appear after each block. Implement in `logic.js`:

```javascript
buildMetaCognitiveQuestion(block) {
  return [{
    name: `${block.id}_metacognitive`,
    title: "Confidence Assessment",
    elements: [{
      type: "radiogroup",
      name: `${block.id}_confidence`,
      title: "How confident are you?",
      colCount: 1,
      choices: [
        { value: "1", text: "Not at all confident" },
        { value: "5", text: "Extremely confident" }
      ]
    }]
  }];
}
```

### Changing Randomization

Edit `study-definition.json`:
- `randomization.blocks`: Randomize block order
- `randomization.within_block`: Randomize questions within blocks
- `blocks.select.count`: Number of blocks to select

## Question Format Guidelines

### Do's ✅
- Use plain text (no HTML)
- Set `colCount: 1` for vertical layouts
- Set `enableHTML: false`
- Include `explain` field for feedback
- Use consistent naming (e.g., `{ap_type}_{construct}_{number}`)

### Don'ts ❌
- Don't use HTML in question text
- Don't use `colCount: 0` (causes horizontal scroll)
- Don't mix HTML and plain text
- Don't forget `isRequired: true` for required questions

## Validation

Validate your question banks before deploying:

```bash
cd scripts
node lint-bank.mjs ../packages/backend/studies/your_study/content/item_bank.json
```

## Testing

1. Start backend: `cd packages/backend && ./start.sh`
2. Start frontend: `./start-server.sh`
3. Open: `http://localhost:3000/public/`
4. Complete survey and verify:
   - Questions display correctly
   - Assignment works
   - Responses save to database
   - Timing data collected

## Common Issues

**Questions not appearing:**
- Check `study-definition.json` section `source` matches file name
- Verify questions are in correct testlet/block

**Layout issues:**
- Ensure `colCount: 1` for vertical layouts
- Remove all HTML markup

**Assignment not working:**
- Check `stratum_field` matches field name in background
- Verify backend is running and database connected

## Getting Help

- Check `REFACTORING-PLAN.md` for architecture details
- Review `packages/backend/studies/avalanche_2025/` for examples
- Check backend logs: `tail -f /tmp/fastapi.log`

