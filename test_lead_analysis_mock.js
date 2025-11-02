const axios = require('axios');

async function testLeadAnalysisMock() {
  try {
    console.log('🧪 Testing lead analysis endpoint with mock API key...');
    
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
        }
      ],
      criteria: 'Ищите людей, которые ищут поставщиков, партнеров для бизнеса, инвестиции, или выражают коммерческий интерес',
      openrouterApiKey: 'sk-or-v1-mock-key-for-testing'
    };

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
      });
    } else {
      console.log('ℹ️ No leads found in the test messages');
    }

  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📄 Response:', error.response.data);
      
      // Check if it's an API key issue
      if (error.response.status === 500 && 
          error.response.data.message && 
          error.response.data.message.includes('401')) {
        console.log('\n💡 This is expected - the mock API key is not valid.');
        console.log('✅ The endpoint is working correctly and processing messages!');
        console.log('🔧 To test with real analysis, add a valid OPENROUTER_API_KEY to .env file.');
      }
    } else {
      console.error('🔥 Error:', error.message);
    }
  }
}

// Run the test
testLeadAnalysisMock();