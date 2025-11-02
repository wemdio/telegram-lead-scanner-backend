const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function monitorTimeoutExecution() {
  console.log('🔍 Мониторинг выполнения таймера автоанализа...');
  
  let checkCount = 0;
  const maxChecks = 25; // Максимум 25 проверок (около 4 минут)
  
  const monitorInterval = setInterval(async () => {
    checkCount++;
    
    try {
      const statusResponse = await axios.get(`${BASE_URL}/scanner/status`);
      const status = statusResponse.data;
      
      const now = new Date();
      console.log(`\n📊 ПРОВЕРКА #${checkCount} (${now.toLocaleTimeString()})`);
      console.log('🎯 Активных таймеров:', status.activeTimeouts || 0);
      
      if (status.timeoutDetails && status.timeoutDetails.length > 0) {
        status.timeoutDetails.forEach((timeout, index) => {
          const timeRemaining = Math.round(timeout.timeRemaining / 1000);
          const expectedTime = new Date(timeout.expectedTriggerAt);
          
          console.log(`  ⏲️ Таймер ${index + 1}:`);
          console.log(`     ID: ${timeout.id}`);
          console.log(`     Ожидается: ${expectedTime.toLocaleTimeString()}`);
          
          if (timeRemaining > 0) {
            console.log(`     ⏳ Осталось: ${timeRemaining} секунд`);
          } else {
            const overdue = Math.abs(timeRemaining);
            console.log(`     ⚠️ Просрочен на: ${overdue} секунд`);
            
            if (overdue > 30) {
              console.log('     ❌ ТАЙМЕР НЕ СРАБОТАЛ! Превышение 30 секунд');
            }
          }
        });
      } else {
        console.log('✅ Нет активных таймеров (возможно, сработал и был удален)');
      }
      
      // Проверяем, не закончились ли проверки
      if (checkCount >= maxChecks) {
        console.log('\n⏰ Достигнуто максимальное количество проверок');
        clearInterval(monitorInterval);
        
        // Финальная проверка
        await performFinalCheck();
        return;
      }
      
      // Если нет активных таймеров, возможно они сработали
      if (status.activeTimeouts === 0) {
        console.log('\n🎉 Все таймеры завершены! Проверяем результат...');
        clearInterval(monitorInterval);
        
        // Финальная проверка
        await performFinalCheck();
        return;
      }
      
    } catch (error) {
      console.error(`❌ Ошибка при проверке #${checkCount}:`, error.message);
    }
    
  }, 10000); // Проверка каждые 10 секунд
  
  console.log('⏰ Начинаем мониторинг каждые 10 секунд...');
  console.log('🛑 Для остановки нажмите Ctrl+C');
}

async function performFinalCheck() {
  console.log('\n🔍 ФИНАЛЬНАЯ ПРОВЕРКА:');
  
  try {
    // Проверяем статус сканера
    const statusResponse = await axios.get(`${BASE_URL}/scanner/status`);
    const status = statusResponse.data;
    
    console.log('📊 Финальный статус:');
    console.log('   🎯 Активных таймеров:', status.activeTimeouts || 0);
    console.log('   📅 Последнее сканирование:', status.lastScan);
    console.log('   ⏰ Следующее сканирование:', status.nextScan);
    
    // Проверяем количество лидов
    const leadsResponse = await axios.get(`${BASE_URL}/leads`);
    const leads = leadsResponse.data;
    
    console.log('📈 Результаты анализа:');
    console.log('   🎯 Всего лидов:', leads.length || 0);
    
    if (leads.length > 0) {
      console.log('   ✅ АВТОАНАЛИЗ СРАБОТАЛ! Найдены новые лиды');
      const latestLead = leads[leads.length - 1];
      console.log('   📝 Последний лид:', {
        name: latestLead.name,
        timestamp: latestLead.timestamp,
        source: latestLead.source
      });
    } else {
      console.log('   ⚠️ Лиды не найдены (возможно, нет подходящих сообщений)');
    }
    
  } catch (error) {
    console.error('❌ Ошибка финальной проверки:', error.message);
  }
  
  console.log('\n🏁 Мониторинг завершен');
}

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Мониторинг остановлен пользователем');
  process.exit(0);
});

monitorTimeoutExecution();