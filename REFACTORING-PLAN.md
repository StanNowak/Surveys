# Study Engine Monorepo - Refactoring Plan

## Architecture Overview

### Core vs Study-Specific Separation

**Core Components** (Reusable across all studies):
- Instrumentation (timing, idle tracking)
- Feedback (grading, rendering)
- Randomization/Balancing (generic stratified least-filled bucket)
- Database schema (generic study tables)
- Frontend core (SurveyJS integration, builder base)
- Auth middleware (Auth0 verification)

**Study-Specific Components** (Avalanche 2025):
- Experience band calculation logic
- Study-specific pair assignment rules
- Item bank content
- Study configuration
- Study-specific frontend logic

---

## Proposed Directory Structure

```
packages/
├── backend/
│   ├── core/
│   │   ├── __init__.py
│   │   ├── randomization.py             # Generic stratified least-filled bucket
│   │   ├── validation.py                # Item bank/config validation
│   │   └── auth.py                      # Auth0 middleware
│   ├── studies/
│   │   └── avalanche_2025/
│   │       ├── __init__.py
│   │       ├── config.py                # Study config (stages, routing)
│   │       ├── content/
│   │       │   └── item_bank.json       # Study-specific item bank
│   │       └── logic.py                 # Experience band → bucket mapping
│   ├── db/
│   │   └── init/
│   │       ├── 001-core.sql             # Generic study tables
│   │       └── 002-rpc.sql              # Generic RPC functions
│   ├── docker-compose.yml
│   ├── main.py                          # FastAPI app entry point
│   └── requirements.txt
│
├── frontend-lib/
│   ├── src/
│   │   ├── core/
│   │   │   ├── instrumentation.js       # Timing/instrumentation
│   │   │   ├── feedback.js              # Grading/feedback rendering
│   │   │   ├── builder.js               # Generic survey builder
│   │   │   └── api.js                   # API client (RPC calls)
│   │   └── studies/
│   │       └── avalanche_2025/
│   │           ├── logic.js             # Experience band calculation
│   │           ├── content/
│   │           │   └── item_bank.json   # Study item bank (or reference)
│   │           └── config.json          # Study config
│   ├── dist/                            # Built component library
│   ├── package.json
│   └── webpack.config.js                # Build config for React component
│
└── shared/
    └── schemas/
        ├── bank.schema.json              # Item bank schema
        └── config.schema.json            # Config schema
```

---

## File Movement Plan

### Backend Core (`packages/backend/core/`)

#### 1. Randomization Module
**New File**: `packages/backend/core/randomization.py`
- **Source**: Logic from `packages/backend/db/init/002-rpc.sql` (assign_pair function logic)
- **Content**: Generic "Stratified Least-Filled Bucket" class that replaces Postgres RPC logic
- **API**: 
  ```python
  class StratifiedBalancer:
      def assign_pair(self, uuid: str, stratum: str, items: List[str], db_session) -> Dict
      def increment_pair_count(self, stratum: str, pair: List[str], db_session) -> None
  ```
- **Note**: This moves the balancing logic from SQL to Python, making it easier to extend for BIBD, Latin squares, etc.

#### 2. Validation Module
**New File**: `packages/backend/core/validation.py`
- **Source**: `scripts/lint-bank.py` (if it validates schemas)
- **Content**: JSON schema validation for item banks and configs
- **Dependencies**: `jsonschema` package

#### 3. Auth Module
**New File**: `packages/backend/core/auth.py`
- **Content**: Auth0 Bearer token verification middleware
- **Dependencies**: `python-jose`, `authlib`

### Backend Study (`packages/backend/studies/avalanche_2025/`)

#### 4. Study Logic
**New File**: `packages/backend/studies/avalanche_2025/logic.py`
- **Source**: `src/main.js` lines 80-103 (`deriveExperienceBand` function)
- **Content**: Experience band calculation (novice/intermediate/advanced)
- **API**:
  ```python
  def derive_experience_band(years: str, training: str) -> str
  ```

