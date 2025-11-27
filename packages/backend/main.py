"""
FastAPI Application Entry Point
Study Engine Backend API
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional
import json
import os
from pathlib import Path

from backend.core.database import get_db_connection
from backend.core.randomization import StratifiedBalancer
from backend.core.auth import optional_auth
from backend.studies.avalanche_2025.logic import derive_experience_band

app = FastAPI(
    title="Study Engine API",
    description="Backend API for survey study engine",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Study ID constant (for now, hardcoded to avalanche_2025)
STUDY_ID = "avalanche_2025"
SCHEMA_NAME = "s_ap_v1"


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "study-engine-api"}


@app.post("/api/studies/avalanche_2025/assign")
async def assign_pair(
    request: Dict,
    # auth: Optional[dict] = Depends(optional_auth)  # Uncomment when Auth0 is ready
):
    """
    Assign a pair using stratified least-filled bucket logic.
    
    Request body:
        {
            "p_uuid": "participant-uuid",
            "p_stratum": "novice|intermediate|advanced",
            "p_ap_list": ["storm", "wind", "persistent", ...]
        }
    
    Returns:
        {
            "pair": ["ap_type1", "ap_type2"],
            "stratum": "novice|intermediate|advanced"
        }
    """
    try:
        uuid = request.get("p_uuid")
        stratum = request.get("p_stratum", "global")
        ap_list = request.get("p_ap_list", [])
        
        if not uuid:
            raise HTTPException(status_code=400, detail="p_uuid is required")
        if not ap_list:
            raise HTTPException(status_code=400, detail="p_ap_list is required")
        
        # Get database connection (required for balancing)
        db = next(get_db_connection())
        balancer = StratifiedBalancer(db, SCHEMA_NAME)
        result = balancer.assign_pair(uuid, stratum, ap_list)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/studies/avalanche_2025/submit")
async def submit_response(
    request: Dict,
    db = Depends(get_db_connection),
    # auth: Optional[dict] = Depends(optional_auth)  # Uncomment when Auth0 is ready
):
    """
    Submit survey response and increment pair counts.
    
    Request body:
        {
            "p_payload": {
                "uuid": "participant-uuid",
                "survey_id": "avalanche_2025",
                "pair": ["ap_type1", "ap_type2"],
                "stratum": "novice|intermediate|advanced",
                "answers": {...},
                "timings": {...},
                ...
            }
        }
    
    Returns:
        {"success": true}
    """
    try:
        payload = request.get("p_payload")
        if not payload:
            raise HTTPException(status_code=400, detail="p_payload is required")
        
        uuid = payload.get("uuid")
        survey_id = payload.get("survey_id", STUDY_ID)
        pair = payload.get("pair", [])
        stratum = payload.get("stratum", "global")
        
        print(f"📥 SUBMIT REQUEST: uuid={uuid}, survey_id={survey_id}, stratum={stratum}, pair={pair}")
        
        if not uuid:
            raise HTTPException(status_code=400, detail="uuid is required in payload")
        
        # Increment pair count
        if pair and len(pair) == 2:
            print(f"📊 Incrementing pair count: stratum={stratum}, pair={pair}")
            balancer = StratifiedBalancer(db, SCHEMA_NAME)
            balancer.increment_pair_count(stratum, pair)
            print(f"✅ Pair count incremented")
        
        # Save response
        payload_json = json.dumps(payload)
        print(f"💾 Saving response: uuid={uuid}, payload_size={len(payload_json)} chars")
        
        with db.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO {SCHEMA_NAME}.responses(
                    uuid, survey_id, payload, panel_member, bank_version, config_version
                ) VALUES (
                    %s, %s, %s::jsonb, %s, %s, %s
                )
                """,
                (
                    uuid,
                    survey_id,
                    payload_json,
                    payload.get("panel_member", False),
                    payload.get("bank_version"),
                    payload.get("config_version")
                )
            )
        db.commit()
        print(f"✅ Response saved successfully")
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"❌ SUBMIT ERROR: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/studies/avalanche_2025/content/item_bank")
async def get_item_bank(
    # auth: Optional[dict] = Depends(optional_auth)  # Uncomment when Auth0 is ready
):
    """
    Get item bank for avalanche_2025 study.
    
    Returns:
        Item bank JSON
    """
    try:
        bank_path = Path(__file__).parent / "studies" / "avalanche_2025" / "content" / "item_bank.json"
        with open(bank_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Item bank not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/studies/avalanche_2025/content/background")
async def get_background(
    # auth: Optional[dict] = Depends(optional_auth)  # Uncomment when Auth0 is ready
):
    """
    Get background questionnaire for avalanche_2025 study.
    
    Returns:
        Background questionnaire JSON
    """
    try:
        bg_path = Path(__file__).parent / "studies" / "avalanche_2025" / "content" / "background.json"
        with open(bg_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Background questionnaire not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/studies/avalanche_2025/content/ap_intro")
async def get_ap_intro(
    # auth: Optional[dict] = Depends(optional_auth)  # Uncomment when Auth0 is ready
):
    """
    Get AP intro questionnaire for avalanche_2025 study.
    
    Returns:
        AP intro questionnaire JSON
    """
    try:
        ap_intro_path = Path(__file__).parent / "studies" / "avalanche_2025" / "content" / "ap_intro.json"
        with open(ap_intro_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="AP intro questionnaire not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/studies/avalanche_2025/content/diagnostics")
async def get_diagnostics(
    # auth: Optional[dict] = Depends(optional_auth)  # Uncomment when Auth0 is ready
):
    """
    Get diagnostic/assessment questions for avalanche_2025 study.
    
    Returns:
        Diagnostics questions JSON array
    """
    try:
        diagnostics_path = Path(__file__).parent / "studies" / "avalanche_2025" / "content" / "diagnostics.json"
        with open(diagnostics_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Diagnostics not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/studies/avalanche_2025/config")
async def get_config(
    # auth: Optional[dict] = Depends(optional_auth)  # Uncomment when Auth0 is ready
):
    """
    Get configuration for avalanche_2025 study.
    
    Returns:
        Study configuration JSON
    """
    try:
        config_path = Path(__file__).parent / "studies" / "avalanche_2025" / "config.json"
        with open(config_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Config not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

