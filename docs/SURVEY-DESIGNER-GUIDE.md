# Survey Designer Guide

This guide explains how to create and modify surveys using the Study Engine. The Study Engine is a modular system designed to support various experimental designs, with the Avalanche Problems study serving as a concrete example.

## What is the Study Engine?

The Study Engine is a system that builds surveys from declarative definitions. Instead of writing code to construct your survey, you provide:
1. A **study definition** (JSON) describing the structure
2. **Question content** (JSON) organized into blocks
3. **Study-specific logic** (JavaScript) for stratification and assignment

The engine then automatically:
- Loads your content
- Calculates participant strata
- Assigns items using balancing algorithms
- Randomizes presentation order
- Builds the survey pages
- Tracks timing and saves responses

This separation means you can create entirely different studies (educational assessments, psychological experiments, market research) by replacing the study-specific components while using the same core engine.

## Understanding the Architecture

The Study Engine separates **core logic** (reusable across all studies) from **study-specific content and logic** (unique to each study).

### Core Components (You Don't Touch These)

These are built into the engine and work for any study:

- **Study Engine**: Processes study definitions and builds surveys
- **Balancing Algorithm**: Assigns items balanced within strata (works with any item types)
- **Question Renderer**: Converts question definitions to SurveyJS format
- **Randomization**: Shuffles blocks and questions
- **Timing Instrumentation**: Tracks response times automatically
- **Feedback System**: Grades answers and shows explanations
- **Database Schema**: Generic structure for storing responses

### Study-Specific Components (You Provide These)

These are unique to your study:

- **Item Bank**: Your questions, organized into blocks
- **Background Questions**: Your demographic/pre-experimental questions
- **Study Definition**: Your study's structure (sections, order, randomization)
- **Stratification Logic**: How to calculate participant groups (e.g., experience level, age)
- **Assignment Logic**: How to select items for each participant
- **Custom Questions**: Meta-cognitive assessments, post-block questions, etc.

**Key Insight**: The Avalanche Problems study is just one example. The same core engine can power studies with completely different content, structure, and logic.

## How a Study Works: The Complete Flow

Here's what happens when a participant takes your survey:

### Phase 1: Initialization
1. Participant opens survey → System loads `study-definition.json`
2. System loads content files: `item_bank.json`, `background.json`, `config.json`
3. System initializes Study Engine with your definition and content

### Phase 2: Background Section
4. Participant answers background questions (demographics, pre-experimental data)
5. System calls your `deriveStratum()` function → Calculates participant's stratum
   - Example: "novice", "intermediate", "advanced" (Avalanche study)
   - Example: "group_a", "group_b" (your study)

### Phase 3: Assignment
6. System calls your `getAssignedItems()` function
7. Your function calls backend API with: `(uuid, stratum, item_list)`
8. Backend balancing algorithm:
   - Checks existing assignments in database
   - Finds items with lowest counts within this stratum
   - Returns balanced assignment (e.g., `["item_a", "item_b"]`)
9. Assignment stored in database for this participant

### Phase 4: Survey Construction
10. Study Engine processes `study-definition.json`:
    - Builds background pages (already shown)
    - Selects assigned blocks from item bank
    - Randomizes block order (if configured)
    - Randomizes questions within blocks (if configured)
    - Builds pages for each question/block
11. System injects any custom questions (e.g., meta-cognitive after each block)

### Phase 5: Participant Completes Survey
12. Participant answers questions
13. Timing instrumentation tracks response time for each question automatically
14. System validates answers and shows feedback (if configured)

### Phase 6: Submission
15. Participant submits → System extracts:
    - Answers (question responses)
    - Timings (response times, idle times)
    - Metadata (stratum, assignment, versions)
16. System calls backend API to save response
17. Backend updates balancing counts in database

**What You Control**: Steps 5 (stratification), 6-8 (assignment), and 11 (custom questions).  
**What the Engine Handles**: Everything else automatically.

## Creating a New Study: Complete Walkthrough

### Step 1: Set Up Your Study Directory

Create a new directory structure:

