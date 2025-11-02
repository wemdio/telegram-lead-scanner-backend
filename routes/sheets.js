const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

let sheetsClient = null;
let auth = null;

// Auto-initialize Google Sheets from frontend localStorage data
router.post('/auto-initialize', async (req, res) => {
  try {
    const { googleServiceAccountEmail, googlePrivateKey, googleSpreadsheetId } = req.body;
    
    console.log('🔧 Auto-initializing Google Sheets from localStorage data...');
    
    if (!googleServiceAccountEmail || !googlePrivateKey) {
      return res.status(400).json({ 
        success: false,
        error: 'Google Sheets credentials not found in localStorage' 
      });
    }

    // Use the existing initialize logic
    const initResponse = await initializeGoogleSheetsClient({
      privateKey: googlePrivateKey,
      clientEmail: googleServiceAccountEmail,
      projectId: 'telegram-scanner'
    });

    if (initResponse.success) {
      console.log('✅ Google Sheets auto-initialized successfully');
      return res.json({
        success: true,
        message: 'Google Sheets client auto-initialized from localStorage',
        mock: initResponse.mock || false
      });
    } else {
      return res.status(500).json({
        success: false,
        error: initResponse.error || 'Failed to auto-initialize Google Sheets'
      });
    }
  } catch (error) {
    console.error('❌ Auto-initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-initialize Google Sheets client',
      message: error.message
    });
  }
});

// Helper function to initialize Google Sheets client
async function initializeGoogleSheetsClient({ privateKey, clientEmail, projectId }) {
  try {
    console.log('🔍 Checking credentials:', { 
      privateKey: privateKey.substring(0, 50) + '...', 
      clientEmail, 
      projectId 
    });
    
    // Check if we're using mock/test credentials first
    const isMockMode = privateKey.includes('MOCK') || 
                      clientEmail.includes('mock') || 
                      projectId.includes('mock') ||
                      privateKey.includes('your_private_key_here') ||
                      clientEmail.includes('your_client_email_here') ||
                      projectId.includes('your_project_id_here') ||
                      privateKey === 'test_key' ||
                      clientEmail === 'test@example.com' ||
                      projectId === 'test_project' ||
                      !privateKey.includes('BEGIN PRIVATE KEY');

    console.log('🔍 Mock mode check:', isMockMode);

    if (isMockMode) {
      console.log('📋 Initializing Google Sheets client in mock mode');
      // Set a mock client indicator
      sheetsClient = { mock: true };
      auth = { mock: true };
      
      return { 
        success: true, 
        message: 'Google Sheets client initialized successfully (mock mode)',
        mock: true
      };
    }

    // console.log('🔍 Proceeding with real Google Sheets initialization');

    // Create JWT auth client for real credentials only
    // Properly format the private key
    let formattedPrivateKey = privateKey;
    
    // Handle different private key formats
    if (typeof privateKey === 'string') {
      // Replace escaped newlines
      formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      
      // Ensure proper PEM format
      if (!formattedPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('❌ Invalid private key format: missing BEGIN PRIVATE KEY header');
        throw new Error('Invalid private key format: missing BEGIN PRIVATE KEY header');
      }
      
      if (!formattedPrivateKey.includes('-----END PRIVATE KEY-----')) {
        console.error('❌ Invalid private key format: missing END PRIVATE KEY footer');
        throw new Error('Invalid private key format: missing END PRIVATE KEY footer');
      }
      
      // Clean up any extra whitespace or formatting issues
      formattedPrivateKey = formattedPrivateKey.trim();
    }

    console.log('🔍 Private key format validation passed');

    auth = new google.auth.JWT(
      clientEmail,
      null,
      formattedPrivateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    // Authorize the client with better error handling
    console.log('🔐 Attempting to authorize Google Sheets client...');
    await auth.authorize();
    
    // Create Sheets API client
    sheetsClient = google.sheets({ version: 'v4', auth });
    
    return { 
      success: true, 
      message: 'Google Sheets client initialized successfully',
      mock: false
    };
  } catch (error) {
    console.error('Google Sheets initialization error:', error);
    return { 
      success: false,
      error: 'Failed to initialize Google Sheets client', 
      message: error.message 
    };
  }
}

// Initialize Google Sheets client
router.post('/initialize', async (req, res) => {
  try {
    const { privateKey, clientEmail, projectId } = req.body;
    
    if (!privateKey || !clientEmail || !projectId) {
      return res.status(400).json({ 
        error: 'Private key, client email, and project ID are required' 
      });
    }

    // Use the helper function
    const initResponse = await initializeGoogleSheetsClient({
      privateKey,
      clientEmail,
      projectId
    });

    if (initResponse.success) {
      return res.json(initResponse);
    } else {
      return res.status(500).json({
        error: initResponse.error || 'Failed to initialize Google Sheets client',
        message: initResponse.message
      });
    }
  } catch (error) {
    console.error('Google Sheets initialization error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize Google Sheets client', 
      message: error.message 
    });
  }
});
// Create new spreadsheet
router.post('/create', async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Spreadsheet title is required' });
    }

    const response = await sheetsClient.spreadsheets.create({
      resource: {
        properties: {
          title: title
        }
      }
    });

    const spreadsheetId = response.data.spreadsheetId;
    const spreadsheetUrl = response.data.spreadsheetUrl;

    res.json({ 
      success: true, 
      spreadsheetId, 
      spreadsheetUrl,
      message: 'Spreadsheet created successfully' 
    });
  } catch (error) {
    // console.error('Create spreadsheet error:', error);
    res.status(500).json({ 
      error: 'Failed to create spreadsheet', 
      message: error.message 
    });
  }
});

