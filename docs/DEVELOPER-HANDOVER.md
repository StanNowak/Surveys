# Developer Handover Documentation

Complete technical documentation for developers taking over the Study Engine project. This guide explains the architecture, how components interact, and how to maintain and extend the system.

## What is the Study Engine?

The Study Engine is a monorepo system for building and deploying survey studies. It consists of:

1. **Backend API** (FastAPI/Python): Handles content delivery, participant assignment, and data storage
2. **Frontend Library** (Vanilla JavaScript): Builds surveys from declarative definitions and handles user interaction
3. **Database** (PostgreSQL): Stores participant assignments and survey responses

The system is designed to be **generic and reusable**—the core logic works for any study type, while study-specific content and logic are provided as data and plugins. The Avalanche Problems study serves as a concrete example of how to use the engine.

## Architecture Overview

The Study Engine is organized as a **monorepo** with clear separation between core (reusable) and study-specific (replaceable) components:

```
packages/
├── backend/          # FastAPI Python backend
│   ├── core/         # Reusable core logic (database, balancing, auth)
│   └── studies/      # Study-specific implementations
│       └── avalanche_2025/
│           ├── logic.py      # Study-specific backend logic
│           ├── config.json   # Study configuration
│           └── content/      # Question banks, background questions
├── frontend-lib/     # Frontend JavaScript library
│   ├── core/         # Reusable core components (engine, builder, API)
│   └── studies/      # Study-specific implementations
│       └── avalanche_2025/
│           ├── logic.js              # Study-specific frontend logic
│           └── study-definition.json # Study structure definition
└── shared/           # Shared schemas and types
    └── schemas/      # JSON schemas for validation
```

**Entry Points:**
- **Frontend**: `public/index.html` → `src/main.js` → loads frontend-lib modules
- **Backend**: `packages/backend/main.py` → FastAPI application

**Key Design Principle**: Core components are generic and work for any study. Study-specific components (content, logic, configuration) are provided as data and plugins, making it easy to create new studies without modifying core code.

## Technology Stack

### Backend
- **FastAPI** (Python 3.13+): Modern async web framework
- **PostgreSQL 16** (via Docker): Relational database with JSONB support
- **psycopg2-binary** (2.9.9): PostgreSQL adapter (direct connection, no ORM)
- **Uvicorn**: ASGI server for FastAPI

**Why psycopg2 directly?** We use raw SQL queries for simplicity and performance. The database schema is straightforward, and we don't need the complexity of an ORM. Connection pooling is handled by psycopg2's `SimpleConnectionPool`.

### Frontend
- **Vanilla JavaScript** (ES modules): No framework dependencies
- **SurveyJS** (jQuery version 1.9.131): Survey rendering library
- **jQuery** (3.6.0): Required by SurveyJS

**Why Vanilla JS?** The frontend will be wrapped in React components for Prismic deployment. Keeping the core library framework-agnostic makes it easier to integrate into different environments.

### Infrastructure
- **Docker Compose**: PostgreSQL database container
- **Prismic**: Production deployment platform (React components)

## System Flow: How It All Works Together

Understanding the complete flow helps when debugging or extending the system:

### 1. Application Startup

**Frontend:**
1. Browser loads `public/index.html`
2. HTML loads SurveyJS library, jQuery, and environment config (`env.js`)
3. HTML loads `src/main.js` as ES module
4. `main.js` calls `initSurvey()` function

**Backend:**
1. FastAPI app starts (`packages/backend/main.py`)
2. Database connection pool initialized (lazy—only when first needed)
3. CORS middleware configured for `localhost:3000`
4. API routes registered

### 2. Survey Initialization

**Frontend (`src/main.js` → `initSurvey()`):**

