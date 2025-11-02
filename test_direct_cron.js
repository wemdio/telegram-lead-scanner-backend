const axios = require('axios');

async function testDirectCron() {
  console.log('🧪 Прямой тест cron задачи...\n');

  try {
    // 1. Проверяем лиды в системе
    console.log('1. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    console.log('Лиды в системе:', leadsResponse.data.total);
    
    if (leadsResponse.data.leads && leadsResponse.data.leads.length > 0) {
      console.log('Первые 3 лида:');
      leadsResponse.data.leads.slice(0, 3).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} - ${lead.message.substring(0, 50)}... (Отправлен: ${lead.sent})`);
      });
    }

    // 2. Запускаем cron задачу напрямую
    console.log('\n2. Запускаем cron задачу напрямую...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат cron задачи:', JSON.stringify(cronResponse.data, null, 2));

    // 3. Проверяем лиды после cron
    console.log('\n3. Проверяем лиды после cron...');
    const leadsAfterResponse = await axios.get('http://localhost:3001/api/leads');
    console.log('Лиды после cron:', leadsAfterResponse.data.total);
    
    if (leadsAfterResponse.data.leads && leadsAfterResponse.data.leads.length > 0) {
      console.log('Статус отправки лидов:');
      leadsAfterResponse.data.leads.forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} - Отправлен: ${lead.sent}`);
      });
    }

    console.log('\n✅ Прямой тест завершен');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error('Статус ошибки:', error.response.status);
      console.error('Детали ошибки:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testDirectCron();