// Add headers to spreadsheet
router.post('/headers', async (req, res) => {
  try {
    const { spreadsheetId, headers, forceUpdate = false } = req.body;
    
    // Check if we're in mock mode (no real credentials or mock client)
    const isMockMode = !sheetsClient || 
      (sheetsClient && sheetsClient.mock) ||
      process.env.GOOGLE_PRIVATE_KEY === 'your_private_key_here' ||
      process.env.GOOGLE_CLIENT_EMAIL === 'your_client_email_here' ||
      process.env.GOOGLE_PROJECT_ID === 'your_project_id_here';
    
    if (isMockMode) {
      console.log('📋 Mock mode: Simulating Google Sheets headers operation');
      const defaultHeaders = [
        'Timestamp',
        'Chat Title', 
        'Username',
        'First Name',
        'Last Name',
        'User ID',
        'Message',
        'Chat ID',
        'Message Type'
      ];
      const targetHeaders = headers || defaultHeaders;
      
      return res.json({ 
        success: true, 
        headers: targetHeaders,
        spreadsheetId: spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID || 'mock_spreadsheet_id',
        message: `Headers ${forceUpdate ? 'updated' : 'added'} successfully (mock mode)`,
        mock: true
      });
    }
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    // Use default headers if not provided
    const defaultHeaders = [
      'Timestamp',
      'Chat Title', 
      'Username',
      'First Name',
      'Last Name',
      'User ID',
      'Message',
      'Chat ID',
      'Message Type'
    ];
    
    const targetHeaders = headers || defaultHeaders;
    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    
    if (!targetSpreadsheetId) {
      return res.status(400).json({ 
        error: 'Spreadsheet ID is required (either in request body or environment variable)' 
      });
    }

    // Check if headers already exist (only if not forcing update)
    if (!forceUpdate) {
      try {
        const existingData = await sheetsClient.spreadsheets.values.get({
          spreadsheetId: targetSpreadsheetId,
          range: 'Сообщения!A1:I1' // Check headers in "Сообщения" sheet
        });
        
        if (existingData.data.values && existingData.data.values.length > 0 && existingData.data.values[0].length > 0) {
          const existingHeaders = existingData.data.values[0];
          // Check if headers match exactly
          if (JSON.stringify(existingHeaders) === JSON.stringify(targetHeaders)) {
            console.log(`📋 Correct headers already exist in spreadsheet: ${existingHeaders.join(', ')}`);
            return res.json({ 
              success: true, 
              headers: existingHeaders,
              spreadsheetId: targetSpreadsheetId,
              message: 'Headers already exist and are correct' 
            });
          } else {
            console.log(`📋 Headers exist but don't match. Existing: [${existingHeaders.join(', ')}], Expected: [${targetHeaders.join(', ')}]`);
          }
        }
      } catch (checkError) {
        console.log(`📋 Could not check existing headers, will add new ones:`, checkError.message);
      }
    }

    console.log(`📋 ${forceUpdate ? 'Force updating' : 'Adding'} headers to spreadsheet: ${targetHeaders.join(', ')}`);

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range: 'Сообщения!A1:I1', // Update headers in "Сообщения" sheet
      valueInputOption: 'RAW',
      resource: {
        values: [targetHeaders]
      }
    });

    console.log(`✅ Headers ${forceUpdate ? 'updated' : 'added'} successfully to spreadsheet ${targetSpreadsheetId}`);

    res.json({ 
      success: true, 
      headers: targetHeaders,
      spreadsheetId: targetSpreadsheetId,
      message: `Headers ${forceUpdate ? 'updated' : 'added'} successfully` 
    });
  } catch (error) {
    console.error('❌ Add headers error:', error);
    res.status(500).json({ 
      error: 'Failed to add headers', 
      message: error.message 
    });
  }
});

