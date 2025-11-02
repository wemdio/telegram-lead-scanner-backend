const fetch = require('node-fetch');

async function monitorAutoAnalysis() {
  console.log('🔍 Мониторинг автоанализа с новым логированием...');
  console.log('⏰ Время запуска:', new Date().toLocaleTimeString());
  
  let checkCount = 0;
  const maxChecks = 20; // 20 проверок по 10 секунд = 3.3 минуты
  
  const checkInterval = setInterval(async () => {
    checkCount++;
    const currentTime = new Date().toLocaleTimeString();
    
    try {
      // Получаем статус сканера
      const statusResponse = await fetch('http://localhost:3001/api/scanner/status');
      const status = await statusResponse.json();
      
      // Получаем количество лидов
      const leadsResponse = await fetch('http://localhost:3001/api/leads');
      const leads = await leadsResponse.json();
      const leadCount = Array.isArray(leads) ? leads.length : 0;
      
      console.log(`\n📊 Проверка ${checkCount}/${maxChecks} в ${currentTime}:`);
      console.log(`  🎯 Лидов найдено: ${leadCount}`);
      console.log(`  🔄 Сканер работает: ${status.isRunning}`);
      console.log(`  📅 Последний скан: ${status.lastScan ? new Date(status.lastScan).toLocaleTimeString() : 'нет'}`);
      console.log(`  ⏭️ Следующий скан: ${status.nextScan ? new Date(status.nextScan).toLocaleTimeString() : 'нет'}`);
      
      if (status.lastScan) {
        const lastScanTime = new Date(status.lastScan);
        const now = new Date();
        const timeSinceLastScan = Math.floor((now - lastScanTime) / 1000);
        const timeUntilAutoAnalysis = 120 - timeSinceLastScan; // 2 минуты = 120 секунд
        
        if (timeUntilAutoAnalysis > 0) {
          console.log(`  ⏳ До автоанализа: ${timeUntilAutoAnalysis} секунд`);
        } else {
          const overdue = Math.abs(timeUntilAutoAnalysis);
          console.log(`  ⚠️ Автоанализ должен был сработать ${overdue} секунд назад`);
          
          if (overdue > 30) {
            console.log('  ❌ Автоанализ не сработал! Проверьте логи backend сервера');
          }
        }
      }
      
      // Останавливаем мониторинг после максимального количества проверок
      if (checkCount >= maxChecks) {
        console.log('\n🏁 Мониторинг завершен');
        console.log('📝 Если автоанализ не сработал, проверьте логи backend сервера на наличие:');
        console.log('   - "🕐 Настройка setTimeout для автоанализа..."');
        console.log('   - "⏰ setTimeout callback выполняется..."');
        console.log('   - "🤖 Начинаем автоматический анализ лидов..."');
        console.log('   - Любые ошибки в try-catch блоках');
        clearInterval(checkInterval);
      }
      
    } catch (error) {
      console.error(`❌ Ошибка при проверке ${checkCount}:`, error.message);
    }
  }, 10000); // Проверяем каждые 10 секунд
  
  // Показываем текущий статус сразу
  try {
    const statusResponse = await fetch('http://localhost:3001/api/scanner/status');
    const status = await statusResponse.json();
    
    console.log('\n📋 Текущий статус:');
    console.log(`  🔄 Сканер работает: ${status.isRunning}`);
    console.log(`  📅 Последний скан: ${status.lastScan ? new Date(status.lastScan).toLocaleTimeString() : 'нет'}`);
    
    if (status.lastScan) {
      const lastScanTime = new Date(status.lastScan);
      const now = new Date();
      const timeSinceLastScan = Math.floor((now - lastScanTime) / 1000);
      const timeUntilAutoAnalysis = 120 - timeSinceLastScan;
      
      if (timeUntilAutoAnalysis > 0) {
        console.log(`  ⏳ До автоанализа: ${timeUntilAutoAnalysis} секунд`);
        console.log(`  🎯 Ожидаемое время автоанализа: ${new Date(Date.now() + timeUntilAutoAnalysis * 1000).toLocaleTimeString()}`);
      } else {
        console.log(`  ⚠️ Автоанализ должен был сработать ${Math.abs(timeUntilAutoAnalysis)} секунд назад`);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка при получении начального статуса:', error.message);
  }
}

monitorAutoAnalysis();