```javascript
// 1. Check if Study Engine is available
if (window.__SURVEY_CONFIG__?.STUDY_DEFINITION_URL) {
    // Use new Study Engine
    const { SurveyBuilderV2 } = await import('../packages/frontend-lib/src/core/builder-v2.js');
    const { Avalanche2025StudyLogic } = await import('../packages/frontend-lib/src/studies/avalanche_2025/logic.js');
    builder = new SurveyBuilderV2(new Avalanche2025StudyLogic());
} else {
    // Fall back to legacy builder
    builder = new window.SurveyBuilder(defaultLogic);
}

// 2. Load content from backend
await builder.loadData(window.__SURVEY_CONFIG__);
// This fetches:
//   - config.json
//   - item_bank.json
//   - background.json
//   - study-definition.json
//   - diagnostics.json (if available)

// 3. Build survey definition
const surveyDefinition = builder.buildSurvey();
// Study Engine processes study-definition.json and builds pages

// 4. Create SurveyJS model
const survey = new Survey.Model(surveyDefinition);

// 5. Attach timing instrumentation
window.attachTiming(survey);
// This hooks into SurveyJS events to track response times
```

**What Happens:**
- `SurveyBuilderV2.loadData()` makes GET requests to backend API endpoints
- Backend serves JSON files from `packages/backend/studies/avalanche_2025/content/`
- Study Engine processes `study-definition.json` to build survey structure
- SurveyJS model is created from the built definition
- Timing instrumentation attaches event handlers to track user interactions

### 3. Background Section Completion

**Frontend (`src/main.js` → `survey.onCurrentPageChanged`):**

```javascript
survey.onCurrentPageChanged.add((survey, options) => {
    // Detect transition from background to experimental section
    if (options.isNextPage && survey.currentPageNo === backgroundPageCount) {
        // Calculate stratum from background answers
        const stratum = deriveExperienceBand(survey);
        
        // Get assigned items from backend
        const assignment = await getAssignedPair(bank, survey, config);
        // This calls: POST /api/studies/avalanche_2025/assign
        
        // Store assignment for later use
        assignedPair = assignment;
        survey.setValue('__assigned_pair', assignment.pair);
        survey.setValue('__assigned_stratum', assignment.stratum);
    }
});
```

**Backend (`packages/backend/main.py` → `assign_pair()`):**

```python
@app.post("/api/studies/avalanche_2025/assign")
async def assign_pair(request: Dict):
    uuid = request.get("p_uuid")
    stratum = request.get("p_stratum", "global")
    ap_list = request.get("p_ap_list", [])
    
    # Get database connection
    db = next(get_db_connection())
    
    # Create balancer for this schema
    balancer = StratifiedBalancer(db, SCHEMA_NAME)
    
    # Get balanced assignment
    result = balancer.assign_pair(uuid, stratum, ap_list)
    # Returns: {"pair": ["item_a", "item_b"], "stratum": "novice"}
    
    return result
```

**What Happens:**
1. Frontend calculates stratum from background questions (study-specific logic)
2. Frontend calls backend with `(uuid, stratum, item_list)`
3. Backend balancer:
   - Checks if UUID already has assignment (returns existing if found)
   - Queries database for item counts within this stratum
   - Generates all possible pairs
   - Scores each pair by maximum count of its items
   - Selects pair(s) with minimum score
   - Randomly selects from best pairs
   - Stores assignment in database
4. Backend returns assignment to frontend
5. Frontend stores assignment and uses it to filter which blocks to show

### 4. Survey Completion and Submission

**Frontend (`src/main.js` → `onCompleteSubmit()`):**

```javascript
async function onCompleteSubmit(survey, assigned) {
    // Extract timing data (rt_*, idle_* fields)
    const timings = {};
    const answers = {};
    
    Object.keys(survey.data || {}).forEach(key => {
        if (key.startsWith('rt_') || key.startsWith('idle_')) {
            timings[key] = survey.data[key];
        } else if (!key.startsWith('__')) {
            answers[key] = survey.data[key];
        }
    });
    
    // Build payload
    const payload = {
        uuid,
        survey_id: "avalanche_canada_ap_v1",
        pair: assigned?.pair,
        stratum: assigned?.stratum,
        answers: answers,
        timings: timings,
        // ... metadata
    };
    
    // Submit to backend
    await submitResponse(cfg.SAVE_URL, payload);
    // This calls: POST /api/studies/avalanche_2025/submit
}
```