// Append data to spreadsheet
router.post('/append', async (req, res) => {
  try {
    const { messages, spreadsheetId } = req.body;
    
    // Check if we're in mock mode (no real credentials)
    const isMockMode = !sheetsClient || 
      process.env.GOOGLE_PRIVATE_KEY === 'your_private_key_here' ||
      process.env.GOOGLE_CLIENT_EMAIL === 'your_client_email_here' ||
      process.env.GOOGLE_PROJECT_ID === 'your_project_id_here';
    
    if (isMockMode) {
      console.log('📋 Mock mode: Simulating Google Sheets append operation');
      console.log(`📊 Would append ${messages.length} messages to spreadsheet`);
      
      // Simulate successful response
      return res.json({ 
        success: true, 
        updatedRows: messages.length,
        totalMessages: messages.length,
        spreadsheetId: spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID || 'mock_spreadsheet_id',
        message: 'Messages appended successfully (mock mode)',
        mock: true
      });
    }
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Messages array is required' 
      });
    }

    console.log(`📊 Processing ${messages.length} messages for Google Sheets`);
    
    // Filter messages - only include those with username
    const filteredMessages = messages.filter(msg => {
      const hasUsername = msg.username && 
                         msg.username !== 'Unknown User' && 
                         msg.username !== 'невозможно получить юзернейм' &&
                         msg.username.trim() !== '';
      
      if (!hasUsername) {
        console.log(`⚠️ Skipping message without username from ${msg.firstName || 'Unknown'} ${msg.lastName || ''}`);
      }
      
      return hasUsername;
    });
    
    console.log(`🔍 Filtered ${filteredMessages.length} messages with username from ${messages.length} total messages`);
    
    // Convert filtered messages to rows format for Google Sheets
    const rows = filteredMessages.map(msg => [
      msg.timestamp || new Date().toISOString(),
      msg.chatTitle || 'Unknown Chat',
      msg.username || 'Unknown User',
      msg.firstName || '',
      msg.lastName || '',
      msg.userId || '',
      msg.message || '',
      msg.chatId || '',
      msg.messageType || 'Message'
    ]);
    
    console.log(`📋 Formatted ${rows.length} rows for Google Sheets`);
    console.log(`📝 Sample row:`, rows[0]);
    
    // Use default spreadsheet ID if not provided
    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    
    if (!targetSpreadsheetId) {
      return res.status(400).json({ 
        error: 'Spreadsheet ID is required (either in request body or environment variable)' 
      });
    }

    const response = await sheetsClient.spreadsheets.values.append({
      spreadsheetId: targetSpreadsheetId,
      range: 'Сообщения!A:I', // Write to "Сообщения" sheet
      valueInputOption: 'RAW',
      resource: {
        values: rows
      }
    });

    console.log(`✅ Successfully appended ${response.data.updates.updatedRows} rows to Google Sheets`);
    
    res.json({ 
      success: true, 
      updatedRows: response.data.updates.updatedRows,
      totalMessages: messages.length,
      filteredMessages: filteredMessages.length,
      spreadsheetId: targetSpreadsheetId,
      message: `Messages appended successfully (${filteredMessages.length} with username from ${messages.length} total)` 
    });
  } catch (error) {
    console.error('❌ Append data error:', error);
    res.status(500).json({ 
      error: 'Failed to append data', 
      message: error.message 
    });
  }
});