#### 5. Study Config
**New File**: `packages/backend/studies/avalanche_2025/config.py`
- **Source**: `item-banks/config.demo.json`
- **Content**: Python dataclass/config object for study stages

#### 6. Study Content
**Move**: `item-banks/bank.demo.json` → `packages/backend/studies/avalanche_2025/content/item_bank.json`
**Move**: `item-banks/background.json` → `packages/backend/studies/avalanche_2025/content/background.json`

### Frontend Core (`packages/frontend-lib/src/core/`)

#### 7. Instrumentation
**Move**: `src/instrumentation.js` → `packages/frontend-lib/src/core/instrumentation.js`
- **Status**: Already core logic, minimal changes needed
- **Note**: May need to export as ES module for React component

#### 8. Feedback
**Move**: `src/feedback.js` → `packages/frontend-lib/src/core/feedback.js`
- **Status**: Already core logic, minimal changes needed

#### 9. Builder (Core)
**Refactor**: `src/builder.js` → `packages/frontend-lib/src/core/builder.js`
- **Changes**: 
  - Remove study-specific logic (experience band calculation)
  - Make testlet/item selection pluggable via hooks
  - Keep generic survey construction logic

#### 10. API Client
**New File**: `packages/frontend-lib/src/core/api.js`
- **Source**: `src/main.js` lines 61-69 (`rpc` function)
- **Content**: Generic API client for backend RPC calls
- **API**:
  ```javascript
  export async function rpc(url, body) { ... }
  export async function assignPair(uuid, stratum, apList) { ... }
  export async function submitResponse(payload) { ... }
  ```

### Frontend Study (`packages/frontend-lib/src/studies/avalanche_2025/`)

#### 11. Study Logic
**New File**: `packages/frontend-lib/src/studies/avalanche_2025/logic.js`
- **Source**: `src/main.js` lines 80-103, 105-147
- **Content**: 
  - `deriveExperienceBand()` function
  - `getAssignedPair()` function (study-specific assignment logic)
  - Study-specific hooks for builder

#### 12. Study Content (Backend Only)
**Move**: `item-banks/bank.demo.json` → `packages/backend/studies/avalanche_2025/content/item_bank.json`
**Move**: `item-banks/config.demo.json` → `packages/backend/studies/avalanche_2025/config.json`
**Move**: `item-banks/background.json` → `packages/backend/studies/avalanche_2025/content/background.json`
**Note**: Frontend will fetch these via API or import from backend during build

### Database (`packages/backend/db/init/`)

#### 13. Core Schema
**Refactor**: `001-core.sql` → Keep but make schema name configurable
- **Changes**: 
  - Replace hardcoded `s_ap_v1` with parameterized schema
  - Make tables generic (study_id instead of hardcoded survey_id)

#### 14. Core RPC (Simplified)
**Refactor**: `002-rpc.sql` → Simplify to basic database operations only
- **Changes**: 
  - Remove assignment logic (moves to Python `randomization.py`)
  - Keep only data storage/retrieval functions
  - Make schema name parameterizable
  - Logic for `assign_pair` and balancing moves to Python backend

### Shared Schemas (`packages/shared/schemas/`)

#### 15. Schemas
**Move**: `src/schema/bank.schema.json` → `packages/shared/schemas/bank.schema.json`
**Move**: `src/schema/config.schema.json` → `packages/shared/schemas/config.schema.json`

---

## FastAPI Application Structure

**New File**: `packages/backend/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.auth import verify_auth0_token
from backend.studies.avalanche_2025 import get_study_config

app = FastAPI()

# CORS middleware
app.add_middleware(CORSMiddleware, ...)

# Auth middleware
@app.middleware("http")
async def auth_middleware(request, call_next):
    # Verify Auth0 token
    ...

# Study endpoints
@app.post("/api/studies/avalanche_2025/assign")
async def assign_pair(...):
    # Use core randomization + study logic
    ...

@app.post("/api/studies/avalanche_2025/submit")
async def submit_response(...):
    # Save to database
    ...
```

---

