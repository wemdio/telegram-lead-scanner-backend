const express = require('express');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const path = require('path');
const { convertTDataToStringSession } = require('../tdata-converter');
const PyrogramConverter = require('../pyrogram-converter');
const router = express.Router();

let telegramClient = null;

// Путь к файлу для сохранения аккаунтов
const ACCOUNTS_FILE = path.join(__dirname, '..', 'accounts.json');

// Функция для отправки ответа лида в API
async function sendLeadResponseToAPI(leadId, leadName, message, chatId) {
  try {
    const response = await fetch('http://localhost:3001/api/leads/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadId: leadId,
        leadName: leadName,
        message: message,
        chatId: chatId,
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      console.log('✅ Lead response sent to API successfully');
    } else {
      console.error('❌ Failed to send lead response to API:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error sending lead response to API:', error);
  }
}

// Функция для загрузки аккаунтов из файла
function loadAccountsFromFile() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
      const savedAccounts = JSON.parse(data);
      
      // Восстанавливаем sessionData для JSON аккаунтов из их файлов
      savedAccounts.forEach(account => {
        if (account.type === 'json' && account.path && !account.sessionData) {
          try {
            // Пробуем разные варианты путей к файлу
            let accountPath = null;
            const possiblePaths = [
              path.resolve(account.path), // Абсолютный путь
              path.resolve(__dirname, '..', account.path), // Относительно backend
              path.resolve(__dirname, '..', '..', account.path), // Относительно корня проекта
              path.resolve(process.cwd(), account.path), // Относительно рабочей директории
              path.resolve(process.cwd(), '..', account.path) // На уровень выше рабочей директории
            ];
            
            // Ищем файл по всем возможным путям
            for (const possiblePath of possiblePaths) {
              if (fs.existsSync(possiblePath)) {
                accountPath = possiblePath;
                break;
              }
            }
            
            if (accountPath) {
              const jsonContent = fs.readFileSync(accountPath, 'utf8');
              account.sessionData = JSON.parse(jsonContent);
              console.log(`Restored sessionData for account ${account.id} from ${accountPath}`);
            } else {
              console.warn(`JSON file not found for account ${account.id}: ${account.path}`);
              console.warn('Tried paths:', possiblePaths);
              // Помечаем аккаунт как неактивный, если файл не найден
              account.status = 'inactive';
            }
          } catch (error) {
            console.error(`Error restoring sessionData for account ${account.id}:`, error.message);
            // Помечаем аккаунт как неактивный при ошибке
            account.status = 'inactive';
          }
        }
      });
      
      accounts = savedAccounts;
      console.log(`Loaded ${accounts.length} accounts from file`);
      
      // Выводим отладочную информацию о загруженных аккаунтах
      accounts.forEach(account => {
        console.log(`Account ${account.id}: type=${account.type}, status=${account.status}, hasSessionData=${!!account.sessionData}`);
      });
    } else {
      console.log('No accounts file found, starting with empty accounts array');
    }
  } catch (error) {
    console.error('Error loading accounts from file:', error);
    accounts = [];
  }
}

// Функция для сохранения аккаунтов в файл
function saveAccountsToFile() {
  try {
    // Создаем копию аккаунтов
    const accountsToSave = accounts.map(account => {
      if (account.type === 'tdata' && account.sessionData) {
        // Для TData аккаунтов сохраняем sessionData, так как это результат конвертации
        return {
          ...account,
          sessionData: account.sessionData
        };
      } else if (account.type === 'string_session' && account.sessionData) {
        // Для string_session аккаунтов также сохраняем sessionData
        return {
          ...account,
          sessionData: account.sessionData
        };
      } else if (account.type === 'json') {
        // Для JSON аккаунтов не сохраняем sessionData в файл (они загружаются из отдельных файлов)
        return {
          ...account,
          sessionData: undefined
        };
      } else {
        // Для остальных типов сохраняем как есть
        return account;
      }
    });
    
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accountsToSave, null, 2));
    console.log(`Saved ${accounts.length} accounts to file`);
  } catch (error) {
    console.error('Error saving accounts to file:', error);
  }
}

