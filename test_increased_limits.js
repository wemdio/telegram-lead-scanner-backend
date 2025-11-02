const axios = require('axios');

async function testIncreasedLimits() {
  console.log('🚀 Тестирование увеличенных лимитов парсинга...\n');

  try {
    // 1. Проверяем статус Telegram
    console.log('1️⃣ Проверка статуса Telegram:');
    const telegramStatus = await axios.get('http://localhost:3001/api/telegram/status');
    console.log(`   Подключен: ${telegramStatus.data.connected ? 'Да' : 'Нет'}`);
    console.log(`   Авторизован: ${telegramStatus.data.authenticated ? 'Да' : 'Нет'}`);
    
    if (!telegramStatus.data.connected || !telegramStatus.data.authenticated) {
      console.log('❌ Telegram не подключен или не авторизован. Тест невозможен.');
      return;
    }

    // 2. Получаем список чатов
    console.log('\n2️⃣ Получение списка чатов:');
    const chatsResponse = await axios.get('http://localhost:3001/api/telegram/chats');
    const chats = chatsResponse.data.chats || [];
    console.log(`   Доступно чатов: ${chats.length}`);
    
    if (chats.length === 0) {
      console.log('❌ Нет доступных чатов для тестирования.');
      return;
    }

    // Выбираем первые 3 чата для тестирования
    const testChats = chats.slice(0, 3);
    console.log('   Тестовые чаты:');
    testChats.forEach((chat, index) => {
      console.log(`     ${index + 1}. ${chat.title} (ID: ${chat.id})`);
    });

    // 3. Запускаем тестовое сканирование
    console.log('\n3️⃣ Запуск тестового сканирования с увеличенными лимитами:');
    console.log('   📊 Ожидаемые улучшения:');
    console.log('     • MAX_MESSAGES: 1000 → 5000 (+400%)');
    console.log('     • Scanner limit: 1000 → 5000 (+400%)');
    console.log('     • Telegram dialogs: 100 → 500 (+400%)');
    console.log('     • Messages API: 100 → 1000 (+900%)');

    const scanStartTime = Date.now();
    
    try {
      const scanResponse = await axios.post('http://localhost:3001/api/scanner/scan', {
        chatIds: testChats.map(chat => chat.id),
        isManualScan: true
      });
      
      const scanDuration = Date.now() - scanStartTime;
      
      console.log('\n✅ Результаты тестового сканирования:');
      console.log(`   Статус: ${scanResponse.data.success ? 'Успешно' : 'Ошибка'}`);
      console.log(`   Время выполнения: ${(scanDuration / 1000).toFixed(2)} секунд`);
      console.log(`   Всего сообщений: ${scanResponse.data.totalMessages || 0}`);
      console.log(`   Найдено лидов: ${scanResponse.data.totalLeads || 0}`);
      
      if (scanResponse.data.chatResults) {
        console.log('\n   📋 Детали по чатам:');
        scanResponse.data.chatResults.forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.chatTitle}:`);
          console.log(`        • Сообщений: ${result.messageCount}`);
          console.log(`        • Лидов: ${result.leadCount}`);
          console.log(`        • Время: ${result.processingTime || 'N/A'}`);
        });
      }

      // 4. Анализ производительности
      console.log('\n4️⃣ Анализ производительности:');
      const totalMessages = scanResponse.data.totalMessages || 0;
      const messagesPerSecond = totalMessages / (scanDuration / 1000);
      
      console.log(`   📈 Производительность:`);
      console.log(`     • Сообщений в секунду: ${messagesPerSecond.toFixed(2)}`);
      console.log(`     • Сообщений в минуту: ${(messagesPerSecond * 60).toFixed(0)}`);
      console.log(`     • Сообщений в час: ${(messagesPerSecond * 3600).toFixed(0)}`);
      
      // Сравнение с предыдущими лимитами
      const oldHourlyLimit = 1500; // Наблюдаемый лимит
      const newHourlyEstimate = messagesPerSecond * 3600;
      const improvement = ((newHourlyEstimate - oldHourlyLimit) / oldHourlyLimit * 100);
      
      console.log(`\n   📊 Сравнение с предыдущими лимитами:`);
      console.log(`     • Старый лимит: ~${oldHourlyLimit} сообщений/час`);
      console.log(`     • Новый потенциал: ~${newHourlyEstimate.toFixed(0)} сообщений/час`);
      console.log(`     • Улучшение: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);

    } catch (scanError) {
      console.log(`❌ Ошибка сканирования: ${scanError.message}`);
      if (scanError.response) {
        console.log(`   Статус: ${scanError.response.status}`);
        console.log(`   Детали: ${JSON.stringify(scanError.response.data, null, 2)}`);
      }
    }

    // 5. Проверяем статистику лидов
    console.log('\n5️⃣ Проверка статистики лидов:');
    try {
      const leadsResponse = await axios.get('http://localhost:3001/api/leads');
      const leads = leadsResponse.data.leads || [];
      console.log(`   Всего лидов в базе: ${leads.length}`);
      
      if (leads.length > 0) {
        const recentLeads = leads.filter(lead => {
          const leadTime = new Date(lead.timestamp);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          return leadTime >= fiveMinutesAgo;
        });
        console.log(`   Новых лидов за последние 5 минут: ${recentLeads.length}`);
      }
    } catch (leadsError) {
      console.log(`   ⚠️ Не удалось получить статистику лидов: ${leadsError.message}`);
    }

    console.log('\n✅ Тестирование завершено!');
    console.log('\n🎯 Рекомендации:');
    console.log('   1. Мониторьте производительность в течение часа');
    console.log('   2. Проверьте стабильность работы с увеличенными лимитами');
    console.log('   3. При необходимости настройте интервалы автосканирования');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    if (error.response) {
      console.error('   Статус:', error.response.status);
      console.error('   Данные:', error.response.data);
    }
  }
}

testIncreasedLimits();