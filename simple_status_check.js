const axios = require('axios');

async function checkStatus() {
    try {
        console.log('🔍 Проверяем статус сервера на порту 3001...');
        
        // Проверяем лиды
        const leadsResponse = await axios.get('http://localhost:3001/api/leads');
        console.log('✅ Сервер работает!');
        console.log('📊 Данные лидов:', typeof leadsResponse.data, Array.isArray(leadsResponse.data) ? `массив из ${leadsResponse.data.length} элементов` : 'не массив');
        
        if (Array.isArray(leadsResponse.data)) {
            const leads = leadsResponse.data;
            console.log(`\n📋 Всего лидов: ${leads.length}`);
            
            // Показываем последние 3 лида
            console.log('\n🔍 Последние 3 лида:');
            leads.slice(-3).forEach((lead, index) => {
                console.log(`${index + 1}. ID: ${lead.id || 'нет'}, Name: ${lead.name || 'undefined'}, Sent: ${lead.sent || 'undefined'}`);
            });
            
            // Статистика по статусу отправки
            const sentCount = leads.filter(l => l.sent === true).length;
            const unsentCount = leads.filter(l => l.sent !== true).length;
            console.log(`\n📈 Статистика: отправлено ${sentCount}, не отправлено ${unsentCount}`);
        }
        
        // Проверяем настройки Telegram
        console.log('\n🤖 Проверяем настройки Telegram...');
        const telegramResponse = await axios.get('http://localhost:3001/api/settings/telegram');
        console.log(`Bot Token: ${telegramResponse.data.botToken ? 'установлен' : 'не установлен'}`);
        console.log(`Channel ID: ${telegramResponse.data.channelId || 'не установлен'}`);
        
        // Тестируем cron job
        console.log('\n⏰ Запускаем cron job...');
        const cronResponse = await axios.post('http://localhost:3001/api/cron/send-new-leads');
        console.log('Результат cron job:', JSON.stringify(cronResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Данные:', error.response.data);
        }
    }
}

checkStatus();