```
packages/
├── backend/
│   └── studies/
│       └── your_study_name/
│           ├── __init__.py
│           ├── config.json
│           ├── logic.py
│           └── content/
│               ├── background.json
│               ├── item_bank.json
│               └── diagnostics.json (optional)
└── frontend-lib/
    └── src/
        └── studies/
            └── your_study_name/
                ├── logic.js
                └── study-definition.json
```

### Step 2: Define Your Study Structure

Create `study-definition.json` in `packages/frontend-lib/src/studies/your_study_name/`:

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
    },
    {
      "id": "diagnostics",
      "type": "standalone",
      "title": "Assessment Questions",
      "source": "diagnostics",
      "conditional": {
        "field": "routing.include_diagnostics",
        "value": true
      },
      "randomization": {
        "questions": true
      }
    }
  ]
}
```

**What This Means:**

- **`sections`**: Array of major sections, processed in order
- **`id`**: Internal identifier (used for references)
- **`type`**: 
  - `"background"`: Shows background questions first
  - `"block_group"`: Randomized experimental blocks
  - `"standalone"`: Fixed set of questions
- **`source`**: Where to find content
  - `"background.json"`: Loads from backend content directory
  - `"testlets"`: Uses `testlets` array from item bank
  - `"diagnostics"`: Uses `diagnostics` array from item bank
- **`blocks.select`**: How to choose blocks
  - `strategy: "stratified"`: Balanced assignment (uses backend)
  - `strategy: "random"`: Uniform random selection
  - `stratum_field`: Which background field to use for stratification
  - `count`: How many blocks to assign (2 = pairs, 1 = single, etc.)
- **`randomization`**: What to shuffle
  - `blocks: true`: Randomize block presentation order
  - `within_block: true`: Randomize question order within each block
  - `questions: true`: Randomize question order (for standalone sections)
- **`afterBlock: true`**: Trigger hook for custom questions after each block
- **`conditional`**: Show section only if condition is met
  - `field`: Path to config value (e.g., `"routing.include_diagnostics"`)
  - `value`: Required value for section to appear

**Design Choice**: Using JSON instead of code allows researchers to modify study structure without programming. The engine interprets this definition and builds the survey automatically.

### Step 3: Create Your Item Bank

Create `item_bank.json` in `packages/backend/studies/your_study_name/content/`:

```json
{
  "schema_version": "1.0.0",
  "testlets": [
    {
      "item_type": "condition_a",
      "label": "Condition A",
      "items": [
        {
          "id": "condition_a_question_01",
          "construct": "knowledge",
          "stem": "What is the main concept?",
          "type": "radiogroup",
          "choices": [
            { "value": "A", "text": "Option A is correct" },
            { "value": "B", "text": "Option B is incorrect" },
            { "value": "C", "text": "Option C is incorrect" }
          ],
          "key": "A",
          "explain": "Option A is correct because..."
        },
        {
          "id": "condition_a_question_02",
          "construct": "application",
          "stem": "How would you apply this concept?",
          "type": "radiogroup",
          "choices": [
            { "value": "A", "text": "Method A" },
            { "value": "B", "text": "Method B" }
          ],
          "key": "B",
          "explain": "Method B is the correct application..."
        }
      ]
    },
    {
      "item_type": "condition_b",
      "label": "Condition B",
      "items": [
        {
          "id": "condition_b_question_01",
          "construct": "knowledge",
          "stem": "What is an alternative concept?",
          "type": "radiogroup",
          "choices": [
            { "value": "A", "text": "Alternative A" },
            { "value": "B", "text": "Alternative B" }
          ],
          "key": "A",
          "explain": "Alternative A is correct..."
        }
      ]
    }
  ],
  "diagnostics": [
    {
      "id": "diagnostic_01",
      "stem": "How confident are you overall?",
      "type": "matrix",
      "rows": [
        { "value": "confidence", "text": "Overall confidence" }
      ],
      "columns": [
        { "value": "1", "text": "Not confident" },
        { "value": "5", "text": "Very confident" }
      ],
      "explain": "This is a self-assessment question."
    }
  ]
}
```

**Understanding the Structure:**

- **`testlets`**: Array of blocks (each block is a unit that can be assigned to participants)
- **`item_type`**: Unique identifier for this block
  - **Critical**: This is what the balancer uses to track assignments
  - In Avalanche study: `"ap_type": "storm_slab"` (avalanche problem type)
  - For your study: Use any identifier (`"condition_type"`, `"stimulus_type"`, `"block_id"`, etc.)
  - The balancer doesn't care about the name—it just needs a unique ID per block
- **`label`**: Human-readable name (shown to participants)
- **`items`**: Array of questions in this block
- **Question Fields**:
  - `id`: Unique question identifier (used in responses)
  - `construct`: Metadata tag for analysis (NOT used for selection/balancing)
  - `stem`: Question text (plain text only, no HTML)
  - `type`: Question type (see below)
  - `choices`: Answer options (for `radiogroup`, `checkbox`, `dropdown`)
  - `key`: Correct answer value (for grading/feedback)
  - `explain`: Explanation shown in feedback
- **`diagnostics`**: Optional array of assessment questions (shown separately)

**Question Types Available:**
- `radiogroup`: Single choice (multiple choice)
- `checkbox`: Multiple selection
- `matrix`: Likert scale / matrix questions (rows × columns)
- `ranking`: Drag-and-drop ranking
- `dropdown`: Dropdown selection

**Design Choice Explanation:**

The `item_type` field is the key to balancing. The algorithm uses this identifier to:
1. Track which blocks have been assigned
2. Count how many times each block appears within each stratum
3. Select blocks to balance frequencies

This design is generic: it works for avalanche problems, treatment conditions, factor combinations, or any other block-based design. The name `item_type` (or `ap_type` in Avalanche study) is just a label—the algorithm treats it as an opaque identifier.

The `construct` field is metadata only. It's not used for selection or balancing. It exists for post-hoc analysis (e.g., "How did participants perform on knowledge questions vs. application questions?").

### Step 4: Define Background Questions

Create `background.json` in `packages/backend/studies/your_study_name/content/`:

```json
{
  "pages": [
    {
      "name": "background_page_1",
      "elements": [
        {
          "type": "radiogroup",
          "name": "age_group",
          "title": "What is your age group?",
          "isRequired": true,
          "colCount": 1,
          "enableHTML": false,
          "choices": [
            { "value": "18-25", "text": "18-25" },
            { "value": "26-35", "text": "26-35" },
            { "value": "36-45", "text": "36-45" },
            { "value": "46+", "text": "46 or older" }
          ]
        },
        {
          "type": "radiogroup",
          "name": "education_level",
          "title": "What is your highest education level?",
          "isRequired": true,
          "colCount": 1,
          "enableHTML": false,
          "choices": [
            { "value": "high_school", "text": "High school" },
            { "value": "college", "text": "College" },
            { "value": "graduate", "text": "Graduate degree" }
          ]
        }
      ]
    }
  ]
}
```

**Important Formatting Rules:**
- Use plain text only (no HTML markup in `title` or `text`)
- Set `colCount: 1` for vertical radio button/checkbox layouts
- Set `enableHTML: false` to prevent HTML rendering
- Use standard SurveyJS question types

**How Background Questions Are Used:**
- Answers are stored in `survey.data`
- Your `deriveStratum()` function reads these values
- The stratum value is used for balanced assignment

### Step 5: Implement Study-Specific Logic

Create `logic.js` in `packages/frontend-lib/src/studies/your_study_name/`:

```javascript
import { assignPair } from '../../core/api.js';

