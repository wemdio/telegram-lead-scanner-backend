const fs = require('fs');
const path = require('path');

async function monitorAutoAnalysis() {
  console.log('🔍 Мониторинг автоанализа...\n');
  
  let checkCount = 0;
  const maxChecks = 15; // 15 проверок по 10 секунд = 2.5 минуты
  
  const startTime = new Date();
  console.log(`⏰ Начало мониторинга: ${startTime.toLocaleTimeString()}`);
  console.log('📊 Ручной скан выполнен в: 01:59:59');
  console.log('🎯 Ожидаем автоанализ через 2 минуты (примерно в 02:01:59)\n');

  const interval = setInterval(async () => {
    checkCount++;
    const currentTime = new Date();
    
    try {
      console.log(`\n🔄 Проверка ${checkCount}/${maxChecks} - ${currentTime.toLocaleTimeString()}`);
      
      // Проверяем количество лидов
      const leadsResponse = await fetch('http://localhost:3001/api/leads');
      const leadsData = await leadsResponse.json();
      const leads = leadsData.leads || [];
      
      console.log(`📊 Найдено лидов: ${leads.length}`);
      
      if (leads.length > 0) {
        console.log('\n🎉 АВТОАНАЛИЗ СРАБОТАЛ! Найдены новые лиды:');
        leads.slice(0, 5).forEach((lead, index) => {
          console.log(`  ${index + 1}. ${lead.name || 'Без имени'} - ${lead.reason || 'Без причины'}`);
          console.log(`     Создан: ${new Date(lead.createdAt).toLocaleTimeString()}`);
        });
        
        clearInterval(interval);
        console.log('\n✅ Мониторинг завершен - автоанализ работает корректно!');
        return;
      }
      
      // Проверяем статус сканера
      const statusResponse = await fetch('http://localhost:3001/api/scanner/status');
      const status = await statusResponse.json();
      
      console.log(`  - Сканер работает: ${status.isRunning}`);
      console.log(`  - Последний скан: ${new Date(status.lastScan).toLocaleTimeString()}`);
      console.log(`  - Всего сообщений: ${status.totalMessages}`);
      
      // Вычисляем время до следующего автоанализа
      const lastScanTime = new Date(status.lastScan);
      const expectedAnalysisTime = new Date(lastScanTime.getTime() + 2 * 60 * 1000); // +2 минуты
      const timeUntilAnalysis = expectedAnalysisTime.getTime() - currentTime.getTime();
      
      if (timeUntilAnalysis > 0) {
        const secondsLeft = Math.floor(timeUntilAnalysis / 1000);
        console.log(`  ⏳ До автоанализа: ${secondsLeft} секунд`);
      } else {
        console.log(`  ⚠️ Автоанализ должен был сработать ${Math.abs(Math.floor(timeUntilAnalysis / 1000))} секунд назад`);
      }
      
      if (checkCount >= maxChecks) {
        console.log('\n❌ АВТОАНАЛИЗ НЕ СРАБОТАЛ за отведенное время');
        console.log('\n🔍 Возможные причины:');
        console.log('1. setTimeout не установлен после скана');
        console.log('2. Ошибка в функции triggerAutomaticAnalysis()');
        console.log('3. Проблема с OpenRouter API ключом');
        console.log('4. Нет новых сообщений для анализа');
        console.log('5. Ошибка в обработке ответа от AI');
        
        console.log('\n💡 Рекомендации:');
        console.log('1. Проверьте логи backend сервера');
        console.log('2. Убедитесь, что OpenRouter API ключ корректный');
        console.log('3. Проверьте наличие новых сообщений в чатах');
        
        clearInterval(interval);
      }
      
    } catch (error) {
      console.error(`❌ Ошибка при проверке ${checkCount}: ${error.message}`);
      
      if (checkCount >= maxChecks) {
        clearInterval(interval);
      }
    }
  }, 10000); // Проверяем каждые 10 секунд
}

monitorAutoAnalysis();