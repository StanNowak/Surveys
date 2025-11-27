# Study Engine - Avalanche Problems Research

A modular monorepo for building and deploying survey studies, currently configured for the Avalanche Problems research study.

## 📚 Documentation

- **[Survey Designer Guide](docs/SURVEY-DESIGNER-GUIDE.md)** - For researchers creating/modifying surveys
- **[Developer Handover](docs/DEVELOPER-HANDOVER.md)** - Complete technical documentation for developers
- **[Refactoring Plan](REFACTORING-PLAN.md)** - Architecture decisions and refactoring history

## Architecture

The project is organized as a monorepo with the following structure:

```
packages/
├── backend/          # FastAPI backend (Python)
│   ├── core/         # Reusable core logic
│   └── studies/      # Study-specific implementations
├── frontend-lib/     # Frontend library (JavaScript/ES modules)
│   ├── core/         # Reusable core components
│   └── studies/      # Study-specific implementations
└── shared/           # Shared schemas and types
```

**Entry Points:**
- Frontend: `public/index.html` → `src/main.js`
- Backend: `packages/backend/main.py`

## Quick Start

### Backend (FastAPI)

1. **Set up Python environment**:
   ```bash
   cd packages/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Start database** (PostgreSQL):
   ```bash
   docker-compose up -d
   ```

3. **Start FastAPI server**:
   ```bash
   ./start.sh
   # Or manually:
   uvicorn backend.main:app --reload --port 8000
   ```

The API will be available at `http://localhost:8000`

### Frontend

1. **Start static file server**:
   ```bash
   ./start-server.sh
   # Or manually:
   npx serve . -p 3000
   ```

2. **Open in browser**:
   - http://localhost:3000/public/

## Study Content

All study content is located in:
- `packages/backend/studies/avalanche_2025/content/`
  - `item_bank.json` - AP blocks (testlets)
  - `background.json` - Background questionnaire
  - `ap_intro.json` - AP intro section
  - `diagnostics.json` - Assessment questions
- `packages/backend/studies/avalanche_2025/config.json` - Study configuration
- `packages/frontend-lib/src/studies/avalanche_2025/study-definition.json` - Study structure

## API Endpoints

- `GET /` - Health check
- `GET /api/studies/avalanche_2025/config` - Get study configuration
- `GET /api/studies/avalanche_2025/content/item_bank` - Get item bank
- `GET /api/studies/avalanche_2025/content/background` - Get background questionnaire
- `GET /api/studies/avalanche_2025/content/ap_intro` - Get AP intro section
- `GET /api/studies/avalanche_2025/content/diagnostics` - Get assessment questions
- `POST /api/studies/avalanche_2025/assign` - Assign participant to condition
- `POST /api/studies/avalanche_2025/submit` - Submit survey response

API docs available at: http://localhost:8000/docs

## Development

### Local Development

The frontend is configured to use the backend API when running locally. See `public/env.local.js` for local overrides.

### Authentication

Auth0 is configured in dev mode (no external setup required). Set `AUTH0_DOMAIN` environment variable to enable production Auth0 verification.

## Repository Structure

**Core Code:**
- `packages/` - Monorepo packages (backend, frontend-lib, shared)
- `public/` - Frontend entry point and static assets
- `src/` - Frontend application code
- `scripts/` - Validation and utility scripts

**Configuration:**
- `netlify.toml` - Frontend deployment config
- `packages/backend/docker-compose.yml` - Database setup

**Documentation:**
- `docs/` - User and developer documentation
- `README.md` - This file
- `REFACTORING-PLAN.md` - Architecture reference

## Testing

Test assignment balancing:
```bash
./test-assignment.sh
```

Stop all servers:
```bash
./STOP-SERVERS.sh
```

## License

[Add license information here]
