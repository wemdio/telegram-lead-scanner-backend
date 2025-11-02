const axios = require('axios');

async function quickParsingCheck() {
  console.log('🔍 Быстрая проверка ограничений парсинга...\n');

  try {
    // 1. Проверяем статус сканера
    console.log('1️⃣ Статус сканера:');
    const scannerStatus = await axios.get('http://localhost:3001/api/scanner/status');
    console.log(`   Активен: ${scannerStatus.data.isScanning ? 'Да' : 'Нет'}`);
    console.log(`   Последнее сканирование: ${scannerStatus.data.lastScanTime || 'Никогда'}`);

    // 2. Проверяем историю сканирований
    console.log('\n2️⃣ История сканирований:');
    const scanHistory = await axios.get('http://localhost:3001/api/scanner/history');
    const history = scanHistory.data.history || [];
    console.log(`   Всего записей в истории: ${history.length}`);
    
    if (history.length > 0) {
      console.log('   Последние 3 сканирования:');
      history.slice(-3).forEach((scan, index) => {
        console.log(`     ${index + 1}. ${scan.timestamp}: ${scan.messagesProcessed || 0} сообщений, ${scan.leadsFound || 0} лидов`);
      });
    }

    // 3. Проверяем статистику лидов
    console.log('\n3️⃣ Статистика лидов:');
    const leadsStats = await axios.get('http://localhost:3001/api/leads/stats');
    console.log(`   Всего лидов: ${leadsStats.data.total || 0}`);
    console.log(`   Отправлено: ${leadsStats.data.sent || 0}`);
    console.log(`   Не отправлено: ${leadsStats.data.unsent || 0}`);

    // 4. Проверяем последние лиды
    console.log('\n4️⃣ Последние лиды:');
    const leads = await axios.get('http://localhost:3001/api/leads');
    const leadsData = leads.data.leads || [];
    console.log(`   Всего лидов в базе: ${leadsData.length}`);
    
    if (leadsData.length > 0) {
      console.log('   Последние 3 лида:');
      leadsData.slice(-3).forEach((lead, index) => {
        const date = new Date(lead.timestamp).toLocaleString('ru-RU');
        console.log(`     ${index + 1}. ${date}: ${lead.username || 'Без имени'} - ${lead.sent ? 'Отправлен' : 'Не отправлен'}`);
      });
    }

    // 5. Анализируем лимиты в коде
    console.log('\n5️⃣ Анализ лимитов в коде:');
    console.log('   📋 Найденные лимиты:');
    console.log('     • scanner.js: limit: 1000 (getMessagesOptions)');
    console.log('     • geminiService.js: MAX_MESSAGES = 1000');
    console.log('     • geminiService.js: чанки по 100 сообщений');
    console.log('     • geminiService.js: задержка 500мс между чанками');
    console.log('     • telegramService.ts: limit: 100 (API запросы)');
    console.log('     • telegram.js: limit по умолчанию 100');

    // 6. Расчет теоретических лимитов
    console.log('\n6️⃣ Теоретические лимиты:');
    console.log('   📊 Максимум за один запрос:');
    console.log('     • Telegram API: 1000 сообщений');
    console.log('     • AI анализ: 1000 сообщений (10 чанков по 100)');
    console.log('     • Время AI анализа: ~5 секунд (10 чанков × 500мс)');
    console.log('   📈 Теоретический максимум в час:');
    console.log('     • При сканировании каждые 5 минут: 12 × 1000 = 12,000 сообщений');
    console.log('     • При сканировании каждый час: 1 × 1000 = 1,000 сообщений');
    console.log('   ⚠️ Наблюдаемый лимит: ~1500 сообщений/час');

    // 7. Проверяем настройки Telegram
    console.log('\n7️⃣ Настройки Telegram:');
    const telegramSettings = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log(`   Bot Token настроен: ${telegramSettings.data.botToken ? 'Да' : 'Нет'}`);
    console.log(`   Channel ID: ${telegramSettings.data.channelId || 'Не установлен'}`);

    console.log('\n✅ Диагностика завершена!');
    console.log('\n🔍 Возможные причины ограничения в 1500 сообщений:');
    console.log('   1. Telegram API rate limiting');
    console.log('   2. Настройки интервала автосканирования');
    console.log('   3. Ограничения в коде (MAX_MESSAGES = 1000)');
    console.log('   4. Проблемы с получением новых сообщений (offset_date)');

  } catch (error) {
    console.error('❌ Ошибка при диагностике:', error.message);
    if (error.response) {
      console.error('   Статус:', error.response.status);
      console.error('   Данные:', error.response.data);
    }
  }
}

quickParsingCheck();