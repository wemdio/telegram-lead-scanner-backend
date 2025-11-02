const axios = require('axios');

async function testMockSheetsUpdate() {
  try {
    console.log('🔧 Настраиваем mock режим для Google Sheets...');
    
    // Сначала настроим mock настройки
    const mockSettings = {
      googleServiceAccountEmail: 'mock@test.com',
      googlePrivateKey: 'MOCK_PRIVATE_KEY_FOR_TESTING',
      googleSpreadsheetId: 'mock-spreadsheet-id'
    };
    
    console.log('📝 Отправляем mock настройки...');
    const settingsResponse = await axios.post('http://localhost:3001/api/settings/google-sheets', mockSettings);
    console.log('✅ Mock настройки сохранены:', settingsResponse.data);
    
    // Теперь тестируем обновление статуса лида
    console.log('🧪 Тестируем обновление статуса лида...');
    const updateResponse = await axios.post('http://localhost:3001/api/sheets/update-lead-sent', {
      spreadsheetId: 'mock-spreadsheet-id',
      leadIndex: 2,
      sent: true
    });
    
    console.log('✅ Результат обновления:', updateResponse.data);
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.response?.data || error.message);
  }
}

testMockSheetsUpdate();