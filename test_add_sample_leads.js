const axios = require('axios');

async function addSampleLeads() {
  try {
    console.log('🧪 Добавляем тестовые лиды в систему...');
    
    // 1. Создаем тестовые лиды
    const sampleLeads = [
      {
        id: 'lead-1',
        name: 'Иван Петров',
        username: '@ivan_petrov',
        message: 'Ищу поставщика качественных товаров для своего магазина',
        channel: 'test_channel',
        timestamp: new Date().toISOString(),
        sent: false
      },
      {
        id: 'lead-2', 
        name: 'Мария Сидорова',
        username: '@maria_sid',
        message: 'Нужен надежный партнер для долгосрочного сотрудничества',
        channel: 'test_channel',
        timestamp: new Date().toISOString(),
        sent: false
      },
      {
        id: 'lead-3',
        name: 'Алексей Козлов',
        username: '@alex_kozlov',
        message: 'Интересуют оптовые поставки, большие объемы',
        channel: 'test_channel',
        timestamp: new Date().toISOString(),
        sent: false
      },
      // Дубликат первого лида (для тестирования системы дубликатов)
      {
        id: 'lead-4',
        name: 'Иван Петров',
        username: '@ivan_petrov',
        message: 'Ищу поставщика качественных товаров для своего магазина',
        channel: 'test_channel',
        timestamp: new Date().toISOString(),
        sent: false
      }
    ];
    
    console.log('\n1. Добавляем тестовые лиды через store API...');
    
    // Добавляем лиды напрямую через store API
    const storeResponse = await axios.post('http://localhost:3001/api/leads/store', {
      leads: sampleLeads,
      analysisTimestamp: new Date().toISOString(),
      criteria: 'Тестовые лиды для проверки дубликатов'
    });
    
    console.log('Результат сохранения лидов:', storeResponse.data);
    
    // 2. Проверяем добавленные лиды
    console.log('\n2. Проверяем добавленные лиды...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads || [];
    console.log(`Найдено лидов в системе: ${leads.length}`);
    
    if (leads.length > 0) {
      console.log('Добавленные лиды:');
      leads.forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} (@${lead.username}) - ${lead.message?.substring(0, 50)}...`);
      });
    }
    
    console.log('\n✅ Тестовые лиды успешно добавлены');
    
  } catch (error) {
    console.error('❌ Ошибка при добавлении тестовых лидов:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

addSampleLeads();