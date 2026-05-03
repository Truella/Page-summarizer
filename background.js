// Returns a dummy summary object to test the end-to-end message passing pipeline.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action !== "summarize") return;

	console.log("background.js received content, word count:", message.wordCount);

	const dummySummary = {
		success: true,
		bullets: [
			"This is a placeholder bullet point from the background script.",
			"The full message passing pipeline is now connected end to end.",
			"Content was successfully extracted and received by background.js.",
			`Page had approximately ${message.wordCount} words before truncation.`,
		],
		insights: [
			"Message passing between all three extension worlds is working correctly.",
			"Replace this dummy response with a real Gemini API call in commit 6.",
		],
		readingTime: Math.ceil(message.wordCount / 250), // ~250 words per minute
	};

	sendResponse(dummySummary);
	return true; 
});
