# Developer Handover Documentation

Complete technical documentation for developers taking over the Study Engine project.

## Architecture Overview

The Study Engine is a **monorepo** organized into packages:

```
packages/
├── backend/          # FastAPI Python backend
│   ├── core/         # Reusable core logic
│   └── studies/      # Study-specific implementations
├── frontend-lib/     # Frontend JavaScript library
│   ├── core/         # Reusable core components
│   └── studies/      # Study-specific implementations
└── shared/           # Shared schemas and types
    └── schemas/      # JSON schemas for validation
```

**Entry Points:**
- Frontend: `public/index.html` → `src/main.js`
- Backend: `packages/backend/main.py`

## Technology Stack

### Backend
- **FastAPI** (Python 3.13+)
- **PostgreSQL 16** (via Docker)
- **SQLAlchemy** (ORM)
- **psycopg2-binary** (PostgreSQL adapter)

### Frontend
- **Vanilla JavaScript** (ES modules)
- **SurveyJS** (jQuery version)
- **jQuery** (required for SurveyJS)

### Infrastructure
- **Docker Compose** (PostgreSQL)
- **Netlify** (frontend deployment)

## Setup Instructions

### Prerequisites
- Node.js (for frontend server)
- Python 3.13+ (for backend)
- Docker Desktop (for PostgreSQL)

### Backend Setup

1. **Start Database:**
   ```bash
   cd packages/backend
   docker-compose up -d
   ```

2. **Install Dependencies:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Start Backend:**
   ```bash
   ./start.sh
   # Or manually:
   uvicorn backend.main:app --reload --port 8000
   ```

Backend runs on `http://localhost:8000`

### Frontend Setup

1. **Start Development Server:**
   ```bash
   ./start-server.sh
   # Or manually:
   npx serve . -p 3000
   ```

2. **Open in Browser:**
   ```
   http://localhost:3000/public/
   ```

## Key Components

### Backend Core

**`packages/backend/core/database.py`**
- Database connection management
- Lazy initialization (allows startup without DB)
- Session management

**`packages/backend/core/randomization.py`**
- Stratified least-filled bucket algorithm
- Balances individual items within strata
- Generic and reusable for any study

**`packages/backend/core/auth.py`**
- Auth0 middleware (dev mode: accepts any token)
- Production mode: TODO (JWT verification)

**`packages/backend/main.py`**
- FastAPI application
- API endpoints for content, assignment, submission
- CORS configuration

### Frontend Core

**`packages/frontend-lib/src/core/study-engine.js`**
- Core survey building engine
- Processes study definitions
- Handles section types and randomization

**`packages/frontend-lib/src/core/builder-v2.js`**
- Modern survey builder (uses Study Engine)
- Loads content from backend
- Integrates study-specific logic

**`packages/frontend-lib/src/core/instrumentation.js`**
- Response time tracking
- Idle time tracking
- Per-question timing data

**`packages/frontend-lib/src/core/feedback.js`**
- Grading logic
- Feedback rendering
- Handles matrix questions (no grading, just explanations)

**`packages/frontend-lib/src/core/api.js`**
- Generic API client
- RPC wrapper functions
- Error handling

### Study-Specific

**`packages/backend/studies/avalanche_2025/logic.py`**
- Experience band calculation
- Study-specific backend logic

**`packages/frontend-lib/src/studies/avalanche_2025/logic.js`**
- Experience band derivation
- Pair assignment
- Meta-cognitive question generation
- Study-specific frontend hooks

## Database Schema

**Schema:** `s_ap_v1`

**Tables:**
- `allocations`: Participant assignments (uuid → pair)
- `pair_counts`: Pair frequency tracking
- `ap_type_counts`: Individual item frequency tracking (for balancing)
- `responses`: Complete survey submissions (JSONB payload)

**Views:**
- `balance_report`: AP type balance monitoring

See `packages/backend/db/init/001-core.sql` for full schema.

## API Endpoints

### Content Endpoints (GET)
- `/api/studies/avalanche_2025/config` - Study configuration
- `/api/studies/avalanche_2025/content/item_bank` - Question bank
- `/api/studies/avalanche_2025/content/background` - Background questions
- `/api/studies/avalanche_2025/content/ap_intro` - AP intro section
- `/api/studies/avalanche_2025/content/diagnostics` - Assessment questions

