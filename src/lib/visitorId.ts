/**
 * Persistent anonymous visitor ID for unique visitor tracking.
 * Stored in localStorage to persist across browser sessions.
 */

const VISITOR_ID_KEY = "ancora_visitor_id";

/**
 * Generate a random UUID-like visitor ID
 */
const generateVisitorId = (): string => {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Get or create a persistent visitor ID.
 * Returns the same ID for the same visitor across sessions.
 */
export const getVisitorId = (): string => {
  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    
    if (!visitorId) {
      visitorId = generateVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
    
    return visitorId;
  } catch {
    // localStorage not available - generate ephemeral ID
    // This will be unique per page load but not persistent
    return generateVisitorId();
  }
};
