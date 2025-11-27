# FastAPI Backend

## Setup

1. **Start Docker Desktop** (required for PostgreSQL):
   - Open Docker Desktop application
   - Wait for it to fully start (whale icon in menu bar)

2. **Start the database**:
   ```bash
   cd packages/backend
   docker-compose up -d
   ```
   
   This will:
   - Pull PostgreSQL 16 image (first time only)
   - Start database on port 5433
   - Initialize schema from `db/init/` scripts

3. **Verify database is running**:
   ```bash
   docker ps | grep postgres
   ```
   
   You should see a container named `backend-db-1` running.

4. **Install Python dependencies** (if not already done):
   ```bash
   cd packages/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

5. **Run the API**:
   ```bash
   ./start.sh
   # Or manually:
   uvicorn backend.main:app --reload --port 8000
   ```

## API Endpoints

### Health Check
- `GET /` - Health check

### Study Endpoints (avalanche_2025)

- `POST /api/studies/avalanche_2025/assign` - Assign pair (requires database)
- `POST /api/studies/avalanche_2025/submit` - Submit response (requires database)
- `GET /api/studies/avalanche_2025/content/item_bank` - Get item bank
- `GET /api/studies/avalanche_2025/content/background` - Get background questionnaire
- `GET /api/studies/avalanche_2025/content/ap_intro` - Get AP intro section
- `GET /api/studies/avalanche_2025/content/diagnostics` - Get diagnostics
- `GET /api/studies/avalanche_2025/config` - Get study config

## Database

The database is required for:
- **Pair assignment** - Stratified balancing logic
- **Response storage** - Saving survey submissions

**Database connection**: `postgresql://postgres:postgres@localhost:5433/surveys`

**Schema**: `s_ap_v1` (created automatically on first startup)

**Database Library**: Uses `psycopg2-binary` directly (no ORM)

## Troubleshooting

### "Database not available" error
1. Check Docker is running: `docker info`
2. Check database container: `docker ps | grep postgres`
3. Start database: `cd packages/backend && docker-compose up -d`
4. Wait a few seconds for database to initialize

### "Cannot connect to Docker daemon"
- Start Docker Desktop application
- Wait for it to fully initialize (check menu bar icon)

### Database connection refused
- Verify port 5433 is not in use: `lsof -i :5433`
- Check container logs: `docker logs backend-db-1`

## Development

The API runs on `http://localhost:8000` by default.

API docs available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
