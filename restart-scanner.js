const axios = require('axios');

async function restartScanner() {
    try {
        console.log('Остановка сканера...');
        
        // Остановка сканера
        const stopResponse = await axios.post('http://localhost:3001/api/scanner/stop');
        console.log('Сканер остановлен:', stopResponse.data);
        
        // Ждем немного перед перезапуском
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Запуск сканера...');
        
        // Запуск сканера с минимальными требуемыми параметрами
        const startResponse = await axios.post('http://localhost:3001/api/scanner/start', {
            scanInterval: '1h',
            selectedChats: ['@leadscanner_test'], // Минимальный чат для запуска
            leadAnalysisSettings: {
                openrouterApiKey: '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',
                leadCriteria: 'любые лиды'
            }
        });
        
        console.log('Сканер запущен:', startResponse.data);
        
        // Проверяем статус
        const statusResponse = await axios.get('http://localhost:3001/api/scanner/status');
        console.log('Статус сканера:', statusResponse.data);
        
        console.log('\nПерезапуск завершен. setTimeout для автоанализа должен быть восстановлен.');
        console.log('Автоанализ будет запущен через 2 минуты после следующего сканирования.');
        
    } catch (error) {
        console.error('Ошибка при перезапуске сканера:', error.message);
        if (error.response) {
            console.error('Ответ сервера:', error.response.data);
        }
    }
}

restartScanner();