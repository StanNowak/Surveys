/**
 * Avalanche 2025 Study Logic
 * Study-specific logic for experience band calculation and pair assignment
 */

import { assignPair } from '../../core/api.js';

/**
 * Derive experience band from years and training level
 * @param {string} years - Years of experience (e.g., "0-1", "2-5", "6+")
 * @param {string} training - Highest training level (e.g., "none", "awareness", "level1", "level2")
 * @returns {string} Experience band: "novice", "intermediate", or "advanced"
 */
export function deriveExperienceBand(survey) {
  // Get values from new background questions
  // Matrix question returns object like: {"number_of_winters": "first_winter"}
  const experienceMatrix = survey.getValue("experience_matrix");
  let winters = "";
  if (experienceMatrix && typeof experienceMatrix === 'object') {
    winters = experienceMatrix.number_of_winters || "";
  }
  
  // Fallback to old field name
  if (!winters) {
    winters = survey.getValue("experience_years") || "";
  }
  
  const training = survey.getValue("highest_training") || "";
  
  // Map new winter values to experience bands
  let years = "";
  if (winters === "first_winter" || winters === "second_winter" || winters === "0-1") {
    years = "0-1";
  } else if (winters === "3-5_winters" || winters === "2-5") {
    years = "2-5";
  } else if (winters === "6-10_winters" || winters === "6-10") {
    years = "6-10";
  } else if (winters === "11-20_winters" || winters === "11-20") {
    years = "11-20";
  } else if (winters === "20+_winters" || winters === "20+") {
    years = "20+";
  } else {
    years = String(winters || "");
  }
  
  const y = String(years || ""); 
  const t = String(training || "").toLowerCase();
  
  // Novice: first/second winter OR no formal training/awareness only
  if (["0-1", "first_winter", "second_winter"].includes(y) || 
      ["none", "awareness"].includes(t)) {
    return "novice";
  }
  
  // Intermediate: 3-5 winters OR intro course
  if (["2-5", "3-5_winters"].includes(y) || 
      ["intro", "level1"].includes(t)) {
    return "intermediate";
  }
  
  // Advanced: 6+ winters OR advanced/professional training
  return "advanced";
}

/**
 * Get assigned pair for a participant
 * @param {Object} bank - Item bank data
 * @param {Object} survey - SurveyJS model instance
 * @param {Object} config - Configuration object with URLs and settings
 * @returns {Promise<Object>} Assignment result with pair and stratum
 */
export async function getAssignedPair(bank, survey, config) {
  const apList = (bank.testlets || []).map(t => t.ap_type).filter(Boolean);
  const stratum = deriveExperienceBand(survey) || "global";
  survey.setValue(config.STRATUM_FROM_FIELD || "experience_band", stratum);

  const backendEnabled = config.MODE === "prod" && !!config.ASSIGN_URL && !!config.SAVE_URL;

  if (backendEnabled) {
    const uuid = new URLSearchParams(location.search).get("uuid") || crypto.randomUUID();
    
    console.log("🔄 Pair Assignment:", { uuid, stratum, apList: apList.length, backendEnabled });
    
    try {
      const out = await assignPair(config.ASSIGN_URL, uuid, stratum, apList);
      console.log("✅ Assignment successful:", out);
      
      survey.setValue("__assigned_pair", out.pair);
      survey.setValue("__assigned_stratum", out.stratum || stratum);
      
      // Return assignment in format expected by study engine
      return {
        pair: out.pair,
        stratum: out.stratum || stratum,
        selectedBlocks: out.pair // The pair contains the selected block IDs
      };
    } catch (e) {
      console.warn("⚠️ Backend assignment failed, falling back to local:", e.message);
      // Backend assignment failed, fall back to local
    }
  }
  
  // Local fallback
  const pairs = [];
  for (let i=0;i<apList.length;i++) {
    for (let j=i+1;j<apList.length;j++) {
      pairs.push([apList[i], apList[j]]);
    }
  }
  const pick = pairs[Math.floor(Math.random() * pairs.length)];
  
  survey.setValue("__assigned_pair", pick);
  survey.setValue("__assigned_stratum", stratum);
  
  return { 
    pair: pick, 
    stratum,
    selectedBlocks: pick // The pair contains the selected block IDs
  };
}

/**
 * Study-specific logic hooks for core study engine
 */
export class Avalanche2025StudyLogic {
    constructor() {
        this.name = "Avalanche 2025 Study Logic";
    }
  /**
   * Customize section builder for study-specific needs
   * @param {SectionBuilder} sectionBuilder - The section builder instance
   * @param {Object} sectionDef - Section definition
   */
  customizeSectionBuilder(sectionBuilder, sectionDef) {
    // Override afterBlock pages to add meta-cognitive questions
    if (sectionDef.type === 'block_group' && sectionDef.afterBlock) {
      const studyLogic = this;
      sectionBuilder._buildAfterBlockPages = function(block, participantData) {
        return studyLogic.buildMetaCognitiveQuestion(block);
      };
    }
  }
  
  /**
   * Build meta-cognitive question page after an AP block
   * @param {Object} block - The block that was just completed
   * @returns {Array} Array of page objects (one page with meta-cognitive question)
   */
  buildMetaCognitiveQuestion(block) {
    const blockId = block.id || block.ap_type;
    const blockLabel = block.label || block.title || 'this block';
    
    return [{
      name: `${blockId}_metacognitive`,
      title: "Confidence Assessment",
      elements: [{
        type: "radiogroup",
        name: `${blockId}_confidence`,
        title: "How confident are you in your answers for this avalanche problem?",
        isRequired: true,
        colCount: 1, // Force vertical layout (1 = single column per SurveyJS docs)
        enableHTML: false, // No HTML needed
        choices: [
          { value: "1", text: "Not at all confident" },
          { value: "2", text: "Slightly confident" },
          { value: "3", text: "Moderately confident" },
          { value: "4", text: "Very confident" },
          { value: "5", text: "Extremely confident" }
        ],
        // Metadata for analysis
        tags: ["metacognitive", "confidence"],
        block_id: blockId
      }]
    }];
  }
}

