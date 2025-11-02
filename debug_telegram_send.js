const axios = require('axios');

async function debugTelegramSend() {
  try {
    console.log('🔍 Тестируем отправку лида в Telegram...\n');

    // Получаем настройки Telegram
    const telegramResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    const { botToken, channelId } = telegramResponse.data;
    console.log('Настройки Telegram получены:', { botToken: botToken ? 'есть' : 'нет', channelId });

    // Получаем лиды
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads;
    
    // Находим первый неотправленный лид с именем
    const testLead = leads.find(lead => lead.sent !== true && lead.name && lead.name !== 'undefined');
    
    if (!testLead) {
      console.log('❌ Не найден подходящий лид для тестирования');
      return;
    }
    
    console.log('Тестовый лид:', {
      id: testLead.id,
      name: testLead.name,
      message: testLead.message ? testLead.message.substring(0, 50) + '...' : 'нет сообщения',
      sent: testLead.sent
    });

    // Отправляем лид в Telegram
    console.log('\n📤 Отправляем лид в Telegram...');
    
    const sendResponse = await axios.post('http://localhost:3001/api/telegram-bot/send-lead-notification', {
      botToken: botToken,
      channelId: channelId,
      lead: testLead
    });
    
    console.log('Ответ от Telegram API:', sendResponse.data);
    
    if (sendResponse.data.success) {
      console.log('\n✅ Лид успешно отправлен в Telegram');
      
      // Обновляем статус лида
      console.log('📝 Обновляем статус лида...');
      
      const updateResponse = await axios.post('http://localhost:3001/api/leads/update-sent', {
        leadId: testLead.id,
        sent: true
      });
      
      console.log('Ответ обновления статуса:', updateResponse.data);
      
      if (updateResponse.data.success) {
        console.log('✅ Статус лида успешно обновлен');
      } else {
        console.log('❌ Ошибка при обновлении статуса лида');
      }
    } else {
      console.log('❌ Ошибка при отправке лида в Telegram');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

debugTelegramSend();