import { api } from '../api.js';

const API_BASE = '/api'; // same-origin; Vite forwards /api to the local server (see vite.config.ts)

/**
 * Fetch local AI recommendation for an appliance
 */
export async function fetchAiRecommendation(applianceName, ratedWatts, hoursPerDay, category) {
  try {
    // api() answers with the built-in assistant when the server or Ollama is unavailable
    return await api.post('/ai/recommendation', { applianceName, ratedWatts, hoursPerDay, category });
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