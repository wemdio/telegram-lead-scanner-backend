const express = require('express');
const cron = require('node-cron');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const GeminiService = require('../services/geminiService');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Путь к файлу настроек
const SETTINGS_FILE = path.join(__dirname, '..', 'persistent-settings.json');

// Функция для загрузки настроек из файла
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      console.log('✅ Настройки загружены из файла:', {
        hasApiKey: !!settings.openrouterApiKey,
        hasCriteria: !!settings.leadCriteria,
        hasSheets: !!settings.sheetsConfig,
        hasSpreadsheetId: !!settings.spreadsheetId
      });
      return settings;
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки настроек:', error.message);
  }
  
  // Возвращаем пустые настройки если файл не существует или поврежден
  return {
    sheetsConfig: null,
    spreadsheetId: null,
    openrouterApiKey: null,
    leadCriteria: null
  };
}

// Функция для сохранения настроек в файл
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log('✅ Настройки сохранены в файл:', {
      hasApiKey: !!settings.openrouterApiKey,
      hasCriteria: !!settings.leadCriteria,
      hasSheets: !!settings.sheetsConfig,
      hasSpreadsheetId: !!settings.spreadsheetId
    });
    return true;
  } catch (error) {
    console.error('❌ Ошибка сохранения настроек:', error.message);
    return false;
  }
}

// Helper function to parse scan interval from string format to hours
function parseScanInterval(scanInterval) {
  if (typeof scanInterval === 'number') {
    return scanInterval;
  }
  
  if (typeof scanInterval === 'string') {
    const match = scanInterval.match(/^(\d+)([hm])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      
      if (unit === 'h') {
        return value; // hours
      } else if (unit === 'm') {
        return value / 60; // convert minutes to hours
      }
    }
  }
  
  // Default to 1 hour if parsing fails
  // console.log(`⚠️ Could not parse scanInterval '${scanInterval}', defaulting to 1 hour`);
  return 1;
}

