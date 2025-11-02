const axios = require('axios');

async function debugLeadsRetrieval() {
  try {
    console.log('🔍 Диагностика получения лидов из Google Sheets...');
    
    // 1. Проверяем настройки Google Sheets
    console.log('\n1️⃣ Проверяем настройки Google Sheets...');
    try {
      const settingsResponse = await axios.get('http://localhost:3001/api/settings/google-sheets');
      console.log('📊 Настройки Google Sheets:', settingsResponse.data);
      
      if (settingsResponse.data.success && settingsResponse.data.spreadsheetId) {
        const spreadsheetId = settingsResponse.data.spreadsheetId;
        console.log(`✅ SpreadsheetId найден: ${spreadsheetId}`);
        
        // 2. Получаем лиды из Google Sheets
        console.log('\n2️⃣ Получаем лиды из Google Sheets...');
        const leadsResponse = await axios.get(`http://localhost:3001/api/sheets/leads/${spreadsheetId}`);
        console.log('📋 Ответ API лидов:', JSON.stringify(leadsResponse.data, null, 2));
        
        const leads = leadsResponse.data.leads;
        console.log(`📊 Всего лидов: ${leads ? leads.length : 'undefined'}`);
        
        if (leads && leads.length > 0) {
          console.log('\n3️⃣ Анализ лидов:');
          leads.forEach((lead, index) => {
            console.log(`Лид ${index + 1}:`, {
              name: lead.name,
              channel: lead.channel,
              timestamp: lead.timestamp,
              sent: lead.sent,
              sentType: typeof lead.sent
            });
          });
          
          // 4. Фильтруем неотправленные лиды
          console.log('\n4️⃣ Фильтрация неотправленных лидов...');
          const newLeads = leads.filter(lead => lead.sent !== true);
          console.log(`🔍 Неотправленных лидов: ${newLeads.length}`);
          
          if (newLeads.length > 0) {
            console.log('📋 Первый неотправленный лид:', JSON.stringify(newLeads[0], null, 2));
          }
        } else {
          console.log('❌ Лиды не найдены или массив пустой');
        }
        
      } else {
        console.log('❌ SpreadsheetId не найден в настройках');
      }
      
    } catch (error) {
      console.error('❌ Ошибка при получении настроек:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка диагностики:', error.message);
    if (error.response) {
      console.error('📋 Детали ошибки:', error.response.data);
    }
  }
}

debugLeadsRetrieval();