const axios = require('axios');

async function testUpdatedCron() {
  try {
    console.log('🔍 Тестируем обновленную функцию sendNewLeadsToTelegram...\n');

    // 1. Проверяем настройки Google Sheets
    console.log('1. Проверяем настройки Google Sheets...');
    const sheetsResponse = await axios.get('http://localhost:3001/api/settings/google-sheets');
    console.log('Настройки Google Sheets:', sheetsResponse.data);

    // 2. Проверяем настройки Telegram
    console.log('\n2. Проверяем настройки Telegram...');
    const telegramResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('Настройки Telegram:', telegramResponse.data);

    // 3. Проверяем лиды в системе
    console.log('\n3. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads;
    console.log(`Всего лидов: ${leads.length}`);
    
    const unsentLeads = leads.filter(lead => lead.sent !== true);
    console.log(`Неотправленных лидов: ${unsentLeads.length}`);
    
    if (unsentLeads.length > 0) {
      console.log('Первые 3 неотправленных лида:');
      unsentLeads.slice(0, 3).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name || 'undefined'} - sent: ${lead.sent}, id: ${lead.id}`);
      });
    }

    // 4. Запускаем функцию отправки лидов
    console.log('\n4. Запускаем функцию отправки лидов...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат cron задачи:', JSON.stringify(cronResponse.data, null, 2));

    // 5. Проверяем лиды после выполнения
    console.log('\n5. Проверяем лиды после выполнения...');
    const leadsAfterResponse = await axios.get('http://localhost:3001/api/leads');
    const leadsAfter = leadsAfterResponse.data.leads;
    console.log(`Лиды после cron: ${leadsAfter ? leadsAfter.length : 0}`);
    
    if (leadsAfter && leadsAfter.length > 0) {
      const sentLeads = leadsAfter.filter(lead => lead.sent === true);
      const stillUnsentLeads = leadsAfter.filter(lead => lead.sent !== true);
      
      console.log(`Отправленных лидов: ${sentLeads.length}`);
      console.log(`Неотправленных лидов: ${stillUnsentLeads.length}`);
      
      if (sentLeads.length > 0) {
        console.log('Отправленные лиды:');
        sentLeads.slice(0, 3).forEach((lead, index) => {
          console.log(`  ${index + 1}. ${lead.name || 'undefined'} - sent: ${lead.sent}`);
        });
      }
    }

    console.log('\n✅ Тест обновленной функции завершен');
    
  } catch (error) {
    console.error('❌ Ошибка в тесте:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

testUpdatedCron();