const fetch = require('node-fetch');

async function restartScannerWithLogging() {
  console.log('🔄 Перезапуск сканера с обновленным логированием...');
  
  try {
    // Останавливаем сканер
    console.log('⏹️ Останавливаем сканер...');
    const stopResponse = await fetch('http://localhost:3001/api/scanner/stop', {
      method: 'POST'
    });
    
    if (stopResponse.ok) {
      console.log('✅ Сканер остановлен');
    } else {
      console.log('⚠️ Сканер уже был остановлен или произошла ошибка');
    }
    
    // Ждем 2 секунды
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Запускаем сканер с теми же параметрами
    console.log('🚀 Запускаем сканер с новым логированием...');
    const startResponse = await fetch('http://localhost:3001/api/scanner/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scanInterval: 1,
        selectedChats: [
          { id: '-1001234567890', title: 'Test Chat 1', type: 'supergroup' },
          { id: '-1001234567891', title: 'Test Chat 2', type: 'supergroup' }
        ],
        telegramConfig: {
          apiId: '12345678',
          apiHash: 'test_api_hash',
          phoneNumber: '+1234567890',
          sessionString: 'test_session'
        },
        sheetsConfig: {
          serviceAccountEmail: 'test@example.com',
          privateKey: 'test_private_key'
        },
        spreadsheetId: '1test_spreadsheet_id',
        leadAnalysisSettings: {
          openrouterApiKey: 'test_openrouter_key',
          leadCriteria: 'Ищем потенциальных клиентов для IT услуг'
        }
      })
    });
    
    if (startResponse.ok) {
      const result = await startResponse.json();
      console.log('✅ Сканер успешно запущен с новым логированием');
      console.log('📊 Статус:', result);
      
      // Проверяем статус через 3 секунды
      setTimeout(async () => {
        try {
          const statusResponse = await fetch('http://localhost:3001/api/scanner/status');
          const status = await statusResponse.json();
          console.log('');
          console.log('📋 Текущий статус сканера:');
          console.log('  - Работает:', status.isRunning);
          console.log('  - Последний скан:', status.lastScan);
          console.log('  - Следующий скан:', status.nextScan);
          console.log('  - Всего сообщений:', status.totalMessages);
          console.log('');
          console.log('🎯 Теперь setTimeout должен сработать через 2 минуты после следующего скана');
          console.log('📝 Следите за логами backend сервера для новых сообщений о setTimeout');
        } catch (error) {
          console.error('❌ Ошибка при проверке статуса:', error);
        }
      }, 3000);
      
    } else {
      const errorText = await startResponse.text();
      console.error('❌ Ошибка запуска сканера:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при перезапуске сканера:', error);
  }
}

restartScannerWithLogging();