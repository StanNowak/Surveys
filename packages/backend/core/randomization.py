"""
Core Randomization Module
Generic "Stratified Least-Filled Bucket" logic for balanced assignment

This module provides reusable balancing logic for any study that needs to:
- Assign items (e.g., test blocks, conditions) to participants
- Balance item frequencies within strata (e.g., experience levels)
- Track assignments and counts for analysis

The logic is study-agnostic and can be used with any:
- Item types (AP types, test conditions, etc.)
- Stratification schemes (experience, demographics, etc.)
- Schema names (for multi-study databases)
"""

import random
from typing import List, Dict, Tuple, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session


class StratifiedBalancer:
    """
    Implements stratified least-filled bucket assignment logic.
    
    Generic, reusable class for any study that needs balanced assignment.
    Works with any item types, strata, and database schemas.
    
    Example usage:
        balancer = StratifiedBalancer(db, schema_name="study_xyz")
        result = balancer.assign_pair(uuid="abc", stratum="novice", 
                                      ap_list=["item1", "item2", "item3"])
    """
    
    def __init__(self, db_session: Session, schema_name: str = "s_ap_v1"):
        """
        Initialize balancer for a specific database schema.
        
        Args:
            db_session: SQLAlchemy database session
            schema_name: Database schema name (allows multi-study databases)
        """
        self.db = db_session
        self.schema = schema_name
    
    def assign_pair(
        self, 
        uuid: str, 
        stratum: str, 
        ap_list: List[str]
    ) -> Dict:
        """
        Assign a pair using stratified least-filled bucket logic.
        Balances individual items (not just pairs) within each stratum.
        
        Generic method that works with any item types and strata.
        Ensures each item appears roughly equally often within each stratum.
        
        Args:
            uuid: Participant UUID (unique identifier)
            stratum: Stratum identifier (e.g., "novice", "intermediate", "advanced", "group_a")
            ap_list: List of available item types (e.g., ["storm", "wind", "persistent"] or any item IDs)
        
        Returns:
            Dict with 'pair' (list of 2 items) and 'stratum'
        """
        # Normalize stratum
        stratum = stratum or "global"
        
        # Check if this UUID already has an allocation
        existing = self.db.execute(
            text(f"""
                SELECT assignment 
                FROM {self.schema}.allocations
                WHERE uuid = :uuid AND stratum = :stratum
            """),
            {"uuid": uuid, "stratum": stratum}
        ).fetchone()
        
        if existing:
            return existing[0]
        
        # Get individual AP type counts for this stratum
        ap_type_counts = {}
        for ap_type in ap_list:
            result = self.db.execute(
                text(f"""
                    SELECT count 
                    FROM {self.schema}.ap_type_counts
                    WHERE stratum = :stratum AND ap_type = :ap_type
                """),
                {"stratum": stratum, "ap_type": ap_type}
            ).fetchone()
            ap_type_counts[ap_type] = result[0] if result else 0
        
        # Generate all possible pairs
        pairs = []
        for i in range(len(ap_list)):
            for j in range(i + 1, len(ap_list)):
                ap_a = ap_list[i]
                ap_b = ap_list[j]
                # Store as (min, max) for consistency
                pairs.append((min(ap_a, ap_b), max(ap_a, ap_b), ap_a, ap_b))
        
        # Score each pair: prefer pairs where both AP types have low counts
        # Score = max(count_a, count_b) - this minimizes the maximum count
        pair_scores = []
        for ap_a_sorted, ap_b_sorted, ap_a, ap_b in pairs:
            count_a = ap_type_counts[ap_a]
            count_b = ap_type_counts[ap_b]
            # Score is the maximum count (we want to minimize this)
            max_count = max(count_a, count_b)
            pair_scores.append((ap_a_sorted, ap_b_sorted, ap_a, ap_b, max_count))
        
        # Find pair(s) with minimum score (lowest maximum count)
        min_score = min(score for _, _, _, _, score in pair_scores)
        best_pairs = [
            (ap_a_sorted, ap_b_sorted) 
            for ap_a_sorted, ap_b_sorted, _, _, score in pair_scores
            if score == min_score
        ]
        
        # Randomly select from best pairs
        selected_pair = random.choice(best_pairs)
        
        # Store allocation
        import json as json_lib
        assignment = {
            "pair": list(selected_pair),
            "stratum": stratum
        }
        
        self.db.execute(
            text(f"""
                INSERT INTO {self.schema}.allocations(uuid, stratum, assignment)
                VALUES (:uuid, :stratum, CAST(:assignment AS jsonb))
                ON CONFLICT (uuid) DO NOTHING
            """),
            {
                "uuid": uuid,
                "stratum": stratum,
                "assignment": json_lib.dumps(assignment)
            }
        )
        self.db.commit()
        
        return assignment
    
    def increment_pair_count(
        self, 
        stratum: str, 
        pair: List[str]
    ) -> None:
        """
        Increment the count for a pair and individual AP types (called on response submission).
        
        Args:
            stratum: Stratum identifier
            pair: List of 2 AP types
        """
        if len(pair) != 2:
            raise ValueError("Pair must contain exactly 2 items")
        
        ap_a, ap_b = min(pair[0], pair[1]), max(pair[0], pair[1])
        stratum = stratum or "global"
        
        # Increment pair count (for tracking/analysis)
        self.db.execute(
            text(f"""
                INSERT INTO {self.schema}.pair_counts(stratum, ap_a, ap_b, count)
                VALUES (:stratum, :ap_a, :ap_b, 1)
                ON CONFLICT (stratum, ap_a, ap_b)
                DO UPDATE SET 
                    count = {self.schema}.pair_counts.count + 1,
                    updated_at = now()
            """),
            {"stratum": stratum, "ap_a": ap_a, "ap_b": ap_b}
        )
        
        # Increment individual AP type counts (for balancing)
        for ap_type in pair:
            self.db.execute(
                text(f"""
                    INSERT INTO {self.schema}.ap_type_counts(stratum, ap_type, count)
                    VALUES (:stratum, :ap_type, 1)
                    ON CONFLICT (stratum, ap_type)
                    DO UPDATE SET 
                        count = {self.schema}.ap_type_counts.count + 1,
                        updated_at = now()
                """),
                {"stratum": stratum, "ap_type": ap_type}
            )
        
        self.db.commit()