// Initialize Telegram client
router.post('/initialize', async (req, res) => {
  try {
    const { apiId, apiHash, sessionString, accountId } = req.body;
    
    // Если передан accountId, получаем данные из аккаунта
    let finalApiId = apiId;
    let finalApiHash = apiHash;
    let finalSessionString = sessionString;
    
    if (accountId) {
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      if (account.type === 'json' && account.sessionData) {
        finalApiId = account.sessionData.apiId;
        finalApiHash = account.sessionData.apiHash;
        finalSessionString = account.sessionData.session || '';
      } else if (account.type === 'pyrogram' && account.sessionData) {
        finalApiId = account.sessionData.apiId;
        finalApiHash = account.sessionData.apiHash;
        finalSessionString = account.sessionData.sessionString || '';
      } else if (account.type === 'string_session') {
        finalApiId = account.apiId;
        finalApiHash = account.apiHash;
        finalSessionString = account.sessionData;
      } else if (account.type === 'tdata' && account.sessionData) {
        finalApiId = '94575';
        finalApiHash = 'a3406de8d171bb422bb6ddf3bbd800e2';
        finalSessionString = account.sessionData;
      } else if (account.type === 'authkey') {
        finalApiId = '94575';
        finalApiHash = 'a3406de8d171bb422bb6ddf3bbd800e2';
        finalSessionString = account.sessionData;
      }
    }
    
    if (!finalApiId || !finalApiHash) {
      return res.status(400).json({ error: 'API ID and API Hash are required' });
    }

    // Check for mock data
    const apiIdStr = finalApiId ? finalApiId.toString() : '';
    const isMockApiId = !finalApiId ||
                       finalApiId === 'mock' ||
                       finalApiId === 'your_api_id_here' ||
                       finalApiId === '12345' ||
                       finalApiId === 12345 ||
                       apiIdStr === '12345' ||
                       apiIdStr === 'test' ||
                       finalApiId === 0;
    
    const isMockApiHash = !finalApiHash ||
                         finalApiHash.includes('mock') || 
                         finalApiHash.includes('your_api_hash_here') ||
                         finalApiHash === 'your_api_hash_here' ||
                         finalApiHash === 'test_hash' ||
                         finalApiHash === 'test';
    
    const isMockSession = !finalSessionString ||
                         finalSessionString.includes('mock') || 
                         finalSessionString.includes('your_session_string_here') ||
                         finalSessionString === 'your_session_string_here' ||
                         finalSessionString === 'test_session' ||
                         finalSessionString === 'test';

    if (isMockApiId || isMockApiHash || isMockSession) {
      return res.json({ 
        success: true, 
        message: 'Mock data detected, skipping Telegram client initialization',
        mock: true 
      });
    }

    // Проверяем, есть ли уже активный клиент с той же сессией
    if (telegramClient && telegramClient.session && finalSessionString) {
      try {
        const currentSessionString = telegramClient.session.save();
        if (currentSessionString === finalSessionString && telegramClient.connected) {
          console.log('Using existing connected client with same session');
          return res.json({ 
            success: true, 
            message: 'Telegram client already initialized with this session',
            sessionString: currentSessionString
          });
        }
      } catch (e) {
        console.log('Error checking existing session:', e.message);
      }
    }

    // Принудительно очищаем все существующие подключения
    if (telegramClient) {
      try {
        console.log('Cleaning up existing client...');
        
        // Принудительно уничтожаем сессию
        try {
          await telegramClient.destroy();
        } catch (destroyError) {
          console.log('Error during destroy (ignored):', destroyError.message);
        }
        
        // Отключаем клиент с таймаутом
        await Promise.race([
          telegramClient.disconnect(),
          new Promise(resolve => setTimeout(resolve, 5000)) // 5 секунд максимум
        ]);
        
        console.log('Existing client cleanup completed');
      } catch (e) {
        console.log('Error during cleanup (ignored):', e.message);
      }
      telegramClient = null;
    }

    // Увеличенная пауза для полной стабилизации
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 секунды

    console.log('Creating new Telegram client...');
    
    // Используем оригинальную сессию без модификации
    const session = new StringSession(finalSessionString || '');
    
    // Создаем новый клиент с базовыми параметрами
    telegramClient = new TelegramClient(session, parseInt(finalApiId), finalApiHash, {
      connectionRetries: 3,
      timeout: 15000, // 15 seconds timeout
      retryDelay: 2000, // 2 second delay between retries
      autoReconnect: false // Disable auto-reconnect to prevent timeout loops
    });

    // Try to connect - if no session string, client will be created but not connected
    if (finalSessionString) {
      await telegramClient.connect();
      
      // Добавляем обработчик входящих сообщений
      telegramClient.addEventHandler(async (update) => {
        if (update.className === 'UpdateNewMessage') {
          const message = update.message;
          if (message && message.message && message.peerId) {
            try {
              // Получаем информацию о чате/пользователе
              let chatId = null;
              let leadName = 'Unknown';
              
              if (message.peerId.className === 'PeerUser') {
                chatId = message.peerId.userId.toString();
                try {
                  const user = await telegramClient.getEntity(message.peerId.userId);
                  leadName = user.firstName || user.username || 'Unknown';
                } catch (e) {
                  console.warn('Could not get user info:', e);
                }
              } else if (message.peerId.className === 'PeerChat') {
                chatId = message.peerId.chatId.toString();
                try {
                  const chat = await telegramClient.getEntity(message.peerId.chatId);
                  leadName = chat.title || 'Unknown Chat';
                } catch (e) {
                  console.warn('Could not get chat info:', e);
                }
              }
              
              if (chatId) {
                // Отправляем ответ лида в API
                await sendLeadResponseToAPI(chatId, leadName, message.message, chatId);
              }
            } catch (error) {
              console.error('Error processing incoming message:', error);
            }
          }
        }
      });
      
      console.log('✅ Message handler added to Telegram client');
    } else {
      // For new sessions, just create the client without connecting
      // Connection will happen when we try to get chats
      // console.log('Telegram client created without session string');
    }

    const newSessionString = telegramClient.session.save();
    
    res.json({ 
      success: true, 
      message: 'Telegram client initialized successfully',
      sessionString: newSessionString
    });
  } catch (error) {
    console.error('Telegram initialization error:', error);
    
    // Ensure we always return valid JSON
    let errorMessage = 'Failed to initialize Telegram client';
    let errorDetails = error.message || 'Unknown error';
    
    // Handle specific Telegram errors
    if (error.message && error.message.includes('AUTH_KEY_DUPLICATED')) {
      return res.status(500).json({ 
        error: 'AUTH_KEY_DUPLICATED', 
        message: 'Обнаружен дублированный ключ авторизации. Попробуйте еще раз через несколько секунд.' 
      });
    }
    
    // Handle specific timeout errors
    if (error.message && error.message.includes('TIMEOUT')) {
      return res.status(408).json({ 
        error: 'Connection timeout', 
        message: 'Telegram connection timed out. Please check your internet connection and try again.' 
      });
    }
    
    // Ensure response is always valid JSON
    res.status(500).json({ 
      error: errorMessage, 
      message: errorDetails,
      success: false
    });
  }
});

// Get user chats
router.get('/chats', async (req, res) => {
  try {
    if (!telegramClient) {
      return res.status(400).json({ error: 'Telegram client not initialized' });
    }

    // Check if client is connected and authenticated
    if (!telegramClient.connected) {
      return res.status(401).json({ 
        error: 'Telegram client not authenticated', 
        message: 'Please provide valid session string or complete authentication first'
      });
    }

    const dialogs = await telegramClient.getDialogs({ limit: 500 }); // Increased limit to get more chats
    
    const chats = dialogs.map(dialog => ({
      id: dialog.id?.toString(),
      title: dialog.title || dialog.name || 'Unknown',
      type: dialog.isChannel ? 'channel' : dialog.isGroup ? 'group' : 'private',
      participantsCount: dialog.participantsCount || 0
    }));

    res.json({ chats });
  } catch (error) {
    // console.error('Get chats error:', error);
    
    // Handle authentication errors specifically
    if (error.code === 401 || error.errorMessage === 'AUTH_KEY_UNREGISTERED') {
      return res.status(401).json({ 
        error: 'Authentication required', 
        message: 'Please provide valid API credentials and session string'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get chats', 
      message: error.message 
    });
  }
});

// Get messages from specific chat
router.post('/messages', async (req, res) => {
  try {
    const { chatId, limit = 1000 } = req.body; // Increased default limit to 1000
    
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID is required' });
    }

    // Check for mock/test chat ID
    if (chatId === 'test_chat' || chatId.includes('mock') || chatId.includes('test')) {
      console.log('Mock chat detected, returning test messages');
      const mockMessages = [];
      const messageCount = Math.min(parseInt(limit), 10); // Limit mock messages to 10
      
      for (let i = 0; i < messageCount; i++) {
        mockMessages.push({
          id: i + 1,
          text: `Тестовое сообщение ${i + 1} для чата ${chatId}`,
          date: new Date(Date.now() - i * 60000), // Messages 1 minute apart
          fromId: `mock_user_${i % 3}`,
          username: `testuser${i % 3}`,
          firstName: `Test${i % 3}`,
          lastName: 'User'
        });
      }
      
      return res.json({ messages: mockMessages });
    }

    if (!telegramClient) {
      return res.status(400).json({ error: 'Telegram client not initialized' });
    }

    const messages = await telegramClient.getMessages(chatId, {
      limit: parseInt(limit)
    });

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      text: msg.text || '',
      date: msg.date,
      fromId: msg.fromId?.userId?.toString() || null,
      username: msg.sender?.username || null,
      firstName: msg.sender?.firstName || null,
      lastName: msg.sender?.lastName || null
    }));

    res.json({ messages: formattedMessages });
  } catch (error) {
    // console.error('Get messages error:', error);
    res.status(500).json({ 
      error: 'Failed to get messages', 
      message: error.message 
    });
  }
});

