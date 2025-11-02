const axios = require('axios');

async function debugLeadSending() {
  try {
    console.log('🔍 Детальная отладка отправки лидов...\n');

    // 1. Проверяем настройки Telegram
    console.log('1. Проверяем настройки Telegram...');
    const telegramResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('Настройки Telegram:', telegramResponse.data);
    
    const { botToken, channelId } = telegramResponse.data;
    if (!botToken || !channelId) {
      console.error('❌ Отсутствуют настройки Telegram!');
      return;
    }

    // 2. Проверяем лиды в системе
    console.log('\n2. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads;
    console.log(`Всего лидов: ${leads.length}`);
    
    if (leads.length === 0) {
      console.log('❌ Нет лидов в системе!');
      return;
    }

    // Показываем детали каждого лида
    leads.forEach((lead, index) => {
      console.log(`  Лид ${index + 1}:`, {
        id: lead.id,
        name: lead.name,
        sent: lead.sent,
        message: lead.message ? lead.message.substring(0, 50) + '...' : 'нет сообщения'
      });
    });

    // 3. Фильтруем неотправленные лиды
    const unsentLeads = leads.filter(lead => lead.sent !== true);
    console.log(`\n3. Неотправленных лидов: ${unsentLeads.length}`);
    
    if (unsentLeads.length === 0) {
      console.log('❌ Все лиды уже отправлены!');
      return;
    }

    // 4. Тестируем отправку одного лида напрямую
    console.log('\n4. Тестируем отправку одного лида напрямую...');
    const testLead = unsentLeads[0];
    console.log('Тестовый лид:', {
      id: testLead.id,
      name: testLead.name,
      sent: testLead.sent
    });

    try {
      const telegramSendResponse = await axios.post('http://localhost:3001/api/telegram-bot/send-lead-notification', {
        botToken: botToken,
        channelId: channelId,
        lead: testLead
      });
      
      console.log('Результат отправки в Telegram:', telegramSendResponse.data);
    } catch (telegramError) {
      console.error('❌ Ошибка отправки в Telegram:', telegramError.message);
      if (telegramError.response) {
        console.error('Детали ошибки:', telegramError.response.data);
      }
    }

    // 5. Запускаем полную функцию отправки лидов
    console.log('\n5. Запускаем полную функцию отправки лидов...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат cron задачи:', cronResponse.data);

    // 6. Проверяем состояние лидов после отправки
    console.log('\n6. Проверяем состояние лидов после отправки...');
    const finalLeadsResponse = await axios.get('http://localhost:3001/api/leads');
    const finalLeads = finalLeadsResponse.data.leads;
    
    const sentLeads = finalLeads.filter(lead => lead.sent === true);
    const stillUnsentLeads = finalLeads.filter(lead => lead.sent !== true);
    
    console.log(`Отправленных лидов: ${sentLeads.length}`);
    console.log(`Неотправленных лидов: ${stillUnsentLeads.length}`);

    console.log('\n✅ Отладка завершена');

  } catch (error) {
    console.error('❌ Ошибка в отладке:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

debugLeadSending();