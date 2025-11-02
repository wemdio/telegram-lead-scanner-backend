const axios = require('axios');

async function checkServerLogs() {
    try {
        console.log('🔍 Проверяем статус сервера...');
        
        // Проверяем статус сервера через endpoint лидов
        const healthResponse = await axios.get('http://localhost:3001/api/leads');
        console.log('✅ Сервер работает, получено лидов:', healthResponse.data.length);
        
        // Проверяем текущие лиды
        const leadsResponse = healthResponse;
        console.log('\n📊 Статистика лидов:');
        console.log(`Всего лидов: ${leadsResponse.data.length}`);
        
        const sentLeads = leadsResponse.data.filter(lead => lead.sent === true);
        const unsentLeads = leadsResponse.data.filter(lead => lead.sent !== true);
        
        console.log(`Отправленных: ${sentLeads.length}`);
        console.log(`Неотправленных: ${unsentLeads.length}`);
        
        // Показываем последние 5 лидов
        console.log('\n📋 Последние 5 лидов:');
        leadsResponse.data.slice(-5).forEach((lead, index) => {
            console.log(`${index + 1}. ID: ${lead.id}, Name: ${lead.name || 'undefined'}, Sent: ${lead.sent}`);
        });
        
        // Проверяем настройки Telegram
        const telegramResponse = await axios.get('http://localhost:3001/api/settings/telegram');
        console.log('\n🤖 Настройки Telegram:');
        console.log(`Bot Token: ${telegramResponse.data.botToken ? telegramResponse.data.botToken.substring(0, 20) + '...' : 'не установлен'}`);
        console.log(`Channel ID: ${telegramResponse.data.channelId || 'не установлен'}`);
        
        // Тестируем cron job
        console.log('\n⏰ Тестируем cron job...');
        const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
        console.log('Результат cron job:', cronResponse.data);
        
    } catch (error) {
        console.error('❌ Ошибка при проверке сервера:', error.message);
        if (error.response) {
            console.error('Статус ответа:', error.response.status);
            console.error('Данные ответа:', error.response.data);
        }
    }
}

checkServerLogs();