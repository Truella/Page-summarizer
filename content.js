const MIN_WORD_COUNT = 100;
const MAX_WORD_COUNT = 3500;

const SELECTORS = [
	"article",
	"main",
	'[role="main"]',
	".post-body",
	".entry-content",
	".article-body",
	".post-content",
	".content-body",
	"#article-body",
	"#main-content",
];

function findMainContent() {
	for (const selector of SELECTORS) {
		const element = document.querySelector(selector);
		if (!element) continue;

		const text = extractText(element);
		const wordCount = countWords(text);

		if (wordCount >= MIN_WORD_COUNT) {
			return text;
		}
	}
	return fallbackParagraphs();
}

// FALLBACK — COLLECT ALL PARAGRAPHS
function fallbackParagraphs() {
	const paragraphs = Array.from(document.querySelectorAll("p"));

	const text = paragraphs
		.map((p) => p.innerText.trim())
		.filter((line) => line.length > 40)
		.join("\n");
	return text;
}

function extractText(element) {
	const raw = element.innerText;

	const cleaned = raw
		.split("\n") 
		.map((line) => line.trim())
		.filter((line) => line.length > 20)
		.join("\n");
	return cleaned;
}


function countWords(text) {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text, maxWords) {
	const words = text.trim().split(/\s+/);
	if (words.length <= maxWords) return text;
	return words.slice(0, maxWords).join(" ") + "...";
}


function extractPageContent() {
	const rawContent = findMainContent();
	const wordCount = countWords(rawContent);

	if (wordCount < MIN_WORD_COUNT) {
		return {
			success: false,
			error: "not_enough_content",
			message:
				"This page doesn't have enough readable text to summarize. Try an article or blog post.",
		};
	}

	const truncated = truncateWords(rawContent, MAX_WORD_COUNT);

	return {
		success: true,
		title: document.title,
		url: window.location.href,
		content: truncated,
		wordCount: wordCount,
		wasTruncated: wordCount > MAX_WORD_COUNT,
	};
}

// MESSAGE LISTENER
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action !== "extractContent") return;

	try {
		const result = extractPageContent();
		sendResponse(result);
	} catch (error) {
		sendResponse({
			success: false,
			error: "extraction_failed",
			message: "Something went wrong while reading this page.",
		});
	}

	return true;
});
