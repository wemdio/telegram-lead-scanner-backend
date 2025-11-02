const axios = require('axios');

async function testCronWithTelegramSettings() {
  console.log('🧪 Тест cron задачи с настройками Telegram...');
  
  try {
    // 1. Проверяем текущие настройки Telegram
    console.log('\n1. Проверяем настройки Telegram...');
    const settingsResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('Настройки Telegram:', {
      botToken: settingsResponse.data.botToken ? 'установлен' : 'не установлен',
      channelId: settingsResponse.data.channelId || 'не установлен'
    });
    
    // 2. Устанавливаем тестовые настройки Telegram если их нет
    if (!settingsResponse.data.botToken || !settingsResponse.data.channelId) {
      console.log('\n2. Устанавливаем тестовые настройки Telegram...');
      const updateResponse = await axios.post('http://localhost:3001/api/settings/telegram', {
        telegramBotToken: 'test_bot_token_123',
        telegramChannelId: 'test_channel_id_456'
      });
      console.log('Результат обновления настроек:', updateResponse.data);
    }
    
    // 3. Проверяем лиды в системе
    console.log('\n3. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads;
    console.log(`Лиды в системе: ${leads ? leads.length : 0}`);
    
    if (leads && leads.length > 0) {
      console.log('Первые 3 лида:');
      leads.slice(0, 3).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name || 'undefined'} - ${lead.message ? lead.message.substring(0, 50) + '...' : 'нет сообщения'} (Отправлен: ${lead.sent})`);
      });
    }
    
    // 4. Запускаем cron задачу
    console.log('\n4. Запускаем cron задачу...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат cron задачи:', JSON.stringify(cronResponse.data, null, 2));
    
    // 5. Проверяем лиды после cron
    console.log('\n5. Проверяем лиды после cron...');
    const leadsAfterResponse = await axios.get('http://localhost:3001/api/leads');
    const leadsAfter = leadsAfterResponse.data.leads;
    console.log(`Лиды после cron: ${leadsAfter ? leadsAfter.length : 0}`);
    
    if (leadsAfter && leadsAfter.length > 0) {
      console.log('Статус отправки лидов:');
      leadsAfter.forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name || 'undefined'} - Отправлен: ${lead.sent}`);
      });
    }
    
    console.log('\n✅ Тест с настройками Telegram завершен');
    
  } catch (error) {
    console.error('❌ Ошибка в тесте:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

testCronWithTelegramSettings();