// Helper function to format time in Moscow timezone in human-readable format
function formatMoscowTime(date) {
  const moscowTime = new Date(date.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
  
  const day = moscowTime.getDate().toString().padStart(2, '0');
  const month = (moscowTime.getMonth() + 1).toString().padStart(2, '0');
  const year = moscowTime.getFullYear();
  const hours = moscowTime.getHours().toString().padStart(2, '0');
  const minutes = moscowTime.getMinutes().toString().padStart(2, '0');
  const seconds = moscowTime.getSeconds().toString().padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds} MSK`;
}

// Store active scan jobs
const activeScanJobs = new Map();
const scanHistory = [];
// Хранилище последних сообщений из сканирования для автоанализа
let lastScanMessages = [];

// Global array to track active auto-analysis timeouts
let activeAutoAnalysisTimeouts = [];

// Global settings storage - загружаем из файла при старте
let globalSettings = loadSettings();

// Scanner status
let scannerStatus = {
  isRunning: false,
  lastScan: null,
  nextScan: null,
  totalScans: 0,
  totalMessages: 0,
  errors: []
};



// Start scanner with specified interval
router.post('/start', async (req, res) => {
  try {
    console.log('🔍 POST /start - Received request');
    
    const { 
      scanInterval, 
      selectedChats, 
      telegramConfig, 
      sheetsConfig,
      spreadsheetId,
      leadAnalysisSettings
    } = req.body;

    console.log('🔍 Extracted parameters:');
    console.log('  - scanInterval:', scanInterval);
    console.log('  - selectedChats:', selectedChats?.length || 0, 'chats');
    console.log('  - telegramConfig present:', !!telegramConfig);
    console.log('  - sheetsConfig present:', !!sheetsConfig);
    console.log('  - spreadsheetId present:', !!spreadsheetId);
    console.log('  - leadAnalysisSettings present:', !!leadAnalysisSettings);

    if (!scanInterval || !selectedChats || selectedChats.length === 0) {
      console.log('❌ Validation failed: missing scanInterval or selectedChats');
      return res.status(400).json({ 
        error: 'Scan interval and selected chats are required' 
      });
    }

    // Stop existing scanner if running
    if (scannerStatus.isRunning) {
      console.log('🛑 Stopping existing scanner...');
      stopAllScanJobs();
    }

    console.log('💾 Saving global settings...');
    // Save settings globally for automatic analysis
    globalSettings.sheetsConfig = sheetsConfig;
    globalSettings.spreadsheetId = spreadsheetId;
    
    // Save AI settings if provided
    if (leadAnalysisSettings) {
      globalSettings.openrouterApiKey = leadAnalysisSettings.openrouterApiKey;
      globalSettings.leadCriteria = leadAnalysisSettings.leadCriteria;
      console.log('💾 Saved AI settings for automatic analysis');
    }
    
    // Сохраняем настройки в файл для постоянного хранения
    console.log('💾 Saving settings to file...');
    saveSettings(globalSettings);
    
    console.log('💾 Saved global settings for automatic analysis');

    // Parse scan interval
    console.log('⏰ Parsing scan interval...');
    const parsedScanInterval = parseScanInterval(scanInterval);
    console.log(`⏰ Parsed scan interval: ${parsedScanInterval} hour(s) (from '${scanInterval}')`);
    
    // Convert hours to milliseconds for setInterval
    const intervalMs = parsedScanInterval * 60 * 60 * 1000;
    
    console.log(`⏰ Scheduled scanner with interval: ${parsedScanInterval} hour(s) (${intervalMs}ms)`);
    
    // Perform immediate scan first
    console.log('🚀 Performing immediate scan...');
    await performScan({
      selectedChats,
      telegramConfig,
      sheetsConfig,
      spreadsheetId,
      scanInterval: parsedScanInterval
    });
    console.log('✅ Immediate scan completed successfully');

    // Create interval job for future scans
    const scanJob = setInterval(async () => {
      // console.log(`🔄 Starting scheduled scan (every ${parsedScanInterval} hour(s))...`);
      await performScan({
        selectedChats,
        telegramConfig,
        sheetsConfig,
        spreadsheetId,
        scanInterval: parsedScanInterval
      });
    }, intervalMs);

    // Store the interval job
    activeScanJobs.set('main', scanJob);

    // Update scanner status
    scannerStatus.isRunning = true;
    scannerStatus.nextScan = getNextScanTime(parsedScanInterval);
    scannerStatus.lastScan = new Date();
    scannerStatus.totalScans = 1; // First scan completed

    res.json({ 
      success: true, 
      message: 'Scanner started successfully',
      status: scannerStatus
    });
  } catch (error) {
    console.error('❌ Start scanner error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    
    const errorMessage = error.message || 'Unknown error occurred';
    const errorDetails = error.stack || 'No stack trace available';
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to start scanner', 
      message: errorMessage,
      details: errorDetails
    });
  }
});

// Stop scanner
router.post('/stop', (req, res) => {
  try {
    stopAllScanJobs();
    
    scannerStatus.isRunning = false;
    scannerStatus.nextScan = null;

    res.json({ 
      success: true, 
      message: 'Scanner stopped successfully',
      status: scannerStatus
    });
  } catch (error) {
    console.error('❌ Stop scanner error:', error);
    
    const errorMessage = error.message || 'Unknown error occurred';
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to stop scanner', 
      message: errorMessage
    });
  }
});

// Manual scan
router.post('/scan', async (req, res) => {
  try {
    // console.log('📥 Received manual scan request');
    // console.log('📋 Request body keys:', Object.keys(req.body));
    
    const { 
      selectedChats, 
      telegramConfig, 
      sheetsConfig,
      spreadsheetId,
      scanInterval,
      leadAnalysisSettings
    } = req.body;

    console.log('🎯 Selected chats:', selectedChats?.length || 0);
    console.log('📱 Telegram config present:', !!telegramConfig);
    console.log('📊 Sheets config present:', !!sheetsConfig);
    console.log('📄 Spreadsheet ID present:', !!spreadsheetId);
    console.log('🤖 Lead analysis settings present:', !!leadAnalysisSettings);

    // Save AI settings to globalSettings for automatic analysis
    if (leadAnalysisSettings) {
      globalSettings.openrouterApiKey = leadAnalysisSettings.openrouterApiKey;
      globalSettings.leadCriteria = leadAnalysisSettings.leadCriteria;
      
      // Сохраняем настройки в файл
      saveSettings(globalSettings);
      
      // console.log('✅ AI settings saved to globalSettings for automatic analysis');
    } else {
      // console.log('⚠️ No AI settings provided in manual scan request');
    }

    if (!selectedChats || selectedChats.length === 0) {
      // console.log('❌ No selected chats provided');
      return res.status(400).json({ 
        error: 'Selected chats are required' 
      });
    }

    // console.log('🚀 Starting manual scan...');
    const parsedScanInterval = parseScanInterval(scanInterval || '1h');
    // console.log(`⏰ Manual scan will process ALL messages (no time filtering)`);
    
    const result = await performScan({
      selectedChats,
      telegramConfig,
      sheetsConfig,
      spreadsheetId,
      scanInterval: parsedScanInterval,
      isManualScan: true
    });

    // console.log('✅ Manual scan completed successfully');
    res.json({ 
      success: true, 
      message: 'Manual scan completed',
      result
    });
  } catch (error) {
    // console.error('❌ Manual scan error:', error);
    // console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to perform manual scan', 
      message: error.message 
    });
  }
});

// Get scanner status
router.get('/status', (req, res) => {
  try {
    // Create a safe copy of scannerStatus without circular references
    const safeStatus = {
      isRunning: scannerStatus.isRunning,
      lastScan: scannerStatus.lastScan,
      nextScan: scannerStatus.nextScan,
      totalScans: scannerStatus.totalScans,
      totalMessages: scannerStatus.totalMessages,
      errors: scannerStatus.errors
    };
    
    res.json({ 
      ...safeStatus,
      activeScanJobs: activeScanJobs.size,
      openrouterApiKey: globalSettings.openrouterApiKey || null,
      leadCriteria: globalSettings.leadCriteria || null,
      timestamp: new Date().toISOString(),
      activeTimeouts: activeAutoAnalysisTimeouts.length
    });
  } catch (error) {
    console.error('❌ Get scanner status error:', error);
    
    const errorMessage = error.message || 'Unknown error occurred';
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to get scanner status', 
      message: errorMessage
    });
  }
});

// Update AI settings without restarting scanner
router.post('/update-ai-settings', (req, res) => {
  try {
    const { openrouterApiKey, leadCriteria } = req.body;
    
    if (!openrouterApiKey || !leadCriteria) {
      return res.status(400).json({
        error: 'Both openrouterApiKey and leadCriteria are required'
      });
    }
    
    // Update global settings
    globalSettings.openrouterApiKey = openrouterApiKey;
    globalSettings.leadCriteria = leadCriteria;
    
    // Сохраняем обновленные настройки в файл
    saveSettings(globalSettings);
    
    console.log('🔄 AI settings updated:', {
      hasApiKey: !!openrouterApiKey,
      hasCriteria: !!leadCriteria
    });
    
    res.json({
      success: true,
      message: 'AI settings updated successfully',
      settings: {
        openrouterApiKey: !!openrouterApiKey,
        leadCriteria: !!leadCriteria
      }
    });
  } catch (error) {
    console.error('❌ Error updating AI settings:', error);
    res.status(500).json({
      error: 'Failed to update AI settings',
      message: error.message
    });
  }
});

// Ручной запуск автоматического анализа
router.post('/trigger-analysis', async (req, res) => {
  try {
    console.log('🔧 Ручной запуск автоматического анализа...');
    
    // Проверяем настройки AI
    if (!globalSettings.openrouterApiKey || !globalSettings.leadCriteria) {
      return res.status(400).json({ 
        error: 'AI settings not configured',
        missing: {
          openrouterApiKey: !globalSettings.openrouterApiKey,
          leadCriteria: !globalSettings.leadCriteria
        }
      });
    }
    
    // Запускаем автоматический анализ
    await triggerAutomaticAnalysis();
    
    res.json({ 
      success: true, 
      message: 'Automatic analysis triggered successfully' 
    });
  } catch (error) {
    console.error('❌ Ошибка ручного запуска анализа:', error);
    res.status(500).json({ error: 'Failed to trigger analysis: ' + error.message });
  }
});

// Get scan history
router.get('/history', (req, res) => {
  const { limit = 50 } = req.query;
  
  res.json({ 
    history: scanHistory.slice(-parseInt(limit)),
    total: scanHistory.length
  });
});

// Get AI settings
router.get('/ai/settings', (req, res) => {
  try {
    const aiSettings = {
      openrouterApiKey: globalSettings.openrouterApiKey || null,
      leadCriteria: globalSettings.leadCriteria || null,
      hasApiKey: !!globalSettings.openrouterApiKey,
      hasCriteria: !!globalSettings.leadCriteria
    };
    
    res.json(aiSettings);
  } catch (error) {
    console.error('❌ Error getting AI settings:', error);
    res.status(500).json({ 
      error: 'Failed to get AI settings',
      details: error.message 
    });
  }
});

// Helper function to perform scan
async function performScan({ selectedChats, telegramConfig, sheetsConfig, spreadsheetId, scanInterval = 1, isManualScan = false }) {
  const scanStartTime = new Date();
  let currentScanMessages = 0; // Messages found in this scan
  let errors = [];
  let telegramClient = null;

  try {
  console.log(`🔍 Starting scan at ${scanStartTime.toISOString()}`);
  console.log(`📊 Scan parameters:`);
  console.log(`  - Selected chats: ${selectedChats?.length || 0}`);
  console.log(`  - Telegram config: ${telegramConfig ? 'present' : 'missing'}`);
  console.log(`  - Sheets config: ${sheetsConfig ? 'present' : 'missing'}`);
  console.log(`  - Spreadsheet ID: ${spreadsheetId || 'not provided'}`);
    
    // Detailed logging of received data
    // console.log(`🔍 DETAILED CONFIG LOGGING:`);
  // console.log(`  - telegramConfig:`, JSON.stringify(telegramConfig, null, 2));
  // console.log(`  - sheetsConfig:`, JSON.stringify(sheetsConfig, null, 2));
  // console.log(`  - spreadsheetId:`, spreadsheetId);
    
    // Initialize Telegram client with real API (skip if mock data or placeholder values)
    // console.log('🔍 Checking Telegram config for mock data...');
    
    // Check if telegramConfig exists
    if (!telegramConfig) {
      // console.log('📱 No Telegram config provided, using mock mode');
    } else {
       // console.log(`  - API ID: ${telegramConfig?.apiId}`);
    // console.log(`  - API Hash: ${telegramConfig?.apiHash ? 'present' : 'missing'}`);
    // console.log(`  - Session String: ${telegramConfig?.sessionString ? 'present' : 'missing'}`);
     }
    
    // Check for mock data or placeholder values
    const apiIdStr = telegramConfig?.apiId ? telegramConfig.apiId.toString() : '';
    const isMockApiId = apiIdStr.includes('mock') || 
                       apiIdStr.includes('your_api_id_here') ||
                       apiIdStr === 'your_api_id_here' ||
                       apiIdStr === '12345' ||
                       telegramConfig?.apiId === 12345 ||
                       apiIdStr === 'test' ||
                       !telegramConfig?.apiId || 
                       telegramConfig?.apiId === 0;
    
    const isMockApiHash = !telegramConfig?.apiHash ||
                         telegramConfig.apiHash?.includes('mock') || 
                         telegramConfig.apiHash?.includes('your_api_hash_here') ||
                         telegramConfig?.apiHash === 'your_api_hash_here' ||
                         telegramConfig?.apiHash === 'your_api_hash' ||
                         telegramConfig?.apiHash === 'test_hash' ||
                         telegramConfig?.apiHash === 'test';
    
    const isMockSession = !telegramConfig?.sessionString ||
                         telegramConfig.sessionString?.includes('mock') || 
                         telegramConfig.sessionString?.includes('your_session_string_here') ||
                         telegramConfig?.sessionString === 'your_session_string_here' ||
                         telegramConfig?.sessionString === 'your_session' ||
                         telegramConfig?.sessionString === 'test_session' ||
                         telegramConfig?.sessionString === 'test';
    
    // console.log(`  - Is mock API ID: ${isMockApiId}`);
      // console.log(`  - Is mock API Hash: ${isMockApiHash}`);
      // console.log(`  - Is mock Session: ${isMockSession}`);
    
    if (telegramConfig && telegramConfig?.apiId && telegramConfig?.apiHash && telegramConfig?.sessionString && 
        !isMockApiId && !isMockApiHash && !isMockSession) {
      // console.log('🔧 Initializing Telegram client...');
      // console.log(`  - API ID: ${telegramConfig?.apiId}`);
      // console.log(`  - API Hash: ${telegramConfig?.apiHash ? 'present' : 'missing'}`);
      // console.log(`  - Session: ${telegramConfig?.sessionString ? 'present' : 'missing'}`);
      
      // Disconnect existing client if any to avoid AUTH_KEY_DUPLICATED
      if (telegramClient) {
        try {
          await telegramClient.disconnect();
          console.log('Disconnected existing Telegram client in scanner');
        } catch (e) {
          console.log('Error disconnecting existing client in scanner:', e.message);
        }
        telegramClient = null;
      }
      
      const session = new StringSession(telegramConfig?.sessionString);
      telegramClient = new TelegramClient(session, parseInt(telegramConfig?.apiId), telegramConfig?.apiHash, {
        connectionRetries: 2,
        timeout: 30000, // Increased timeout to 30 seconds
        retryDelay: 5000, // Increased retry delay to 5 seconds
        autoReconnect: false // Disable auto-reconnect to prevent timeout loops
      });
      
      // console.log('🔌 Attempting to connect to Telegram...');
      try {
        await telegramClient.connect();
        // console.log('✅ Telegram client connected successfully');
        
        // console.log('👤 Verifying authentication...');
        // Verify connection by getting current user
        const me = await telegramClient.getMe();
        // console.log(`✅ Authenticated as: ${me.firstName} ${me.lastName || ''}`);
      } catch (connectError) {
        // console.error('❌ Failed to connect to Telegram:', connectError);
          // console.error('❌ Connection error type:', connectError.constructor.name);
          // console.error('❌ Connection error message:', connectError.message);
        
        // Handle specific Telegram errors
        if (connectError.message && connectError.message.includes('AUTH_KEY_DUPLICATED')) {
          errors.push('Обнаружен дублированный ключ авторизации. Попробуйте еще раз через несколько секунд.');
        } else {
          errors.push(`Telegram connection failed: ${connectError.message}`);
        }
        
        // Fall back to mock data if connection fails
        telegramClient = null;
        
        // console.log('🧹 Cleaning up failed connection...');
        // Ensure client is properly cleaned up
        try {
          if (telegramClient) {
            await telegramClient.disconnect();
          }
        } catch (disconnectError) {
          // console.error('❌ Error during cleanup:', disconnectError);
        }
        telegramClient = null;
      }
    } else {
      // console.log('⚠️ Telegram API credentials incomplete or using placeholder values, using mock data');
      // console.log('💡 To use real Telegram API, please configure valid credentials in Settings');
    }
    
    // Initialize Google Sheets client if sheetsConfig is provided
    // console.log('🔍 Checking Google Sheets config...');
    if (sheetsConfig && sheetsConfig.serviceAccountEmail && sheetsConfig.privateKey) {
      // console.log('🔧 Initializing Google Sheets client with provided config...');
      try {
        const sheetsInitResponse = await fetch('http://localhost:3001/api/sheets/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            privateKey: sheetsConfig.privateKey,
            clientEmail: sheetsConfig.serviceAccountEmail,
            projectId: 'telegram-scanner'
          })
        });
        
        if (sheetsInitResponse.ok) {
          const result = await sheetsInitResponse.json();
          // console.log('✅ Google Sheets client initialized successfully:', result.message);
        } else {
          const error = await sheetsInitResponse.json();
          console.error('⚠️ Failed to initialize Google Sheets:', error);
          errors.push(`Google Sheets initialization failed: ${error.message || error.error}`);
          
          // If Google Sheets fails, don't fail the entire scan - continue with Telegram scanning
          console.log('📝 Continuing scan without Google Sheets integration');
        }
      } catch (sheetsError) {
        console.error('❌ Error initializing Google Sheets:', sheetsError);
        errors.push(`Google Sheets initialization error: ${sheetsError.message}`);
        
        // If Google Sheets fails, don't fail the entire scan - continue with Telegram scanning
        console.log('📝 Continuing scan without Google Sheets integration');
      }
    } else {
      // console.log('⚠️ Google Sheets config incomplete, using mock mode');
    }
    
    // Collect all processed messages for lead analysis
    const allProcessedMessages = [];
    
    for (const chatId of selectedChats) {
      console.log(`🔄 Processing chat: ${chatId}`);
      try {
        let messages;
        if (telegramClient && telegramClient.connected) {
          // Use real Telegram API with enhanced data extraction
          messages = await fetchRealMessagesFromChat(telegramClient, chatId, scanInterval, isManualScan);
        } else {
          // Use mock data when no real Telegram connection
          console.log(`⚠️ No Telegram connection for chat ${chatId}, using mock data...`);
          messages = generateMockMessages(chatId, scanInterval, isManualScan);
        }
        
        currentScanMessages += messages.length;
        
        // Add messages to the collection for lead analysis
        allProcessedMessages.push(...messages);
        
        // Append to Google Sheets (messages already contain all necessary data)
        if (spreadsheetId && messages.length > 0) {
          await appendMessagesToSheet(messages, spreadsheetId);
        }
        
        const chatTitle = messages[0]?.chatTitle || `Chat ${chatId}`;
        // console.log(`✅ Processed ${messages.length} messages from ${chatTitle}`);
      } catch (chatError) {
        // console.error(`❌ Error processing chat ${chatId}:`, chatError);
        errors.push(`Chat ${chatId}: ${chatError.message}`);
      }
    }
    
    // Disconnect Telegram client
    if (telegramClient) {
      try {
        if (telegramClient.connected) {
          await telegramClient.disconnect();
          // console.log('✅ Telegram client disconnected');
        }
      } catch (disconnectError) {
        // console.error('❌ Error disconnecting Telegram client:', disconnectError);
      }
    }

    const scanEndTime = new Date();
    const duration = scanEndTime - scanStartTime;

    // Update scanner status
    scannerStatus.lastScan = scanEndTime;
    scannerStatus.totalScans += 1;
    scannerStatus.totalMessages += currentScanMessages; // Accumulate total messages
    scannerStatus.errors = errors;
    
    // Update next scan time only for scheduled scans (not manual scans)
    if (!isManualScan && scannerStatus.isRunning) {
      scannerStatus.nextScan = getNextScanTime(scanInterval);
      // console.log(`⏰ Next scheduled scan: ${scannerStatus.nextScan.toISOString()}`);
    }

    // Add to scan history
    const scanResult = {
      timestamp: scanEndTime,
      duration,
      totalMessages: currentScanMessages,
      chatsProcessed: selectedChats.length,
      errors: errors.length,
      success: errors.length === 0
    };
    
    scanHistory.push(scanResult);
    // Сохраняем последние сообщения сканирования для автоанализа
    lastScanMessages = allProcessedMessages.slice();
    
    // Keep only last 100 scan results
    if (scanHistory.length > 100) {
      scanHistory.shift();
    }

    // console.log(`✅ Scan completed: ${currentScanMessages} messages processed in ${duration}ms`);
    
    // Автоматическое нажатие кнопки анализа через 2 минуты после завершения сканирования
    console.log('⏰ Устанавливаем setTimeout для автоанализа через 2 минуты...');
    console.log('📅 Время установки:', new Date().toLocaleString());
    console.log('🎯 Ожидаемое время срабатывания:', new Date(Date.now() + 2 * 60 * 1000).toLocaleString());
    
    const timeoutId = setTimeout(async () => {
      console.log('🔥🔥🔥 CALLBACK setTimeout СРАБОТАЛ! 🔥🔥🔥');
      console.log('🔍 Автоматическое нажатие кнопки анализа через 2 минуты после сканирования');
      console.log('⏰ Время запуска автоанализа:', new Date().toLocaleString());
      console.log('🆔 ID таймера:', timeoutId);
      console.log('📊 Количество сообщений для анализа:', lastScanMessages.length);
      console.log('📊 Активных таймеров до удаления:', activeAutoAnalysisTimeouts.length);
      
      // Remove this timeout from active timeouts array
      const index = activeAutoAnalysisTimeouts.findIndex(t => t.id === timeoutId);
      if (index !== -1) {
        const removedTimeout = activeAutoAnalysisTimeouts.splice(index, 1)[0];
        console.log('✅ Таймер удален из activeAutoAnalysisTimeouts');
        console.log('🗑️ Удаленный таймер:', {
          id: removedTimeout.id,
          createdAt: removedTimeout.createdAt,
          expectedTriggerAt: removedTimeout.expectedTriggerAt
        });
        console.log('📊 Осталось активных таймеров:', activeAutoAnalysisTimeouts.length);
      } else {
        console.log('⚠️ Таймер не найден в activeAutoAnalysisTimeouts!');
      }
      
      if (lastScanMessages?.length > 0) {
        console.log('📝 Первые 3 сообщения для анализа:', lastScanMessages.slice(0, 3).map(m => ({
          chat: m.chatTitle,
          text: m.text?.substring(0, 50) + '...'
        })));
      } else {
        console.log('⚠️ Нет сообщений для анализа в lastScanMessages');
      }
      
      console.log('🚀 Начинаем вызов triggerAutomaticAnalysis...');
      try {
        // Эмуляция нажатия кнопки анализа
        await triggerAutomaticAnalysis();
        console.log('✅ triggerAutomaticAnalysis завершен успешно');
      } catch (error) {
        console.error('❌ Ошибка в автоматическом анализе:', error);
        console.error('📋 Stack trace:', error.stack);
      }
      
      console.log('🏁 CALLBACK setTimeout ЗАВЕРШЕН!');
    }, 2 * 60 * 1000); // 2 минуты в миллисекундах
    
    // Store timeout info for tracking
    const timeoutInfo = {
      id: timeoutId,
      createdAt: new Date(),
      expectedTriggerAt: new Date(Date.now() + 2 * 60 * 1000),
      scanTime: new Date()
    };
    activeAutoAnalysisTimeouts.push(timeoutInfo);
    
    console.log('✅ setTimeout установлен с ID:', timeoutId);
    console.log('📊 Активных таймеров автоанализа:', activeAutoAnalysisTimeouts.length);
    console.log('🔍 Информация о таймере:', {
      id: timeoutId,
      expectedTrigger: timeoutInfo.expectedTriggerAt.toLocaleString()
    });
    
    return scanResult;
  } catch (error) {
    // console.error('❌ Scan failed:', error);
    scannerStatus.errors.push(error.message);
    throw error;
  }
}

// Function to fetch real messages from Telegram API
async function fetchRealMessagesFromChat(telegramClient, chatId, scanInterval = 1, isManualScan = false) {
  try {
    console.log(`🔍 Fetching messages from chat ${chatId} for last ${scanInterval} hour(s)...`);
    
    // Check if client is still connected
    if (!telegramClient || !telegramClient.connected) {
      throw new Error('Telegram client is not connected');
    }
    
    // Get chat information first with timeout
    let chatEntity, chatTitle;
    try {
      chatEntity = await Promise.race([
        telegramClient.getEntity(chatId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting chat entity')), 10000))
      ]);
      chatTitle = chatEntity.title || chatEntity.firstName || `Chat ${chatId}`;
      console.log(`📋 Chat title: ${chatTitle}`);
    } catch (entityError) {
      console.warn(`⚠️ Could not get chat entity for ${chatId}, using fallback title:`, entityError.message);
      chatTitle = `Chat ${chatId}`;
    }
    
    // Calculate the time threshold (use scanInterval hours) - skip for manual scans
    let timeThreshold = null;
    let effectiveScanInterval = scanInterval;
    
    if (!isManualScan) {
      // Используем строго указанный интервал, чтобы анализировать только новые сообщения
      effectiveScanInterval = scanInterval;
      timeThreshold = new Date();
      timeThreshold.setHours(timeThreshold.getHours() - effectiveScanInterval);
      console.log(`⏰ Using effective scan interval: ${effectiveScanInterval} hours (requested: ${scanInterval})`);
      console.log(`⏰ Time threshold set to: ${timeThreshold.toISOString()}`);
      console.log(`⏰ Fetching messages from last ${effectiveScanInterval} hour(s) (since ${timeThreshold.toISOString()})...`);
    } else {
      console.log(`⏰ Manual scan mode: fetching ALL messages (no time filtering)`);
    }
    
    // Get messages with timeout and retry logic
    let messages;
    try {
      const getMessagesOptions = {
        limit: 1000 // Reduced limit to avoid flood wait (was 5000)
      };
      
      // For automatic scans, add offset_date to get messages only from the time threshold
      if (!isManualScan && timeThreshold) {
        // Convert timeThreshold to Unix timestamp
        getMessagesOptions.offset_date = Math.floor(timeThreshold.getTime() / 1000);
        console.log(`⏰ Using offset_date: ${getMessagesOptions.offset_date} (${timeThreshold.toISOString()})`);
      }
      
      messages = await Promise.race([
        telegramClient.getMessages(chatId, getMessagesOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting messages')), 45000)) // Increased to 45 seconds
      ]);
      console.log(`📨 Retrieved ${messages.length} messages from ${chatTitle}`);
    } catch (messagesError) {
      console.error(`❌ Error getting messages from ${chatTitle}:`, messagesError.message);
      // Return empty array instead of throwing
      return [];
    }
    
    // Filter messages by time threshold (only messages newer than timeThreshold) - skip for manual scans
    let filteredMessages;
    if (!isManualScan && timeThreshold) {
      // Since we used offset_date, most messages should already be within the time window
      // But we still filter to be extra sure and handle edge cases
      filteredMessages = messages.filter(msg => {
        if (!msg.date) return false;
        const messageDate = new Date(msg.date * 1000); // Convert Unix timestamp to Date
        return messageDate >= timeThreshold;
      });
      console.log(`🔍 Filtered to ${filteredMessages.length} messages within time window (from ${messages.length} retrieved)`);
      
      // Log if we got significantly fewer messages than expected
      if (messages.length === 5000 && filteredMessages.length < messages.length * 0.8) {
        console.log(`⚠️ Warning: Retrieved ${messages.length} messages but only ${filteredMessages.length} are within time window. Chat may be very active.`);
      }
    } else {
      filteredMessages = messages;
      console.log(`🔍 Manual scan: processing all ${filteredMessages.length} messages`);
    }
    
    // Debug: show some message timestamps for troubleshooting
    if (messages.length > 0) {
      const currentTime = new Date();
      console.log(`🕐 Current time: ${currentTime.toISOString()}`);
      if (timeThreshold) {
        console.log(`⏰ Time threshold: ${timeThreshold.toISOString()}`);
      } else {
        console.log(`⏰ Time threshold: none (manual scan)`);
      }
      
      // Show timestamps of first few messages
      const sampleMessages = messages.slice(0, 3);
      sampleMessages.forEach((msg, index) => {
        if (msg.date) {
          const msgDate = new Date(msg.date * 1000);
          const isWithinWindow = timeThreshold ? msgDate >= timeThreshold : true;
          console.log(`📅 Message ${index + 1} time: ${msgDate.toISOString()} (within window: ${isWithinWindow})`);
        }
      });
    }
    
    // Process messages with detailed user information
    const processedMessages = [];
    
    for (const msg of filteredMessages) {
      if (!msg.message && !msg.text) continue; // Skip empty messages
      
      let userInfo = {
        username: 'Unknown User',
        firstName: '',
        lastName: '',
        userId: null
      };
      
      // Get sender information
          if (msg.fromId) {
            let senderId;
            if (msg.fromId.userId) {
              senderId = msg.fromId.userId;
            } else if (msg.fromId.channelId) {
              senderId = msg.fromId.channelId;
            }
            
            if (senderId) {
              // First try to get user info from message properties
              if (msg.sender) {
                userInfo = {
                  username: msg.sender.username || 'невозможно получить юзернейм',
                  firstName: msg.sender.firstName || '',
                  lastName: msg.sender.lastName || '',
                  userId: senderId.toString()
                };
              } else {
                // Fallback: try to get entity from Telegram API
                try {
                  const senderEntity = await telegramClient.getEntity(senderId);
                  userInfo = {
                    username: senderEntity.username || 'невозможно получить юзернейм',
                    firstName: senderEntity.firstName || '',
                    lastName: senderEntity.lastName || '',
                    userId: senderId.toString()
                  };
                } catch (userError) {
                  console.warn(`⚠️ Could not get user info for message ${msg.id}:`, userError.message);
                  // Use fallback user info with better defaults
                  const fallbackUserId = senderId.toString();
                  userInfo = {
                    username: 'невозможно получить юзернейм',
                    firstName: '',
                    lastName: '',
                    userId: fallbackUserId
                  };
                }
              }
            }
          } else {
            // Handle messages without fromId (system messages, etc.)
            userInfo = {
              username: 'невозможно получить юзернейм',
              firstName: '',
              lastName: '',
              userId: 'system'
            };
          }
      
      processedMessages.push({
        id: msg.id,
        timestamp: msg.date ? formatMoscowTime(new Date(msg.date * 1000)) : formatMoscowTime(new Date()),
        message: msg.message || msg.text || '',
        username: userInfo.username,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        userId: userInfo.userId,
        chatId: chatId.toString(),
        chatTitle: chatTitle,
        messageType: msg.className || 'Message'
      });
    }
    
    console.log(`✅ Processed ${processedMessages.length} valid messages from ${chatTitle}`);
    return processedMessages;
    
  } catch (error) {
    console.error(`❌ Error fetching messages from chat ${chatId}:`, error.message);
    console.error(`❌ Error type:`, error.constructor.name);
    // Return empty array instead of throwing to prevent scan failure
    console.log(`⚠️ Returning empty array for chat ${chatId} due to error`);
    return [];
  }
}

// Mock function to fetch messages from chat (fallback)
async function fetchMessagesFromChat(chatId, scanInterval = 1, isManualScan = false) {
  // In real implementation, this would use the Telegram API
  // For now, return mock data with time filtering
  return generateMockMessages(chatId, scanInterval, isManualScan);
}

// Function to generate mock messages for testing
function generateMockMessages(chatId, scanInterval = 1, isManualScan = false) {
  const mockMessages = [];
  const usernames = ['alice_user', 'bob_chat', 'charlie_dev', 'diana_admin'];
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis'];
  const sampleTexts = [
    'Hello everyone!',
    'How are you doing today?',
    'Check out this new feature',
    'Meeting at 3 PM',
    'Great work on the project!',
    'Working on new updates',
    'See you tomorrow!',
    'Thanks for the help',
    'Let me know if you need anything',
    'Have a great day!'
  ];
  
  // Calculate time threshold based on scanInterval - skip for manual scans
  let timeThreshold = null;
  let totalMessages;
  
  if (!isManualScan) {
    timeThreshold = new Date();
    timeThreshold.setHours(timeThreshold.getHours() - scanInterval);
    console.log(`🕐 Generating mock messages for last ${scanInterval} hour(s) (since ${timeThreshold.toISOString()})`);
    totalMessages = Math.max(10, scanInterval * 5); // At least 10 messages, or 5 per hour
  } else {
    console.log(`🕐 Manual scan: generating ALL mock messages (no time filtering)`);
    totalMessages = 50; // Generate more messages for manual scan
  }
  
  const intervalMinutes = isManualScan ? 30 : (scanInterval * 60) / totalMessages; // Distribute messages evenly
  
  for (let i = 0; i < totalMessages; i++) {
    const userIndex = i % usernames.length;
    const messageTime = new Date(Date.now() - i * intervalMinutes * 60000); // Messages distributed over the interval
    
    // Only include messages within the time threshold for scheduled scans
    if (isManualScan || !timeThreshold || messageTime >= timeThreshold) {
      mockMessages.push({
        id: Date.now() + i,
        timestamp: formatMoscowTime(messageTime),
        message: sampleTexts[i % sampleTexts.length],
        username: usernames[userIndex],
        firstName: firstNames[userIndex],
        lastName: lastNames[userIndex],
        userId: `mock_user_${userIndex + 1}`,
        chatId: chatId.toString(),
        chatTitle: `Test Chat ${chatId}`,
        messageType: 'Message'
      });
    }
  }
  
  // Sort messages by timestamp (newest first)
  mockMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  if (isManualScan) {
    console.log(`📝 Generated ${mockMessages.length} mock messages for chat ${chatId} (manual scan - all messages)`);
  } else {
    console.log(`📝 Generated ${mockMessages.length} mock messages for chat ${chatId} within ${scanInterval} hour(s)`);
  }
  return mockMessages;
}

// Function to append messages to Google Sheets
async function appendMessagesToSheet(messages, spreadsheetId) {
  try {
    console.log(`📊 Appending ${messages.length} messages to Google Sheets...`);
    console.log(`📋 Using spreadsheet ID: ${spreadsheetId}`);
    
    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    
    // Skip Google Sheets operations if using mock data
    if (targetSpreadsheetId && targetSpreadsheetId.includes('mock')) {
      console.log(`⚠️ Mock spreadsheet ID detected, skipping Google Sheets operations`);
      console.log(`📝 Would have appended ${messages.length} messages to mock spreadsheet`);
      return { success: true, mock: true, messagesCount: messages.length };
    }
    
    // Check and add headers only if they don't exist (without force update)
    try {
      console.log(`📋 Checking if headers exist in spreadsheet...`);
      const headersResponse = await fetch('http://localhost:3001/api/sheets/headers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: targetSpreadsheetId,
          forceUpdate: false // Don't force update, only add if missing
        })
      });
      
      if (headersResponse.ok) {
        const headerResult = await headersResponse.json();
        console.log(`✅ Headers check completed:`, headerResult.message);
      } else {
        const errorText = await headersResponse.text();
        console.log(`⚠️ Could not check/add headers:`, errorText);
      }
    } catch (headerError) {
      console.log(`⚠️ Could not check/add headers, continuing with data append:`, headerError.message);
    }
    
    // Filter out messages without usernames and format the remaining ones
    const messagesWithUsernames = messages.filter(msg => msg.username && msg.username.trim() !== '');
    
    if (messagesWithUsernames.length === 0) {
      console.log(`⚠️ All ${messages.length} messages filtered out (no usernames), skipping Google Sheets write`);
      return { success: true, filtered: true, originalCount: messages.length, filteredCount: 0 };
    }
    
    if (messagesWithUsernames.length < messages.length) {
      console.log(`📋 Filtered out ${messages.length - messagesWithUsernames.length} messages without usernames`);
      console.log(`📋 Writing ${messagesWithUsernames.length} messages with usernames to Google Sheets`);
    }
    
    const formattedMessages = messagesWithUsernames.map(msg => ({
      timestamp: msg.timestamp,
      chatTitle: msg.chatTitle,
      username: msg.username,
      firstName: msg.firstName,
      lastName: msg.lastName,
      userId: msg.userId,
      message: msg.message,
      chatId: msg.chatId
    }));
    
    console.log(`📋 Sample message format:`, formattedMessages[0]);
    
    // Send to Google Sheets API
    const response = await fetch('http://localhost:3001/api/sheets/append', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: formattedMessages,
        spreadsheetId: targetSpreadsheetId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Successfully appended ${messagesWithUsernames.length} messages to Google Sheets`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error appending messages to Google Sheets:', error);
    throw error;
  }
}