**Backend (`packages/backend/main.py` → `submit_response()`):**

```python
@app.post("/api/studies/avalanche_2025/submit")
async def submit_response(request: Dict, db = Depends(get_db_connection)):
    payload = request.get("p_payload")
    
    # Increment pair counts (for balancing tracking)
    if pair and len(pair) == 2:
        balancer = StratifiedBalancer(db, SCHEMA_NAME)
        balancer.increment_pair_count(stratum, pair)
        # Updates: pair_counts and ap_type_counts tables
    
    # Save response
    with db.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO {SCHEMA_NAME}.responses(
                uuid, survey_id, payload, ...
            ) VALUES (%s, %s, %s::jsonb, ...)
            """,
            (uuid, survey_id, json.dumps(payload), ...)
        )
    db.commit()
    
    return {"success": true}
```

**What Happens:**
1. Frontend extracts answers and timings from `survey.data`
2. Frontend builds payload with metadata
3. Frontend calls backend submit endpoint
4. Backend increments balancing counts (tracks which items were assigned)
5. Backend saves complete response as JSONB in database
6. Backend commits transaction

## Key Components Deep Dive

### Backend Core

#### `packages/backend/core/database.py`

**Purpose**: Manages PostgreSQL connections using psycopg2.

**Key Features:**
- **Connection Pooling**: Uses `SimpleConnectionPool` (1-20 connections)
- **Lazy Initialization**: Pool created on first use, not at import time
- **Graceful Degradation**: API can start even if database is unavailable (content endpoints still work)

**Usage:**
```python
# Context manager (for manual use)
with get_db() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT ...")
    conn.commit()  # Auto-committed on exit

# Dependency injection (for FastAPI)
def my_endpoint(db = Depends(get_db_connection)):
    with db.cursor() as cur:
        cur.execute("SELECT ...")
    db.commit()
```

**Design Choice**: Lazy initialization allows the API to start and serve content endpoints even if the database isn't immediately available. This is useful during development and deployment.

#### `packages/backend/core/randomization.py`

**Purpose**: Implements stratified least-filled bucket balancing algorithm.

**How It Works:**

1. **Track Individual Item Counts**: For each stratum, track how many times each item has been assigned
   ```python
   # Query: SELECT count FROM ap_type_counts WHERE stratum='novice' AND ap_type='storm'
   ap_type_counts = {"storm": 5, "wind": 3, "persistent": 4}
   ```

2. **Generate All Possible Pairs**: Create all combinations of items
   ```python
   pairs = [("storm", "wind"), ("storm", "persistent"), ("wind", "persistent")]
   ```

3. **Score Each Pair**: Score = maximum count of the two items
   ```python
   # ("storm", "wind"): max(5, 3) = 5
   # ("storm", "persistent"): max(5, 4) = 5
   # ("wind", "persistent"): max(3, 4) = 4  ← Best score!
   ```

4. **Select Best Pair(s)**: Choose pair(s) with minimum score
   ```python
   best_pairs = [("wind", "persistent")]  # Score = 4
   ```

5. **Random Selection**: If multiple pairs have the same score, randomly pick one
   ```python
   selected_pair = random.choice(best_pairs)
   ```

6. **Update Counts**: Increment counts for both items in the selected pair
   ```python
   # ap_type_counts["wind"] += 1
   # ap_type_counts["persistent"] += 1
   ```

**Why This Algorithm?** It ensures each item appears roughly equally often within each stratum, which is critical for balanced experimental designs. The algorithm is generic—it works with any item types and strata.

