const axios = require('axios');

async function testScannerStart() {
    try {
        console.log('🔍 Проверка доступных чатов...');
        
        // Получаем список чатов
        const chatsResponse = await axios.get('http://localhost:3001/api/telegram/chats');
        const chats = chatsResponse.data.chats;
        
        console.log(`📋 Найдено чатов: ${chats.length}`);
        
        if (chats.length === 0) {
            console.log('❌ Нет доступных чатов для сканирования');
            console.log('💡 Проверьте авторизацию Telegram');
            return;
        }
        
        // Показываем первые 5 чатов
        console.log('\n📋 Первые 5 чатов:');
        chats.slice(0, 5).forEach((chat, index) => {
            console.log(`${index + 1}. ${chat.title} (ID: ${chat.id}, Type: ${chat.type})`);
        });
        
        // Выбираем первый групповой чат или канал для тестирования
        const testChat = chats.find(chat => chat.type === 'supergroup' || chat.type === 'channel');
        
        if (!testChat) {
            console.log('❌ Не найдено подходящих чатов для тестирования (нужны группы или каналы)');
            return;
        }
        
        console.log(`\n🎯 Тестируем сканирование чата: ${testChat.title}`);
        
        // Пытаемся запустить сканер
        const scannerData = {
            scanInterval: 1,
            selectedChats: [testChat.id]
        };
        
        console.log('🚀 Запускаем сканер...');
        const startResponse = await axios.post('http://localhost:3001/api/scanner/start', scannerData);
        
        console.log('✅ Сканер запущен успешно!');
        console.log('📊 Ответ:', startResponse.data);
        
        // Проверяем статус через 3 секунды
        setTimeout(async () => {
            try {
                const statusResponse = await axios.get('http://localhost:3001/api/scanner/status');
                console.log('\n📈 Статус сканера через 3 секунды:');
                console.log(JSON.stringify(statusResponse.data, null, 2));
            } catch (error) {
                console.log('❌ Ошибка при проверке статуса:', error.message);
            }
        }, 3000);
        
    } catch (error) {
        console.log('❌ Ошибка при тестировании сканера:');
        if (error.response) {
            console.log('📄 Статус:', error.response.status);
            console.log('📄 Данные:', error.response.data);
        } else {
            console.log('📄 Сообщение:', error.message);
        }
    }
}

testScannerStart();