// Helper function to stop all scan jobs
function stopAllScanJobs() {
  activeScanJobs.forEach((job, key) => {
    if (job) {
      // Handle both cron jobs (with stop method) and setInterval (with clearInterval)
      if (typeof job.stop === 'function') {
        job.stop();
      } else {
        clearInterval(job);
      }
    }
  });
  activeScanJobs.clear();
}

// Helper function to calculate next scan time
function getNextScanTime(intervalHours) {
  const now = new Date();
  const nextScan = new Date(now.getTime() + (intervalHours * 60 * 60 * 1000));
  return nextScan;
}

// Function to analyze messages for leads using Gemini API
async function analyzeMessagesForLeads(messages, leadAnalysisSettings, spreadsheetId, sheetsConfig) {
  try {
    const { openrouterApiKey, leadCriteria } = leadAnalysisSettings;

  console.log('🔍 Lead Analysis Settings:');
  console.log('  - API Key present:', !!openrouterApiKey);
    console.log('  - Lead Criteria:', JSON.stringify(leadCriteria, null, 2));
    console.log('  - Lead Criteria type:', typeof leadCriteria);
    console.log('  - Lead Criteria length:', leadCriteria ? leadCriteria.length : 'undefined');
    
    // Initialize Gemini service
    const geminiService = new GeminiService();
    geminiService.initialize({ apiKey: openrouterApiKey });
    
    // Transform messages to expected format for AI analysis
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      channel: msg.chatTitle || 'Unknown Channel',
      author: msg.username && msg.username !== 'невозможно получить юзернейм' ? msg.username : (`${msg.firstName || ''} ${msg.lastName || ''}`.trim() || 'Unknown Author'),
      username: msg.username && msg.username !== 'невозможно получить юзернейм' ? msg.username : null,
      message: msg.message,
      timestamp: msg.timestamp
    }));
    
    console.log('🔄 Transformed messages format for AI:', transformedMessages.length);
    console.log('📋 Sample transformed message:', transformedMessages[0]);
    console.log('🔍 Username debug - sample message username:', transformedMessages[0]?.username);
    
    // Analyze messages
    const analysisResult = await geminiService.analyzeMessagesForLeads(transformedMessages, {
      description: leadCriteria
    });
    
    // Send analyzed leads to the leads API endpoint and save to spreadsheet
    if (analysisResult.leads && analysisResult.leads.length > 0) {
      console.log(`🎯 Found ${analysisResult.leads.length} potential leads`);
      
      // Store leads via API
      const response = await fetch('http://localhost:3001/api/leads/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leads: analysisResult.leads,
          analysisTimestamp: new Date().toISOString(),
          criteria: leadCriteria,
          spreadsheetId: spreadsheetId
        })
      });
      
      if (response.ok) {
        console.log(`✅ Successfully stored ${analysisResult.leads.length} leads`);
      } else {
        console.error('❌ Failed to store leads:', await response.text());
      }
      
      // Also save leads to Лиды in Google Sheets
      try {
        console.log('📋 Saving leads to Лиды...');
        const sheetsResponse = await fetch('http://localhost:3001/api/sheets/append-leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            leads: analysisResult.leads,
            spreadsheetId: spreadsheetId,
            sheetName: 'Лиды',
            googleServiceAccountEmail: sheetsConfig?.serviceAccountEmail,
            googlePrivateKey: sheetsConfig?.privateKey
          })
        });
        
        if (sheetsResponse.ok) {
          const sheetsResult = await sheetsResponse.json();
          console.log(`✅ Successfully saved ${sheetsResult.totalLeads} leads to Лиды`);
          } else {
            const errorText = await sheetsResponse.text();
            console.error('❌ Failed to save leads to Лиды:', errorText);
        }
      } catch (sheetsError) {
        console.error('❌ Error saving leads to Лиды:', sheetsError);
      }
    } else {
      console.log('📝 No leads found in the analyzed messages');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing messages for leads:', error);
    throw error;
  }
}

