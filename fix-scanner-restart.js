const fs = require('fs');
const path = require('path');

async function fixScannerRestart() {
  console.log('🔧 Исправляем проблему с сканером...\n');
  
  try {
    // Загружаем настройки из persistent-settings.json
    const settingsPath = path.join(__dirname, 'persistent-settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    console.log('📋 Загруженные настройки:');
    console.log(`  - OpenRouter API ключ: ${!!settings.openrouterApiKey}`);
    console.log(`  - Критерии лидов: ${!!settings.leadCriteria}`);
    console.log(`  - Spreadsheet ID: ${!!settings.spreadsheetId}`);
    console.log(`  - Sheets Config: ${!!settings.sheetsConfig}\n`);
    
    // Сначала останавливаем сканер
    console.log('🛑 Останавливаем сканер...');
    const stopResponse = await fetch('http://localhost:3001/api/scanner/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (stopResponse.ok) {
      console.log('✅ Сканер остановлен');
    } else {
      console.log('⚠️ Ошибка при остановке сканера:', await stopResponse.text());
    }
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Запускаем сканер с полными настройками
    console.log('🚀 Запускаем сканер с полными настройками...');
    
    const startData = {
      scanInterval: '1h',
      selectedChats: ['@leadscanner_test'],
      telegramConfig: settings.telegramConfig || {},
      sheetsConfig: settings.sheetsConfig,
      spreadsheetId: settings.spreadsheetId,
      leadAnalysisSettings: {
        openrouterApiKey: settings.openrouterApiKey,
        leadCriteria: settings.leadCriteria
      }
    };
    
    console.log('📤 Отправляем данные для запуска:', {
      scanInterval: startData.scanInterval,
      selectedChats: startData.selectedChats,
      hasTelegramConfig: !!startData.telegramConfig,
      hasSheetsConfig: !!startData.sheetsConfig,
      hasSpreadsheetId: !!startData.spreadsheetId,
      hasOpenrouterApiKey: !!startData.leadAnalysisSettings.openrouterApiKey,
      hasLeadCriteria: !!startData.leadAnalysisSettings.leadCriteria
    });
    
    const startResponse = await fetch('http://localhost:3001/api/scanner/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startData)
    });
    
    if (startResponse.ok) {
      const result = await startResponse.json();
      console.log('✅ Сканер успешно запущен:', result);
    } else {
      const errorText = await startResponse.text();
      console.error('❌ Ошибка при запуске сканера:', errorText);
      return;
    }
    
    // Проверяем статус после запуска
    console.log('\n🔍 Проверяем статус сканера после запуска...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await fetch('http://localhost:3001/api/scanner/status');
    const status = await statusResponse.json();
    
    console.log('📊 Новый статус сканера:');
    console.log(`  - Работает: ${status.isRunning}`);
    console.log(`  - Последний скан: ${status.lastScan}`);
    console.log(`  - Следующий скан: ${status.nextScan}`);
    console.log(`  - Всего сканов: ${status.totalScans}`);
    console.log(`  - Всего сообщений: ${status.totalMessages}`);
    console.log(`  - OpenRouter API ключ: ${!!status.openrouterApiKey}`);
    console.log(`  - Критерии лидов: ${!!status.leadCriteria}`);
    
    if (status.isRunning) {
      console.log('\n✅ Сканер успешно запущен и настроен!');
      console.log('🔄 setTimeout для автоанализа будет установлен после следующего скана');
      console.log('⏰ Автоанализ будет срабатывать через 2 минуты после каждого скана');
    } else {
      console.log('\n❌ Сканер не запустился. Проверьте настройки и логи сервера.');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении сканера:', error);
  }
}

fixScannerRestart();