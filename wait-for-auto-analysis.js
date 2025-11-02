console.log('⏰ Ждем автоанализ через 2 минуты после сканирования (01:03)...');
console.log('🔍 Автоанализ должен сработать в 01:05');

let timeElapsed = 0;
const interval = setInterval(() => {
    timeElapsed += 30;
    const minutes = Math.floor(timeElapsed / 60);
    const seconds = timeElapsed % 60;
    console.log(`⏳ Прошло: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    if (timeElapsed >= 150) { // 2.5 минуты
        console.log('⏰ 2.5 минуты прошли! Автоанализ должен был сработать.');
        clearInterval(interval);
        process.exit(0);
    }
}, 30000); // каждые 30 секунд

setTimeout(() => {
    console.log('⏰ 2 минуты прошли! Проверяем результат...');
}, 120000);