### Functional Endpoints (POST)
- `/api/studies/avalanche_2025/assign` - Assign participant to condition
  - Body: `{p_uuid, p_stratum, p_ap_list}`
  - Returns: `{pair, stratum}`
  
- `/api/studies/avalanche_2025/submit` - Submit survey response
  - Body: `{p_payload: {uuid, survey_id, pair, stratum, answers, timings, ...}}`
  - Returns: `{success: true}`

## Data Flow

1. **Survey Load:**
   - Frontend loads config, study definition, content from backend
   - Study Engine processes definition and builds survey

2. **Background Completion:**
   - Experience band calculated from background questions
   - Frontend calls `/assign` with stratum and AP list
   - Backend returns balanced pair assignment

3. **Survey Completion:**
   - Timing data collected throughout
   - Answers and timings separated
   - Frontend calls `/submit` with complete payload
   - Backend saves to database and increments balance counts

## Balancing Logic

The system uses **Stratified Least-Filled Bucket** algorithm:

1. Tracks individual item counts within each stratum
2. Generates all possible pairs
3. Scores each pair by maximum count of its items
4. Selects pair(s) with minimum score
5. Randomly selects from best pairs

This ensures each AP type appears roughly equally within each experience level.

## Environment Configuration

**Frontend:** `public/env.js` and `public/env.local.js`
- `MODE`: "prod" or "test"
- `ASSIGN_URL`: Assignment endpoint
- `SAVE_URL`: Submission endpoint
- Content URLs: Point to backend API

**Backend:** Environment variables
- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://postgres:postgres@localhost:5433/surveys`)
- `AUTH0_DOMAIN`: Auth0 domain (optional, for production)

## Deployment

### Frontend (Netlify)
- Static files in `public/`
- `netlify.toml` configures build
- Serves from `public/` directory

### Backend
- FastAPI application
- Requires PostgreSQL database
- Deploy with `uvicorn` or similar ASGI server
- Set `DATABASE_URL` environment variable

## Testing

**Assignment Testing:**
```bash
./test-assignment.sh
```

**Manual Testing:**
1. Start backend and frontend
2. Complete survey
3. Check browser console for logs
4. Check backend logs: `tail -f /tmp/fastapi.log`
5. Verify database: `docker exec backend-db-1 psql -U postgres -d surveys -c "SELECT * FROM s_ap_v1.responses;"`

## Troubleshooting

**Database Connection Issues:**
- Check Docker is running: `docker ps`
- Check database container: `docker ps | grep postgres`
- Verify connection: `docker exec backend-db-1 psql -U postgres -d surveys -c "SELECT 1;"`

**Frontend Not Loading:**
- Check backend is running: `curl http://localhost:8000/`
- Check browser console for errors
- Verify content URLs in `env.local.js`

**Assignment Not Working:**
- Check backend logs for errors
- Verify database schema initialized
- Check stratum calculation logic

**Timing Data Missing:**
- Verify instrumentation attached: Check browser console
- Check `survey.data` contains `rt_*` fields
- Verify timing extraction in `onCompleteSubmit`

## Code Organization Principles

1. **Core vs Study-Specific:**
   - Core: Reusable across all studies
   - Study-specific: Only for this study

2. **Pluggable Logic:**
   - Study logic "plugs into" core engine
   - Custom hooks for study-specific behavior

3. **Separation of Concerns:**
   - Backend: Data, balancing, storage
   - Frontend: UI, timing, user interaction
   - Shared: Schemas, types

## Future Enhancements

- [ ] Real Auth0 JWT verification
- [ ] Additional study types
- [ ] Advanced randomization strategies
- [ ] Analytics dashboard
- [ ] Export tools for data analysis

## Key Files Reference

**Backend:**
- `packages/backend/main.py` - API entry point
- `packages/backend/core/randomization.py` - Balancing logic
- `packages/backend/db/init/001-core.sql` - Database schema

**Frontend:**
- `src/main.js` - Application entry point
- `packages/frontend-lib/src/core/study-engine.js` - Core engine
- `public/index.html` - HTML entry point

**Configuration:**
- `packages/backend/studies/avalanche_2025/config.json` - Study config
- `packages/frontend-lib/src/studies/avalanche_2025/study-definition.json` - Study structure

## Support

- Architecture details: See `REFACTORING-PLAN.md`
- Survey design: See `docs/SURVEY-DESIGNER-GUIDE.md`
- Backend API docs: `http://localhost:8000/docs` (Swagger UI)