// Clear spreadsheet data
router.post('/clear', async (req, res) => {
  try {
    const { spreadsheetId, range = 'A2:Z' } = req.body;
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID is required' });
    }

    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId,
      range
    });

    res.json({ 
      success: true, 
      message: 'Spreadsheet cleared successfully' 
    });
  } catch (error) {
    console.error('Clear spreadsheet error:', error);
    res.status(500).json({ 
      error: 'Failed to clear spreadsheet', 
      message: error.message 
    });
  }
});

// Get spreadsheet data without spreadsheetId parameter (use from settings)
router.get('/data', async (req, res) => {
  try {
    const { range = 'A:Z' } = req.query;
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    // Get spreadsheetId from settings
    let spreadsheetId = null;
    try {
      const settingsResponse = await fetch('http://localhost:3002/api/settings/google-sheets');
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        if (settings.success && settings.spreadsheetId) {
          spreadsheetId = settings.spreadsheetId;
        }
      }
    } catch (error) {
      console.log('⚠️ Could not get spreadsheetId from settings:', error.message);
    }

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID not found in settings' });
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    res.json({ 
      success: true, 
      data: response.data.values || [],
      range: response.data.range
    });
  } catch (error) {
    console.error('Get spreadsheet data error:', error);
    res.status(500).json({ 
      error: 'Failed to get spreadsheet data', 
      message: error.message 
    });
  }
});

// Get spreadsheet data
router.get('/data/:spreadsheetId', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { range = 'A:Z' } = req.query;
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    res.json({ 
      success: true, 
      data: response.data.values || [],
      range: response.data.range
    });
  } catch (error) {
    console.error('Get spreadsheet data error:', error);
    res.status(500).json({ 
      error: 'Failed to get spreadsheet data', 
      message: error.message 
    });
  }
});

// Reset spreadsheet with correct headers
router.post('/reset', async (req, res) => {
  try {
    const { spreadsheetId } = req.body;
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    
    if (!targetSpreadsheetId) {
      return res.status(400).json({ 
        error: 'Spreadsheet ID is required (either in request body or environment variable)' 
      });
    }

    console.log(`🔄 Resetting spreadsheet ${targetSpreadsheetId}...`);

    // Clear all data
    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId: targetSpreadsheetId,
      range: 'A:Z'
    });

    console.log(`🧹 Cleared all data from spreadsheet`);

    // Add correct headers
    const headers = [
      'Timestamp',
      'Chat Title', 
      'Username',
      'First Name',
      'Last Name',
      'User ID',
      'Message',
      'Chat ID',
      'Message Type'
    ];

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range: 'A1:I1',
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });

    console.log(`✅ Added correct headers to spreadsheet`);

    res.json({ 
      success: true, 
      headers: headers,
      spreadsheetId: targetSpreadsheetId,
      message: 'Spreadsheet reset successfully with correct headers' 
    });
  } catch (error) {
    console.error('❌ Reset spreadsheet error:', error);
    res.status(500).json({ 
      error: 'Failed to reset spreadsheet', 
      message: error.message 
    });
  }
});

