const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testCronWithSpreadsheet() {
  console.log('🧪 Тестирование cron job с настроенным spreadsheetId...\n');

  try {
    // 1. Проверяем текущие лиды в системе
    console.log('1️⃣ Проверяем лиды в системе...');
    const leadsResponse = await axios.get(`${BASE_URL}/leads`);
    const systemLeads = leadsResponse.data.leads || [];
    console.log(`📊 Лидов в системе: ${systemLeads.length}`);
    
    if (systemLeads.length > 0) {
      console.log('📋 Первый лид в системе:', JSON.stringify(systemLeads[0], null, 2));
    }

    // 2. Устанавливаем тестовый spreadsheetId
    console.log('\n2️⃣ Устанавливаем тестовый spreadsheetId...');
    const testSpreadsheetId = 'test-spreadsheet-123';
    
    // Сохраняем настройки Google Sheets
    const sheetsSettings = {
      serviceAccountEmail: 'test@example.com',
      privateKey: 'test-private-key',
      spreadsheetId: testSpreadsheetId
    };
    
    try {
      const saveSettingsResponse = await axios.post(`${BASE_URL}/settings/google-sheets`, sheetsSettings);
      console.log('✅ Настройки Google Sheets сохранены');
    } catch (error) {
      console.log('⚠️ Не удалось сохранить настройки Google Sheets:', error.message);
    }

    // 3. Проверяем получение лидов из Google Sheets (должно работать в mock режиме)
    console.log('\n3️⃣ Проверяем получение лидов из Google Sheets...');
    try {
      const sheetsLeadsResponse = await axios.get(`${BASE_URL}/sheets/leads/${testSpreadsheetId}`);
      console.log('📊 Ответ от Google Sheets API:', JSON.stringify(sheetsLeadsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Ошибка получения лидов из Google Sheets:', error.message);
      if (error.response) {
        console.log('📋 Детали ошибки:', error.response.data);
      }
    }

    // 4. Запускаем cron job
    console.log('\n4️⃣ Запускаем cron job...');
    const cronResponse = await axios.post(`${BASE_URL}/cron/send-new-leads`);
    console.log('📊 Результат cron job:', JSON.stringify(cronResponse.data, null, 2));

    // 5. Проверяем лиды после cron job
    console.log('\n5️⃣ Проверяем лиды после cron job...');
    const leadsAfterResponse = await axios.get(`${BASE_URL}/leads`);
    const leadsAfter = leadsAfterResponse.data.leads || [];
    console.log(`📊 Лидов после cron: ${leadsAfter.length}`);
    
    if (leadsAfter.length > 0) {
      console.log('📋 Статус отправки лидов:');
      leadsAfter.forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name || lead.username || 'Без имени'} - Отправлен: ${lead.sent || false}`);
      });
    }

    console.log('\n✅ Тест завершен');

  } catch (error) {
    console.error('❌ Ошибка в тесте:', error.message);
    if (error.response) {
      console.error('📋 Детали ошибки:', error.response.data);
    }
  }
}

testCronWithSpreadsheet();