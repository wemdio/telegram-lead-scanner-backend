const axios = require('axios');

async function testMockTelegramSettings() {
  try {
    console.log('🧪 Настройка mock режима для Telegram...\n');

    // Сохраняем mock настройки Telegram
    const mockSettings = {
    telegramBotToken: 'mock_bot_token_12345',
    telegramChannelId: 'mock_channel_id_67890'
  };

    console.log('📤 Сохраняем mock настройки Telegram...');
    const saveResponse = await axios.post('http://localhost:3001/api/settings/telegram', mockSettings);
    console.log('✅ Mock настройки Telegram сохранены:', saveResponse.data);

    // Проверяем сохраненные настройки
    console.log('\n📥 Проверяем сохраненные настройки...');
    const getResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    console.log('📋 Текущие настройки Telegram:', getResponse.data);

    console.log('\n✅ Mock режим для Telegram настроен успешно!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

testMockTelegramSettings();