// Disconnect Telegram client
router.post('/disconnect', async (req, res) => {
  try {
    if (telegramClient) {
      // Принудительно очищаем сессию перед отключением
      if (telegramClient.session) {
        telegramClient.session.delete();
      }
      await telegramClient.disconnect();
      // Увеличиваем задержку до 5 секунд для более надежного отключения
      await new Promise(resolve => setTimeout(resolve, 5000));
      telegramClient = null;
    }
    
    res.json({ success: true, message: 'Telegram client disconnected' });
  } catch (error) {
    // console.error('Disconnect error:', error);
    res.status(500).json({ 
      error: 'Failed to disconnect', 
      message: error.message 
    });
  }
});

// Get client status
router.get('/status', (req, res) => {
  res.json({ 
    connected: telegramClient !== null,
    timestamp: new Date().toISOString()
  });
});

// Check connection status
router.post('/check-connection', async (req, res) => {
  try {
    const { apiId, apiHash, phoneNumber } = req.body;
    
    // Check for mock data
    const apiIdStr = apiId ? apiId.toString() : '';
    const isMockApiId = !apiId ||
                       apiId === 'mock' ||
                       apiId === 'your_api_id_here' ||
                       apiId === '12345' ||
                       apiId === 12345 ||
                       apiIdStr === '12345' ||
                       apiIdStr === 'test' ||
                       apiId === 0;
    
    const isMockApiHash = !apiHash ||
                         apiHash.includes('mock') || 
                         apiHash.includes('your_api_hash_here') ||
                         apiHash === 'your_api_hash_here' ||
                         apiHash === 'test_hash' ||
                         apiHash === 'test';
    
    const isMockPhone = !phoneNumber ||
                       phoneNumber.includes('mock') || 
                       phoneNumber.includes('your_phone_here') ||
                       phoneNumber === 'your_phone_here' ||
                       phoneNumber === 'test_phone' ||
                       phoneNumber === 'test';

    if (isMockApiId || isMockApiHash || isMockPhone) {
      return res.json({ 
        success: true,
        connected: true, 
        message: 'Mock data detected, connection simulated successfully',
        mock: true,
        user: {
          id: 'mock_user_123',
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
          phone: '+1234567890'
        }
      });
    }

    if (!telegramClient) {
      return res.json({ 
        success: false,
        connected: false, 
        message: 'Telegram client not initialized. Please initialize first.',
        error: 'Client not initialized'
      });
    }

    // Check if client is connected and authenticated
    if (!telegramClient.connected) {
      return res.json({ 
        success: false,
        connected: false, 
        message: 'Telegram client not connected. Please initialize and authenticate first.',
        error: 'Client not connected'
      });
    }

    // Try to get user info to verify authentication
    try {
      const me = await telegramClient.getMe();
      return res.json({ 
        success: true,
        connected: true, 
        message: 'Successfully connected to Telegram',
        user: {
          id: me.id,
          firstName: me.firstName,
          lastName: me.lastName,
          username: me.username,
          phone: me.phone
        }
      });
    } catch (authError) {
      return res.json({ 
        success: false,
        connected: false, 
        message: 'Telegram client connected but not authenticated. Please complete authentication.',
        error: 'Authentication required'
      });
    }
  } catch (error) {
    console.error('Error checking Telegram connection:', error);
    res.status(500).json({ 
      success: false,
      connected: false, 
      error: 'Failed to check connection status',
      message: error.message 
    });
  }
});

async function sendCodeHandler(req, res) {
  try {
    const { apiId, apiHash, phoneNumber } = req.body;
    
    if (!apiId || !apiHash || !phoneNumber) {
      return res.status(400).json({ error: 'API ID, API Hash and phone number are required' });
    }

    const apiIdStr = apiId ? apiId.toString() : '';
    const isMockApiId = !apiId ||
                       apiId === 'mock' ||
                       apiId === 'your_api_id_here' ||
                       apiId === '12345' ||
                       apiId === 12345 ||
                       apiIdStr === '12345' ||
                       apiIdStr === 'test' ||
                       apiId === 0;
    
    const isMockApiHash = !apiHash ||
                         apiHash.includes('mock') || 
                         apiHash.includes('your_api_hash_here') ||
                         apiHash === 'your_api_hash_here' ||
                         apiHash === 'test_hash' ||
                         apiHash === 'test';

    if (isMockApiId || isMockApiHash) {
      return res.json({ 
        success: true, 
        message: 'Mock data detected, skipping authentication',
        mock: true 
      });
    }

    const session = new StringSession('');
    telegramClient = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 2,
      timeout: 10000,
      retryDelay: 2000,
      autoReconnect: false
    });

    await telegramClient.connect();
    
    // Добавляем обработчик входящих сообщений
    telegramClient.addEventHandler(async (update) => {
      if (update.className === 'UpdateNewMessage') {
        const message = update.message;
        if (message && message.message && message.peerId) {
          try {
            // Получаем информацию о чате/пользователе
            let chatId = null;
            let leadName = 'Unknown';
            
            if (message.peerId.className === 'PeerUser') {
              chatId = message.peerId.userId.toString();
              try {
                const user = await telegramClient.getEntity(message.peerId.userId);
                leadName = user.firstName || user.username || 'Unknown';
              } catch (e) {
                console.warn('Could not get user info:', e);
              }
            } else if (message.peerId.className === 'PeerChat') {
              chatId = message.peerId.chatId.toString();
              try {
                const chat = await telegramClient.getEntity(message.peerId.chatId);
                leadName = chat.title || 'Unknown Chat';
              } catch (e) {
                console.warn('Could not get chat info:', e);
              }
            }
            
            if (chatId) {
              // Отправляем ответ лида в API
              await sendLeadResponseToAPI(chatId, leadName, message.message, chatId);
            }
          } catch (error) {
            console.error('Error processing incoming message:', error);
          }
        }
      }
    });
    
    console.log('✅ Message handler added to Telegram client (sendCode)');
    
    const result = await telegramClient.sendCode({
      apiId: parseInt(apiId),
      apiHash: apiHash
    }, phoneNumber);
    
    res.json({ 
      success: true, 
      message: 'Code sent successfully',
      phoneCodeHash: result.phoneCodeHash
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to send code', 
        message: error.message || 'Unknown error occurred'
      });
    }
  }
}

// Step 1: Send authentication code (aliased)
router.post('/auth/send-code', async (req, res) => {
  return await sendCodeHandler(req, res);
});

// Main endpoint for auth
router.post('/auth', async (req, res) => {
  return await sendCodeHandler(req, res);
});

