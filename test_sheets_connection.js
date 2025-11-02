const axios = require('axios');

// Тестируем подключение к Google Sheets
async function testSheetsConnection() {
  console.log('🧪 Тестируем подключение к Google Sheets...\n');
  
  try {
    // 1. Проверяем настройки
    console.log('1. Проверяем настройки Google Sheets...');
    const settingsResponse = await axios.get('http://localhost:3001/api/settings/google-sheets');
    console.log('Настройки:', settingsResponse.data);
    
    // 2. Тестируем подключение к Google Sheets
    console.log('\n2. Тестируем подключение к Google Sheets...');
    try {
      const testResponse = await axios.post('http://localhost:3001/api/sheets/test-connection');
      console.log('Результат подключения:', testResponse.data);
    } catch (error) {
      console.log('❌ Ошибка подключения к Google Sheets:', error.response?.data || error.message);
    }
    
    // 3. Пробуем получить лиды
    console.log('\n3. Пробуем получить лиды...');
    try {
      const leadsResponse = await axios.get('http://localhost:3001/api/leads');
      console.log('Ответ API лидов:', leadsResponse.data);
      
      if (Array.isArray(leadsResponse.data)) {
        console.log(`Найдено лидов: ${leadsResponse.data.length}`);
      } else {
        console.log('Неожиданный формат ответа лидов');
      }
    } catch (error) {
      console.log('❌ Ошибка получения лидов:', error.response?.data || error.message);
    }
    
    // 4. Проверяем настройки Telegram
    console.log('\n4. Проверяем настройки Telegram...');
    try {
      const telegramResponse = await axios.get('http://localhost:3001/api/settings/telegram');
      console.log('Настройки Telegram:', telegramResponse.data);
    } catch (error) {
      console.log('❌ Ошибка получения настроек Telegram:', error.response?.data || error.message);
    }
    
    console.log('\n✅ Тест подключения завершен');
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
  }
}

// Запускаем тест
testSheetsConnection();