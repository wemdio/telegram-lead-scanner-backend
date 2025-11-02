const axios = require('axios');

async function checkTelegramAuth() {
  console.log('🔍 Проверка авторизации Telegram...\n');

  try {
    // 1. Проверяем настройки Telegram
    console.log('1️⃣ Проверка настроек Telegram:');
    const settingsResponse = await axios.get('http://localhost:3001/api/settings/telegram');
    const settings = settingsResponse.data;
    
    console.log(`   Bot Token: ${settings.botToken ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`);
    console.log(`   Channel ID: ${settings.channelId ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`);
    
    if (!settings.botToken || !settings.channelId) {
      console.log('❌ Настройки Telegram не полные!\n');
      return;
    }

    // 2. Проверяем статус подключения
    console.log('\n2️⃣ Проверка статуса подключения:');
    try {
      const statusResponse = await axios.get('http://localhost:3001/api/telegram/status');
      const status = statusResponse.data;
      
      console.log(`   Подключен: ${status.connected ? 'Да' : 'НЕТ'}`);
      console.log(`   Авторизован: ${status.success ? 'Да' : 'НЕТ'}`);
      
      if (status.user) {
        console.log(`   Пользователь: ${status.user.firstName} ${status.user.lastName || ''}`);
        console.log(`   Username: @${status.user.username || 'не указан'}`);
        console.log(`   Phone: ${status.user.phone || 'не указан'}`);
      }
      
      if (!status.connected || !status.success) {
        console.log('❌ Telegram не авторизован или не подключен!');
        console.log('   Сообщение:', status.message);
        console.log('   Ошибка:', status.error);
      }
    } catch (statusError) {
      console.log('❌ Ошибка проверки статуса:', statusError.response?.data?.message || statusError.message);
    }

    // 3. Пытаемся получить список чатов
    console.log('\n3️⃣ Проверка доступа к чатам:');
    try {
      const chatsResponse = await axios.get('http://localhost:3001/api/telegram/chats');
      const chats = chatsResponse.data.chats;
      
      console.log(`   Найдено чатов: ${chats.length}`);
      
      if (chats.length > 0) {
        console.log('   Первые 5 чатов:');
        chats.slice(0, 5).forEach((chat, index) => {
          console.log(`     ${index + 1}. ${chat.title} (${chat.type}) - ID: ${chat.id}`);
        });
      } else {
        console.log('   ❌ Чаты не найдены!');
      }
    } catch (chatsError) {
      console.log('❌ Ошибка получения чатов:', chatsError.response?.data?.message || chatsError.message);
      
      if (chatsError.response?.status === 401) {
        console.log('   🔑 Требуется авторизация Telegram!');
      }
    }

    // 4. Проверяем инициализацию клиента
    console.log('\n4️⃣ Проверка инициализации клиента:');
    try {
      const initResponse = await axios.post('http://localhost:3001/api/telegram/initialize', {
        apiId: settings.apiId || '12345678',
        apiHash: settings.apiHash || 'test_hash',
        sessionString: settings.sessionString || ''
      });
      
      console.log(`   Инициализация: ${initResponse.data.success ? 'Успешно' : 'Неудачно'}`);
      console.log(`   Сообщение: ${initResponse.data.message}`);
      
      if (initResponse.data.sessionString) {
        console.log(`   Session String: ${initResponse.data.sessionString.substring(0, 50)}...`);
      }
    } catch (initError) {
      console.log('❌ Ошибка инициализации:', initError.response?.data?.message || initError.message);
    }

    console.log('\n📋 Рекомендации:');
    console.log('1. Убедитесь, что у вас есть валидные API ID и API Hash от Telegram');
    console.log('2. Убедитесь, что у вас есть валидная Session String');
    console.log('3. Проверьте, что Telegram аккаунт не заблокирован');
    console.log('4. Попробуйте переавторизоваться через интерфейс приложения');

  } catch (error) {
    console.error('❌ Общая ошибка проверки:', error.message);
  }
}

checkTelegramAuth().catch(console.error);