// Create new sheet/tab in existing spreadsheet
router.post('/create-sheet', async (req, res) => {
  try {
    const { spreadsheetId, sheetTitle } = req.body;
    
    // Check if we're in mock mode
    const isMockMode = !sheetsClient || 
      (sheetsClient && sheetsClient.mock) ||
      process.env.GOOGLE_PRIVATE_KEY === 'your_private_key_here' ||
      process.env.GOOGLE_CLIENT_EMAIL === 'your_client_email_here' ||
      process.env.GOOGLE_PROJECT_ID === 'your_project_id_here';
    
    if (isMockMode) {
      console.log(`📋 Mock mode: Simulating sheet creation '${sheetTitle}'`);
      return res.json({ 
        success: true, 
        sheetId: Math.floor(Math.random() * 1000000),
        sheetTitle: sheetTitle || 'Лиды',
    message: `Sheet '${sheetTitle || 'Лиды'}' created successfully (mock mode)`,
        mock: true
      });
    }
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    const targetSheetTitle = sheetTitle || 'Лиды';
    
    if (!targetSpreadsheetId) {
      return res.status(400).json({ 
        error: 'Spreadsheet ID is required (either in request body or environment variable)' 
      });
    }

    // Check if sheet already exists
    try {
      const spreadsheet = await sheetsClient.spreadsheets.get({
        spreadsheetId: targetSpreadsheetId
      });
      
      const existingSheet = spreadsheet.data.sheets.find(
        sheet => sheet.properties.title === targetSheetTitle
      );
      
      if (existingSheet) {
        console.log(`📋 Sheet '${targetSheetTitle}' already exists`);
        return res.json({ 
          success: true, 
          sheetId: existingSheet.properties.sheetId,
          sheetTitle: targetSheetTitle,
          message: `Sheet '${targetSheetTitle}' already exists`,
          alreadyExists: true
        });
      }
    } catch (error) {
      console.error('Error checking existing sheets:', error);
    }

    // Create new sheet
    const response = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: targetSpreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: targetSheetTitle
            }
          }
        }]
      }
    });

    const newSheetId = response.data.replies[0].addSheet.properties.sheetId;
    
    console.log(`✅ Created new sheet '${targetSheetTitle}' with ID: ${newSheetId}`);

    res.json({ 
      success: true, 
      sheetId: newSheetId,
      sheetTitle: targetSheetTitle,
      spreadsheetId: targetSpreadsheetId,
      message: `Sheet '${targetSheetTitle}' created successfully` 
    });
  } catch (error) {
    console.error('❌ Create sheet error:', error);
    res.status(500).json({ 
      error: 'Failed to create sheet', 
      message: error.message 
    });
  }
});