**Key Method: `assign_pair(uuid, stratum, ap_list)`**
- Checks for existing assignment (returns cached if found)
- Queries current counts from database
- Generates and scores pairs
- Selects best pair
- Stores assignment in database
- Returns assignment

**Key Method: `increment_pair_count(stratum, pair)`**
- Called on response submission
- Increments `pair_counts` table (for analysis)
- Increments `ap_type_counts` table (for balancing)

#### `packages/backend/core/auth.py`

**Purpose**: Auth0 token verification middleware.

**Current State**: Dev mode (accepts any token, returns mock user)

**Production TODO**: Implement real JWT verification when `AUTH0_DOMAIN` environment variable is set.

**Usage:**
```python
# Optional auth (works with or without token)
@app.post("/endpoint")
async def my_endpoint(auth: Optional[dict] = Depends(optional_auth)):
    if auth:
        user_id = auth.get("sub")
    # ... endpoint logic
```

#### `packages/backend/main.py`

**Purpose**: FastAPI application with all API endpoints.

**Endpoints:**

**Content Endpoints (GET)** - Serve study content:
- `/api/studies/avalanche_2025/config` - Study configuration
- `/api/studies/avalanche_2025/content/item_bank` - Question bank
- `/api/studies/avalanche_2025/content/background` - Background questions
- `/api/studies/avalanche_2025/content/ap_intro` - AP intro section
- `/api/studies/avalanche_2025/content/diagnostics` - Assessment questions

**Functional Endpoints (POST)** - Require database:
- `/api/studies/avalanche_2025/assign` - Assign participant to condition
  - Body: `{"p_uuid": "...", "p_stratum": "...", "p_ap_list": [...]}`
  - Returns: `{"pair": [...], "stratum": "..."}`
  
- `/api/studies/avalanche_2025/submit` - Submit survey response
  - Body: `{"p_payload": {...}}`
  - Returns: `{"success": true}`

**CORS Configuration**: Allows requests from `localhost:3000` (development) and will need Prismic domain added for production.

### Frontend Core

#### `packages/frontend-lib/src/core/study-engine.js`

**Purpose**: Core survey building engine that processes study definitions.

**Key Classes:**

**`StudyEngine`**: Main orchestrator
- Takes: study definition, item bank, config, study logic
- Processes sections in order
- Builds pages for each section
- Returns complete survey definition

**`SectionBuilder`**: Builds pages for a section
- Handles different section types: `background`, `block_group`, `standalone`
- Applies randomization (blocks, within-block, questions)
- Calls study-specific hooks for customization

**`SelectionStrategies`**: How to select blocks
- `random`: Uniform random selection
- `stratified`: Uses backend assignment for balanced selection

**`RandomizationStrategies`**: How to randomize
- `randomizeBlocks`: Shuffle block order
- `randomizeWithinBlock`: Shuffle questions within blocks
- `randomizeQuestions`: Shuffle all questions

**How It Works:**
1. Engine receives study definition (JSON)
2. For each section in definition:
   - Creates `SectionBuilder` for that section
   - Builder loads content from item bank based on `source`
   - Builder applies selection/randomization based on config
   - Builder converts questions to SurveyJS format
   - Builder returns pages
3. Engine collects all pages and returns complete survey definition

#### `packages/frontend-lib/src/core/builder-v2.js`

**Purpose**: Modern survey builder that uses Study Engine.

**Key Methods:**

**`loadData(config)`**: Loads all content from backend
```javascript
// Fetches:
// - config.json
// - item_bank.json
// - background.json
// - study-definition.json
// - diagnostics.json
```

**`buildSurvey(participantData, assignment)`**: Builds survey using Study Engine
```javascript
// Creates StudyEngine with all data
// Calls engine.buildSurvey()
// Returns SurveyJS survey definition
```

**Fallback**: If Study Engine fails to load, falls back to legacy builder (`builder.js`).

