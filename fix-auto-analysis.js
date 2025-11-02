// Исправление проблемы с автоанализом
// Проблема: globalSettings не загружает настройки AI из persistent-settings.json

const fs = require('fs');
const path = require('path');

async function fixAutoAnalysis() {
  console.log('🔧 Исправление проблемы с автоанализом...\n');

  try {
    // 1. Читаем настройки из файла
    const settingsPath = path.join(__dirname, 'persistent-settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    console.log('📋 Настройки из файла:');
    console.log(`  - openrouterApiKey: ${settings.openrouterApiKey ? 'есть' : 'отсутствует'}`);
    console.log(`  - leadCriteria: ${settings.leadCriteria || 'отсутствует'}`);
    console.log(`  - selectedChats: ${settings.selectedChats?.length || 0} чатов`);
    console.log(`  - scanInterval: ${settings.scanInterval || 'не указан'}\n`);

    // 2. Обновляем настройки AI через API
    console.log('🔄 Обновляем настройки AI в globalSettings...');
    
    const updateResponse = await fetch('http://localhost:3001/api/scanner/update-ai-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        openrouterApiKey: settings.openrouterApiKey,
        leadCriteria: settings.leadCriteria,
        spreadsheetId: settings.spreadsheetId,
        sheetsConfig: settings.sheetsConfig
      })
    });

    if (updateResponse.ok) {
      console.log('✅ Настройки AI успешно обновлены в globalSettings');
    } else {
      const errorText = await updateResponse.text();
      console.log('❌ Ошибка обновления настроек AI:', errorText);
      return;
    }

    // 3. Перезапускаем сканер с обновленными настройками
    console.log('\n🔄 Перезапускаем сканер...');
    
    // Останавливаем сканер
    const stopResponse = await fetch('http://localhost:3001/api/scanner/stop', {
      method: 'POST'
    });
    
    if (stopResponse.ok) {
      console.log('✅ Сканер остановлен');
    }

    // Ждем 2 секунды
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Запускаем сканер с полными настройками
    const startResponse = await fetch('http://localhost:3001/api/scanner/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scanInterval: settings.scanInterval,
        selectedChats: settings.selectedChats,
        telegramConfig: settings.telegramConfig,
        sheetsConfig: settings.sheetsConfig,
        spreadsheetId: settings.spreadsheetId,
        openrouterApiKey: settings.openrouterApiKey,
        leadCriteria: settings.leadCriteria
      })
    });

    if (startResponse.ok) {
      const result = await startResponse.json();
      console.log('✅ Сканер перезапущен с обновленными настройками');
      console.log(`⏰ Следующее сканирование: ${result.nextScan}`);
    } else {
      const errorText = await startResponse.text();
      console.log('❌ Ошибка запуска сканера:', errorText);
      return;
    }

    // 4. Проверяем статус
    console.log('\n📊 Проверяем статус сканера...');
    
    const statusResponse = await fetch('http://localhost:3001/api/scanner/status');
    const status = await statusResponse.json();
    
    console.log('📈 Статус сканера:');
    console.log(`  - Работает: ${status.isRunning}`);
    console.log(`  - OpenRouter API ключ: ${status.openrouterApiKey ? 'загружен' : 'отсутствует'}`);
    console.log(`  - Критерии лидов: ${status.leadCriteria || 'отсутствуют'}`);
    console.log(`  - Следующее сканирование: ${status.nextScan}`);

    if (status.openrouterApiKey && status.leadCriteria) {
      console.log('\n✅ Проблема исправлена! Автоанализ теперь должен работать');
      console.log('💡 При следующем сканировании будет вызван OpenRouter API');
    } else {
      console.log('\n❌ Проблема не решена - настройки AI не загружены в globalSettings');
    }

  } catch (error) {
    console.error('❌ Ошибка при исправлении автоанализа:', error.message);
  }
}

fixAutoAnalysis();