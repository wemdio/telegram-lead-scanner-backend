const axios = require('axios');

async function testDirectTelegramSend() {
  console.log('🧪 Тестируем прямую отправку в Telegram API...\n');

  try {
    // 1. Получаем настройки Telegram
    const settingsResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('Настройки Telegram:', settingsResponse.data);

    const { botToken, channelId } = settingsResponse.data;

    // 2. Создаем тестовый лид
    const testLead = {
      id: 'test-lead-' + Date.now(),
      name: 'Test Lead Direct',
      author: 'Test Author',
      message: 'Тестовое сообщение для проверки отправки',
      timestamp: new Date().toISOString(),
      sent: false
    };

    console.log('📤 Отправляем тестовый лид напрямую...');
    console.log('Данные для отправки:', {
      botToken: botToken ? 'есть' : 'нет',
      channelId: channelId,
      leadName: testLead.name
    });

    // 3. Отправляем лид через API
    const url = 'http://localhost:3001/api/telegram-bot/send-lead-notification';
    console.log('🌐 URL для запроса:', url);
    
    const requestData = {
      botToken: botToken,
      channelId: channelId,
      lead: testLead
    };
    
    console.log('📋 Данные запроса:', {
      ...requestData,
      botToken: botToken ? `${botToken.substring(0, 10)}...` : 'нет'
    });

    const response = await axios.post(url, requestData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Успешно отправлено!');
    console.log('Ответ:', response.data);

  } catch (error) {
    console.log('❌ Ошибка:', error.message);
    if (error.response) {
      console.log('Статус:', error.response.status);
      console.log('Детали ошибки:', error.response.data);
      console.log('Заголовки ответа:', error.response.headers);
    } else if (error.request) {
      console.log('Запрос был отправлен, но ответ не получен');
      console.log('Детали запроса:', error.request);
    } else {
      console.log('Ошибка настройки запроса:', error.message);
    }
  }
}

testDirectTelegramSend();