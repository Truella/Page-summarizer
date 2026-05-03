const summarizeBtn = document.getElementById("summarizeBtn");
const retryBtn = document.getElementById("retryBtn");
const pageTitle = document.getElementById("pageTitle");
const pageDomain = document.getElementById("pageDomain");
const loadingStep = document.getElementById("loadingStep");
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");

// state panels
const panels = {
	idle: document.getElementById("stateIdle"),
	loading: document.getElementById("stateLoading"),
	success: document.getElementById("stateSuccess"),
	cached: document.getElementById("stateCached"),
	error: document.getElementById("stateError"),
};

// success panel output elements
const bulletList = document.getElementById("bulletList");
const insightsList = document.getElementById("insightsList");
const readingTime = document.getElementById("readingTime");

// cached panel output elements
const cachedBulletList = document.getElementById("cachedBulletList");
const cachedInsightsList = document.getElementById("cachedInsightsList");
const cachedReadingTime = document.getElementById("cachedReadingTime");

const CACHE_PREFIX = "summary:";
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds


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
function loadFromCache(url) {
	return new Promise((resolve) => {
		const key = CACHE_PREFIX + url;
		chrome.storage.local.get(key, (result) => {
			const cached = result[key];

			// nothing stored for this URL
			if (!cached) {
				resolve(null);
				return;
			}

			// check if cache is still fresh
			const age = Date.now() - cached.timestamp;
			if (age > CACHE_MAX_AGE) {
				chrome.storage.local.remove(key);
				resolve(null);
				return;
			}

			resolve(cached);
		});
	});
}

function saveToCache(url, data) {
	return new Promise((resolve) => {
		const key = CACHE_PREFIX + url;
		const entry = {
			bullets: data.bullets,
			insights: data.insights,
			readingTime: data.readingTime,
			title: data.title,
			timestamp: Date.now(),
		};
		chrome.storage.local.set({ [key]: entry }, resolve);
	});
}

function clearCache(url) {
	return new Promise((resolve) => {
		chrome.storage.local.remove(CACHE_PREFIX + url, resolve);
	});
}

function populateBulletList(listEl, bullets) {
	listEl.innerHTML = "";
	bullets.forEach((bullet) => {
		const li = document.createElement("li");
		li.textContent = bullet; 
		listEl.appendChild(li);
	});
}

function populateInsightsList(listEl, insights) {
	listEl.innerHTML = "";
	insights.forEach((insight) => {
		const card = document.createElement("div");
		card.className = "insight-card";

		const dot = document.createElement("span");
		dot.className = "insight-dot";
		dot.setAttribute("aria-hidden", "true");

		const p = document.createElement("p");
		p.textContent = insight;

		card.appendChild(dot);
		card.appendChild(p);
		listEl.appendChild(card);
	});
}

function renderSummary(data) {
	populateBulletList(bulletList, data.bullets);
	populateInsightsList(insightsList, data.insights);
	readingTime.textContent = `${data.readingTime} min read`;
	showState("success");
}

function renderCached(data) {
	populateBulletList(cachedBulletList, data.bullets);
	populateInsightsList(cachedInsightsList, data.insights);
	cachedReadingTime.textContent = `${data.readingTime} min read`;
	showState("cached");
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

let currentUrl = null;

async function runSummarize(forceRefresh = false) {
	showState("loading");

	try {
		loadingStep.textContent = "Finding active tab…";
		const tab = await getActiveTab();
		currentUrl = tab.url;

		pageTitle.textContent = tab.title || "Unknown Page";
		pageDomain.textContent = new URL(tab.url).hostname;

		if (!forceRefresh) {
			loadingStep.textContent = "Checking cache…";
			const cached = await loadFromCache(tab.url);

			if (cached) {
				renderCached(cached);
				return;
			}
		}

		loadingStep.textContent = "Extracting article text…";
		const extracted = await extractFromTab(tab.id);

		loadingStep.textContent = "Generating summary…";
		const summary = await requestSummary(extracted);

		await saveToCache(tab.url, {
			bullets: summary.bullets,
			insights: summary.insights,
			readingTime: summary.readingTime,
			title: tab.title,
		});

		renderSummary(summary);
	} catch (error) {
		console.error("Summarize failed:", error.message);
		showError("Couldn't summarize this page", error.message);
	}
}

function copySummaryToClipboard(bulletsEl, insightsEl, btnEl) {
	const bullets = Array.from(bulletsEl.querySelectorAll("li")).map(
		(li) => `• ${li.textContent}`,
	);
	const insights = Array.from(insightsEl.querySelectorAll("p")).map(
		(p) => `→ ${p.textContent}`,
	);
	const text = [...bullets, "", ...insights].join("\n");

	navigator.clipboard.writeText(text).then(() => {
		btnEl.textContent = "Copied!";
		setTimeout(() => (btnEl.textContent = "⎘ Copy"), 2000);
	});
}

// summarize button
summarizeBtn.addEventListener("click", () => runSummarize(false));

// retry button (error state)
retryBtn.addEventListener("click", () => runSummarize(false));

// re-summarize button
document.getElementById("refreshBtn").addEventListener("click", async () => {
	if (currentUrl) await clearCache(currentUrl);
	runSummarize(true);
});

// clear buttons — wipe cache and go back to idle
document
	.getElementById("clearBtnSuccess")
	.addEventListener("click", async () => {
		if (currentUrl) await clearCache(currentUrl);
		showState("idle");
	});

document
	.getElementById("clearBtnCached")
	.addEventListener("click", async () => {
		if (currentUrl) await clearCache(currentUrl);
		showState("idle");
	});

document.getElementById("clearBtnError").addEventListener("click", () => {
	showState("idle");
});

// copy buttons
document.getElementById("copyBtn").addEventListener("click", () => {
	copySummaryToClipboard(
		bulletList,
		insightsList,
		document.getElementById("copyBtn"),
	);
});

document.getElementById("cachedCopyBtn").addEventListener("click", () => {
	copySummaryToClipboard(
		cachedBulletList,
		cachedInsightsList,
		document.getElementById("cachedCopyBtn"),
	);
});
async function init() {
	try {
		const tab = await getActiveTab();
		currentUrl = tab.url;

		pageTitle.textContent = tab.title || "Unknown Page";
		pageDomain.textContent = new URL(tab.url).hostname;

		const cached = await loadFromCache(tab.url);
		if (cached) {
			renderCached(cached);
			return;
		}
	} catch (e) {
		// 
	}

	showState("idle");
}

init();
