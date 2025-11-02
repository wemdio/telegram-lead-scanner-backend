const axios = require('axios');

async function checkTelegramConnection() {
  console.log('🔍 Проверка подключения к Telegram...\n');

  try {
    // 1. Проверяем статус подключения к Telegram
    console.log('1️⃣ Статус подключения к Telegram:');
    const telegramStatus = await axios.get('http://localhost:3001/api/telegram/status');
    console.log(`   Подключен: ${telegramStatus.data.connected ? 'Да' : 'Нет'}`);
    console.log(`   Авторизован: ${telegramStatus.data.authorized ? 'Да' : 'Нет'}`);
    console.log(`   Сессия активна: ${telegramStatus.data.sessionActive ? 'Да' : 'Нет'}`);

    // 2. Проверяем доступные чаты
    console.log('\n2️⃣ Доступные чаты:');
    try {
      const chatsResponse = await axios.get('http://localhost:3001/api/telegram/chats');
      const chats = chatsResponse.data.chats || [];
      console.log(`   Всего чатов: ${chats.length}`);
      
      if (chats.length > 0) {
        console.log('   Первые 5 чатов:');
        chats.slice(0, 5).forEach((chat, index) => {
          console.log(`     ${index + 1}. ${chat.title || chat.name || 'Без названия'} (ID: ${chat.id})`);
        });
      } else {
        console.log('   ⚠️ Чаты не найдены');
      }
    } catch (chatsError) {
      console.log(`   ❌ Ошибка получения чатов: ${chatsError.message}`);
    }

    // 3. Тестируем получение сообщений из первого доступного чата
    console.log('\n3️⃣ Тест получения сообщений:');
    try {
      const chatsResponse = await axios.get('http://localhost:3001/api/telegram/chats');
      const chats = chatsResponse.data.chats || [];
      
      if (chats.length > 0) {
        const firstChat = chats[0];
        console.log(`   Тестируем чат: ${firstChat.title || firstChat.name} (ID: ${firstChat.id})`);
        
        const messagesResponse = await axios.post('http://localhost:3001/api/telegram/messages', {
          chatId: firstChat.id,
          limit: 10
        });
        
        const messages = messagesResponse.data.messages || [];
        console.log(`   Получено сообщений: ${messages.length}`);
        
        if (messages.length > 0) {
          console.log('   Последние 3 сообщения:');
          messages.slice(0, 3).forEach((msg, index) => {
            const date = new Date(msg.date * 1000).toLocaleString('ru-RU');
            const text = msg.message ? msg.message.substring(0, 50) + '...' : 'Без текста';
            console.log(`     ${index + 1}. ${date}: ${text}`);
          });
        } else {
          console.log('   ⚠️ Сообщения не найдены');
        }
      } else {
        console.log('   ⚠️ Нет доступных чатов для тестирования');
      }
    } catch (messagesError) {
      console.log(`   ❌ Ошибка получения сообщений: ${messagesError.message}`);
    }

    // 4. Проверяем настройки автосканирования
    console.log('\n4️⃣ Настройки автосканирования:');
    const cronStatus = await axios.get('http://localhost:3001/api/cron/status');
    console.log(`   Cron активен: ${cronStatus.data.active ? 'Да' : 'Нет'}`);
    console.log(`   Интервал: ${cronStatus.data.interval || 'Не установлен'}`);
    console.log(`   Следующий запуск: ${cronStatus.data.nextRun || 'Неизвестно'}`);

    // 5. Проверяем последние логи сканера
    console.log('\n5️⃣ История сканирований:');
    const scanHistory = await axios.get('http://localhost:3001/api/scanner/history');
    const history = scanHistory.data.history || [];
    
    if (history.length > 0) {
      console.log('   Последние 5 сканирований:');
      history.slice(-5).forEach((scan, index) => {
        const date = new Date(scan.timestamp).toLocaleString('ru-RU');
        console.log(`     ${index + 1}. ${date}: ${scan.messagesProcessed || 0} сообщений, ${scan.leadsFound || 0} лидов`);
        if (scan.error) {
          console.log(`        ❌ Ошибка: ${scan.error}`);
        }
      });
    }

    console.log('\n✅ Проверка подключения завершена!');

  } catch (error) {
    console.error('❌ Ошибка при проверке подключения:', error.message);
    if (error.response) {
      console.error('   Статус:', error.response.status);
      console.error('   Данные:', error.response.data);
    }
  }
}

checkTelegramConnection();