## React Component Library Structure

**New File**: `packages/frontend-lib/src/index.js`
```javascript
import { AvalancheStudy } from './studies/avalanche_2025/component';

export { AvalancheStudy };
```

**New File**: `packages/frontend-lib/src/studies/avalanche_2025/component.jsx`
```jsx
import React from 'react';
import { Survey } from 'survey-react-ui';
import { attachTiming } from '../../core/instrumentation';
import { grade, renderFeedback } from '../../core/feedback';
import { buildSurvey } from '../../core/builder';
import { deriveExperienceBand, getAssignedPair } from './logic';
import itemBank from './content/item_bank.json';
import config from './config.json';

export function AvalancheStudy({ authToken, onComplete }) {
  // Study-specific initialization
  // Uses core modules + study logic
  ...
}
```

---

## Migration Steps

**Approach**: Focus on one thing at a time - start with file organization, then scaffold FastAPI backend.

### Phase 1: Create New Structure & File Organization
1. Create directory structure
2. Move core frontend files (instrumentation, feedback, builder, api)
3. Move study-specific frontend logic
4. Move item banks and configs to backend study directory
5. Move schemas to shared location
6. Update imports/exports as needed

### Phase 2: Move Core Logic
1. Move instrumentation.js → frontend-lib/src/core/
2. Move feedback.js → frontend-lib/src/core/
3. Refactor builder.js → frontend-lib/src/core/builder.js
4. Extract API client from main.js → frontend-lib/src/core/api.js

### Phase 3: Move Study Logic
1. Extract experience band logic → study logic files
2. Move item banks → study content directories
3. Move configs → study config files

### Phase 4: Backend Implementation (After File Organization)
1. Create FastAPI app structure
2. Implement core randomization module (migrate logic from 002-rpc.sql)
3. Implement study-specific logic
4. Create Auth0 middleware
5. Update database schema to be generic (simplify SQL, move logic to Python)
6. Create API endpoints to serve item banks to frontend

### Phase 5: React Component
1. Create React component wrapper
2. Integrate core modules
3. Add study-specific logic
4. Build and export component library

### Phase 6: Testing & Validation
1. Test core modules independently
2. Test study-specific logic
3. Integration testing
4. Update documentation

---

## Key Design Decisions

### 1. Item Bank Location
**Decision**: Item banks live in backend study directory (`packages/backend/studies/avalanche_2025/content/`)
**Rationale**: 
- Backend needs for validation/balancing
- Frontend can fetch via API endpoint or import at build time
- Single source of truth prevents sync issues
- Future: Backend can serve item banks via `/api/studies/{study_id}/content` endpoint

### 2. Config Location
**Decision**: Config in study directory (not core)
**Rationale**: Each study has different stages/routing requirements

### 3. Experience Band Logic
**Decision**: Study-specific (not core)
**Rationale**: Different studies may stratify differently (e.g., by age, expertise, etc.)

### 4. Database Schema
**Decision**: Generic schema with study_id column
**Rationale**: Supports multiple studies in same database

### 5. Frontend Build
**Decision**: React component library (not standalone app)
**Rationale**: Needs to integrate into existing React website

---

## Questions for Clarification

1. **Item Bank Updates**: When you add new questions and meta-cognitive questions, should these go directly into the study content directory?

2. **Component Export**: Should the React component be a default export or named export? Do you need TypeScript definitions?

3. **Build Tool**: Prefer Webpack, Vite, or Rollup for the frontend library build?

4. **Database**: Should we support multiple studies in one database instance, or separate databases per study?

5. **Auth0 Integration**: Do you have Auth0 credentials/domain already, or should I set up a placeholder structure?

---

## Next Steps

1. **Review this plan** - Confirm structure and approach
2. **Create directory structure** - Set up the monorepo folders
3. **Begin Phase 1 migration** - Start moving files systematically
4. **Implement FastAPI backend** - Create the Python backend structure
5. **Build React component** - Create the exportable component

Would you like me to proceed with creating the directory structure and beginning the migration?

