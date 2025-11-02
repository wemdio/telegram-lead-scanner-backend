const axios = require('axios');

async function debugTelegramSettings() {
  try {
    console.log('🔍 Проверяем текущие настройки Telegram...\n');

    // Получаем текущие настройки
    const currentSettings = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('Текущие настройки:', currentSettings.data);

    // Устанавливаем правильные тестовые настройки
    console.log('\n📝 Устанавливаем правильные тестовые настройки...');
    
    const newSettings = {
      telegramBotToken: "7123456789:AAEexampleBotTokenHere123456789",
      telegramChannelId: "-1001234567890"
    };
    
    const saveResponse = await axios.post('http://localhost:3001/api/settings/telegram', newSettings);
    console.log('Результат сохранения:', saveResponse.data);

    // Проверяем сохраненные настройки
    console.log('\n🔍 Проверяем сохраненные настройки...');
    const updatedSettings = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('Обновленные настройки:', updatedSettings.data);

    // Тестируем отправку с новыми настройками
    console.log('\n📤 Тестируем отправку лида с новыми настройками...');
    
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
      sent: testLead.sent
    });

    // Отправляем лид в Telegram
    const sendResponse = await axios.post('http://localhost:3001/api/telegram-bot/send-lead-notification', {
      botToken: newSettings.telegramBotToken,
      channelId: newSettings.telegramChannelId,
      lead: testLead
    });
    
    console.log('Ответ от Telegram API:', sendResponse.data);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

debugTelegramSettings();