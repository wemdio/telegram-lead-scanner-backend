const axios = require('axios');

async function testMockMode() {
  console.log('🧪 Тестируем работу в mock режиме...\n');

  try {
    // 1. Включаем mock режим
    console.log('1. Включаем mock режим...');
    const mockResponse = await axios.post('http://localhost:3001/api/sheets/mock', { enabled: true });
    console.log('Mock режим включен:', mockResponse.data);

    // 2. Проверяем настройки в mock режиме
    console.log('\n2. Проверяем настройки в mock режиме...');
    const settingsResponse = await axios.get('http://localhost:3001/api/sheets/settings/test_spreadsheet_id');
    console.log('Настройки в mock режиме:', settingsResponse.data);

    // 3. Проверяем лиды в системе
    console.log('\n3. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    console.log('Лиды в системе:', leadsResponse.data.total);
    
    if (leadsResponse.data.leads && leadsResponse.data.leads.length > 0) {
      console.log('Первые 3 лида:');
      leadsResponse.data.leads.slice(0, 3).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} - ${lead.message.substring(0, 50)}... (Отправлен: ${lead.sent})`);
      });
    }

    // 4. Запускаем cron задачу в mock режиме
    console.log('\n4. Запускаем cron задачу в mock режиме...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-leads');
    console.log('Результат cron задачи:', cronResponse.data);

    // 5. Проверяем лиды после cron
    console.log('\n5. Проверяем лиды после cron...');
    const leadsAfterResponse = await axios.get('http://localhost:3001/api/leads');
    console.log('Лиды после cron:', leadsAfterResponse.data.total);
    
    if (leadsAfterResponse.data.leads && leadsAfterResponse.data.leads.length > 0) {
      console.log('Статус отправки лидов:');
      leadsAfterResponse.data.leads.forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} - Отправлен: ${lead.sent}`);
      });
    }

    console.log('\n✅ Тест в mock режиме завершен');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

testMockMode();