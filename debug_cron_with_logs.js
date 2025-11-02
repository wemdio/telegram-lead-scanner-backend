const axios = require('axios');

async function debugCronWithLogs() {
  try {
    console.log('🔍 Детальная отладка cron задачи с логами...\n');

    // 1. Проверяем лиды в системе
    console.log('1. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads;
    console.log(`Всего лидов: ${leads.length}`);
    
    const unsentLeads = leads.filter(lead => lead.sent !== true);
    console.log(`Неотправленных лидов: ${unsentLeads.length}`);
    
    unsentLeads.forEach((lead, index) => {
      console.log(`  Неотправленный лид ${index}: name=${lead.name}, sent=${lead.sent}, id=${lead.id}`);
    });

    // 2. Проверяем настройки Telegram
    console.log('\n2. Проверяем настройки Telegram...');
    const telegramResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('Настройки:', telegramResponse.data);

    // 3. Вызываем функцию отправки лидов напрямую
    console.log('\n3. Вызываем функцию отправки лидов напрямую...');
    
    // Имитируем вызов функции sendNewLeads из cron.js
    const sendResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат отправки:', sendResponse.data);

    // 4. Проверяем лиды после отправки
    console.log('\n4. Проверяем лиды после отправки...');
    const leadsAfterResponse = await axios.get('http://localhost:3001/api/leads');
    const leadsAfter = leadsAfterResponse.data.leads;
    
    const unsentAfter = leadsAfter.filter(lead => lead.sent !== true);
    console.log(`Неотправленных лидов после: ${unsentAfter.length}`);
    
    unsentAfter.forEach((lead, index) => {
      console.log(`  Неотправленный лид ${index} после: name=${lead.name}, sent=${lead.sent}, id=${lead.id}`);
    });

    // 5. Проверяем отправленные лиды
    const sentAfter = leadsAfter.filter(lead => lead.sent === true);
    console.log(`\nОтправленных лидов после: ${sentAfter.length}`);
    
    sentAfter.forEach((lead, index) => {
      console.log(`  Отправленный лид ${index}: name=${lead.name}, sent=${lead.sent}, id=${lead.id}`);
    });

  } catch (error) {
    console.error('❌ Ошибка при отладке:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

debugCronWithLogs();