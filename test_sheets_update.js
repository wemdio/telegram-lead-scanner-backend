const axios = require('axios');
const GoogleSheetsService = require('./services/googleSheetsService');

async function testSheetsUpdate() {
  try {
    console.log('🧪 Тестируем обновление Google Sheets...');
    
    // Получаем настройки
    const settingsResponse = await axios.get('http://localhost:3001/api/settings/google-sheets');
    console.log('📋 Настройки получены:', {
      success: settingsResponse.data.success,
      hasServiceAccountEmail: !!settingsResponse.data.serviceAccountEmail,
      hasPrivateKey: !!settingsResponse.data.privateKey,
      hasSpreadsheetId: !!settingsResponse.data.spreadsheetId
    });
    
    if (!settingsResponse.data.success) {
      console.log('❌ Не удалось получить настройки');
      return;
    }
    
    const settings = settingsResponse.data;
    
    // Инициализируем Google Sheets Service
    console.log('🔧 Инициализируем Google Sheets Service...');
    const sheetsService = new GoogleSheetsService();
    
    try {
      await sheetsService.initialize(settings.serviceAccountEmail, settings.privateKey);
      console.log('✅ Google Sheets Service инициализирован успешно');
      
      // Тестируем обновление
      console.log('📝 Тестируем обновление лида...');
      const spreadsheetId = settings.spreadsheetId;
      const leadIndex = 2;
      const sent = true;
      
      const range = `Лиды!H${leadIndex}`;
      console.log('📍 Обновляем диапазон:', range);
      
      const response = await sheetsService.sheetsClient.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'RAW',
        resource: {
          values: [[sent ? 'TRUE' : 'FALSE']]
        }
      });
      
      console.log('✅ Обновление выполнено успешно:', response.data);
      
    } catch (initError) {
      console.error('❌ Ошибка инициализации Google Sheets Service:', initError.message);
      console.error('Детали ошибки:', initError);
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
    console.error('Детали:', error);
  }
}

testSheetsUpdate();