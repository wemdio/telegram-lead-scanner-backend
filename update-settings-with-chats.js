const fs = require('fs');
const path = require('path');

async function updateSettingsWithChats() {
  try {
    console.log('🔄 Обновляем настройки с тестовыми чатами...\n');

    const settingsPath = path.join(__dirname, 'persistent-settings.json');
    
    // Читаем текущие настройки
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }

    // Добавляем тестовые чаты из реальных данных
    const testChats = [
      "7881639949",
      "-1001442937604", 
      "-1001273124836",
      "-1001131923496",
      "-1001611947303"
    ];

    // Обновляем настройки
    const updatedSettings = {
      ...settings,
      selectedChats: testChats,
      telegramConfig: {
        apiId: settings.telegramConfig?.apiId || "12345",
        apiHash: settings.telegramConfig?.apiHash || "test-hash",
        sessionString: settings.telegramConfig?.sessionString || "test-session"
      },
      scanInterval: settings.scanInterval || 1
    };

    // Сохраняем обновленные настройки
    fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));
    
    console.log('✅ Настройки обновлены:');
    console.log(`  - selectedChats: ${updatedSettings.selectedChats.length} чатов`);
    console.log(`  - telegramConfig: ${!!updatedSettings.telegramConfig.apiId}`);
    console.log(`  - scanInterval: ${updatedSettings.scanInterval}`);
    console.log(`  - openrouterApiKey: ${!!updatedSettings.openrouterApiKey}`);
    console.log(`  - leadCriteria: ${!!updatedSettings.leadCriteria}`);
    
    console.log('\n📋 Выбранные чаты:');
    updatedSettings.selectedChats.forEach((chat, index) => {
      console.log(`  ${index + 1}. ${chat}`);
    });

    // Теперь тестируем ручной скан
    console.log('\n🔍 Тестируем ручной скан...');
    
    const scanPayload = {
      selectedChats: updatedSettings.selectedChats,
      telegramConfig: updatedSettings.telegramConfig,
      sheetsConfig: updatedSettings.sheetsConfig,
      spreadsheetId: updatedSettings.spreadsheetId,
      scanInterval: updatedSettings.scanInterval,
      leadAnalysisSettings: {
        openrouterApiKey: updatedSettings.openrouterApiKey,
        leadCriteria: updatedSettings.leadCriteria
      }
    };

    console.log('📤 Отправляем запрос на ручной скан...');
    const scanResponse = await fetch('http://localhost:3001/api/scanner/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scanPayload)
    });

    if (!scanResponse.ok) {
      const errorText = await scanResponse.text();
      console.log(`❌ Ошибка выполнения скана: ${errorText}`);
      return;
    }

    const scanResult = await scanResponse.json();
    console.log('✅ Ручной скан выполнен успешно');
    console.log(`📊 Результат скана:`, scanResult);

    // Проверяем статус сканера после скана
    console.log('\n📊 Проверяем статус сканера после скана...');
    const statusResponse = await fetch('http://localhost:3001/api/scanner/status');
    const status = await statusResponse.json();
    
    console.log(`  - Работает: ${status.isRunning}`);
    console.log(`  - Последний скан: ${status.lastScan}`);
    console.log(`  - Следующий скан: ${status.nextScan}`);
    console.log(`  - Всего сообщений: ${status.totalMessages}`);

    console.log('\n⏰ Автоанализ должен сработать через 2 минуты после скана');
    console.log('🔍 Следите за логами backend сервера для проверки');

  } catch (error) {
    console.error('❌ Ошибка обновления настроек:', error.message);
  }
}

updateSettingsWithChats();