/**
 * Calculate participant's stratum from background questions
 * @param {Object} survey - SurveyJS survey object
 * @returns {string} Stratum identifier (e.g., "novice", "intermediate", "advanced")
 */
export function deriveStratum(survey) {
  const age = survey.getValue("age_group");
  const education = survey.getValue("education_level");
  
  // Your stratification logic
  if (age === "18-25" && education === "high_school") {
    return "novice";
  } else if (age === "26-35" && education === "college") {
    return "intermediate";
  } else if (education === "graduate") {
    return "advanced";
  }
  
  // Default stratum
  return "intermediate";
}

/**
 * Get assigned items for participant
 * @param {Object} bank - Item bank data
 * @param {Object} survey - SurveyJS survey object
 * @param {Object} config - Study configuration
 * @returns {Promise<Object>} Assignment with selected items
 */
export async function getAssignedItems(bank, survey, config) {
  const uuid = new URLSearchParams(location.search).get("uuid") || crypto.randomUUID();
  const stratum = deriveStratum(survey);
  
  // Extract all item types from testlets
  const itemList = bank.testlets.map(t => t.item_type);
  
  // Call backend for balanced assignment
  const ASSIGN_URL = window.__SURVEY_CONFIG__?.ASSIGN_URL;
  if (!ASSIGN_URL) {
    // Fallback: random assignment if backend unavailable
    const shuffled = [...itemList].sort(() => Math.random() - 0.5);
    return {
      pair: shuffled.slice(0, 2),
      stratum: stratum
    };
  }
  
  try {
    const assignment = await assignPair(ASSIGN_URL, uuid, stratum, itemList);
    return assignment;
  } catch (error) {
    console.error("Assignment failed, using random fallback:", error);
    const shuffled = [...itemList].sort(() => Math.random() - 0.5);
    return {
      pair: shuffled.slice(0, 2),
      stratum: stratum
    };
  }
}

