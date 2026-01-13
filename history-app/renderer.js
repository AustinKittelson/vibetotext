const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcRenderer } = require('electron');

const HISTORY_PATH = path.join(os.homedir(), '.vibetotext', 'history.json');

// Stopwords to filter from common words
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these',
  'what', 'which', 'who', 'where', 'when', 'why', 'how', 'all', 'each',
  'some', 'no', 'not', 'only', 'so', 'than', 'too', 'very', 'just',
  'also', 'now', 'here', 'there', 'then', 'if', 'because', 'about',
  'any', 'up', 'down', 'out', 'off', 'over', 'going', 'gonna', 'like',
  'okay', 'ok', 'yeah', 'yes', 'um', 'uh', 'ah', 'oh', 'well', 'right',
  'actually', 'basically', 'really', 'thing', 'things', 'something',
  'know', 'think', 'want', 'get', 'got', 'make', 'way', 'see', 'go',
]);

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      const data = fs.readFileSync(HISTORY_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading history:', err);
  }
  return { entries: [] };
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getCommonWords(entries) {
  const wordCounts = {};

  entries.forEach(entry => {
    const words = entry.text.toLowerCase()
      .replace(/[.,!?;:'"()\[\]{}]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));

    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
  });

  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function render() {
  const history = loadHistory();
  const entries = history.entries || [];

  // Sort by timestamp, newest first
  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Calculate stats
  const totalSessions = entries.length;
  const totalWords = entries.reduce((sum, e) => sum + (e.word_count || e.text.split(/\s+/).length), 0);

  // Update stats
  document.getElementById('total-sessions').textContent = totalSessions.toLocaleString();
  document.getElementById('total-words').textContent = totalWords.toLocaleString();

  // Show/hide empty state
  const emptyState = document.getElementById('empty-state');
  const entriesContainer = document.getElementById('entries');
  const commonWordsSection = document.getElementById('common-words-section');

  if (entries.length === 0) {
    emptyState.style.display = 'flex';
    entriesContainer.style.display = 'none';
    commonWordsSection.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  entriesContainer.style.display = 'block';
  commonWordsSection.style.display = 'block';

  // Render common words
  const commonWords = getCommonWords(entries);
  const commonWordsContainer = document.getElementById('common-words');
  commonWordsContainer.innerHTML = commonWords
    .map(([word, count]) => `<span class="word-chip">${word}<span class="count">${count}</span></span>`)
    .join('');

  // Render entries
  entriesContainer.innerHTML = entries.slice(0, 100).map(entry => {
    const wordCount = entry.word_count || entry.text.split(/\s+/).length;
    const mode = entry.mode || 'transcribe';
    const timeStr = formatTime(entry.timestamp);

    return `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-time">${timeStr}</span>
          <span class="entry-mode ${mode}">${mode}</span>
        </div>
        <div class="entry-text">${escapeHtml(entry.text)}</div>
        <div class="entry-words">${wordCount} words</div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initial render
render();

// Listen for updates from main process
ipcRenderer.on('history-updated', () => {
  render();
});

// Also poll for changes (backup in case file watcher misses something)
setInterval(render, 5000);
