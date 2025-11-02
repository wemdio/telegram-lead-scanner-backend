const axios = require('axios');

async function testCronWithMockSettings() {
  console.log('🧪 Тестируем cron задачу с mock настройками Google Sheets...\n');

  try {
    // 1. Устанавливаем mock настройки Google Sheets
    console.log('1. Устанавливаем mock настройки Google Sheets...');
    const mockGoogleSettings = {
      serviceAccountEmail: 'mock-service@mock.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----',
      spreadsheetId: 'mock_spreadsheet_id_12345'
    };

    const googleSettingsResponse = await axios.post('http://localhost:3001/api/settings/google-sheets', mockGoogleSettings);
    console.log('Mock Google Sheets настройки сохранены:', googleSettingsResponse.data);

    // 2. Устанавливаем mock настройки Telegram
    console.log('\n2. Устанавливаем mock настройки Telegram...');
    const mockTelegramSettings = {
      telegramBotToken: 'mock_bot_token_12345',
      telegramChannelId: 'mock_channel_id_67890'
    };

    const telegramSettingsResponse = await axios.post('http://localhost:3001/api/settings/telegram', mockTelegramSettings);
    console.log('Mock Telegram настройки сохранены:', telegramSettingsResponse.data);

    // 3. Проверяем лиды в системе
    console.log('\n3. Проверяем лиды в системе...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads || [];
    console.log(`Всего лидов: ${leads.length}`);
    
    const unsentLeads = leads.filter(lead => !lead.sent);
    console.log(`Неотправленных лидов: ${unsentLeads.length}`);

    // 4. Запускаем cron задачу
    console.log('\n4. Запускаем cron задачу отправки лидов...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат cron задачи:', cronResponse.data);

    // 5. Проверяем состояние лидов после отправки
    console.log('\n5. Проверяем состояние лидов после отправки...');
    const leadsAfterResponse = await axios.get('http://localhost:3001/api/leads');
    const leadsAfter = leadsAfterResponse.data.leads || [];
    
    const sentLeadsAfter = leadsAfter.filter(lead => lead.sent === true);
    const unsentLeadsAfter = leadsAfter.filter(lead => !lead.sent);
    
    console.log(`Отправленных лидов: ${sentLeadsAfter.length}`);
    console.log(`Неотправленных лидов: ${unsentLeadsAfter.length}`);

    console.log('\n✅ Тест завершен');

  } catch (error) {
    console.error('❌ Ошибка в тесте:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

testCronWithMockSettings();