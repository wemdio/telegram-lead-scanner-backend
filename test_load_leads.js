const axios = require('axios');

async function testLoadLeads() {
  try {
    console.log('🔍 Загружаем лиды из Google Sheets и тестируем отправку...\n');

    // 1. Получаем настройки Google Sheets
    console.log('1. Получаем настройки Google Sheets...');
    const settingsResponse = await axios.get('http://localhost:3001/api/settings/google-sheets');
    console.log('Настройки Google Sheets:', settingsResponse.data);
    
    if (!settingsResponse.data.success) {
      throw new Error('Настройки Google Sheets не найдены');
    }

    const { serviceAccountEmail, privateKey, spreadsheetId } = settingsResponse.data;

    // 2. Инициализируем Google Sheets клиент
    console.log('2. Инициализируем Google Sheets клиент...');
    const initResponse = await axios.post('http://localhost:3001/api/sheets/auto-initialize', {
      googleServiceAccountEmail: serviceAccountEmail,
      googlePrivateKey: privateKey,
      googleSpreadsheetId: spreadsheetId
    });
    console.log('Результат инициализации:', initResponse.data);

    // 3. Загружаем лиды из Google Sheets
    console.log('3. Загружаем лиды из Google Sheets...');
    const leadsResponse = await axios.get(`http://localhost:3001/api/sheets/leads/${spreadsheetId}`);
    console.log('Лиды из Google Sheets:', leadsResponse.data);

    // 4. Проверяем лиды в системе после загрузки
    console.log('4. Проверяем лиды в системе после загрузки...');
    const systemLeadsResponse = await axios.get('http://localhost:3001/api/leads/status');
    console.log('Лиды в системе:', systemLeadsResponse.data);

    // 5. Запускаем функцию отправки лидов
    console.log('5. Запускаем функцию отправки лидов...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат отправки:', cronResponse.data);

    // 6. Проверяем лиды после выполнения
    console.log('6. Проверяем лиды после выполнения...');
    const finalLeadsResponse = await axios.get('http://localhost:3001/api/leads/status');
    console.log('Финальное состояние лидов:', finalLeadsResponse.data);

    // 7. Проверяем статус в Google Sheets
    console.log('7. Проверяем статус в Google Sheets...');
    const finalSheetsResponse = await axios.get(`http://localhost:3001/api/sheets/leads/${spreadsheetId}`);
    console.log('Финальное состояние в Google Sheets:', finalSheetsResponse.data);

    console.log('\n✅ Тест завершен успешно!');

  } catch (error) {
    console.error('❌ Ошибка в тесте:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

testLoadLeads();