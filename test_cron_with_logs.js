const axios = require('axios');

async function testCronWithLogs() {
  console.log('🧪 Тестируем cron с детальными логами...\n');

  try {
    // 1. Проверяем настройки Google Sheets
    console.log('1. Проверяем настройки Google Sheets...');
    const settingsResponse = await axios.get('http://localhost:3001/api/sheets/settings/test_spreadsheet_id');
    console.log('Настройки Google Sheets:', settingsResponse.data);

    // 2. Проверяем лиды в системе
    console.log('\n2. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    console.log('Лиды в системе:', leadsResponse.data.total);
    
    if (leadsResponse.data.leads && leadsResponse.data.leads.length > 0) {
      console.log('Первые 3 лида:');
      leadsResponse.data.leads.slice(0, 3).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} - ${lead.message.substring(0, 50)}... (Отправлен: ${lead.sent})`);
      });
    }

    // 3. Запускаем cron задачу
    console.log('\n3. Запускаем cron задачу...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-leads');
    console.log('Результат cron задачи:', cronResponse.data);

    // 4. Проверяем лиды после cron
    console.log('\n4. Проверяем лиды после cron...');
    const leadsAfterResponse = await axios.get('http://localhost:3001/api/leads');
    console.log('Лиды после cron:', leadsAfterResponse.data.total);
    
    if (leadsAfterResponse.data.leads && leadsAfterResponse.data.leads.length > 0) {
      console.log('Статус отправки лидов:');
      leadsAfterResponse.data.leads.forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} - Отправлен: ${lead.sent}`);
      });
    }

    console.log('\n✅ Тест завершен');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

testCronWithLogs();