#### `packages/frontend-lib/src/core/instrumentation.js`

**Purpose**: Tracks response times and idle times for each question.

**How It Works:**
1. Attaches to SurveyJS events: `onCurrentPageChanged`, `onValueChanged`
2. Tracks when question is shown (`question_start_time`)
3. Tracks when question is answered (`question_end_time`)
4. Calculates response time: `rt_question_id_final = end_time - start_time`
5. Tracks idle time: `idle_question_id_ms = time_spent_idle`
6. Stores in `survey.data` with keys like `rt_loose_development_01_final`, `idle_loose_development_01_ms`

**Data Format:**
```javascript
survey.data = {
    "loose_development_01": "A",  // Answer
    "rt_loose_development_01_final": 3456,  // Response time (ms)
    "idle_loose_development_01_ms": 1200,  // Idle time (ms)
    // ...
}
```

#### `packages/frontend-lib/src/core/feedback.js`

**Purpose**: Grades answers and renders feedback.

**Key Functions:**

**`grade(survey, bank)`**: Grades all answers
- Compares answers to `key` field in questions
- Returns grading results

**`renderFeedback(grading, bank)`**: Renders feedback HTML
- Shows correct/incorrect for each question
- Displays `explain` text for each question
- Handles matrix questions (shows explanations only, no grading)

#### `packages/frontend-lib/src/core/api.js`

**Purpose**: Generic API client for backend communication.

**Key Functions:**

**`rpc(url, body)`**: Generic RPC wrapper
- Makes POST request with JSON body
- Handles errors (network, CORS, HTTP)
- Returns JSON response

**`assignPair(assignUrl, uuid, stratum, apList)`**: Assignment wrapper
- Calls `/assign` endpoint
- Returns assignment object

**`submitResponse(saveUrl, payload)`**: Submission wrapper
- Calls `/submit` endpoint
- Returns success response

### Study-Specific Components

#### `packages/backend/studies/avalanche_2025/logic.py`

**Purpose**: Study-specific backend logic (currently minimal).

**Functions:**
- `derive_experience_band(background_data)`: Calculates experience band from background questions (not currently used—frontend handles this)

#### `packages/frontend-lib/src/studies/avalanche_2025/logic.js`

**Purpose**: Study-specific frontend logic.

**Key Functions:**

**`deriveExperienceBand(survey)`**: Calculates stratum from background questions
- Reads matrix question: `experience_matrix.number_of_winters`
- Reads training level: `highest_training`
- Maps to: `"novice"`, `"intermediate"`, or `"advanced"`

**`getAssignedPair(bank, survey, config)`**: Gets assignment from backend
- Calls `assignPair()` API function
- Includes fallback to random if backend unavailable

**`Avalanche2025StudyLogic`**: Study-specific hooks
- `customizeSectionBuilder()`: Overrides `_buildAfterBlockPages` to add meta-cognitive questions
- `buildMetaCognitiveQuestion(block)`: Creates confidence question after each block

## Database Schema

**Schema Name**: `s_ap_v1` (avalanche problems version 1)

**Tables:**

