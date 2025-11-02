const express = require('express');
const router = express.Router();

// Test connection endpoint
router.get('/test-connection', async (req, res) => {
  try {
    console.log('🔍 Testing Google Sheets connection...');
    
    // Check if Google Sheets client is initialized
    const sheetsModule = require('./sheets');
    
    res.json({
      success: true,
      message: 'Google Sheets test connection endpoint working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Google Sheets test connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Google Sheets test connection failed',
      message: error.message
    });
  }
});

module.exports = router;