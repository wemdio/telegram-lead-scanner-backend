const axios = require('axios');
require('dotenv').config();

async function testLeadAnalysis() {
  try {
    console.log('🧪 Testing lead analysis endpoint...');
    
    const testData = {
      messages: [
        {
          id: 'msg_001',
          timestamp: '2025-01-07T21:00:00.000Z',
          chatTitle: 'Business Chat',
          username: 'business_user',
          firstName: 'Иван',
          lastName: 'Петров',
          userId: '123456',
          message: 'Ищу поставщика качественных товаров для своего магазина. Готов к долгосрочному сотрудничеству. Бюджет до 500к рублей.',
          chatId: 'business_chat_1'
        },
        {
          id: 'msg_002',
          timestamp: '2025-01-07T21:05:00.000Z',
          chatTitle: 'Business Chat',
          username: 'entrepreneur',
          firstName: 'Мария',
          lastName: 'Сидорова',
          userId: '789012',
          message: 'Открываю новый ресторан, нужны партнеры для инвестиций. Проект очень перспективный!',
          chatId: 'business_chat_1'
        },
        {
          id: 'msg_003',
          timestamp: '2025-01-07T21:10:00.000Z',
          chatTitle: 'Random Chat',
          username: 'casual_user',
          firstName: 'Петр',
          lastName: 'Иванов',
          userId: '345678',
          message: 'Привет всем! Как дела? Погода сегодня отличная.',
          chatId: 'random_chat_1'
        }
      ],
      criteria: 'Ищите людей, которые ищут поставщиков, партнеров для бизнеса, инвестиции, или выражают коммерческий интерес',
      geminiApiKey: process.env.OPENROUTER_API_KEY
    };

    if (!testData.geminiApiKey) {
      console.error('❌ OPENROUTER_API_KEY not found in environment variables');
      return;
    }

    console.log('📤 Sending request to /api/leads/analyze...');
    console.log('📊 Test messages count:', testData.messages.length);
    console.log('🎯 Criteria:', testData.criteria);
    
    const response = await axios.post('http://localhost:3001/api/leads/analyze', testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Response received:');
    console.log('📈 Total analyzed:', response.data.totalAnalyzed);
    console.log('🎯 Leads found:', response.data.leads.length);
    
    if (response.data.leads.length > 0) {
      console.log('\n📋 Lead details:');
      response.data.leads.forEach((lead, index) => {
        console.log(`\n🔍 Lead ${index + 1}:`);
        console.log(`   👤 User: ${lead.firstName} ${lead.lastName} (@${lead.username})`);
        console.log(`   💬 Message: ${lead.message}`);
        console.log(`   ⭐ Score: ${lead.score}`);
        console.log(`   📝 Reason: ${lead.reason}`);
        console.log(`   💰 Budget: ${lead.budget || 'Not specified'}`);
        console.log(`   📞 Contact: ${lead.contactInfo || 'Not specified'}`);
      });
    } else {
      console.log('ℹ️ No leads found in the test messages');
    }

  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📄 Response:', error.response.data);
    } else {
      console.error('🔥 Error:', error.message);
    }
  }
}

// Run the test
testLeadAnalysis();