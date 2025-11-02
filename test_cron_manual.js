const axios = require('axios');

async function testManualCronSend() {
  try {
    console.log('🧪 Тестируем ручную отправку новых лидов через cron...');
    
    const response = await axios.post('http://localhost:3001/api/cron/send-new-leads');
    
    console.log('📨 Ответ от API:', response.data);
    
    if (response.data.success) {
      console.log(`✅ Успешно! Отправлено лидов: ${response.data.sentCount}`);
    } else {
      console.log('❌ Ошибка:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error('📋 Детали ошибки:', error.response.data);
    }
  }
}

testManualCronSend();