async function answerQuestion(question: string) {
  try {
    const questionEmbedding = await embedTexts([question]);
    const searchResults = await collection.query({
      queryEmbeddings: questionEmbedding,
      nResults: 5,
      include: ['documents', 'metadatas'],
    });

    const contextChunks = searchResults.documents.flat();
    const contextMetadatas = searchResults.metadatas.flat();

    if (!contextChunks.length) {
      console.log('No relevant documents found.');
      return;
    }

    const contextText = contextChunks
      .map((chunk, idx) => {
        const meta = contextMetadatas[idx];
        return `Source (${meta.sourceDoc}):\n${chunk}`;
      })
      .join('\n\n');

    const systemPrompt = `
You are a highly skilled coding assistant. Use ONLY the following context to answer:

${contextText}

If the answer cannot be found, say: "I don't know based on the provided documents."
Do not mention the sources inside your answer.
`;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0,
    });

    const answerText =
      chatResponse.choices[0].message?.content ?? 'No answer generated.';

    // 🧹 Post-process: Build final output
    console.log('--- Answer ---');
    console.log(answerText);

    console.log('\n--- Sources ---');
    const sourceDocs = new Set(contextMetadatas.map((m) => m.sourceDoc));
    sourceDocs.forEach((docId) => {
      console.log(`- ${docId}`);
    });
  } catch (err) {
    console.error('Error answering question:', err);
  }
}
