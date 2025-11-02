const express = require('express');
const router = express.Router();

// Функция для отправки сообщения через Telegram Bot API
const sendTelegramMessage = async (botToken, chatId, message, parseMode = 'HTML', replyMarkup = null) => {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const body = {
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: true
    };

    // Добавляем inline клавиатуру если она передана
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`);
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Ошибка отправки сообщения в Telegram:', error);
    return { success: false, error: error.message };
  }
};

// Функция для проверки бота и канала
const testBotConnection = async (botToken, chatId) => {
  try {
    // Сначала проверяем информацию о боте
    const botInfoUrl = `https://api.telegram.org/bot${botToken}/getMe`;
    const botInfoResponse = await fetch(botInfoUrl);
    const botInfo = await botInfoResponse.json();
    
    if (!botInfoResponse.ok) {
      throw new Error(`Неверный токен бота: ${botInfo.description || 'Unknown error'}`);
    }

    // Затем пытаемся отправить тестовое сообщение
    const testMessage = `🤖 <b>Тест подключения</b>\n\nБот <b>${botInfo.result.first_name}</b> успешно подключен к каналу!\n\n<i>Время: ${new Date().toLocaleString('ru-RU')}</i>`;
    
    const sendResult = await sendTelegramMessage(botToken, chatId, testMessage);
    
    if (!sendResult.success) {
      throw new Error(`Не удалось отправить сообщение в канал: ${sendResult.error}`);
    }

    return { 
      success: true, 
      botInfo: botInfo.result,
      message: 'Подключение успешно! Тестовое сообщение отправлено в канал.'
    };
  } catch (error) {
    console.error('Ошибка тестирования бота:', error);
    return { success: false, error: error.message };
  }
};

// Функция для форматирования информации о лиде
const formatLeadMessage = (lead) => {
  // Исправляем отображение уровня уверенности - берем значение из колонки confidence
  const confidence = lead.confidence ? `${lead.confidence}%` : 'Не указан';
  
  // Форматируем дату корректно
  let formattedDate = 'Не указано';
  if (lead.timestamp) {
    try {
      let date;
      
      // Проверяем, если это формат "DD.MM.YYYY HH:MM:SS MSK" из scanner.js
      if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2} MSK$/.test(lead.timestamp)) {
        const match = lead.timestamp.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2}) MSK$/);
        if (match) {
          const [, day, month, year, hours, minutes, seconds] = match;
          // Создаем дату в московском времени
          date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`);
        }
      } else {
        // Если это другой формат, пробуем стандартный парсинг
        date = new Date(lead.timestamp);
      }
      
      if (date && !isNaN(date.getTime())) {
        formattedDate = date.toLocaleString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Ошибка форматирования даты:', error);
    }
  }
  
  // Форматируем имя пользователя с @ для создания кликабельной ссылки
  const username = lead.name || lead.username || 'Не указан';
  const formattedUsername = username !== 'Не указан' && !username.startsWith('@') ? `@${username}` : username;
  
  return `🎯 <b>Новый лид найден!</b>

👤 <b>Пользователь:</b> ${formattedUsername}
📱 <b>Канал:</b> ${lead.channel || 'Не указан'}
⏰ <b>Время сообщения:</b> ${formattedDate}
🎯 <b>Уровень уверенности:</b> ${confidence}

💬 <b>Сообщение лида:</b>
<code>${lead.message || 'Не указано'}</code>

🤖 <b>Обоснование AI:</b>
<i>${lead.reasoning || lead.reason || 'Не указано'}</i>`;
};

// Эндпоинт для тестирования подключения бота
router.post('/test', async (req, res) => {
  try {
    const { botToken, channelId } = req.body;

    if (!botToken || !channelId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать токен бота и ID канала'
      });
    }

    const result = await testBotConnection(botToken, channelId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        botInfo: result.botInfo
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Ошибка тестирования бота:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Эндпоинт для отправки уведомления о лиде
router.post('/send-lead-notification', async (req, res) => {
  try {
    const { botToken, channelId, lead } = req.body;

    console.log('📤 [DEBUG] Получен запрос на отправку лида:', {
      botToken: botToken ? `${botToken.substring(0, 10)}...` : 'нет',
      channelId: channelId,
      leadId: lead?.id,
      leadName: lead?.name
    });

    if (!botToken || !channelId || !lead) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать токен бота, ID канала и данные лида'
      });
    }

    // Проверяем на mock режим - только явные mock значения
    const isMockBotToken = !botToken ||
                          botToken === 'mock' ||
                          botToken === 'test_bot_token' ||
                          botToken === 'your_bot_token_here' ||
                          botToken === 'mock_bot_token_12345';

    const isMockChannelId = !channelId ||
                           channelId === 'mock' ||
                           channelId === 'test_channel_id' ||
                           channelId === 'your_channel_id_here' ||
                           channelId === 'mock_channel_id_67890';

    console.log('🔍 [DEBUG] Проверка mock режима:', {
      botToken: botToken,
      channelId: channelId,
      isMockBotToken: isMockBotToken,
      isMockChannelId: isMockChannelId,
      willUseMock: isMockBotToken || isMockChannelId
    });

    if (isMockBotToken || isMockChannelId) {
      // Mock режим - имитируем успешную отправку
      console.log('📤 [MOCK] Отправка лида в Telegram канал:', {
        botToken: botToken ? 'есть' : 'нет',
        channelId: channelId,
        leadName: lead.name || lead.author || lead.firstName,
        leadId: lead.id
      });

      const message = formatLeadMessage(lead);
      console.log('📝 [MOCK] Сформированное сообщение:', message.substring(0, 100) + '...');

      return res.json({
        success: true,
        message: 'Уведомление о лиде отправлено в канал (MOCK режим)',
        telegramMessageId: Math.floor(Math.random() * 1000000), // Случайный ID для mock
        mockMode: true
      });
    }

    const message = formatLeadMessage(lead);
    
    // Создаем inline кнопку "Написать" для перехода в чат с лидом
    const replyMarkup = {
      inline_keyboard: [[
        {
          text: "✍️ Написать",
          url: lead.username ? `https://t.me/${lead.username.replace('@', '')}` : `tg://user?id=${lead.userId || ''}`
        }
      ]]
    };
    
    const result = await sendTelegramMessage(botToken, channelId, message, 'HTML', replyMarkup);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Уведомление о лиде отправлено в канал',
        telegramMessageId: result.data.result.message_id
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Ошибка отправки уведомления о лиде:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

module.exports = router;