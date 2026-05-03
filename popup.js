const summarizeBtn = document.getElementById("summarizeBtn");
const retryBtn = document.getElementById("retryBtn");
const pageTitle = document.getElementById("pageTitle");
const pageDomain = document.getElementById("pageDomain");
const loadingStep = document.getElementById("loadingStep");
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");

const panels = {
	idle: document.getElementById("stateIdle"),
	loading: document.getElementById("stateLoading"),
	success: document.getElementById("stateSuccess"),
	cached: document.getElementById("stateCached"),
	error: document.getElementById("stateError"),
};

// summary output elements
const bulletList = document.getElementById("bulletList");
const insightsList = document.getElementById("insightsList");
const readingTime = document.getElementById("readingTime");


function showState(stateName) {
	Object.values(panels).forEach((panel) => panel.classList.add("hidden"));
	const target = panels[stateName];
	if (target) target.classList.remove("hidden");
}

function showError(title, message) {
	errorTitle.textContent = title;
	errorMessage.textContent = message;
	showState("error");
}

function renderSummary(data) {
	bulletList.innerHTML = "";
	insightsList.innerHTML = "";

	data.bullets.forEach((bullet) => {
		const li = document.createElement("li");
		li.textContent = bullet;
		bulletList.appendChild(li);
	});

	data.insights.forEach((insight) => {
		const card = document.createElement("div");
		card.className = "insight-card";

		const dot = document.createElement("span");
		dot.className = "insight-dot";
		dot.setAttribute("aria-hidden", "true");

		const p = document.createElement("p");
		p.textContent = insight;

		card.appendChild(dot);
		card.appendChild(p);
		insightsList.appendChild(card);
	});

	readingTime.textContent = `${data.readingTime} min read`;
	showState("success");
}

function getActiveTab() {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}
			if (!tabs || tabs.length === 0) {
				reject(new Error("No active tab found."));
				return;
			}
			resolve(tabs[0]);
		});
	});
}

function extractFromTab(tabId) {
	return new Promise((resolve, reject) => {
		chrome.tabs.sendMessage(tabId, { action: "extractContent" }, (response) => {
			if (chrome.runtime.lastError) {
				reject(new Error("Could not connect to page. Try refreshing the tab."));
				return;
			}
			if (!response) {
				reject(new Error("No response from content script."));
				return;
			}
			if (!response.success) {
				reject(
					new Error(response.message || "Could not extract page content."),
				);
				return;
			}
			resolve(response);
		});
	});
}

function requestSummary(extractedData) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(
			{
				action: "summarize",
				content: extractedData.content,
				title: extractedData.title,
				url: extractedData.url,
				wordCount: extractedData.wordCount,
			},
			(response) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}
				if (!response || !response.success) {
					reject(new Error(response?.message || "Summary request failed."));
					return;
				}
				resolve(response);
			},
		);
	});
}


async function runSummarize() {
	showState("loading");

	try {
		loadingStep.textContent = "Finding active tab…";
		const tab = await getActiveTab();

		pageTitle.textContent = tab.title || "Unknown Page";
		pageDomain.textContent = new URL(tab.url).hostname;

		loadingStep.textContent = "Extracting article text…";
		const extracted = await extractFromTab(tab.id);

		loadingStep.textContent = "Generating summary…";
		const summary = await requestSummary(extracted);

		renderSummary(summary);
	} catch (error) {
		console.error("Summarize failed:", error.message);
		showError("Couldn't summarize this page", error.message);
	}
}

summarizeBtn.addEventListener("click", runSummarize);
retryBtn.addEventListener("click", runSummarize);

document
	.getElementById("clearBtnSuccess")
	.addEventListener("click", () => showState("idle"));
document
	.getElementById("clearBtnCached")
	.addEventListener("click", () => showState("idle"));
document
	.getElementById("clearBtnError")
	.addEventListener("click", () => showState("idle"));
document.getElementById("refreshBtn").addEventListener("click", runSummarize);

document.getElementById("copyBtn").addEventListener("click", () => {
	const bullets = Array.from(bulletList.querySelectorAll("li")).map(
		(li) => `• ${li.textContent}`,
	);
	const insights = Array.from(insightsList.querySelectorAll("p")).map(
		(p) => `→ ${p.textContent}`,
	);
	const text = [...bullets, "", ...insights].join("\n");

	navigator.clipboard.writeText(text).then(() => {
		const btn = document.getElementById("copyBtn");
		btn.textContent = "Copied!";
		setTimeout(() => (btn.textContent = "⎘ Copy"), 2000);
	});
});

showState("idle");
