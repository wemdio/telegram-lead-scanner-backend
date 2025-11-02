const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function getFrontendSettings() {
  console.log('🔍 Получаем настройки из localStorage браузера...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Переходим на фронтенд приложение
    console.log('📱 Подключаемся к фронтенд приложению...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    // Получаем настройки из localStorage
    const settings = await page.evaluate(() => {
      return {
        selectedChatIds: JSON.parse(localStorage.getItem('selectedChatIds') || '[]'),
        telegramApiId: localStorage.getItem('telegramApiId'),
        telegramApiHash: localStorage.getItem('telegramApiHash'),
        telegramSessionString: localStorage.getItem('telegramSessionString'),
        googleServiceAccountEmail: localStorage.getItem('googleServiceAccountEmail'),
        googlePrivateKey: localStorage.getItem('googlePrivateKey'),
        googleSpreadsheetId: localStorage.getItem('googleSpreadsheetId'),
        scanInterval: parseInt(localStorage.getItem('scanInterval') || '1'),
        openrouterApiKey: localStorage.getItem('openrouterApiKey') || '',
        leadCriteria: localStorage.getItem('leadCriteria') || ''
      };
    });
    
    console.log('📋 Настройки из localStorage:');
    console.log(`  - selectedChatIds: ${settings.selectedChatIds.length} чатов`);
    console.log(`  - telegramApiId: ${!!settings.telegramApiId}`);
    console.log(`  - telegramApiHash: ${!!settings.telegramApiHash}`);
    console.log(`  - telegramSessionString: ${!!settings.telegramSessionString}`);
    console.log(`  - googleServiceAccountEmail: ${!!settings.googleServiceAccountEmail}`);
    console.log(`  - googlePrivateKey: ${!!settings.googlePrivateKey}`);
    console.log(`  - googleSpreadsheetId: ${!!settings.googleSpreadsheetId}`);
    console.log(`  - scanInterval: ${settings.scanInterval}`);
    console.log(`  - openrouterApiKey: ${!!settings.openrouterApiKey}`);
    console.log(`  - leadCriteria: ${!!settings.leadCriteria}`);
    
    // Обновляем persistent-settings.json
    const settingsPath = path.join(__dirname, 'persistent-settings.json');
    const persistentSettings = {
      openrouterApiKey: settings.openrouterApiKey,
      leadCriteria: settings.leadCriteria,
      sheetsConfig: {
        serviceAccountEmail: settings.googleServiceAccountEmail,
        privateKey: settings.googlePrivateKey
      },
      spreadsheetId: settings.googleSpreadsheetId,
      selectedChats: settings.selectedChatIds,
      telegramConfig: {
        apiId: settings.telegramApiId,
        apiHash: settings.telegramApiHash,
        sessionString: settings.telegramSessionString
      },
      scanInterval: settings.scanInterval
    };
    
    fs.writeFileSync(settingsPath, JSON.stringify(persistentSettings, null, 2));
    console.log('\n✅ Настройки сохранены в persistent-settings.json');
    
    return settings;
    
  } catch (error) {
    console.error('❌ Ошибка получения настроек:', error.message);
    
    // Fallback - используем тестовые данные
    console.log('\n🔄 Используем тестовые данные...');
    const testSettings = {
      openrouterApiKey: 'sk-or-v1-test-key',
      leadCriteria: 'Ищем потенциальных клиентов',
      sheetsConfig: {
        serviceAccountEmail: 'test@example.com',
        privateKey: 'test-key'
      },
      spreadsheetId: 'test-spreadsheet-id',
      selectedChats: ['7881639949', '-1001442937604', '-1001273124836'],
      telegramConfig: {
        apiId: '12345',
        apiHash: 'test-hash',
        sessionString: 'test-session'
      },
      scanInterval: 1
    };
    
    const settingsPath = path.join(__dirname, 'persistent-settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));
    console.log('✅ Тестовые настройки сохранены в persistent-settings.json');
    
    return testSettings;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

getFrontendSettings();