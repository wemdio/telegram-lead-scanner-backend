const axios = require('axios');

async function debugParsingLimits() {
  console.log('🔍 Диагностика ограничений парсинга сообщений...\n');

  try {
    // 1. Проверяем статус сканера (нет отдельного эндпоинта для настроек)
    console.log('1️⃣ Проверка статуса сканера:');
    const statusResponse = await axios.get('http://localhost:3001/api/scanner/status');
    const status = statusResponse.data;
    console.log(`   Статус: ${status.isScanning ? 'Сканирует' : 'Не активен'}`);
    console.log(`   Последнее сканирование: ${status.lastScanTime || 'Никогда'}`);
    console.log(`   Прогресс: ${status.progress || 0}%`);
    
    // Проверяем настройки Telegram
    const telegramSettingsResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    const telegramSettings = telegramSettingsResponse.data;
    console.log(`   Telegram настроен: ${telegramSettings.botToken ? 'Да' : 'Нет'}`);
    
    // Проверяем доступные чаты
    try {
      const chatsResponse = await axios.get('http://localhost:3001/api/telegram/chats');
      const chats = chatsResponse.data.chats || [];
      console.log(`   Доступных чатов: ${chats.length}`);
    } catch (chatsError) {
      console.log(`   ⚠️ Не удалось получить список чатов: ${chatsError.message}`);
    }

    // 2. Проверяем лимиты в коде
    console.log('\n2️⃣ Анализ лимитов в коде:');
    console.log('   - Лимит getMessages: 1000 сообщений за запрос');
    console.log('   - Лимит AI анализа: 1000 сообщений максимум');
    console.log('   - Размер чанка для AI: 100 сообщений');
    console.log('   - Задержка между чанками: 500ms');

    // 3. Проверяем статистику последних сканирований
    console.log('\n3️⃣ Статистика последних сканирований:');
    const scannerStatusResponse = await axios.get('http://localhost:3001/api/scanner/status');
    const scannerStatus = scannerStatusResponse.data;
    console.log(`   Статус: ${scannerStatus.isScanning ? 'Сканирует' : 'Не активен'}`);
    console.log(`   Последнее сканирование: ${scannerStatus.lastScanTime || 'Никогда'}`);
    console.log(`   Прогресс: ${scannerStatus.progress || 0}%`);
    
    if (scannerStatus.scanResults) {
      console.log(`   Результаты последнего сканирования:`);
      console.log(`     - Всего сообщений: ${scannerStatus.scanResults.totalMessages || 0}`);
      console.log(`     - Найдено лидов: ${scannerStatus.scanResults.totalLeads || 0}`);
      console.log(`     - Время выполнения: ${scannerStatus.scanResults.processingTime || 0}с`);
    }

    // 4. Проверяем данные в базе
    console.log('\n4️⃣ Проверка данных в базе:');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data;
    
    if (Array.isArray(leads)) {
      console.log(`   Всего лидов в базе: ${leads.length}`);
      
      // Группируем по времени создания
      const leadsByHour = {};
      leads.forEach(lead => {
        if (lead.timestamp) {
          const hour = new Date(lead.timestamp).toISOString().slice(0, 13);
          leadsByHour[hour] = (leadsByHour[hour] || 0) + 1;
        }
      });
      
      console.log(`   Распределение лидов по часам (последние 10):`);
      const sortedHours = Object.keys(leadsByHour).sort().slice(-10);
      sortedHours.forEach(hour => {
        console.log(`     ${hour}: ${leadsByHour[hour]} лидов`);
      });
    } else {
      console.log(`   Данные лидов: ${typeof leads} (не массив)`);
    }

    // 5. Тестируем ручное сканирование одного чата
    console.log('\n5️⃣ Тест ручного сканирования:');
    if (settings.selectedChats && settings.selectedChats.length > 0) {
      const testChat = settings.selectedChats[0];
      console.log(`   Тестируем чат: ${testChat.title} (ID: ${testChat.id})`);
      
      try {
        const scanResponse = await axios.post('http://localhost:3001/api/scanner/scan', {
          chatIds: [testChat.id],
          isManualScan: true
        });
        
        console.log(`   Результат теста:`);
        console.log(`     - Статус: ${scanResponse.data.success ? 'Успешно' : 'Ошибка'}`);
        console.log(`     - Сообщений получено: ${scanResponse.data.totalMessages || 0}`);
        console.log(`     - Лидов найдено: ${scanResponse.data.totalLeads || 0}`);
        
        if (scanResponse.data.chatResults) {
          scanResponse.data.chatResults.forEach(result => {
            console.log(`     - Чат ${result.chatTitle}: ${result.messageCount} сообщений, ${result.leadCount} лидов`);
          });
        }
      } catch (scanError) {
        console.log(`   ❌ Ошибка тестового сканирования: ${scanError.message}`);
      }
    } else {
      console.log(`   ⚠️ Нет выбранных чатов для тестирования`);
    }

    // 6. Анализ возможных причин ограничения
    console.log('\n6️⃣ Анализ возможных причин ограничения ~1500 сообщений/час:');
    console.log('   Возможные причины:');
    console.log('   a) Лимит Telegram API: 1000 сообщений за запрос getMessages()');
    console.log('   b) Фильтрация по времени: offset_date ограничивает выборку');
    console.log('   c) Лимит AI анализа: максимум 1000 сообщений за раз');
    console.log('   d) Rate limiting: задержки между запросами');
    console.log('   e) Активность чатов: в некоторых чатах может быть мало сообщений');
    
    // Расчет теоретического максимума
    const chatsCount = settings.selectedChats?.length || 0;
    const maxMessagesPerChat = 1000;
    const theoreticalMax = chatsCount * maxMessagesPerChat;
    console.log(`\n   Теоретический максимум:`);
    console.log(`   - Чатов: ${chatsCount}`);
    console.log(`   - Максимум сообщений на чат: ${maxMessagesPerChat}`);
    console.log(`   - Теоретический максимум за сканирование: ${theoreticalMax}`);
    console.log(`   - Наблюдаемое значение: ~1500 сообщений/час`);
    
    if (theoreticalMax > 1500) {
      console.log(`   ⚠️ Есть ограничение! Теоретически должно быть больше.`);
    }

  } catch (error) {
    console.error('❌ Ошибка диагностики:', error.message);
    if (error.response) {
      console.error('   Детали ошибки:', error.response.data);
    }
  }
}

debugParsingLimits();