// Функция для автоматического запуска анализа лидов
async function triggerAutomaticAnalysis() {
  console.log('🚀 НАЧАЛО triggerAutomaticAnalysis');
  console.log('⏰ Время вызова:', new Date().toLocaleString());
  
  try {
    console.log('🤖 Запуск автоматического анализа лидов...');
    
    // Получаем настройки AI из globalSettings (сохраненные из GUI)
    const openrouterApiKey = globalSettings.openrouterApiKey;
    const leadCriteria = globalSettings.leadCriteria;

    console.log('🔍 DEBUG: Проверка globalSettings:');
    console.log('  - openrouterApiKey:', !!openrouterApiKey);
    console.log('  - leadCriteria:', !!leadCriteria);
    console.log('  - spreadsheetId:', !!globalSettings.spreadsheetId);
    console.log('  - sheetsConfig:', !!globalSettings.sheetsConfig);

    if (!openrouterApiKey || !leadCriteria) {
      console.log('⚠️ Настройки AI не сохранены в globalSettings, пропускаем автоматический анализ');
      console.log('💡 Убедитесь что настройки AI заданы во вкладке "Лиды" и сканер был перезапущен');
      return;
    }
    
    // Если есть свежие сообщения из последнего скана — анализируем их напрямую без внешнего запроса
    if (Array.isArray(lastScanMessages) && lastScanMessages.length > 0) {
      console.log(`🔍 Локальный автоанализ ${lastScanMessages.length} сообщений из последнего сканирования`);
      try {
        await analyzeMessagesForLeads(lastScanMessages, { openrouterApiKey, leadCriteria }, globalSettings.spreadsheetId, globalSettings.sheetsConfig);
        console.log('✅ Локальный автоанализ успешно завершён');
        return;
      } catch (err) {
        console.error('❌ Ошибка локального автоанализа, выполняю fallback к внешнему эндпоинту', err?.message || err);
      }
    }
    
    // Подготавливаем данные для запроса
    const requestBody = {
      openrouterApiKey,
      criteria: leadCriteria,
      spreadsheetId: globalSettings.spreadsheetId,
      googleServiceAccountEmail: globalSettings.sheetsConfig?.serviceAccountEmail,
      googlePrivateKey: globalSettings.sheetsConfig?.privateKey
    };
    
    console.log('📋 Отправляем запрос с параметрами:', {
      hasApiKey: !!requestBody.openrouterApiKey,
      hasCriteria: !!requestBody.criteria,
      hasSpreadsheetId: !!requestBody.spreadsheetId,
      hasServiceAccountEmail: !!requestBody.googleServiceAccountEmail,
      hasPrivateKey: !!requestBody.googlePrivateKey
    });
    
    // Получаем последние сообщения для анализа
    const response = await fetch('http://localhost:3001/api/leads/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Автоматический анализ завершен: найдено ${result.leads?.length || 0} лидов`);
    } else {
      const errorText = await response.text();
      console.error('❌ Ошибка автоматического анализа:', errorText);
    }
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА в triggerAutomaticAnalysis:', error);
    console.error('📋 Stack trace:', error.stack);
    throw error; // Пробрасываем ошибку дальше
  } finally {
    console.log('🏁 КОНЕЦ triggerAutomaticAnalysis');
  }
}

// Cleanup on process exit
process.on('SIGTERM', () => {
  stopAllScanJobs();
});

process.on('SIGINT', () => {
  stopAllScanJobs();
});

module.exports = router;