// Step 2: Verify code and get session string
router.post('/auth/verify-code', async (req, res) => {
  try {
    const { phoneNumber, phoneCode, phoneCodeHash, apiId, apiHash } = req.body;
    

    
    if (!phoneNumber || !phoneCode || !phoneCodeHash) {
      return res.status(400).json({ error: 'Phone number, code and code hash are required' });
    }

    if (!telegramClient) {
      return res.status(400).json({ error: 'Authentication session not found. Please send code first.' });
    }

    // Use the stored phone code hash and provided phone code
    const result = await telegramClient.invoke(new Api.auth.SignIn({
      phoneNumber: phoneNumber,
      phoneCodeHash: phoneCodeHash,
      phoneCode: phoneCode
    }));
    
    const sessionString = telegramClient.session.save();
    
    res.json({ 
      success: true, 
      message: 'Authentication successful',
      sessionString: sessionString
    });
  } catch (error) {
    // console.error('Verify code error:', error);
    
    // Handle specific authentication errors
    if (error.errorMessage === 'PHONE_CODE_INVALID') {
      return res.status(400).json({ 
        error: 'Invalid verification code', 
        message: 'Please check the code and try again'
      });
    }
    
    if (error.errorMessage === 'PHONE_CODE_EXPIRED') {
      return res.status(400).json({ 
        error: 'Verification code expired', 
        message: 'Please request a new code'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to verify code', 
      message: error.message 
    });
  }
});

// Validate session string
router.post('/auth/validate-session', async (req, res) => {
  try {
    const { apiId, apiHash, sessionString } = req.body;
    
    if (!apiId || !apiHash || !sessionString) {
  return res.status(400).json({ error: 'API ID, API Hash and session string are required' });

}
const apiIdNum = parseInt(apiId);
if (isNaN(apiIdNum) || apiIdNum <= 0) {
  return res.status(400).json({ error: 'API ID must be a valid positive number' });
}


    // Check for mock data
    const apiIdStr = apiId ? apiId.toString() : '';
    const isMockApiId = !apiId ||
                       apiId === 'mock' ||
                       apiId === 'your_api_id_here' ||
                       apiId === '12345' ||
                       apiId === 12345 ||
                       apiIdStr === '12345' ||
                       apiIdStr === 'test' ||
                       apiId === 0;
    
    const isMockApiHash = !apiHash ||
                         apiHash.includes('mock') || 
                         apiHash.includes('your_api_hash_here') ||
                         apiHash === 'your_api_hash_here' ||
                         apiHash === 'test_hash' ||
                         apiHash === 'test';
    
    const isMockSession = !sessionString ||
                         sessionString.includes('mock') || 
                         sessionString.includes('your_session_string_here') ||
                         sessionString === 'your_session_string_here' ||
                         sessionString === 'test_session' ||
                         sessionString === 'test';

    if (isMockApiId || isMockApiHash || isMockSession) {
      return res.json({ 
        valid: true, 
        message: 'Mock session detected, validation skipped',
        mock: true,
        user: { id: 'mock_user', username: 'mock_user', first_name: 'Mock', last_name: 'User' }
      });
    }

    // Create a temporary client to test the session
    const testClient = new TelegramClient(new StringSession(sessionString), apiIdNum, apiHash, {
      connectionRetries: 2,
      timeout: 10000, // 10 seconds timeout
      retryDelay: 2000,
      autoReconnect: false
    });

    await testClient.connect();
    
    // Try to get current user to validate session
    const user = await testClient.getMe();
    
    await testClient.disconnect();
    
    res.json({ 
      valid: true, 
      user: {
        id: user.id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username
      }
    });
  } catch (error) {
    // console.error('Session validation error:', error);
    
    // Handle specific timeout errors
    if (error.message && error.message.includes('TIMEOUT')) {
      return res.json({ 
        valid: false, 
        error: 'Connection timeout. Please check your internet connection and try again.' 
      });
    }
    
    res.json({ 
      valid: false, 
      error: error.message 
    });
  }
});

// Create new session through phone authentication
router.post('/create-session', async (req, res) => {
  try {
    const { phoneNumber, apiId, apiHash } = req.body;
    
    if (!phoneNumber || !apiId || !apiHash) {
      return res.status(400).json({ error: 'Phone number, API ID and API Hash are required' });
    }
    const apiIdNum = parseInt(apiId);
    if (isNaN(apiIdNum) || apiIdNum <= 0) {
      return res.status(400).json({ error: 'API ID must be a valid positive number' });
    }
    if (typeof apiHash !== 'string' || apiHash.length < 32) {
      return res.status(400).json({ error: 'API Hash must be a valid string of at least 32 characters' });
    }

    console.log('Creating new session for phone:', phoneNumber);

    // Create new client with empty session
    const session = new StringSession('');
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 3,
      timeout: 15000,
      retryDelay: 2000,
      autoReconnect: false
    });

    await client.connect();
    console.log('Connected to Telegram for authentication');

    // Send authentication code
    const result = await client.sendCode({
      apiId: parseInt(apiId),
      apiHash: apiHash
    }, phoneNumber);

    console.log('Authentication code sent');

    // Store client temporarily for verification
    global.tempAuthClient = client;
    global.tempAuthData = {
      phoneNumber,
      phoneCodeHash: result.phoneCodeHash,
      apiId: parseInt(apiId),
      apiHash
    };

    res.json({
      success: true,
      message: 'Authentication code sent to your phone',
      phoneCodeHash: result.phoneCodeHash
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error.message
    });
  }
});