/**
 * Study-specific logic hooks
 */
export class YourStudyLogic {
  /**
   * Customize section builder (e.g., for meta-cognitive questions)
   */
  customizeSectionBuilder(sectionBuilder, sectionDef) {
    if (sectionDef.afterBlock) {
      // Override _buildAfterBlockPages to add custom questions
      sectionBuilder._buildAfterBlockPages = (block, participantData) => {
        return this.buildMetaCognitiveQuestion(block);
      };
    }
  }
  
  /**
   * Build meta-cognitive question after each block
   */
  buildMetaCognitiveQuestion(block) {
    return [{
      name: `${block.item_type}_metacognitive`,
      elements: [{
        type: "radiogroup",
        name: `${block.item_type}_confidence`,
        title: "How confident are you in your answers for this block?",
        isRequired: true,
        colCount: 1,
        choices: [
          { value: "1", text: "Not at all confident" },
          { value: "2", text: "Slightly confident" },
          { value: "3", text: "Moderately confident" },
          { value: "4", text: "Very confident" },
          { value: "5", text: "Extremely confident" }
        ]
      }]
    }];
  }
}
```

**What This Does:**

- **`deriveStratum()`**: Calculates participant's stratum from background answers
  - Called automatically after background section
  - Returns a string identifier (used by balancer)
  - This is study-specific because different studies stratify on different variables
  
- **`getAssignedItems()`**: Gets balanced assignment from backend
  - Extracts item types from item bank
  - Calls backend API with `(uuid, stratum, item_list)`
  - Backend returns balanced assignment
  - Includes fallback to random if backend unavailable

- **`YourStudyLogic`**: Custom hooks for study-specific behavior
  - `customizeSectionBuilder()`: Override section building behavior
  - `buildMetaCognitiveQuestion()`: Add custom questions after blocks

**Design Choice**: Stratification is study-specific because different studies use different variables (experience, age, pre-test scores, etc.). The core engine doesn't know how to calculate your stratum—you provide that logic. The engine then uses your stratum value with the generic balancing algorithm.

### Step 6: Configure Your Study

Create `config.json` in `packages/backend/studies/your_study_name/`:

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
    "auto_advance": false,
    "progress_bar": true
  },
  "quiz": {
    "feedback_mode": "full",
    "show_explanations": true
  }
}
```

**Configuration Options:**

- **`routing`**: Study flow settings
  - `randomize_blocks`: Shuffle block order
  - `blocks_to_draw`: Number of blocks to assign (overridden by study definition)
  - `randomize_within_block`: Shuffle questions within blocks
  - `include_diagnostics`: Show diagnostics section (used by conditional)
  
- **`ui`**: User interface settings
  - `one_question_per_page`: Show one question per page (vs. all on one page)
  - `auto_advance`: Automatically advance after answer
  - `progress_bar`: Show progress indicator
  
- **`quiz`**: Feedback settings
  - `feedback_mode`: When to show feedback (`"full"`, `"oncomplete"`, `"none"`)
  - `show_explanations`: Show explanation text in feedback

## Adapting for Different Experimental Designs

The Study Engine's core logic is generic and can support various experimental designs. Here's how to adapt it:

### Current Design: Stratified Balanced Assignment (Avalanche Problems)