**`allocations`**: Stores participant assignments
```sql
CREATE TABLE s_ap_v1.allocations(
  uuid       text PRIMARY KEY,
  stratum    text NOT NULL DEFAULT 'global',
  assignment jsonb NOT NULL,  -- {"pair": [...], "stratum": "..."}
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**`pair_counts`**: Tracks pair frequencies (for analysis)
```sql
CREATE TABLE s_ap_v1.pair_counts(
  stratum    text NOT NULL DEFAULT 'global',
  ap_a       text NOT NULL,
  ap_b       text NOT NULL,
  count      int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stratum, ap_a, ap_b)
);
```

**`ap_type_counts`**: Tracks individual item frequencies (for balancing)
```sql
CREATE TABLE s_ap_v1.ap_type_counts(
  stratum    text NOT NULL DEFAULT 'global',
  ap_type    text NOT NULL,
  count      int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stratum, ap_type)
);
```

**`responses`**: Stores complete survey submissions
```sql
CREATE TABLE s_ap_v1.responses(
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid           text NOT NULL,
  survey_id      text NOT NULL,
  payload        jsonb NOT NULL,  -- Complete response: answers, timings, metadata
  panel_member   boolean,
  bank_version   text,
  config_version text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

**Views:**

**`balance_report`**: Monitoring view for AP type balance
```sql
CREATE VIEW s_ap_v1.balance_report AS
SELECT stratum, ap_type, count, updated_at
FROM s_ap_v1.ap_type_counts
ORDER BY stratum, count DESC;
```

**Design Choice**: Using JSONB for `assignment` and `payload` allows flexible schema without migrations. The structure is generic—for a new study, create a new schema (e.g., `s_my_study_v1`) with the same table structure but different names.

## Environment Configuration

### Frontend Configuration

**`public/env.js`**: Production configuration
```javascript
window.__SURVEY_CONFIG__ = {
    MODE: "prod",
    ASSIGN_URL: "https://api.example.com/api/studies/avalanche_2025/assign",
    SAVE_URL: "https://api.example.com/api/studies/avalanche_2025/submit",
    BANK_URL: "https://api.example.com/api/studies/avalanche_2025/content/item_bank",
    // ... other content URLs
};
```

**`public/env.local.js`**: Local development overrides
```javascript
// Auto-loaded when hostname is localhost
window.__SURVEY_CONFIG__ = {
    ...window.__SURVEY_CONFIG__,
    ASSIGN_URL: "http://localhost:8000/api/studies/avalanche_2025/assign",
    SAVE_URL: "http://localhost:8000/api/studies/avalanche_2025/submit",
    // ... points all URLs to localhost:8000
};
```

**How It Works**: `env.js` loads first, then `env.local.js` overrides it if on localhost. This allows local development without modifying production config.

### Backend Configuration

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
  - Default: `postgresql://postgres:postgres@localhost:5433/surveys`
  - Format: `postgresql://user:password@host:port/database`
  
- `AUTH0_DOMAIN`: Auth0 domain (optional, for production)
  - If set: Enables real Auth0 JWT verification
  - If not set: Dev mode (accepts any token)

**Loading**: Uses `python-dotenv` to load from `.env` file (if present).

## Deployment

### Production Deployment (Prismic)

**Frontend:**
1. Wrap `packages/frontend-lib/` code in React components
2. Components integrate into Prismic pages
3. SurveyJS functionality remains the same, wrapped in React
4. API calls go to backend endpoint (configured in `env.js`)

**Backend:**
1. Deploy FastAPI application (e.g., on Heroku, AWS, DigitalOcean)
2. Set `DATABASE_URL` environment variable to production database
3. Configure CORS to allow Prismic domain
4. Set `AUTH0_DOMAIN` for production Auth0 verification

**Integration:**
```javascript
// React component example
import { SurveyBuilderV2 } from '@study-engine/frontend-lib';
import { Avalanche2025StudyLogic } from '@study-engine/avalanche-2025';

function AvalancheStudy() {
    const builder = new SurveyBuilderV2(new Avalanche2025StudyLogic());
    // ... initialize and render survey
}
```

### Local Development

**Start Database:**
```bash
cd packages/backend
docker-compose up -d
```

**Start Backend:**
```bash
cd packages/backend
./start.sh
# Runs on http://localhost:8000
```

**Start Frontend:**
```bash
./start-server.sh
# Runs on http://localhost:3000
# Open: http://localhost:3000/public/
```

## Testing

### Assignment Testing

Test the balancing algorithm:
```bash
./test-assignment.sh
```

This script:
1. Makes multiple assignment requests
2. Verifies assignments are balanced
3. Checks database counts

### Manual Testing

1. **Start both servers** (backend and frontend)
2. **Open survey** in browser: `http://localhost:3000/public/`
3. **Complete survey** and check:
   - Browser console for logs (assignment, submission)
   - Backend logs: `tail -f /tmp/fastapi.log`
   - Database: `docker exec backend-db-1 psql -U postgres -d surveys -c "SELECT * FROM s_ap_v1.responses ORDER BY created_at DESC LIMIT 1;"`
4. **Verify data**:
   - Assignment saved in `allocations` table
   - Response saved in `responses` table
   - Counts incremented in `ap_type_counts` table
   - Timing data present in payload

### Database Queries for Testing

**Check recent responses:**
```sql
SELECT uuid, survey_id, created_at, 
       payload->>'stratum' as stratum,
       payload->'pair' as pair
FROM s_ap_v1.responses 
ORDER BY created_at DESC 
LIMIT 5;
```

**Check balance:**
```sql
SELECT stratum, ap_type, count 
FROM s_ap_v1.ap_type_counts 
ORDER BY stratum, count DESC;
```

**Check pair frequencies:**
```sql
SELECT stratum, ap_a, ap_b, count 
FROM s_ap_v1.pair_counts 
ORDER BY stratum, count DESC;
```

## Troubleshooting

### Database Connection Issues

**Symptoms**: `RuntimeError: Database not available`

**Diagnosis:**
```bash
# Check Docker is running
docker ps

# Check database container
docker ps | grep postgres
# Should show: backend-db-1

# Check container logs
docker logs backend-db-1

# Test connection
docker exec backend-db-1 psql -U postgres -d surveys -c "SELECT 1;"
```

**Solutions:**
1. Start Docker Desktop
2. Start database: `cd packages/backend && docker-compose up -d`
3. Wait a few seconds for database to initialize
4. Check `DATABASE_URL` environment variable matches Docker port (5433)

### Frontend Not Loading

**Symptoms**: Blank page, console errors

**Diagnosis:**
```bash
# Check backend is running
curl http://localhost:8000/

# Check browser console (F12)
# Look for: CORS errors, 404 errors, module import errors
```

**Common Issues:**
1. **Backend not running**: Start backend first
2. **CORS error**: Backend CORS not configured for your origin
3. **Content URLs wrong**: Check `env.local.js` points to correct backend URL
4. **Module import error**: Check browser supports ES modules

**Solutions:**
1. Start backend: `cd packages/backend && ./start.sh`
2. Verify backend responds: `curl http://localhost:8000/`
3. Check `env.local.js` has correct URLs
4. Hard refresh browser (Cmd+Shift+R)

### Assignment Not Working

**Symptoms**: Assignment fails, wrong items assigned, no assignment

**Diagnosis:**
```bash
# Check backend logs
tail -f /tmp/fastapi.log
# Look for: database errors, assignment errors

# Check database schema
docker exec backend-db-1 psql -U postgres -d surveys -c "\dt s_ap_v1.*"
# Should show: allocations, pair_counts, ap_type_counts, responses
```

**Common Issues:**
1. **Database schema not initialized**: Run migration scripts
2. **Stratum calculation wrong**: Check `deriveExperienceBand()` logic
3. **Item list empty**: Check item bank loaded correctly

**Solutions:**
1. Initialize schema: Database auto-initializes on first connection (see `001-core.sql`)
2. Check stratum: Add `console.log(stratum)` in `deriveExperienceBand()`
3. Check item list: Add `console.log(ap_list)` in assignment call

### Timing Data Missing

**Symptoms**: No `rt_*` or `idle_*` fields in response

**Diagnosis:**
```javascript
// In browser console, after completing survey:
console.log(Object.keys(survey.data).filter(k => k.startsWith('rt_')));
// Should show: ["rt_question_01_final", "rt_question_02_final", ...]
```

**Common Issues:**
1. **Instrumentation not attached**: Check `window.attachTiming(survey)` called
2. **Timing extraction wrong**: Check `onCompleteSubmit()` extracts timing fields
3. **SurveyJS events not firing**: Check SurveyJS version compatibility

**Solutions:**
1. Verify instrumentation: Check `src/main.js` calls `window.attachTiming(survey)`
2. Check extraction: Verify `onCompleteSubmit()` filters `rt_*` and `idle_*` fields
3. Check SurveyJS: Ensure compatible version (1.9.131)

### Backend Errors

**Symptoms**: 500 errors, database errors, connection errors

**Diagnosis:**
```bash
# Check backend logs
tail -f /tmp/fastapi.log

# Check database connection
cd packages/backend
source venv/bin/activate
python -c "from backend.core.database import get_connection_pool; pool = get_connection_pool(); print('OK' if pool else 'FAILED')"
```

**Common Issues:**
1. **Database not running**: Start Docker container
2. **Wrong DATABASE_URL**: Check environment variable
3. **Schema not initialized**: Check database has tables
4. **SQL syntax error**: Check query syntax in code

**Solutions:**
1. Start database: `docker-compose up -d`
2. Check `DATABASE_URL`: Should match Docker port
3. Initialize schema: Tables auto-create on first use
4. Check SQL: Verify parameter binding (`%s` not `:param`)

## Code Organization Principles

### 1. Core vs Study-Specific

**Core** (`packages/*/core/`): Reusable across all studies
- Don't modify unless adding generic features
- Works with any study content/logic

**Study-Specific** (`packages/*/studies/*/`): Unique to each study
- Replace for new studies
- Contains content, logic, configuration

### 2. Pluggable Logic

Study-specific logic "plugs into" core engine via:
- **Hooks**: `customizeSectionBuilder()`, `buildMetaCognitiveQuestion()`
- **Functions**: `deriveStratum()`, `getAssignedItems()`
- **Data**: Study definition, item bank, config

### 3. Separation of Concerns

- **Backend**: Data storage, balancing, API
- **Frontend**: UI, timing, user interaction
- **Shared**: Schemas, types (validation)

## Future Enhancements

- [ ] **Real Auth0 JWT verification**: Currently in dev mode (accepts any token). Implement when `AUTH0_DOMAIN` is set.

## Key Files Reference

### Backend
- `packages/backend/main.py` - FastAPI application, API endpoints
- `packages/backend/core/randomization.py` - Balancing algorithm
- `packages/backend/core/database.py` - Database connection management
- `packages/backend/core/auth.py` - Auth0 middleware
- `packages/backend/db/init/001-core.sql` - Database schema

### Frontend
- `src/main.js` - Application entry point, survey initialization
- `packages/frontend-lib/src/core/study-engine.js` - Core survey building engine
- `packages/frontend-lib/src/core/builder-v2.js` - Modern survey builder
- `packages/frontend-lib/src/core/instrumentation.js` - Timing tracking
- `packages/frontend-lib/src/core/api.js` - Backend API client
- `public/index.html` - HTML entry point

### Study-Specific
- `packages/backend/studies/avalanche_2025/config.json` - Study configuration
- `packages/backend/studies/avalanche_2025/content/` - Question banks, background questions
- `packages/frontend-lib/src/studies/avalanche_2025/study-definition.json` - Study structure
- `packages/frontend-lib/src/studies/avalanche_2025/logic.js` - Study-specific frontend logic

## Support and Resources

- **Survey design guide**: `docs/SURVEY-DESIGNER-GUIDE.md` - For researchers creating studies
- **Generic vs specific analysis**: `docs/AUDIT-GENERIC-VS-SPECIFIC.md` - Detailed breakdown
- **Backend API docs**: `http://localhost:8000/docs` - Swagger UI (when backend running)
- **Example study**: `packages/backend/studies/avalanche_2025/` - Complete working example
