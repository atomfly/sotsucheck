// Configuration constants
const CONFIG = {
  // Base URL for the progress report system (to be set externally)
  BASE_URL: 'https://fukaya-lab.azurewebsites.net/', // この値は別途設定される (This value is set separately)
  
  // API endpoints
  ENDPOINTS: {
    REPORT_PAGE: '/report.html',
    API_MEMBER: '/api/lab/member'
  },
  
  // Application constants
  RULES: {
    REQUIRED_REPORTS: 123,
    ALLOWED_DAYS_OFF: 31,
    START_YEAR: 2025,
    START_MONTH: 4,
    START_DAY: 10,
    DEADLINE_HOUR: 9,
    TOTAL_WEEKDAYS: 154
  },
  
  // UI constants
  COLORS: {
    SUCCESS: '#16a34a',
    WARNING: '#d97706',
    ERROR: '#dc2626',
    INFO: '#3b82f6',
    NEUTRAL: '#6b7280'
  }
};

// Export for use in other modules
try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
  }
} catch (e) {
  if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
  }
}