// Verify authentication code and complete session creation
router.post('/verify-session', async (req, res) => {
  try {
    const { phoneCode } = req.body;
    
    if (!phoneCode) {
      return res.status(400).json({ error: 'Phone code is required' });
    }

    if (!global.tempAuthClient || !global.tempAuthData) {
      return res.status(400).json({ error: 'No active authentication session. Please start authentication first.' });
    }

    console.log('Verifying authentication code');

    // Verify the code
    const authResult = await global.tempAuthClient.invoke(new Api.auth.SignIn({
      phoneNumber: global.tempAuthData.phoneNumber,
      phoneCodeHash: global.tempAuthData.phoneCodeHash,
      phoneCode: phoneCode
    }));

    // After successful authentication, get the session string
    console.log('=== НАЧАЛО ПОЛУЧЕНИЯ SESSION STRING ===');
    console.log('Получаем session string...');
    console.log('Тип session:', typeof global.tempAuthClient.session);
    console.log('Session объект:', global.tempAuthClient.session);
    console.log('Session конструктор:', global.tempAuthClient.session?.constructor?.name);
    
    let sessionString;
    try {
      sessionString = global.tempAuthClient.session.save();
      console.log('✅ Session.save() вызван успешно');
      console.log('Session string получен:', sessionString ? 'Да' : 'Нет', sessionString?.length || 0, 'символов');
      console.log('Session string тип:', typeof sessionString);
      console.log('Session string первые 50 символов:', sessionString?.substring(0, 50));
    } catch (error) {
      console.error('❌ Ошибка при вызове session.save():', error);
      sessionString = null;
    }
    
    // Дополнительная проверка sessionString
    if (!sessionString || sessionString.length === 0) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: sessionString пуст после аутентификации');
      console.log('Состояние клиента:', {
        connected: global.tempAuthClient.connected,
        authorized: await global.tempAuthClient.checkAuthorization(),
        sessionType: typeof global.tempAuthClient.session,
        sessionHasSave: typeof global.tempAuthClient.session?.save === 'function'
      });
      
      // Попробуем несколько альтернативных способов
      console.log('🔄 Пробуем альтернативные способы получения session string...');
      
      // Способ 1: Прямой доступ к session data
      try {
        if (global.tempAuthClient.session._data) {
          console.log('Способ 1: Найдены session._data');
          sessionString = global.tempAuthClient.session._data;
        }
      } catch (e) {
        console.log('Способ 1 не работает:', e.message);
      }
      
      // Способ 2: Попробуем toString
      try {
        if (global.tempAuthClient.session.toString && typeof global.tempAuthClient.session.toString === 'function') {
          const toStringResult = global.tempAuthClient.session.toString();
          console.log('Способ 2: toString результат:', toStringResult?.substring(0, 50));
          if (toStringResult && toStringResult.length > 10) {
            sessionString = toStringResult;
          }
        }
      } catch (e) {
        console.log('Способ 2 не работает:', e.message);
      }
      
      // Способ 3: Повторный вызов save()
      try {
        console.log('Способ 3: Повторный вызов save()');
        const retrySessionString = global.tempAuthClient.session.save();
        console.log('Повторный save() результат:', retrySessionString?.substring(0, 50));
        if (retrySessionString && retrySessionString.length > 0) {
          sessionString = retrySessionString;
        }
      } catch (e) {
        console.log('Способ 3 не работает:', e.message);
      }
      
      // Способ 4: Проверим все свойства session объекта
      try {
        console.log('Способ 4: Анализ всех свойств session объекта');
        const sessionKeys = Object.keys(global.tempAuthClient.session || {});
        console.log('Session keys:', sessionKeys);
        for (const key of sessionKeys) {
          const value = global.tempAuthClient.session[key];
          if (typeof value === 'string' && value.length > 50) {
            console.log(`Найдена потенциальная session string в ${key}:`, value.substring(0, 50));
            sessionString = value;
            break;
          }
        }
      } catch (e) {
        console.log('Способ 4 не работает:', e.message);
      }
    }
    
    // Убеждаемся, что sessionString это строка
    const finalSessionString = sessionString && sessionString.length > 0 ? String(sessionString) : null;
    console.log('=== ФИНАЛЬНЫЙ РЕЗУЛЬТАТ ===');
    console.log('Final session string:', finalSessionString ? 'Присутствует' : 'Отсутствует', finalSessionString?.length || 0);
    if (finalSessionString) {
      console.log('Final session string первые 50 символов:', finalSessionString.substring(0, 50));
    }
    console.log('=== КОНЕЦ ПОЛУЧЕНИЯ SESSION STRING ===');
    
    // Get user info
    const me = await global.tempAuthClient.getMe();
    console.log('Информация о пользователе получена:', {
      id: me.id,
      firstName: me.firstName,
      lastName: me.lastName,
      username: me.username,
      phone: me.phone
    });
    
    // Не добавляем аккаунт для парсинга в общий список accounts
    // Аккаунт для парсинга будет сохранен в localStorage на фронтенде
    console.log('Parsing account session created, not adding to contacts list');

    // Clean up temporary data
    await global.tempAuthClient.disconnect();
    delete global.tempAuthClient;
    delete global.tempAuthData;

    console.log('New session created successfully for user:', newAccount.user);
    console.log('Отправляем ответ с данными:', {
      sessionString: finalSessionString ? 'Присутствует' : 'Отсутствует',
      sessionStringLength: finalSessionString?.length || 0,
      userId: me.id.toString(),
      username: me.username || `${me.firstName || ''} ${me.lastName || ''}`.trim()
    });

    res.json({
      success: true,
      message: 'Session created successfully',
      sessionString: finalSessionString,
      userId: me.id.toString(),
      username: me.username || `${me.firstName || ''} ${me.lastName || ''}`.trim(),
      account: {
        id: newAccount.id,
        name: newAccount.name,
        user: newAccount.user
      }
    });
  } catch (error) {
    console.error('Error verifying session:', error);
    
    // Clean up on error
    if (global.tempAuthClient) {
      try {
        await global.tempAuthClient.disconnect();
      } catch (e) {}
      delete global.tempAuthClient;
      delete global.tempAuthData;
    }

    if (error.errorMessage === 'PHONE_CODE_INVALID') {
      return res.status(400).json({
        error: 'Invalid verification code',
        message: 'Please check the code and try again'
      });
    }

    if (error.errorMessage === 'PHONE_CODE_EXPIRED') {
      return res.status(400).json({
        error: 'Verification code expired',
        message: 'Please request a new code'
      });
    }

    res.status(500).json({
      error: 'Failed to verify session',
      message: error.message
    });
  }
});

