const axios = require('axios');

async function testSyncEndpoint() {
  try {
    console.log('🧪 Тестируем новый эндпоинт синхронизации лидов...\n');

    // 1. Проверяем текущее состояние лидов
    console.log('1. Проверяем текущее состояние лидов...');
    const initialStatusResponse = await axios.get('http://localhost:3001/api/leads/status');
    console.log('Начальное состояние:', {
      totalLeads: initialStatusResponse.data.totalLeads,
      leads: initialStatusResponse.data.leads.map(lead => ({ id: lead.id, name: lead.name }))
    });

    // 2. Запускаем синхронизацию лидов из Google Sheets
    console.log('\n2. Запускаем синхронизацию лидов из Google Sheets...');
    const syncResponse = await axios.post('http://localhost:3001/api/leads/sync-from-sheets');
    console.log('Результат синхронизации:', {
      success: syncResponse.data.success,
      message: syncResponse.data.message,
      totalLeads: syncResponse.data.totalLeads,
      newLeads: syncResponse.data.newLeads
    });

    // 3. Проверяем состояние после синхронизации
    console.log('\n3. Проверяем состояние после синхронизации...');
    const finalStatusResponse = await axios.get('http://localhost:3001/api/leads/status');
    console.log('Финальное состояние:', {
      totalLeads: finalStatusResponse.data.totalLeads,
      leads: finalStatusResponse.data.leads.map(lead => ({ 
        id: lead.id, 
        name: lead.name, 
        sent: lead.sent 
      }))
    });

    // 4. Тестируем отправку лидов
    console.log('\n4. Тестируем отправку лидов...');
    const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    console.log('Результат отправки:', cronResponse.data);

    // 5. Проверяем финальное состояние
    console.log('\n5. Проверяем финальное состояние...');
    const veryFinalStatusResponse = await axios.get('http://localhost:3001/api/leads/status');
    console.log('Очень финальное состояние:', {
      totalLeads: veryFinalStatusResponse.data.totalLeads,
      leads: veryFinalStatusResponse.data.leads.map(lead => ({ 
        id: lead.id, 
        name: lead.name, 
        sent: lead.sent 
      }))
    });

    console.log('\n✅ Тест эндпоинта синхронизации завершен успешно!');

  } catch (error) {
    console.error('❌ Ошибка в тесте:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

testSyncEndpoint();