**What it does:** Assigns pairs of items, balanced within strata.

**How it works:**
1. Participant completes background → stratum calculated (e.g., "novice")
2. System calls backend with `(uuid, "novice", ["item_a", "item_b", "item_c", ...])`
3. Backend balancer:
   - Checks counts: `item_a` appears 5 times in "novice", `item_b` appears 3 times, `item_c` appears 4 times
   - Finds pair with lowest maximum count: `item_b` + `item_c` (max = 4)
   - Returns `["item_b", "item_c"]`
4. Participant sees questions for `item_b` and `item_c`
5. Backend increments counts for `item_b` and `item_c` in "novice" stratum

**To adapt for your study:**
- Change `item_type` field name (currently `ap_type` in Avalanche study)
- Change stratification logic in `deriveStratum()`
- Change `count` in study definition (currently 2 for pairs, could be 1, 3, etc.)

### Latin Square Design

**What it does:** Each participant sees one condition, balanced across participants and presentation order.

**How to adapt:**
1. Set `count: 1` in study definition (assign single item, not pair)
2. Use `item_type` to represent conditions (e.g., `"condition_a"`, `"condition_b"`, `"condition_c"`)
3. Stratify on presentation order or participant group
4. Balancer ensures each condition appears equally within each stratum

**Example study definition:**
```json
{
  "blocks": {
    "select": {
      "strategy": "stratified",
      "stratum_field": "presentation_order",
      "count": 1
    }
  }
}
```

**Example background question:**
```json
{
  "name": "presentation_order",
  "title": "What is your presentation order?",
  "type": "radiogroup",
  "choices": [
    { "value": "first", "text": "First" },
    { "value": "second", "text": "Second" },
    { "value": "third", "text": "Third" }
  ]
}
```

The balancer will ensure condition_a, condition_b, and condition_c each appear equally in "first", "second", and "third" groups.

### Factorial Design (2×2)

**What it does:** Assign combinations of factor levels (e.g., Factor A × Factor B = 4 conditions).

**How to adapt:**
1. Create testlets for each factor combination:
   ```json
   {
     "item_type": "factor_a_high_factor_b_high",
     "label": "High A, High B",
     "items": [...]
   },
   {
     "item_type": "factor_a_high_factor_b_low",
     "label": "High A, Low B",
     "items": [...]
   }
   ```
2. Set `count: 4` in study definition (assign all 4 combinations)
3. Balancer ensures each combination appears equally within strata

**Alternative:** If you want participants to see only some combinations:
- Set `count: 2` to assign 2 out of 4 combinations
- Balancer will balance which combinations are assigned

### Within-Subjects Design

**What it does:** Each participant sees all conditions, order randomized.

**How to adapt:**
1. Set `count` to total number of items (assign all items)
2. Set `randomization.blocks: true` to randomize presentation order
3. No balancing needed (everyone sees everything, just order differs)

**Example:**
```json
{
  "blocks": {
    "select": {
      "strategy": "random",
      "count": 5
    }
  },
  "randomization": {
    "blocks": true,
    "within_block": true
  }
}
```

### Block Design

**What it does:** Participants complete multiple blocks, blocks balanced across participants.

**How to adapt:**
1. Each testlet represents a block
2. Set `count` to number of blocks per participant (e.g., `count: 3`)
3. Balancer ensures blocks are balanced within strata

**Example:** If you have 6 blocks and assign 3 per participant:
- Balancer ensures each block appears roughly equally
- Each participant sees a different combination of 3 blocks
- Over many participants, all blocks appear equally often

## Generic vs Study-Specific: Clear Boundaries

### Generic Elements (Don't Change - Work for Any Study)

- **Core Study Engine** (`study-engine.js`): Processes any study definition
- **Balancing Algorithm** (`randomization.py`): Works with any item types and strata
- **Question Structure**: Standard format works for any questions
- **Database Schema Structure**: Generic tables (though names may be study-specific)
- **Timing Instrumentation**: Automatically tracks response times
- **Feedback System**: Generic grading and explanation display

### Study-Specific Elements (You Must Provide)

