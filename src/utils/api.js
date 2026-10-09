const API_BASE = '/api'; // same-origin; Vite forwards /api to the local server (see vite.config.ts)

/**
 * Fetch local AI recommendation for an appliance
 */
export async function fetchAiRecommendation(applianceName, ratedWatts, hoursPerDay) {
  try {
    const response = await fetch(`${API_BASE}/ai/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applianceName, ratedWatts, hoursPerDay }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Fetch Error:', error);
    return { success: false, error: 'Could not connect to backend server.' };
  }
}

/**
 * Fetch appliances list from SQLite
 */
export async function fetchAppliances() {
  try {
    const response = await fetch(`${API_BASE}/appliances`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch appliances:', error);
    return [];
  }
}