// Отправить сообщение
router.post('/send-message', async (req, res) => {
  let client; // Объявляем client в начале функции
  
  try {
    console.log('=== DEBUG: Send message request ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('=== END DEBUG ===');
    
    const { targetUsername, message, accountId, apiId, apiHash, sessionString, phoneNumber } = req.body;
    
    if (!targetUsername || !message) {
      return res.status(400).json({
        success: false,
        error: 'Target username and message are required'
      });
    }

    // Если переданы apiId, apiHash, sessionString напрямую, используем их
    let finalSessionString = '';
    let finalApiId, finalApiHash;
    let proxyConfig = null;

    if (apiId && apiHash && sessionString) {
      // Используем переданные параметры напрямую
      finalApiId = apiId;
      finalApiHash = apiHash;
      finalSessionString = sessionString;
      console.log('Используем переданные параметры напрямую');
    } else if (accountId) {
      // Если указан accountId, используем аккаунт из системы
      const account = accounts.find(acc => acc.id === accountId);
      if (!account) {
        return res.status(400).json({
          success: false,
          error: 'Account not found'
        });
      }

      console.log('Найден аккаунт:', JSON.stringify(account, null, 2));

      // Получаем настройки прокси из аккаунта
      if (account.proxy) {
        proxyConfig = {
          socksType: account.proxy.type === 'socks5' ? 5 : (account.proxy.type === 'socks4' ? 4 : undefined),
          ip: account.proxy.host,
          port: account.proxy.port,
          username: account.proxy.username || undefined,
          password: account.proxy.password || undefined
        };
        console.log('Используем прокси из аккаунта:', proxyConfig);
      }

      if (account.type === 'json' && account.sessionData) {
        // Используем данные из JSON файла
        finalSessionString = account.sessionData.session || '';
        finalApiId = account.sessionData.apiId;
        finalApiHash = account.sessionData.apiHash;
        console.log('Используем данные из JSON аккаунта');
      } else if (account.type === 'tdata' && account.sessionData) {
        // Используем конвертированную StringSession из TData
        finalSessionString = account.sessionData;
        // Используем дефолтные значения для TData аккаунтов
        finalApiId = '94575';
        finalApiHash = 'a3406de8d171bb422bb6ddf3bbd800e2';
        console.log('Используем конвертированную TData сессию с дефолтными API параметрами');
      } else if (account.type === 'string_session') {
        // Используем API параметры из нового аккаунта
        finalApiId = account.apiId;
        finalApiHash = account.apiHash;
        finalSessionString = account.sessionData;
        console.log('Используем новую StringSession');
      } else if (account.type === 'pyrogram' && account.sessionData) {
        // Используем данные из Pyrogram аккаунта
        finalApiId = account.sessionData.apiId;
        finalApiHash = account.sessionData.apiHash;
        finalSessionString = account.sessionData.sessionString || '';
        console.log('Используем данные из Pyrogram аккаунта');
      } else if (account.type === 'authkey') {
        // Используем данные из authkey аккаунта
        finalSessionString = account.sessionData;
        // Используем дефолтные значения для authkey аккаунтов
        finalApiId = '94575';
        finalApiHash = 'a3406de8d171bb422bb6ddf3bbd800e2';
        console.log('Используем данные из authkey аккаунта');
      } else if (account.type === 'tdata') {
        // TData аккаунт без sessionData - нужна конвертация
        return res.status(400).json({
          success: false,
          error: 'TData account session not converted. Please re-add the account.'
        });
      }
    } else if (apiId && apiHash && phoneNumber) {
      // Используем старый способ с переданными параметрами
      finalApiId = apiId;
      finalApiHash = apiHash;
      console.log('Используем параметры с номером телефона');
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either (apiId, apiHash, sessionString) or accountId or (apiId, apiHash, phoneNumber) must be provided'
      });
    }

    console.log('Финальные параметры для подключения:');
    console.log('finalApiId:', finalApiId);
    console.log('finalApiHash:', finalApiHash);
    console.log('finalSessionString length:', finalSessionString ? finalSessionString.length : 0);

    // Проверяем, что все необходимые параметры заданы
    if (!finalApiId || !finalApiHash) {
      return res.status(400).json({
        success: false,
        error: 'Your API ID or Hash cannot be empty or undefined'
      });
    }

    const session = new StringSession(finalSessionString);
    
    // Настройки клиента с поддержкой прокси
    const clientOptions = {
      connectionRetries: 3,
      timeout: 10000, // 10 секунд таймаут
      retryDelay: 1000, // 1 секунда между попытками
      maxConcurrentDownloads: 1,
      requestRetries: 2,
      downloadRetries: 2,
      baseLogger: console,
      useWSS: false, // Отключаем WebSocket Secure
      testServers: false,
      autoReconnect: false, // Отключаем автопереподключение
      langCode: 'en',
      systemLangCode: 'en',
      deviceModel: 'Desktop',
      systemVersion: 'Windows',
      appVersion: '1.0.0',
      langPack: '',
      proxy: proxyConfig // Используем настройки прокси из аккаунта
    };

    client = new TelegramClient(session, parseInt(finalApiId), finalApiHash, clientOptions);

    console.log('Подключаемся к Telegram...');
    await client.connect();

    if (!client.connected) {
      return res.status(400).json({
        success: false,
        error: 'Failed to connect to Telegram'
      });
    }

    console.log('Успешно подключились к Telegram');

    // Получаем информацию о текущем пользователе
    try {
      const me = await client.getMe();
      console.log('Информация о текущем пользователе:', {
        id: me.id,
        username: me.username,
        firstName: me.firstName,
        lastName: me.lastName
      });
    } catch (getMeError) {
      console.error('Ошибка получения информации о пользователе:', getMeError);
    }

    // Если сессия пустая, нужна авторизация
    if (!finalSessionString && !accountId) {
      return res.status(400).json({
        success: false,
        error: 'Authentication required. Please use an authenticated account.'
      });
    }

    // Проверяем валидность username
    if (!targetUsername.startsWith('@') && !targetUsername.match(/^[a-zA-Z0-9_]+$/) && targetUsername !== 'me') {
      return res.status(400).json({
        success: false,
        error: 'Invalid username format. Username should start with @ or be a valid username.'
      });
    }

    console.log(`Отправляем сообщение пользователю: ${targetUsername}`);
    console.log(`Текст сообщения: ${message}`);

    try {
      // Пропускаем checkAuthorization() и пробуем отправить сообщение напрямую
      console.log('⚡ Пробуем использовать низкоуровневый API для отправки сообщения...');

      // Для "me" используем специальный подход - отправляем в Saved Messages
      let target = targetUsername;
      if (targetUsername === 'me') {
        target = 'me'; // gramJS поддерживает "me" как специальный идентификатор
        console.log(`📝 Отправляем в Saved Messages (используем "me")`);
      }

      // Отправляем сообщение с детальным логированием используя низкоуровневый API
      console.log(`🚀 Начинаем отправку сообщения к цели: ${target}...`);
      console.log(`📄 Текст сообщения: "${message}"`);
      
      // Используем низкоуровневый API вместо client.sendMessage
      const sendMessagePromise = client.invoke(
        new Api.messages.SendMessage({
          peer: target,
          message: message,
          randomId: Math.floor(Math.random() * 1000000000)
        })
      );
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => {
          console.log('⏰ Таймаут отправки сообщения (5 секунд)');
          reject(new Error('Message sending timeout after 5 seconds'));
        }, 5000)
      );

      console.log('⏳ Ожидаем результат отправки...');
      const result = await Promise.race([sendMessagePromise, timeoutPromise]);
      console.log('✅ Сообщение успешно отправлено!');
      console.log('📊 Результат отправки:', JSON.stringify(result, null, 2));
    } catch (sendError) {
      console.error('❌ Ошибка при отправке сообщения:');
      console.error('   Тип ошибки:', sendError.constructor.name);
      console.error('   Сообщение:', sendError.message || sendError);
      console.error('   Стек:', sendError.stack);
      throw sendError;
    }

    await client.disconnect();

    res.json({
      success: true,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Error sending message:', error);
    
    if (client) {
      try {
        await client.disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting client:', disconnectError);
      }
    }

    // Специальная обработка ошибки SESSION_REVOKED
    if (error.message && error.message.includes('SESSION_REVOKED')) {
      console.error('🚫 Сессия Telegram была отозвана - требуется повторная авторизация');
      res.status(401).json({
        success: false,
        error: 'Session revoked',
        message: 'Сессия Telegram была отозвана. Аккаунт может быть заблокирован или требуется повторная авторизация.',
        code: 'SESSION_REVOKED',
        requiresReauth: true
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error.message
    });
  }
});

