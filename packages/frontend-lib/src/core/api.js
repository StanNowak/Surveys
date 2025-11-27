/**
 * API Client Module
 * Generic API client for backend RPC calls
 */

/**
 * Make an RPC call to the backend
 * @param {string} url - API endpoint URL
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response data
 */
export async function rpc(url, body) {
  console.log("📡 API Request:", { url, bodyKeys: Object.keys(body) });
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const errorText = await r.text();
      console.error("❌ API Error:", { status: r.status, statusText: r.statusText, error: errorText });
      throw new Error(`HTTP ${r.status}: ${errorText}`);
    }
    const result = await r.json();
    console.log("✅ API Response:", result);
    return result;
  } catch (error) {
    console.error("❌ API Request failed:", { url, error: error.message });
    // Re-throw with more context for network/CORS errors
    if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
      throw new Error(`Network error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Assign a pair using the backend API
 * @param {string} assignUrl - Assignment endpoint URL
 * @param {string} uuid - Participant UUID
 * @param {string} stratum - Stratum identifier
 * @param {Array<string>} apList - List of available AP types
 * @returns {Promise<Object>} Assignment result with pair and stratum
 */
export async function assignPair(assignUrl, uuid, stratum, apList) {
  return await rpc(assignUrl, { 
    p_uuid: uuid, 
    p_stratum: stratum, 
    p_ap_list: apList 
  });
}

/**
 * Submit survey response to backend
 * @param {string} saveUrl - Submission endpoint URL
 * @param {Object} payload - Complete survey payload
 * @returns {Promise<Object>} Submission result
 */
export async function submitResponse(saveUrl, payload) {
  return await rpc(saveUrl, { p_payload: payload });
}

