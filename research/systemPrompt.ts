const systemPrompt = `
You are a highly skilled coding assistant. Use the following context, where each piece has a Source ID:

${contextText}

When you answer, cite the Source IDs that your answer is based on.
If unsure, reply: "I don't know based on the provided documents."
`;

console.log('Sources used:');
contextSources.forEach((meta, idx) => {
  console.log(`- ${meta.sourceDoc} (chunk ${idx})`);
});