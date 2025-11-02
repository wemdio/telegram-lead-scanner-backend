const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function restartScannerWithTimeoutTracking() {
  console.log('🔄 Перезапуск сканера с отслеживанием таймеров...');
  
  try {
    // 1. Остановить сканер
    console.log('⏹️ Останавливаем сканер...');
    const stopResponse = await axios.post(`${BASE_URL}/scanner/stop`);
    console.log('✅ Сканер остановлен:', stopResponse.data);
    
    // Ждем 2 секунды
    console.log('⏳ Ждем 2 секунды...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Запустить сканер
    console.log('▶️ Запускаем сканер...');
    const startResponse = await axios.post(`${BASE_URL}/scanner/start`);
    console.log('✅ Сканер запущен:', startResponse.data);
    
    // Ждем 3 секунды для стабилизации
    console.log('⏳ Ждем 3 секунды для стабилизации...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Проверить статус с новой информацией о таймерах
    console.log('📊 Проверяем статус сканера с отслеживанием таймеров...');
    const statusResponse = await axios.get(`${BASE_URL}/scanner/status`);
    const status = statusResponse.data;
    
    console.log('\n📋 СТАТУС СКАНЕРА:');
    console.log('🔄 Работает:', status.isRunning);
    console.log('📅 Последнее сканирование:', status.lastScan);
    console.log('⏰ Следующее сканирование:', status.nextScan);
    console.log('🎯 Активных таймеров автоанализа:', status.activeTimeouts || 0);
    
    if (status.timeoutDetails && status.timeoutDetails.length > 0) {
      console.log('\n⏲️ ДЕТАЛИ АКТИВНЫХ ТАЙМЕРОВ:');
      status.timeoutDetails.forEach((timeout, index) => {
        console.log(`  ${index + 1}. ID: ${timeout.id}`);
        console.log(`     Создан: ${new Date(timeout.createdAt).toLocaleString()}`);
        console.log(`     Сработает: ${new Date(timeout.expectedTriggerAt).toLocaleString()}`);
        console.log(`     Осталось: ${Math.round(timeout.timeRemaining / 1000)} секунд`);
      });
    }
    
    console.log('\n✅ Сканер успешно перезапущен с отслеживанием таймеров!');
    
    if (status.nextScan) {
      const nextScanTime = new Date(status.nextScan);
      const autoAnalysisTime = new Date(nextScanTime.getTime() + 2 * 60 * 1000);
      console.log(`\n🔮 ПРОГНОЗ:`);
      console.log(`   📊 Следующее сканирование: ${nextScanTime.toLocaleString()}`);
      console.log(`   🤖 Автоанализ ожидается: ${autoAnalysisTime.toLocaleString()}`);
      console.log(`   ⏱️ До автоанализа: ${Math.round((autoAnalysisTime.getTime() - Date.now()) / 1000)} секунд`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при перезапуске сканера:', error.message);
    if (error.response) {
      console.error('📄 Детали ошибки:', error.response.data);
    }
  }
}

restartScannerWithTimeoutTracking();