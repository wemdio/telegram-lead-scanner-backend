const axios = require('axios');

function checkForDuplicateLeads(newLeads) {
  console.log('🔍 Проверяем дубликаты лидов...');
  
  const uniqueLeads = [];
  const duplicates = [];
  const seenLeads = new Set();
  
  for (const lead of newLeads) {
    // Создаем уникальный ключ для лида на основе имени пользователя и сообщения
    const leadKey = `${lead.name || 'unknown'}_${(lead.message || '').substring(0, 100)}`;
    
    console.log(`Проверяем лид: name="${lead.name}", leadKey="${leadKey}"`);
    
    if (seenLeads.has(leadKey)) {
      duplicates.push(lead);
      console.log(`🔄 Найден дубликат лида: ${lead.name} - ${(lead.message || '').substring(0, 50)}...`);
    } else {
      seenLeads.add(leadKey);
      uniqueLeads.push(lead);
      console.log(`✅ Уникальный лид добавлен: ${lead.name}`);
    }
  }
  
  console.log(`✅ Уникальных лидов: ${uniqueLeads.length}, дубликатов: ${duplicates.length}`);
  
  return {
    uniqueLeads,
    duplicates,
    duplicateCount: duplicates.length
  };
}

async function debugDuplicateCheck() {
  try {
    console.log('🔍 Тестируем логику проверки дубликатов...\n');

    // Получаем лиды из системы
    const leadsResponse = await axios.get('http://localhost:3001/api/leads');
    const leads = leadsResponse.data.leads;
    console.log(`Всего лидов: ${leads.length}\n`);
    
    // Фильтруем неотправленные лиды
    const newLeads = leads.filter(lead => lead.sent !== true);
    console.log(`Неотправленных лидов: ${newLeads.length}\n`);
    
    newLeads.forEach((lead, index) => {
      console.log(`Лид ${index}: name="${lead.name}", sent=${lead.sent}, message="${(lead.message || '').substring(0, 50)}..."`);
    });
    
    console.log('\n--- Проверка дубликатов ---');
    
    // Проверяем дубликаты
    const duplicateCheck = checkForDuplicateLeads(newLeads);
    
    console.log('\n--- Результат ---');
    console.log(`Уникальных лидов для отправки: ${duplicateCheck.uniqueLeads.length}`);
    console.log(`Дубликатов найдено: ${duplicateCheck.duplicateCount}`);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

debugDuplicateCheck();