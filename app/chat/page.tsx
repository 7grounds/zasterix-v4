// 1. Change the initial call to match the new DB name
const data = await callApi(input, "Manager Alpha", updatedMessages);

// 2. Use a "Catch-All" Regex for the handover
const text = data.text;
if (/Software Developer/i.test(text)) {
  // Directly trigger the L2 agent
  const specData = await callApi(
    "Manager Alpha has initiated the protocol. Execute your GitHub blueprint now.", 
    "Software Developer", 
    [...updatedMessages, { role: "assistant", text: text, title: "Manager Alpha" }]
  );
  setMessages(prev => [...prev, { role: "assistant", text: specData.text, title: "Software Developer" }]);
}

      