// Add leads to Лиды
router.post('/append-leads', async (req, res) => {
  try {
    const { leads, spreadsheetId, sheetName, googleServiceAccountEmail, googlePrivateKey } = req.body;
    
    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'Leads array is required' });
    }
    
    // Check if we're in mock mode
    // Check if we have credentials from request or use environment variables
    const clientEmail = googleServiceAccountEmail || process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = googlePrivateKey || process.env.GOOGLE_PRIVATE_KEY;
    
    const isMockMode = !clientEmail || !privateKey || 
      clientEmail === 'your_client_email_here' ||
      privateKey === 'your_private_key_here';
    
    if (isMockMode) {
      console.log(`📋 Mock mode: Simulating leads append to ${sheetName}`);
      return res.json({ 
        success: true, 
        updatedRows: leads.length,
        totalLeads: leads.length,
        sheetName: sheetName,
        message: `${leads.length} leads appended to ${sheetName} successfully (mock mode)`,
        mock: true
      });
    }
    
    // Create Google Sheets client with provided credentials
    let currentSheetsClient = sheetsClient;
    if (googleServiceAccountEmail && googlePrivateKey) {
      try {
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: googleServiceAccountEmail,
            private_key: googlePrivateKey.replace(/\\n/g, '\n'),
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        currentSheetsClient = google.sheets({ version: 'v4', auth });
        console.log('📋 Created Google Sheets client with provided credentials');
      } catch (authError) {
        console.error('❌ Failed to create Google Sheets client:', authError);
        return res.status(400).json({ error: 'Failed to authenticate with Google Sheets API' });
      }
    }
    
    if (!currentSheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    
    if (!targetSpreadsheetId) {
      return res.status(400).json({ 
        error: 'Spreadsheet ID is required (either in request body or environment variable)' 
      });
    }

    // First, ensure Лиды exists
    try {
      await currentSheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: targetSpreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        });
      console.log(`✅ Created sheet '${sheetName}'`);
    } catch (error) {
      // Sheet might already exist, that's okay
      console.log(`📋 Sheet '${sheetName}' already exists or error creating:`, error.message);
    }

    // Check if headers exist in target sheet
    let hasHeaders = false;
    try {
      const existingData = await currentSheetsClient.spreadsheets.values.get({
        spreadsheetId: targetSpreadsheetId,
        range: `${sheetName}!A1:Z1`, // Check headers in target sheet
      });
      
      if (existingData.data.values && existingData.data.values.length > 0) {
        hasHeaders = true;
        console.log(`📋 Headers already exist in ${sheetName}`);
      }
    } catch (error) {
      console.log(`📋 No existing headers in ${sheetName}, will add them`);
    }

    // Add headers if they don't exist
    if (!hasHeaders) {
      const headers = [
        'Timestamp',
        'Channel',
        'Name', 
        'Username',
        'Message',
        'Reasoning',
        'Confidence',
        'Sent'
      ];
      
      await currentSheetsClient.spreadsheets.values.update({
          spreadsheetId: targetSpreadsheetId,
          range: `${sheetName}!A1:H1`, // Update headers in target sheet
          valueInputOption: 'RAW',
          resource: {
            values: [headers]
          }
        });
      
      console.log(`✅ Added headers to ${sheetName}`);
    }

    // Format leads data for Google Sheets
    const rows = leads.map(lead => {
      console.log('🔍 Processing lead for sheets - username:', lead.username, 'author:', lead.author, 'name:', lead.name);
      return [
        lead.timestamp || new Date().toISOString(),
        lead.channel || lead.chatTitle || 'Unknown Channel',
        lead.name || lead.author || 'Unknown',
        lead.username || lead.author || lead.name || 'невозможно получить юзернейм',
        lead.message || '',
        lead.reasoning || lead.reason || '',
        lead.confidence || lead.score || 0,
        lead.sent || false
      ];
    });
    
    console.log(`📋 Formatted ${rows.length} lead rows for ${sheetName}`);
    console.log(`📝 Sample lead row:`, rows[0]);

    // Append leads to target sheet
    const response = await currentSheetsClient.spreadsheets.values.append({
      spreadsheetId: targetSpreadsheetId,
      range: `${sheetName}!A:H`, // Write to target sheet
      valueInputOption: 'RAW',
      resource: {
        values: rows
      }
    });

    console.log(`✅ Successfully appended ${response.data.updates.updatedRows} lead rows to ${sheetName}`);
    
    res.json({ 
      success: true, 
      updatedRows: response.data.updates.updatedRows,
      totalLeads: leads.length,
      spreadsheetId: targetSpreadsheetId,
      sheetName: sheetName,
      message: `${leads.length} leads appended to ${sheetName} successfully` 
    });
  } catch (error) {
    console.error('❌ Append leads error:', error);
    res.status(500).json({ 
      error: 'Failed to append leads', 
      message: error.message 
    });
  }
});

