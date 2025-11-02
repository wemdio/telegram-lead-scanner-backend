const axios = require('axios');

// Тестируем систему проверки дубликатов
async function testDuplicateSystem() {
  console.log('🧪 Тестируем систему проверки дубликатов лидов...\n');
  
  try {
    // 1. Проверяем настройки Google Sheets
    console.log('1. Проверяем настройки Google Sheets...');
    const settingsResponse = await axios.get('http://localhost:3001/api/settings/google-sheets');
    console.log('Настройки Google Sheets:', settingsResponse.data);
    
    if (!settingsResponse.data || !settingsResponse.data.spreadsheetId) {
      console.log('❌ spreadsheetId не настроен. Настраиваем тестовые данные...');
      
      // Сохраняем тестовые настройки
      await axios.post('http://localhost:3001/api/settings/google-sheets', {
        email: 'test@example.com',
        privateKey: 'test-key',
        spreadsheetId: 'test-spreadsheet-id'
      });
      
      console.log('✅ Тестовые настройки сохранены');
    }
    
    // 2. Получаем текущие лиды
    console.log('\n2. Получаем текущие лиды из Google Sheets...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    console.log('Полный ответ API лидов:', leadsResponse.data);
    
    const leads = leadsResponse.data.leads || [];
    console.log(`Найдено лидов: ${leads.length}`);
    
    if (leads.length > 0) {
      console.log('Первые 3 лида:');
      leads.slice(0, 3).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} - ${lead.message?.substring(0, 50)}... (Отправлен: ${lead.sent})`);
      });
    }
    
    // 3. Тестируем отправку лидов с проверкой дубликатов
    console.log('\n3. Тестируем отправку лидов с проверкой дубликатов...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    
    console.log('Результат отправки лидов:');
    console.log(`  Успех: ${cronResponse.data.success}`);
    console.log(`  Отправлено лидов: ${cronResponse.data.sentCount}`);
    console.log(`  Сообщение: ${cronResponse.data.message}`);
    
    if (cronResponse.data.details) {
      console.log('  Детали:', cronResponse.data.details);
    }
    
    console.log('\n✅ Тест системы проверки дубликатов завершен');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

// Запускаем тест
testDuplicateSystem();