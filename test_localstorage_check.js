const axios = require('axios');

async function checkGoogleSheetsSettings() {
  try {
    console.log('🔍 Проверяем настройки Google Sheets через API...');
    
    // Проверяем текущие настройки
    const currentSettings = await axios.get('http://localhost:3001/api/settings/google-sheets');
    console.log('📊 Текущие настройки:', JSON.stringify(currentSettings.data, null, 2));
    
    // Попробуем сохранить тестовые настройки
    console.log('\n🔧 Сохраняем тестовые настройки...');
    const testSettings = {
      googleServiceAccountEmail: 'test@example.com',
      googlePrivateKey: 'test-key',
      googleSpreadsheetId: 'test-spreadsheet-id'
    };
    
    const saveResponse = await axios.post('http://localhost:3001/api/settings/google-sheets', testSettings);
    console.log('💾 Ответ сохранения:', saveResponse.data);
    
    // Проверяем сохранились ли настройки
    console.log('\n📋 Проверяем сохраненные настройки...');
    const updatedSettings = await axios.get('http://localhost:3001/api/settings/google-sheets');
    console.log('📊 Обновленные настройки:', JSON.stringify(updatedSettings.data, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка при проверке настроек:', error.message);
    if (error.response) {
      console.error('📋 Детали ошибки:', error.response.data);
    }
  }
}

checkGoogleSheetsSettings();