// Get leads from Лиды sheet
router.get('/leads/:spreadsheetId', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const sheetName = 'Лиды'; // Лист с лидами
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    // Handle mock mode
    if (sheetsClient.mock) {
      console.log('📋 Mock mode: returning sample leads data');
      const mockLeads = [
        {
          id: 'mock-lead-1',
          timestamp: new Date().toISOString(),
          channel: 'Mock Channel',
          name: 'Тестовый Лид 1',
          username: '@test_user1',
          message: 'Тестовое сообщение для демонстрации',
          reasoning: 'Мок данные для тестирования',
          confidence: 0.85,
          source: 'google-sheets'
        },
        {
          id: 'mock-lead-2',
          timestamp: new Date().toISOString(),
          channel: 'Mock Channel 2',
          name: 'Тестовый Лид 2',
          username: '@test_user2',
          message: 'Еще одно тестовое сообщение',
          reasoning: 'Демонстрационные данные',
          confidence: 0.92,
          source: 'google-sheets'
        }
      ];
      
      return res.json({ 
        success: true, 
        leads: mockLeads,
        totalLeads: mockLeads.length,
        sheetName: sheetName,
        mock: true
      });
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      // Нет данных или только заголовки
      return res.json({ 
        success: true, 
        leads: [],
        totalLeads: 0
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Фильтрация пустых строк: оставляем только те, где есть содержимое
    // хотя бы в одном из ключевых полей (message, channel, name, username, reasoning, timestamp)
    const normalizedHeaders = headers.map(h => (h || '').toLowerCase());
    const importantIndices = normalizedHeaders
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => (
        h.includes('message') ||
        h.includes('channel') ||
        h.includes('name') ||
        h.includes('username') ||
        h.includes('reasoning') ||
        h.includes('timestamp')
      ))
      .map(({ i }) => i);

    const filteredDataRows = dataRows.filter(row => {
      if (!row) return false;
      // Если есть «важные» столбцы, проверяем, что хотя бы один из них не пуст
      if (importantIndices.length > 0) {
        return importantIndices.some(idx => {
          const v = row[idx];
          return v !== undefined && String(v).trim().length > 0;
        });
      }
      // Если заголовки не распознаны, перестрахуемся: строка должна иметь любой непустой элемент
      return row.some(cell => cell !== undefined && String(cell).trim().length > 0);
    });
    
    // Загружаем данные о контактированных лидах из листа "Связались"
    let contactsMap = new Map();
    try {
      const contactsResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: `Связались!A:G`
      });
      
      if (contactsResponse.data.values && contactsResponse.data.values.length > 0) {
        // Пропускаем заголовок (первая строка)
        for (let i = 1; i < contactsResponse.data.values.length; i++) {
          const row = contactsResponse.data.values[i];
          if (row[0]) { // ID лида
            contactsMap.set(row[0], {
              contacted: true,
              contactDate: row[3] || new Date().toISOString(),
              contactName: row[1] || 'Unknown',
              contactUsername: row[2] || '',
              contactChannel: row[4] || '',
              contactMessage: row[5] || '',
              contactAccount: row[6] || ''
            });
          }
        }
      }
    } catch (contactsError) {
      console.error('Error loading contacts data:', contactsError);
    }

    // Преобразуем строки в объекты лидов
    const leads = filteredDataRows.map((row, index) => {
      const lead = {};
      headers.forEach((header, headerIndex) => {
        if (header && row[headerIndex] !== undefined) {
          // Приводим названия полей к стандартному формату
          const fieldName = header.toLowerCase();
          if (fieldName.includes('timestamp')) {
            lead.timestamp = row[headerIndex];
          } else if (fieldName.includes('channel')) {
            lead.channel = row[headerIndex];
          } else if (fieldName.includes('name')) {
            lead.name = row[headerIndex];
          } else if (fieldName.includes('username')) {
            lead.username = row[headerIndex];
          } else if (fieldName.includes('message')) {
            lead.message = row[headerIndex];
          } else if (fieldName.includes('reasoning')) {
            lead.reasoning = row[headerIndex];
          } else if (fieldName.includes('confidence')) {
            lead.confidence = parseFloat(row[headerIndex]) || 0;
          } else if (fieldName.includes('sent')) {
            lead.sent = row[headerIndex] === 'Да' || row[headerIndex] === 'true' || row[headerIndex] === true;
          } else {
            lead[header] = row[headerIndex];
          }
        }
      });
      
      // Добавляем ID для каждого лида
      lead.id = `sheet-lead-${index + 1}`;
      lead.source = 'google-sheets';
      
      // ВАЖНО: Добавляем originalIndex для корректного обновления статуса в Google Sheets
      lead.originalIndex = index; // Индекс строки в Google Sheets (без учета заголовка)
      
      // Проверяем статус контакта
      const contactInfo = contactsMap.get(lead.id);
      if (contactInfo) {
        lead.contacted = true;
        lead.contactDate = contactInfo.contactDate;
      }
      
      return lead;
    });

    // Фильтруем пустые строки: оставляем только те, где есть содержимое
    const filteredLeads = leads.filter((lead) => {
      const fields = [lead.message, lead.username, lead.name, lead.channel, lead.reasoning];
      return fields.some((v) => (typeof v === 'string' ? v.trim().length > 0 : !!v));
    });

    console.log(`📋 Retrieved ${filteredLeads.length}/${leads.length} non-empty leads from ${sheetName}`);
    
    res.json({ 
      success: true, 
      leads: filteredLeads,
      totalLeads: filteredLeads.length,
      sheetName: sheetName
    });
  } catch (error) {
    console.error('Get leads from sheets error:', error);
    res.status(500).json({ 
      error: 'Failed to get leads from sheets', 
      message: error.message 
    });
  }
});

