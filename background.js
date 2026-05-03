
const PROXY_URL = "https://page-summarizer-proxy.vercel.app/api/summarize";
async function getSummary(title, content) {
	const response = await fetch(PROXY_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title, content }),
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || `Server error: ${response.status}`);
	}

	const data = await response.json();

	if (!data.success) {
		throw new Error(data.error || "Proxy returned an unsuccessful response.");
	}

	return data;
}

function ErrorMsg(message) {
	if (
		message.includes("429") ||
		message.includes("quota") ||
		message.includes("rate")
	) {
		return "Too many requests. Wait a moment and try again.";
	}
	if (
		message.includes("fetch") ||
		message.includes("network") ||
		message.includes("Failed")
	) {
		return "Could not reach the summary server. Check your internet connection.";
	}
	if (message.includes("502") || message.includes("503")) {
		return "The AI service is temporarily unavailable. Try again shortly.";
	}
	return message || "Something went wrong. Please try again.";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action !== "summarize") return;

	getSummary(message.title, message.content)
		.then((summary) => {
			sendResponse({
				success: true,
				bullets: summary.bullets,
				insights: summary.insights,
				readingTime: summary.readingTime,
			});
		})
		.catch((error) => {
			console.error("Summary error:", error.message);
			sendResponse({
				success: false,
				message: ErrorMsg(error.message),
			});
		});

	return true; 
});