// Хранилище аккаунтов (в реальном приложении это должна быть база данных)
let accounts = [];

// Загружаем аккаунты при инициализации модуля
loadAccountsFromFile();

// Получить список аккаунтов
router.get('/accounts', async (req, res) => {
  console.log('🔍 [TELEGRAM ACCOUNTS] Запрос получен:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    origin: req.get('origin')
  });
  
  try {
    // Отладочная информация
    console.log('=== DEBUG: Accounts array ===');
    console.log('Total accounts:', accounts.length);
    accounts.forEach((account, index) => {
      console.log(`Account ${index}:`, {
        id: account.id,
        type: account.type,
        path: account.path,
        name: account.name,
        hasSessionData: !!account.sessionData,
        sessionDataKeys: account.sessionData ? Object.keys(account.sessionData) : 'none'
      });
    });
    console.log('=== END DEBUG ===');

    // Возвращаем аккаунты с полными данными для использования в приложении
    const accountsWithData = accounts.map(account => ({
      ...account,
      // Для JSON аккаунтов возвращаем sessionData, для TData - только основную информацию
      sessionData: account.type === 'json' ? account.sessionData : undefined
    }));
    
    const responseData = {
      success: true,
      accounts: accountsWithData
    };
    
    console.log('✅ [TELEGRAM ACCOUNTS] Отправляем ответ:', {
      success: responseData.success,
      accountsCount: responseData.accounts.length
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ [TELEGRAM ACCOUNTS] Ошибка:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get accounts',
      message: error.message
    });
  }
});

// Добавить новый аккаунт
router.post('/accounts/add', async (req, res) => {
  try {
    console.log('=== DEBUG: Received request body ===');
    console.log('Full body:', JSON.stringify(req.body, null, 2));
    console.log('=== END DEBUG ===');
    
    const { type, path: accountPath, name, content, apiId, apiHash, fileData, proxy } = req.body;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Type is required'
      });
    }

    if (!['pyrogram', 'json', 'tdata', 'string_session', 'authkey'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be one of: pyrogram, json, tdata, string_session, authkey'
      });
    }

    // Валидация и обработка в зависимости от типа
    let sessionData = null;
    let accountName = name;
    let finalPath = accountPath;

    if (type === 'pyrogram') {
      if (!accountPath) {
        return res.status(400).json({
          success: false,
          error: 'Path is required for Pyrogram session files'
        });
      }

      // Проверяем наличие JSON конфигурации
      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'JSON configuration is required for Pyrogram sessions'
        });
      }

      // Парсим JSON конфигурацию для получения API ID и API Hash
      let jsonConfig;
      try {
        jsonConfig = JSON.parse(content);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON configuration: ' + error.message
        });
      }

      // Извлекаем API ID и API Hash из JSON (поддерживаем разные форматы)
      const extractedApiId = jsonConfig.api_id || jsonConfig.apiId || jsonConfig.app_id;
      const extractedApiHash = jsonConfig.api_hash || jsonConfig.apiHash || jsonConfig.app_hash;
      const extractedAccountName = jsonConfig.account_name || jsonConfig.name;

      console.log('=== DEBUG: Field extraction ===');
      console.log('jsonConfig.api_id:', jsonConfig.api_id);
      console.log('jsonConfig.apiId:', jsonConfig.apiId);
      console.log('jsonConfig.app_id:', jsonConfig.app_id);
      console.log('jsonConfig.api_hash:', jsonConfig.api_hash);
      console.log('jsonConfig.apiHash:', jsonConfig.apiHash);
      console.log('jsonConfig.app_hash:', jsonConfig.app_hash);
      console.log('extractedApiId:', extractedApiId);
      console.log('extractedApiHash:', extractedApiHash);
      console.log('=== END DEBUG ===');

      if ((!extractedApiId && extractedApiId !== 0) || !extractedApiHash) {
        console.log('Validation failed - missing fields:', { 
          hasApiId: !!(extractedApiId || extractedApiId === 0), 
          hasApiHash: !!extractedApiHash,
          configKeys: Object.keys(jsonConfig),
          extractedApiId,
          extractedApiHash,
          apiIdType: typeof extractedApiId,
          apiHashType: typeof extractedApiHash
        });
        return res.status(400).json({
          success: false,
          error: `JSON configuration must contain api_id/apiId/app_id and api_hash/apiHash/app_hash fields. Found keys: ${Object.keys(jsonConfig).join(', ')}`
        });
      }

      let sessionFilePath = accountPath;

      // Если передан fileData, сохраняем файл во временную директорию
      if (fileData && Array.isArray(fileData)) {
        const tempDir = path.join(__dirname, '..', 'temp_sessions');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const fileName = path.basename(accountPath);
        sessionFilePath = path.join(tempDir, fileName);
        
        // Записываем данные файла
        const buffer = Buffer.from(fileData);
        fs.writeFileSync(sessionFilePath, buffer);
        console.log(`Saved uploaded Pyrogram session to: ${sessionFilePath}`);
      }

      // Проверяем существование файла сессии
      if (!fs.existsSync(sessionFilePath)) {
        return res.status(400).json({
          success: false,
          error: 'Pyrogram session file not found'
        });
      }

      // Проверяем, что это действительно Pyrogram сессия
      if (!PyrogramConverter.isPyrogramSession(sessionFilePath)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Pyrogram session file format'
        });
      }

      // Конвертируем Pyrogram сессию в StringSession
      try {
        const converter = new PyrogramConverter();
        const stringSession = await converter.convertPyrogramSession(sessionFilePath, extractedApiId, extractedApiHash);
        sessionData = stringSession;
        console.log('Pyrogram session successfully converted to StringSession');
      } catch (error) {
        console.error('Error converting Pyrogram session:', error);
        return res.status(400).json({
          success: false,
          error: 'Failed to convert Pyrogram session: ' + error.message
        });
      }

      accountName = extractedAccountName || accountName || `Pyrogram Account ${accounts.length + 1}`;
      finalPath = sessionFilePath;
    }

    // Проверяем, что аккаунт с таким путем не существует
    const existingAccount = accounts.find(acc => acc.path === finalPath);
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        error: 'Account with this path already exists'
      });
    }

    const newAccount = {
      id: Date.now().toString(),
      type: type,
      path: finalPath,
      name: accountName,
      status: 'active',
      sessionData: sessionData, // Сохраняем данные сессии для JSON
      proxy: proxy || null, // Добавляем прокси настройки
      addedAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    
    // Сохраняем аккаунты в файл
    saveAccountsToFile();

    res.json({
      success: true,
      message: 'Account added successfully',
      account: {
        ...newAccount,
        sessionData: undefined // Не возвращаем чувствительные данные в ответе
      }
    });
  } catch (error) {
    console.error('Error adding account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add account',
      message: error.message
    });
  }
});

