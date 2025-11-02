const axios = require('axios');

async function createTestLeads() {
  try {
    console.log('🧪 Creating test leads...');
    
    const testLeads = [
      {
        name: 'Бизнес Пользователь',
        username: 'business_user',
        channel: 'Business Chat',
        message: 'Ищу поставщика качественных товаров для своего магазина. Готов к долгосрочному сотрудничеству. Бюджет до 500к рублей.',
        timestamp: '2025-01-07T21:00:00.000Z',
        reason: 'Ищет поставщика для бизнеса',
        confidence: 85,
        sent: false
      },
      {
        name: 'Иван Инвестор',
        username: 'investor_ivan',
        channel: 'Investment Group',
        message: 'Рассматриваю инвестиции в перспективные стартапы. Интересуют IT и e-commerce проекты.',
        timestamp: '2025-01-07T20:30:00.000Z',
        reason: 'Потенциальный инвестор',
        confidence: 90,
        sent: false
      },
      {
        name: 'Анна Смирнова',
        username: 'anna_smirnova',
        channel: 'Partnership Hub',
        message: 'Ищу партнера для открытия франшизы кофейни. Есть опыт в ресторанном бизнесе.',
        timestamp: '2025-01-07T19:45:00.000Z',
        reason: 'Ищет бизнес-партнера',
        confidence: 80,
        sent: false
      }
    ];

    console.log('📤 Sending test leads to /api/leads/store...');
    
    const response = await axios.post('http://localhost:3001/api/leads/store', {
      leads: testLeads,
      analysisTimestamp: new Date().toISOString(),
      criteria: 'Тестовые лиды для проверки функциональности'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Test leads created successfully:');
    console.log('📊 Response:', response.data);
    
    // Verify leads were stored
    const statusResponse = await axios.get('http://localhost:3001/api/leads/status');
    console.log('📋 Current leads count:', statusResponse.data.totalLeads);
    
  } catch (error) {
    console.error('❌ Error creating test leads:', error.response?.data || error.message || error);
    if (error.code) {
      console.error('🔍 Error code:', error.code);
    }
    if (error.response) {
      console.error('📡 Response status:', error.response.status);
      console.error('📡 Response headers:', error.response.headers);
    }
  }
}

createTestLeads();