- **Item Bank Content**: Your questions, organized into blocks
- **Background Questions**: Your demographic/pre-experimental questions
- **Stratification Logic**: How to calculate participant stratum (`deriveStratum()`)
- **Study Definition**: Your study's structure (`study-definition.json`)
- **Custom Questions**: Meta-cognitive, post-block questions (`buildMetaCognitiveQuestion()`)
- **Backend Logic** (optional): Any study-specific backend calculations (`logic.py`)

### Naming Conventions (Cosmetic - Easy to Change)

The current implementation uses `ap_type` (avalanche problem type) as a naming convention. This is **purely cosmetic**—the core logic doesn't care what you call it.

**In your study, you could use:**
- `item_type` (generic)
- `condition_type` (for experimental conditions)
- `stimulus_type` (for stimulus materials)
- `block_id` (for block designs)
- `treatment_id` (for treatment conditions)

**Database naming:** The schema uses `ap_type_counts` and `ap_a`/`ap_b` column names. These are study-specific naming, but the **structure** is generic. For a new study, you'd create a new schema (e.g., `s_my_study_v1`) with renamed tables/columns, but the structure (stratum, item_type, count) remains the same.

**Key Point:** The balancer algorithm treats `item_type` (or `ap_type`) as an opaque identifier. It doesn't interpret the value—it just uses it to track which blocks have been assigned. This is why the same algorithm works for avalanche problems, treatment conditions, factor combinations, or any other block-based design.

## Common Patterns and Examples

### Pattern 1: Simple Random Assignment

**Use case:** Assign items randomly, no balancing needed.

**Implementation:**
```json
{
  "blocks": {
    "select": {
      "strategy": "random",
      "count": 2
    }
  }
}
```

**When to use:** When you don't need balanced assignment (e.g., pilot testing, exploratory studies).

### Pattern 2: Stratified Balanced Assignment

**Use case:** Balance items within demographic groups (current Avalanche study).

**Implementation:**
```json
{
  "blocks": {
    "select": {
      "strategy": "stratified",
      "stratum_field": "experience_band",
      "count": 2
    }
  }
}
```

**When to use:** When you need balanced assignment within participant groups (most experimental designs).

### Pattern 3: Conditional Sections

**Use case:** Show some sections only if certain conditions are met.

**Implementation:**
```json
{
  "id": "advanced_questions",
  "type": "standalone",
  "conditional": {
    "field": "routing.include_advanced",
    "value": true
  }
}
```

**When to use:** When you want optional sections (e.g., advanced questions for experienced participants, follow-up questions based on responses).

### Pattern 4: Post-Block Questions

**Use case:** Ask meta-cognitive questions after each experimental block.

**Implementation:**
```json
{
  "id": "experimental",
  "type": "block_group",
  "afterBlock": true
}
```

Then implement `buildMetaCognitiveQuestion()` in your study logic (see Step 5).

**When to use:** When you want to collect confidence, difficulty, or other meta-cognitive assessments after each block.

## Validation and Testing

### Validate Your Item Bank

Before deploying, validate your JSON files:

```bash
cd scripts
node lint-bank.mjs ../packages/backend/studies/your_study/content/item_bank.json
```

This checks:
- Required fields are present
- Question structure is valid
- Choices are properly formatted
- No syntax errors

### Test Locally

1. **Start backend:**
   ```bash
   cd packages/backend
   ./start.sh
   ```

2. **Start frontend:**
   ```bash
   ./start-server.sh
   ```

3. **Open in browser:**
   ```
   http://localhost:3000/public/
   ```

4. **Complete survey and verify:**
   - Questions display correctly
   - Assignment works (check browser console for assignment)
   - Responses save to database
   - Timing data collected (check response payload)

5. **Check database:**
   ```bash
   docker exec backend-db-1 psql -U postgres -d surveys -c "SELECT * FROM s_ap_v1.responses ORDER BY created_at DESC LIMIT 1;"
   ```

## Getting Help

- **Technical details**: See `docs/DEVELOPER-HANDOVER.md`
- **Examples**: Review `packages/backend/studies/avalanche_2025/` for complete working example
- **Backend logs**: `tail -f /tmp/fastapi.log`
- **Generic vs specific analysis**: See `docs/AUDIT-GENERIC-VS-SPECIFIC.md` for detailed breakdown
