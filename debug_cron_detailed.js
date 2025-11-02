const axios = require('axios');

async function debugCronDetailed() {
  try {
    console.log('🔍 Детальная отладка cron задачи...\n');

    // 1. Проверяем лиды в системе
    console.log('1. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads;
    
    console.log(`Всего лидов: ${leads ? leads.length : 0}`);
    
    if (leads && leads.length > 0) {
      leads.forEach((lead, index) => {
        console.log(`  Лид ${index}: sent=${lead.sent}, name=${lead.name || 'undefined'}`);
      });
    }

    // 2. Проверяем настройки Telegram
    console.log('\n2. Проверяем настройки Telegram...');
    const settingsResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('Настройки:', settingsResponse.data);

    // 3. Запускаем cron с детальным логированием
    console.log('\n3. Запускаем cron задачу...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат cron:', cronResponse.data);

    // 4. Проверяем лиды после cron
    console.log('\n4. Проверяем лиды после cron...');
    const leadsAfterResponse = await axios.get('http://localhost:3001/api/leads');
    const leadsAfter = leadsAfterResponse.data.leads;
    
    if (leadsAfter && leadsAfter.length > 0) {
      leadsAfter.forEach((lead, index) => {
        console.log(`  Лид ${index} после cron: sent=${lead.sent}, name=${lead.name || 'undefined'}`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка при отладке:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

debugCronDetailed();