// Read settings from Настройки TG sheet
router.get('/settings/:spreadsheetId', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const sheetName = 'Настройки TG';
    
    if (!sheetsClient) {
      return res.status(400).json({ error: 'Google Sheets client not initialized' });
    }

    // Handle mock mode
    if (sheetsClient.mock) {
      console.log('📋 Mock mode: returning sample settings data');
      const mockSettings = {
        serviceAccountEmail: 'mock@example.com',
        privateKey: 'mock_private_key',
        telegramBotToken: 'mock_bot_token',
        telegramChannelId: 'mock_channel_id'
      };
      
      return res.json({ 
        success: true, 
        settings: mockSettings,
        sheetName: sheetName,
        mock: true
      });
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:B`
    });

    const rows = response.data.values || [];
    const settings = {};
    
    // Парсим настройки из формата ключ-значение
    rows.forEach(row => {
      if (row.length >= 2 && row[0] && row[1]) {
        const key = row[0].trim().toLowerCase();
        const value = row[1].trim();
        
        // Маппинг ключей на стандартные названия
        if (key.includes('service account email') || key.includes('email')) {
          settings.serviceAccountEmail = value;
        } else if (key.includes('private key') || key.includes('ключ')) {
          settings.privateKey = value;
        } else if (key.includes('bot token') || key.includes('токен')) {
          settings.telegramBotToken = value;
        } else if (key.includes('channel id') || key.includes('канал')) {
          settings.telegramChannelId = value;
        }
      }
    });

    console.log(`📋 Retrieved settings from ${sheetName}`);
    
    res.json({ 
      success: true, 
      settings: settings,
      sheetName: sheetName
    });
  } catch (error) {
    console.error('Get settings from sheets error:', error);
    res.status(500).json({ 
      error: 'Failed to get settings from sheets', 
      message: error.message 
    });
  }
});

// Get messages from Google Sheets
router.get('/messages', async (req, res) => {
  try {
    const { spreadsheetId, googleServiceAccountEmail, googlePrivateKey } = req.query;
    
    if (!spreadsheetId) {
      return res.status(400).json({ 
        success: false,
        error: 'spreadsheetId is required' 
      });
    }

    // Initialize Google Sheets client if needed
    if (!sheetsClient && googleServiceAccountEmail && googlePrivateKey) {
      const initResponse = await initializeGoogleSheetsClient({
        privateKey: googlePrivateKey,
        clientEmail: googleServiceAccountEmail,
        projectId: 'telegram-scanner'
      });
      
      if (!initResponse.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to initialize Google Sheets client'
        });
      }
    }

    if (!sheetsClient) {
      return res.status(400).json({
        success: false,
        error: 'Google Sheets client not initialized'
      });
    }

    // Get data from the first sheet
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A:Z', // Get all columns
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.json({
        success: true,
        messages: [],
        count: 0
      });
    }

    // Skip header row and process messages
    const messages = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length > 0 && row[0]) { // Skip empty rows
        const message = {
          id: `msg_${i}_${Date.now()}`,
          message: row[0] || '',
          content: row[0] || '',
          userId: row[1] || 'unknown',
          author: row[1] || 'unknown',
          username: row[1] || 'unknown',
          chatId: row[2] || 'unknown',
          channel: row[2] || 'unknown',
          timestamp: row[3] || new Date().toISOString()
        };
        messages.push(message);
      }
    }

    res.json({
      success: true,
      messages: messages,
      count: messages.length
    });

  } catch (error) {
    console.error('❌ Error getting messages from Google Sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get messages from Google Sheets',
      message: error.message
    });
  }
});

// Get client status
router.get('/status', (req, res) => {
  res.json({ 
    connected: sheetsClient !== null,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;