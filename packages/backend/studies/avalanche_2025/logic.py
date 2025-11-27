"""
Avalanche 2025 Study Logic
Study-specific logic for experience band calculation
"""


def derive_experience_band(years: str, training: str) -> str:
    """
    Derive experience band from years and training level.
    
    Args:
        years: Years of experience (e.g., "0-1", "2-5", "6+")
        training: Highest training level (e.g., "none", "awareness", "level1", "level2")
    
    Returns:
        Experience band: "novice", "intermediate", or "advanced"
    """
    years = str(years or "").strip()
    training = str(training or "").strip().lower()
    
    # Novice: 0-1 years OR no formal training/awareness only
    if years == "0-1" or training in ["none", "awareness"]:
        return "novice"
    
    # Intermediate: 2-5 years OR level 1 training
    if years == "2-5" or training == "level1":
        return "intermediate"
    
    # Advanced: 6+ years OR level 2+ training
    return "advanced"