// Удалить аккаунт
router.delete('/accounts/remove/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const accountIndex = accounts.findIndex(acc => acc.id === id);
    if (accountIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    const removedAccount = accounts.splice(accountIndex, 1)[0];
    
    // Сохраняем изменения в файл
    saveAccountsToFile();

    res.json({
      success: true,
      message: 'Account removed successfully',
      account: removedAccount
    });
  } catch (error) {
    console.error('Error removing account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove account',
      message: error.message
    });
  }
});

// Создать StringSession из auth_key и dc_id
router.post('/create-session-from-authkey', async (req, res) => {
  try {
    const { authKey, dcId, accountName, proxy } = req.body;

    // Валидация входных данных
    if (!authKey || !dcId) {
      return res.status(400).json({
        success: false,
        error: 'Auth key and DC ID are required'
      });
    }

    // Проверяем формат auth_key (должен быть hex строкой)
    if (typeof authKey !== 'string' || !/^[0-9a-fA-F]+$/.test(authKey)) {
      return res.status(400).json({
        success: false,
        error: 'Auth key must be a valid hexadecimal string'
      });
    }

    // Проверяем DC ID (должен быть от 1 до 5)
    const dcIdNum = parseInt(dcId);
    if (isNaN(dcIdNum) || dcIdNum < 1 || dcIdNum > 5) {
      return res.status(400).json({
        success: false,
        error: 'DC ID must be a number between 1 and 5'
      });
    }

    // Проверяем длину auth_key (должен быть 256 байт = 512 hex символов)
    if (authKey.length !== 512) {
      return res.status(400).json({
        success: false,
        error: 'Auth key must be exactly 512 hexadecimal characters (256 bytes)'
      });
    }

    // Валидация прокси если он указан
    if (proxy) {
      if (!proxy.host || !proxy.port) {
        return res.status(400).json({
          success: false,
          error: 'Proxy host and port are required when using proxy'
        });
      }

      const port = parseInt(proxy.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        return res.status(400).json({
          success: false,
          error: 'Proxy port must be a number between 1 and 65535'
        });
      }

      const validProxyTypes = ['http', 'https', 'socks4', 'socks5'];
      if (proxy.type && !validProxyTypes.includes(proxy.type)) {
        return res.status(400).json({
          success: false,
          error: 'Proxy type must be one of: ' + validProxyTypes.join(', ')
        });
      }
    }

    // Импортируем Python модуль для создания StringSession
    const { spawn } = require('child_process');
    const path = require('path');

    // Создаем временный Python скрипт для генерации StringSession
    const backendPath = path.join(__dirname, '..').replace(/\\/g, '/');
    const pythonScript = `
import sys
sys.path.append(r'${backendPath}')
from telegram_session_encoder import create_string_session

try:
    auth_key_hex = "${authKey}"
    dc_id = ${dcIdNum}
    string_session = create_string_session(auth_key_hex, dc_id)
    print(string_session)
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)
`;

    // Выполняем Python скрипт
    const python = spawn('python', ['-c', pythonScript]);
    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', errorOutput);
        return res.status(500).json({
          success: false,
          error: 'Failed to create StringSession: ' + (errorOutput || 'Unknown error')
        });
      }

      const stringSession = output.trim();
      
      if (stringSession.startsWith('ERROR:')) {
        return res.status(400).json({
          success: false,
          error: stringSession.replace('ERROR: ', '')
        });
      }

      // Проверяем, что аккаунт с таким auth_key не существует
      const existingAccount = accounts.find(acc => 
        acc.type === 'authkey' && acc.authKey === authKey
      );
      
      if (existingAccount) {
        return res.status(400).json({
          success: false,
          error: 'Account with this auth key already exists'
        });
      }

      // Создаем новый аккаунт
      const newAccount = {
        id: Date.now().toString(),
        type: 'authkey',
        path: `authkey_${dcIdNum}_${Date.now()}`,
        name: accountName || `Auth Key Account DC${dcIdNum}`,
        status: 'active',
        sessionData: stringSession,
        authKey: authKey, // Сохраняем для проверки дубликатов
        dcId: dcIdNum,
        addedAt: new Date().toISOString()
      };

      // Добавляем данные прокси если они указаны
      if (proxy) {
        newAccount.proxy = {
          type: proxy.type || 'http',
          host: proxy.host,
          port: parseInt(proxy.port),
          username: proxy.username || undefined,
          password: proxy.password || undefined
        };
      }

      // Сохраняем прокси данные если они указаны
      if (proxy) {
        newAccount.proxy = {
          type: proxy.type,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username || undefined,
          password: proxy.password || undefined
        };
      }

      accounts.push(newAccount);
      
      // Сохраняем аккаунты в файл
      saveAccountsToFile();

      res.json({
        success: true,
        message: 'Account created successfully from auth key',
        account: {
          ...newAccount,
          sessionData: undefined, // Не возвращаем чувствительные данные
          authKey: undefined // Не возвращаем auth key в ответе
        }
      });
    });

  } catch (error) {
    console.error('Error creating session from auth key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session from auth key',
      message: error.message
    });
  }
});

// Очистка Telegram сессии
router.post('/clear-session', async (req, res) => {
  try {
    console.log('Получен запрос на очистку сессии');
    
    // Принудительно закрываем все существующие соединения
    if (global.telegramClient) {
      try {
        console.log('Закрываем существующий глобальный клиент...');
        await global.telegramClient.disconnect();
        await global.telegramClient.destroy();
        console.log('Глобальный клиент закрыт и уничтожен');
      } catch (error) {
        console.log('Ошибка при закрытии глобального клиента:', error.message);
      }
      global.telegramClient = null;
    }

    // Закрываем локальный клиент
    if (telegramClient) {
      try {
        console.log('Закрываем локальный клиент...');
        await telegramClient.disconnect();
        await telegramClient.destroy();
        console.log('Локальный клиент закрыт и уничтожен');
      } catch (error) {
        console.log('Ошибка при закрытии локального клиента:', error.message);
      }
      telegramClient = null;
    }

    // Очищаем все сохраненные сессии из accounts.json
    try {
      // Очищаем все session strings в массиве accounts
      accounts = accounts.map(account => ({
        ...account,
        sessionString: '',
        sessionData: null,
        status: 'inactive'
      }));
      saveAccountsToFile();
      console.log('Сессии очищены из accounts.json');
    } catch (error) {
      console.log('Ошибка при очистке accounts.json:', error.message);
    }

    // Дополнительная пауза для стабилизации
    await new Promise(resolve => setTimeout(resolve, 2000));

    res.json({ 
      success: true, 
      message: 'Сессия успешно очищена. Можно создавать новую сессию.' 
    });
  } catch (error) {
    console.error('Ошибка при очистке сессии:', error);
    res.status(500).json({ 
      error: 'Ошибка при очистке сессии: ' + error.message 
    });
  }
});

module.exports = router;