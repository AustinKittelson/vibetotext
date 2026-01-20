// Analytics Charts for VibeToText
// Uses D3.js v7 for visualizations

console.log('[Analytics] analytics.js loaded, D3 available:', typeof d3 !== 'undefined');

const CHART_COLORS = {
  accent: '#fbbf24',      // Amber - main chart color
  green: '#34d399',       // Transcribe
  purple: '#a78bfa',      // Greppy
  orange: '#fb923c',      // Cleanup
  blue: '#60a5fa',        // Plan
  muted: '#6e6e73',
  border: '#2a2a32',
  bg: '#151518',
};

const MODE_COLORS = {
  transcribe: CHART_COLORS.green,
  greppy: CHART_COLORS.purple,
  cleanup: CHART_COLORS.orange,
  plan: CHART_COLORS.blue,
};

// Cache for re-rendering on tab switch/resize
let cachedAnalyticsData = null;

// Filler words to detect
const FILLER_WORDS = ['um', 'uh', 'like', 'basically', 'actually', 'literally', 'honestly', 'anyway', 'so', 'right'];

// Simple sentiment word lists
const POSITIVE_WORDS = new Set([
  'good', 'great', 'awesome', 'excellent', 'amazing', 'wonderful', 'fantastic', 'perfect', 'love', 'best',
  'happy', 'nice', 'cool', 'brilliant', 'beautiful', 'thanks', 'thank', 'helpful', 'easy', 'fast',
  'better', 'improved', 'success', 'successful', 'working', 'works', 'fixed', 'solved', 'done', 'complete'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'wrong', 'error', 'bug', 'issue', 'problem', 'fail', 'failed', 'broken', 'stuck',
  'hard', 'difficult', 'annoying', 'frustrating', 'slow', 'ugly', 'terrible', 'awful', 'hate', 'worst',
  'confused', 'confusing', 'impossible', 'never', 'crash', 'crashed', 'missing', 'lost', 'stupid', 'mess'
]);

// Daily word goal (could be made configurable later)
const DAILY_WORD_GOAL = 500;
const WEEKLY_WORD_GOAL = 2500;

// Tooltip helper
let tooltip = null;

function getTooltip() {
  if (!tooltip) {
    tooltip = d3.select('body')
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('opacity', 0);
  }
  return tooltip;
}

function showTooltip(event, html) {
  const tip = getTooltip();
  tip.html(html)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 10) + 'px')
    .style('opacity', 1);
}

function hideTooltip() {
  getTooltip().style('opacity', 0);
}

// Process entries for charts
function processData(entries) {
  // Activity by hour and day
  const activityMatrix = Array(7).fill(null).map(() => Array(24).fill(0));

  // WPM by hour
  const wpmByHour = Array(24).fill(null).map(() => ({ sum: 0, count: 0 }));

  // Daily aggregates
  const dailyData = {};

  // Mode counts
  const modeCounts = { transcribe: 0, greppy: 0, cleanup: 0, plan: 0 };

  // All words for vocabulary analysis
  const allWords = [];
  const wordFrequency = {};

  // Filler word counts
  const fillerCounts = {};
  FILLER_WORDS.forEach(w => fillerCounts[w] = 0);

  // N-grams (2 and 3 word phrases)
  const bigrams = {};
  const trigrams = {};

  // Session durations for histogram
  const sessionDurations = [];

  // Sentiment by day
  const sentimentByDay = {};

  // Streak tracking
  const daysUsed = new Set();

  // Personal records
  let maxWpm = 0;
  let maxWordsInDay = 0;
  let longestSession = 0;

  entries.forEach(entry => {
    const date = new Date(entry.timestamp);
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    const dateKey = date.toISOString().split('T')[0];

    // Track days used for streaks
    daysUsed.add(dateKey);

    // Activity matrix
    activityMatrix[dayOfWeek][hour]++;

    // WPM by hour
    if (entry.wpm) {
      wpmByHour[hour].sum += entry.wpm;
      wpmByHour[hour].count++;
      maxWpm = Math.max(maxWpm, entry.wpm);
    }

    // Session duration
    if (entry.duration_seconds) {
      sessionDurations.push(entry.duration_seconds);
      longestSession = Math.max(longestSession, entry.duration_seconds);
    }

    // Daily data
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        words: 0,
        duration: 0,
        wpmSum: 0,
        wpmCount: 0,
        entries: 0,
      };
    }
    dailyData[dateKey].words += entry.word_count || 0;
    dailyData[dateKey].duration += entry.duration_seconds || 0;
    dailyData[dateKey].entries++;
    if (entry.wpm) {
      dailyData[dateKey].wpmSum += entry.wpm;
      dailyData[dateKey].wpmCount++;
    }

    // Mode counts
    const mode = entry.mode || 'transcribe';
    if (modeCounts.hasOwnProperty(mode)) {
      modeCounts[mode]++;
    }

    // Text analysis
    const text = entry.text || '';
    const words = text.toLowerCase()
      .replace(/[.,!?;:'"()\[\]{}]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);

    // Collect all words
    words.forEach(word => {
      allWords.push(word);
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    });

    // Count filler words
    words.forEach(word => {
      if (fillerCounts.hasOwnProperty(word)) {
        fillerCounts[word]++;
      }
    });

    // Extract n-grams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      bigrams[bigram] = (bigrams[bigram] || 0) + 1;
    }
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      trigrams[trigram] = (trigrams[trigram] || 0) + 1;
    }

    // Sentiment analysis
    let positive = 0, negative = 0;
    words.forEach(word => {
      if (POSITIVE_WORDS.has(word)) positive++;
      if (NEGATIVE_WORDS.has(word)) negative++;
    });
    if (!sentimentByDay[dateKey]) {
      sentimentByDay[dateKey] = { positive: 0, negative: 0, total: 0 };
    }
    sentimentByDay[dateKey].positive += positive;
    sentimentByDay[dateKey].negative += negative;
    sentimentByDay[dateKey].total += words.length;
  });

  // Convert daily data to sorted array
  const dailyArray = Object.values(dailyData)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate cumulative time saved and track max words
  let cumulativeTimeSaved = 0;
  dailyArray.forEach(d => {
    const typingTimeMinutes = d.words / 40;
    const dictatingTimeMinutes = d.duration / 60;
    d.timeSavedToday = Math.max(0, typingTimeMinutes - dictatingTimeMinutes);
    cumulativeTimeSaved += d.timeSavedToday;
    d.cumulativeTimeSaved = cumulativeTimeSaved;
    d.avgWpm = d.wpmCount > 0 ? Math.round(d.wpmSum / d.wpmCount) : null;
    maxWordsInDay = Math.max(maxWordsInDay, d.words);
  });

  // Calculate streaks
  const sortedDays = Array.from(daysUsed).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Calculate longest streak
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(sortedDays[i - 1]);
      const currDate = new Date(sortedDays[i]);
      const diffDays = (currDate - prevDate) / 86400000;
      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Calculate current streak (must include today or yesterday)
  if (daysUsed.has(today) || daysUsed.has(yesterday)) {
    currentStreak = 1;
    const startDay = daysUsed.has(today) ? today : yesterday;
    let checkDate = new Date(startDay);
    checkDate.setDate(checkDate.getDate() - 1);
    while (daysUsed.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  // Average WPM by hour
  const avgWpmByHour = wpmByHour.map(h => h.count > 0 ? Math.round(h.sum / h.count) : null);

  // Get top bigrams and trigrams (filter out boring ones)
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'i', 'you', 'it', 'is', 'that', 'this']);
  const topBigrams = Object.entries(bigrams)
    .filter(([phrase, count]) => {
      const words = phrase.split(' ');
      return count >= 2 && !words.every(w => stopwords.has(w));
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topTrigrams = Object.entries(trigrams)
    .filter(([phrase, count]) => {
      const words = phrase.split(' ');
      return count >= 2 && !words.every(w => stopwords.has(w));
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Vocabulary diversity
  const uniqueWords = new Set(allWords.filter(w => w.length > 2));
  const totalWords = allWords.length;

  // Sentiment array for charting
  const sentimentArray = Object.entries(sentimentByDay)
    .map(([date, data]) => ({
      date,
      score: data.total > 0 ? (data.positive - data.negative) / Math.sqrt(data.total) : 0,
      positive: data.positive,
      negative: data.negative,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Week comparison
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const thisWeekData = { words: 0, sessions: 0, duration: 0 };
  const lastWeekData = { words: 0, sessions: 0, duration: 0 };

  entries.forEach(entry => {
    const entryDate = new Date(entry.timestamp);
    if (entryDate >= startOfThisWeek) {
      thisWeekData.words += entry.word_count || 0;
      thisWeekData.sessions++;
      thisWeekData.duration += entry.duration_seconds || 0;
    } else if (entryDate >= startOfLastWeek && entryDate < startOfThisWeek) {
      lastWeekData.words += entry.word_count || 0;
      lastWeekData.sessions++;
      lastWeekData.duration += entry.duration_seconds || 0;
    }
  });

  // Today's data for goals
  const todayData = dailyData[today] || { words: 0, entries: 0, duration: 0 };

  // This week's words for weekly goal
  const thisWeekWords = thisWeekData.words;

  return {
    activityMatrix,
    dailyArray,
    dailyData,
    modeCounts,
    currentStreak,
    longestStreak,
    maxWpm,
    maxWordsInDay,
    longestSession,
    fillerCounts,
    uniqueWords: uniqueWords.size,
    totalWords,
    topBigrams,
    topTrigrams,
    avgWpmByHour,
    sessionDurations,
    sentimentArray,
    thisWeekData,
    lastWeekData,
    todayData,
    thisWeekWords,
    wordFrequency,
  };
}

// Render activity heatmap
function renderActivityHeatmap(containerId, activityMatrix) {
  const container = d3.select(containerId);
  container.html('');

  const margin = { top: 5, right: 20, bottom: 25, left: 35 };

  // Cap cell sizes for compact display
  const maxCellWidth = 18;
  const maxCellHeight = 14;
  const cellGap = 2;

  const cellWidth = maxCellWidth;
  const cellHeight = maxCellHeight;

  const width = (cellWidth + cellGap) * 24;
  const height = (cellHeight + cellGap) * 7;

  if (width <= 0) return;

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = d3.range(24);

  // Find max value for color scale
  const maxVal = d3.max(activityMatrix.flat()) || 1;

  const colorScale = d3.scaleLinear()
    .domain([0, maxVal])
    .range([CHART_COLORS.bg, CHART_COLORS.accent]);

  // Draw cells
  days.forEach((day, dayIndex) => {
    hours.forEach(hour => {
      const value = activityMatrix[dayIndex][hour];
      svg.append('rect')
        .attr('x', hour * (cellWidth + cellGap))
        .attr('y', dayIndex * (cellHeight + cellGap))
        .attr('width', cellWidth)
        .attr('height', cellHeight)
        .attr('rx', 2)
        .attr('fill', colorScale(value))
        .attr('stroke', CHART_COLORS.border)
        .attr('stroke-width', 0.5)
        .on('mouseover', (event) => {
          showTooltip(event, `${day} ${hour}:00 - ${value} transcription${value !== 1 ? 's' : ''}`);
        })
        .on('mouseout', hideTooltip);
    });
  });

  // Y axis (days)
  svg.selectAll('.day-label')
    .data(days)
    .enter()
    .append('text')
    .attr('x', -5)
    .attr('y', (d, i) => i * (cellHeight + cellGap) + cellHeight / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('fill', CHART_COLORS.muted)
    .attr('font-size', '9px')
    .text(d => d);

  // X axis (hours)
  svg.selectAll('.hour-label')
    .data([0, 6, 12, 18])
    .enter()
    .append('text')
    .attr('x', d => d * (cellWidth + cellGap) + cellWidth / 2)
    .attr('y', height + 15)
    .attr('text-anchor', 'middle')
    .attr('fill', CHART_COLORS.muted)
    .attr('font-size', '9px')
    .text(d => `${d}:00`);
}

// Render yearly activity heatmap (GitHub-style contribution graph)
function renderYearlyHeatmap(containerId, dailyData) {
  const container = d3.select(containerId);
  container.html('');

  // Fixed cell size for compact display
  const cellSize = 10;
  const cellGap = 2;

  // Generate the last 365 days
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const days = [];
  const currentDate = new Date(oneYearAgo);
  while (currentDate <= today) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate dimensions based on fixed cell size
  const numWeeks = Math.ceil(days.length / 7) + 1;
  const margin = { top: 15, right: 10, bottom: 5, left: 20 };
  const width = numWeeks * (cellSize + cellGap);
  const height = 7 * (cellSize + cellGap);

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Find max activity for color scale
  const maxActivity = Math.max(1, ...Object.values(dailyData).map(d => d.entries || 0));

  const colorScale = d3.scaleLinear()
    .domain([0, maxActivity])
    .range([CHART_COLORS.bg, CHART_COLORS.accent]);

  // Get the day of week for the first day (0 = Sunday)
  const startDayOfWeek = days[0].getDay();

  // Draw cells
  days.forEach((date, i) => {
    const dateKey = date.toISOString().split('T')[0];
    const dayData = dailyData[dateKey];
    const value = dayData ? dayData.entries : 0;

    // Calculate position: week (column) and day of week (row)
    const dayOfWeek = date.getDay();
    const weekIndex = Math.floor((i + startDayOfWeek) / 7);

    svg.append('rect')
      .attr('x', weekIndex * (cellSize + cellGap))
      .attr('y', dayOfWeek * (cellSize + cellGap))
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 2)
      .attr('fill', value > 0 ? colorScale(value) : CHART_COLORS.bg)
      .attr('stroke', CHART_COLORS.border)
      .attr('stroke-width', 0.5)
      .on('mouseover', (event) => {
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const sessions = value === 1 ? '1 session' : `${value} sessions`;
        showTooltip(event, `${dateStr} - ${sessions}`);
      })
      .on('mouseout', hideTooltip);
  });

  // Month labels
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastMonth = -1;
  days.forEach((date, i) => {
    const month = date.getMonth();
    if (month !== lastMonth && date.getDate() <= 7) {
      const weekIndex = Math.floor((i + startDayOfWeek) / 7);
      svg.append('text')
        .attr('x', weekIndex * (cellSize + cellGap))
        .attr('y', -5)
        .attr('text-anchor', 'start')
        .attr('fill', CHART_COLORS.muted)
        .attr('font-size', '9px')
        .text(months[month]);
      lastMonth = month;
    }
  });

  // Day labels (Mon, Wed, Fri)
  const dayLabels = ['', 'M', '', 'W', '', 'F', ''];
  dayLabels.forEach((label, i) => {
    if (label) {
      svg.append('text')
        .attr('x', -5)
        .attr('y', i * (cellSize + cellGap) + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', CHART_COLORS.muted)
        .attr('font-size', '9px')
        .text(label);
    }
  });
}

// Render words over time area chart
function renderWordsChart(containerId, dailyArray) {
  const container = d3.select(containerId);
  container.html('');

  if (dailyArray.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No data yet');
    return;
  }

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 150 - margin.top - margin.bottom;

  if (width <= 0) return;

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(dailyArray, d => new Date(d.date)))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(dailyArray, d => d.words) * 1.1])
    .range([height, 0]);

  // Grid
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(''));

  // Area
  const area = d3.area()
    .x(d => x(new Date(d.date)))
    .y0(height)
    .y1(d => y(d.words))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(dailyArray)
    .attr('fill', CHART_COLORS.accent)
    .attr('fill-opacity', 0.2)
    .attr('d', area);

  // Line
  const line = d3.line()
    .x(d => x(new Date(d.date)))
    .y(d => y(d.words))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(dailyArray)
    .attr('fill', 'none')
    .attr('stroke', CHART_COLORS.accent)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Dots
  svg.selectAll('.dot')
    .data(dailyArray)
    .enter()
    .append('circle')
    .attr('cx', d => x(new Date(d.date)))
    .attr('cy', d => y(d.words))
    .attr('r', 3)
    .attr('fill', CHART_COLORS.accent)
    .on('mouseover', (event, d) => {
      showTooltip(event, `${d.date}: ${d.words} words`);
    })
    .on('mouseout', hideTooltip);

  // Axes
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d')));

  svg.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(4));
}

// Render cumulative time saved chart
function renderTimeSavedChart(containerId, dailyArray) {
  const container = d3.select(containerId);
  container.html('');

  if (dailyArray.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No data yet');
    return;
  }

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 150 - margin.top - margin.bottom;

  if (width <= 0) return;

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(dailyArray, d => new Date(d.date)))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(dailyArray, d => d.cumulativeTimeSaved) * 1.1])
    .range([height, 0]);

  // Grid
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(''));

  // Area
  const area = d3.area()
    .x(d => x(new Date(d.date)))
    .y0(height)
    .y1(d => y(d.cumulativeTimeSaved))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(dailyArray)
    .attr('fill', CHART_COLORS.green)
    .attr('fill-opacity', 0.2)
    .attr('d', area);

  // Line
  const line = d3.line()
    .x(d => x(new Date(d.date)))
    .y(d => y(d.cumulativeTimeSaved))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(dailyArray)
    .attr('fill', 'none')
    .attr('stroke', CHART_COLORS.green)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Dots
  svg.selectAll('.dot')
    .data(dailyArray)
    .enter()
    .append('circle')
    .attr('cx', d => x(new Date(d.date)))
    .attr('cy', d => y(d.cumulativeTimeSaved))
    .attr('r', 3)
    .attr('fill', CHART_COLORS.green)
    .on('mouseover', (event, d) => {
      showTooltip(event, `${d.date}: ${d.cumulativeTimeSaved.toFixed(1)} min saved total`);
    })
    .on('mouseout', hideTooltip);

  // Axes
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d')));

  svg.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => `${d}m`));
}

// Render WPM trends chart
function renderWpmChart(containerId, dailyArray) {
  const container = d3.select(containerId);
  container.html('');

  // Filter to only days with WPM data
  const wpmData = dailyArray.filter(d => d.avgWpm !== null);

  if (wpmData.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No data yet');
    return;
  }

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 150 - margin.top - margin.bottom;

  if (width <= 0) return;

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(wpmData, d => new Date(d.date)))
    .range([0, width]);

  const yMin = d3.min(wpmData, d => d.avgWpm) * 0.9;
  const yMax = d3.max(wpmData, d => d.avgWpm) * 1.1;

  const y = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height, 0]);

  // Grid
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(''));

  // Line
  const line = d3.line()
    .x(d => x(new Date(d.date)))
    .y(d => y(d.avgWpm))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(wpmData)
    .attr('fill', 'none')
    .attr('stroke', CHART_COLORS.accent)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Dots
  svg.selectAll('.dot')
    .data(wpmData)
    .enter()
    .append('circle')
    .attr('cx', d => x(new Date(d.date)))
    .attr('cy', d => y(d.avgWpm))
    .attr('r', 4)
    .attr('fill', CHART_COLORS.accent)
    .on('mouseover', (event, d) => {
      showTooltip(event, `${d.date}: ${d.avgWpm} WPM`);
    })
    .on('mouseout', hideTooltip);

  // Axes
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d')));

  svg.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(4));
}

// Render mode donut chart
function renderModeDonut(containerId, modeCounts) {
  const container = d3.select(containerId);
  container.html('');

  const total = Object.values(modeCounts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No data');
    return;
  }

  const width = container.node().getBoundingClientRect().width;
  const height = 150;
  const radius = Math.min(width, height) / 2 - 10;

  if (radius <= 0) return;

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  const data = Object.entries(modeCounts)
    .filter(([_, count]) => count > 0)
    .map(([mode, count]) => ({ mode, count }));

  const pie = d3.pie()
    .value(d => d.count)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius);

  const arcHover = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius + 5);

  const arcs = svg.selectAll('.arc')
    .data(pie(data))
    .enter()
    .append('g')
    .attr('class', 'arc');

  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => MODE_COLORS[d.data.mode])
    .attr('stroke', CHART_COLORS.bg)
    .attr('stroke-width', 2)
    .on('mouseover', function(event, d) {
      d3.select(this).transition().duration(100).attr('d', arcHover);
      const pct = ((d.data.count / total) * 100).toFixed(0);
      showTooltip(event, `${d.data.mode}: ${d.data.count} (${pct}%)`);
    })
    .on('mouseout', function() {
      d3.select(this).transition().duration(100).attr('d', arc);
      hideTooltip();
    });

  // Center text
  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', CHART_COLORS.muted)
    .attr('font-size', '24px')
    .attr('font-weight', '700')
    .text(total);

  // Legend
  const legend = container.append('div')
    .attr('class', 'donut-legend');

  data.forEach(d => {
    const item = legend.append('div').attr('class', 'legend-item');
    item.append('div')
      .attr('class', 'legend-color')
      .style('background', MODE_COLORS[d.mode]);
    item.append('span').text(`${d.mode} (${d.count})`);
  });
}

// Render streaks card
function renderStreaks(containerId, currentStreak, longestStreak) {
  const container = d3.select(containerId);
  container.html('');

  const div = container.append('div').attr('class', 'stat-grid');

  // Current streak
  const current = div.append('div').attr('class', 'stat-item highlight');
  current.append('div').attr('class', 'stat-number').text(currentStreak);
  current.append('div').attr('class', 'stat-desc').text('Current Streak');

  // Longest streak
  const longest = div.append('div').attr('class', 'stat-item');
  longest.append('div').attr('class', 'stat-number').text(longestStreak);
  longest.append('div').attr('class', 'stat-desc').text('Longest Streak');
}

// Render personal records card
function renderRecords(containerId, maxWpm, maxWordsInDay, longestSession) {
  const container = d3.select(containerId);
  container.html('');

  const div = container.append('div').attr('class', 'stat-grid');

  // Max WPM
  const wpm = div.append('div').attr('class', 'stat-item');
  wpm.append('div').attr('class', 'stat-number small').text(maxWpm || '--');
  wpm.append('div').attr('class', 'stat-desc').text('Best WPM');

  // Max words in day
  const words = div.append('div').attr('class', 'stat-item');
  words.append('div').attr('class', 'stat-number small').text(maxWordsInDay.toLocaleString());
  words.append('div').attr('class', 'stat-desc').text('Most Words/Day');

  // Longest session
  const session = div.append('div').attr('class', 'stat-item');
  session.append('div').attr('class', 'stat-number small').text(longestSession ? `${longestSession.toFixed(0)}s` : '--');
  session.append('div').attr('class', 'stat-desc').text('Longest Session');
}

// Render goals progress
function renderGoals(containerId, todayData, thisWeekWords) {
  const container = d3.select(containerId);
  container.html('');

  const div = container.append('div');

  // Daily goal
  const dailyPct = Math.min(100, (todayData.words / DAILY_WORD_GOAL) * 100);
  const dailyGoal = div.append('div').attr('class', 'goal-container');
  const dailyHeader = dailyGoal.append('div').attr('class', 'goal-header');
  dailyHeader.append('span').attr('class', 'goal-label').text('Daily Words');
  dailyHeader.append('span').attr('class', 'goal-value').text(`${todayData.words.toLocaleString()} / ${DAILY_WORD_GOAL.toLocaleString()}`);
  const dailyBar = dailyGoal.append('div').attr('class', 'goal-bar');
  dailyBar.append('div')
    .attr('class', `goal-fill ${dailyPct >= 100 ? 'green' : 'accent'}`)
    .style('width', `${dailyPct}%`);

  // Weekly goal
  const weeklyPct = Math.min(100, (thisWeekWords / WEEKLY_WORD_GOAL) * 100);
  const weeklyGoal = div.append('div').attr('class', 'goal-container').style('margin-top', '12px');
  const weeklyHeader = weeklyGoal.append('div').attr('class', 'goal-header');
  weeklyHeader.append('span').attr('class', 'goal-label').text('Weekly Words');
  weeklyHeader.append('span').attr('class', 'goal-value').text(`${thisWeekWords.toLocaleString()} / ${WEEKLY_WORD_GOAL.toLocaleString()}`);
  const weeklyBar = weeklyGoal.append('div').attr('class', 'goal-bar');
  weeklyBar.append('div')
    .attr('class', `goal-fill ${weeklyPct >= 100 ? 'green' : 'blue'}`)
    .style('width', `${weeklyPct}%`);
}

// Render filler words
function renderFillerWords(containerId, fillerCounts) {
  const container = d3.select(containerId);
  container.html('');

  const sorted = Object.entries(fillerCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No filler words detected');
    return;
  }

  const maxCount = sorted[0][1];
  const list = container.append('div').attr('class', 'filler-list');

  sorted.slice(0, 6).forEach(([word, count]) => {
    const item = list.append('div').attr('class', 'filler-item');
    item.append('span').attr('class', 'filler-word').text(`"${word}"`);
    const bar = item.append('div').attr('class', 'filler-bar');
    bar.append('div')
      .attr('class', 'filler-fill')
      .style('width', `${(count / maxCount) * 100}%`);
    item.append('span').attr('class', 'filler-count').text(count);
  });
}

// Render vocabulary diversity
function renderVocabulary(containerId, uniqueWords, totalWords) {
  const container = d3.select(containerId);
  container.html('');

  const richness = totalWords > 0 ? ((uniqueWords / totalWords) * 100).toFixed(1) : 0;

  const div = container.append('div').attr('class', 'vocab-stats');

  const main = div.append('div').attr('class', 'vocab-main');
  main.append('div').attr('class', 'vocab-number').text(uniqueWords.toLocaleString());
  main.append('div').attr('class', 'vocab-label').text('Unique Words');

  const sub = div.append('div').attr('class', 'vocab-sub');

  const total = sub.append('div').attr('class', 'vocab-sub-item');
  total.append('div').attr('class', 'vocab-sub-number').text(totalWords.toLocaleString());
  total.append('div').attr('class', 'vocab-sub-label').text('Total Words');

  const rich = sub.append('div').attr('class', 'vocab-sub-item');
  rich.append('div').attr('class', 'vocab-sub-number').text(`${richness}%`);
  rich.append('div').attr('class', 'vocab-sub-label').text('Richness');
}

// Render common phrases
function renderCommonPhrases(containerId, topBigrams, topTrigrams) {
  const container = d3.select(containerId);
  container.html('');

  const allPhrases = [...topTrigrams, ...topBigrams].slice(0, 12);

  if (allPhrases.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No phrases yet');
    return;
  }

  const div = container.append('div').attr('class', 'phrases-list');

  allPhrases.forEach(([phrase, count]) => {
    const chip = div.append('span').attr('class', 'phrase-chip');
    chip.text(phrase);
    chip.append('span').attr('class', 'count').text(count);
  });
}

// Render WPM by hour
function renderWpmByHour(containerId, avgWpmByHour) {
  const container = d3.select(containerId);
  container.html('');

  const data = avgWpmByHour.map((wpm, hour) => ({ hour, wpm })).filter(d => d.wpm !== null);

  if (data.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No data yet');
    return;
  }

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 120 - margin.top - margin.bottom;

  if (width <= 0) return;

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(d3.range(24))
    .range([0, width])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.wpm) * 1.1])
    .range([height, 0]);

  // Bars
  svg.selectAll('.bar')
    .data(avgWpmByHour)
    .enter()
    .append('rect')
    .attr('x', (d, i) => x(i))
    .attr('y', d => d ? y(d) : height)
    .attr('width', x.bandwidth())
    .attr('height', d => d ? height - y(d) : 0)
    .attr('fill', d => d ? CHART_COLORS.accent : CHART_COLORS.border)
    .attr('rx', 2)
    .on('mouseover', (event, d) => {
      if (d) {
        const hour = avgWpmByHour.indexOf(d);
        showTooltip(event, `${hour}:00 - ${d} WPM`);
      }
    })
    .on('mouseout', hideTooltip);

  // X axis
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).tickValues([0, 6, 12, 18]).tickFormat(d => `${d}:00`));
}

// Render session histogram
function renderSessionHistogram(containerId, sessionDurations) {
  const container = d3.select(containerId);
  container.html('');

  if (sessionDurations.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No data yet');
    return;
  }

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 120 - margin.top - margin.bottom;

  if (width <= 0) return;

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Create histogram bins
  const maxDuration = Math.min(d3.max(sessionDurations), 60); // Cap at 60s for readability
  const x = d3.scaleLinear()
    .domain([0, maxDuration])
    .range([0, width]);

  const histogram = d3.histogram()
    .domain(x.domain())
    .thresholds(x.ticks(12));

  const bins = histogram(sessionDurations.filter(d => d <= maxDuration));

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .range([height, 0]);

  // Bars
  svg.selectAll('.bar')
    .data(bins)
    .enter()
    .append('rect')
    .attr('x', d => x(d.x0) + 1)
    .attr('y', d => y(d.length))
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr('height', d => height - y(d.length))
    .attr('fill', CHART_COLORS.purple)
    .attr('rx', 2)
    .on('mouseover', (event, d) => {
      showTooltip(event, `${d.x0.toFixed(0)}-${d.x1.toFixed(0)}s: ${d.length} sessions`);
    })
    .on('mouseout', hideTooltip);

  // Axes
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => `${d}s`));

  svg.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(4));
}

// Render period comparison
function renderPeriodComparison(containerId, thisWeekData, lastWeekData) {
  const container = d3.select(containerId);
  container.html('');

  const div = container.append('div').attr('class', 'comparison-container');

  // This week
  const thisWeek = div.append('div').attr('class', 'comparison-period');
  thisWeek.append('div').attr('class', 'comparison-label').text('This Week');
  const thisStats = thisWeek.append('div').attr('class', 'comparison-stats');

  [
    { label: 'Words', value: thisWeekData.words, lastValue: lastWeekData.words },
    { label: 'Sessions', value: thisWeekData.sessions, lastValue: lastWeekData.sessions },
    { label: 'Duration', value: `${(thisWeekData.duration / 60).toFixed(1)}m`, lastValue: lastWeekData.duration },
  ].forEach(stat => {
    const row = thisStats.append('div').attr('class', 'comparison-stat');
    row.append('span').attr('class', 'comparison-stat-label').text(stat.label);
    row.append('span').attr('class', 'comparison-stat-value').text(
      typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value
    );
  });

  // Last week
  const lastWeek = div.append('div').attr('class', 'comparison-period');
  lastWeek.append('div').attr('class', 'comparison-label').text('Last Week');
  const lastStats = lastWeek.append('div').attr('class', 'comparison-stats');

  [
    { label: 'Words', value: lastWeekData.words, thisValue: thisWeekData.words },
    { label: 'Sessions', value: lastWeekData.sessions, thisValue: thisWeekData.sessions },
    { label: 'Duration', value: `${(lastWeekData.duration / 60).toFixed(1)}m`, thisValue: thisWeekData.duration },
  ].forEach(stat => {
    const row = lastStats.append('div').attr('class', 'comparison-stat');
    row.append('span').attr('class', 'comparison-stat-label').text(stat.label);
    const valueSpan = row.append('span').attr('class', 'comparison-stat-value');

    if (typeof stat.value === 'number') {
      valueSpan.text(stat.value.toLocaleString());
      if (stat.thisValue > stat.value) {
        valueSpan.classed('down', true);
      } else if (stat.thisValue < stat.value) {
        valueSpan.classed('up', true);
      }
    } else {
      valueSpan.text(stat.value);
    }
  });
}

// Render word cloud
function renderWordCloud(containerId, wordFrequency) {
  const container = d3.select(containerId);
  container.html('');

  // Filter stopwords and get top words
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'i', 'you', 'he', 'she',
    'it', 'we', 'they', 'me', 'him', 'her', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that',
    'these', 'what', 'which', 'who', 'where', 'when', 'why', 'how', 'all', 'each', 'some', 'no', 'not',
    'only', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'if', 'because',
    'about', 'any', 'up', 'down', 'out', 'off', 'over', 'going', 'gonna', 'like', 'okay', 'ok', 'yeah',
    'yes', 'um', 'uh', 'ah', 'oh', 'well', 'right', 'actually', 'basically', 'really', 'thing', 'things',
    'something', 'know', 'think', 'want', 'get', 'got', 'make', 'way', 'see', 'go', 'one', 'two'
  ]);

  const words = Object.entries(wordFrequency)
    .filter(([word, count]) => word.length > 2 && !stopwords.has(word) && count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  if (words.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No data yet');
    return;
  }

  const maxCount = words[0][1];
  const minCount = words[words.length - 1][1];

  const div = container.append('div').attr('class', 'word-cloud-container');

  words.forEach(([word, count]) => {
    // Scale font size between 12px and 36px
    const size = 12 + ((count - minCount) / (maxCount - minCount || 1)) * 24;
    div.append('span')
      .attr('class', 'cloud-word')
      .style('font-size', `${size}px`)
      .style('font-weight', size > 20 ? '600' : '400')
      .text(word)
      .on('mouseover', (event) => showTooltip(event, `${word}: ${count}`))
      .on('mouseout', hideTooltip);
  });
}

// Render sentiment chart
function renderSentimentChart(containerId, sentimentArray) {
  const container = d3.select(containerId);
  container.html('');

  if (sentimentArray.length === 0) {
    container.append('div').attr('class', 'analytics-empty').text('No data yet');
    return;
  }

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 120 - margin.top - margin.bottom;

  if (width <= 0) return;

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(sentimentArray, d => new Date(d.date)))
    .range([0, width]);

  const yExtent = d3.extent(sentimentArray, d => d.score);
  const yMax = Math.max(Math.abs(yExtent[0]), Math.abs(yExtent[1]), 1);

  const y = d3.scaleLinear()
    .domain([-yMax, yMax])
    .range([height, 0]);

  // Zero line
  svg.append('line')
    .attr('x1', 0)
    .attr('x2', width)
    .attr('y1', y(0))
    .attr('y2', y(0))
    .attr('stroke', CHART_COLORS.border)
    .attr('stroke-dasharray', '4,4');

  // Area for positive
  const areaPositive = d3.area()
    .x(d => x(new Date(d.date)))
    .y0(y(0))
    .y1(d => y(Math.max(0, d.score)))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(sentimentArray)
    .attr('fill', CHART_COLORS.green)
    .attr('fill-opacity', 0.3)
    .attr('d', areaPositive);

  // Area for negative
  const areaNegative = d3.area()
    .x(d => x(new Date(d.date)))
    .y0(y(0))
    .y1(d => y(Math.min(0, d.score)))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(sentimentArray)
    .attr('fill', CHART_COLORS.orange)
    .attr('fill-opacity', 0.3)
    .attr('d', areaNegative);

  // Line
  const line = d3.line()
    .x(d => x(new Date(d.date)))
    .y(d => y(d.score))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(sentimentArray)
    .attr('fill', 'none')
    .attr('stroke', CHART_COLORS.muted)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Dots
  svg.selectAll('.dot')
    .data(sentimentArray)
    .enter()
    .append('circle')
    .attr('cx', d => x(new Date(d.date)))
    .attr('cy', d => y(d.score))
    .attr('r', 3)
    .attr('fill', d => d.score >= 0 ? CHART_COLORS.green : CHART_COLORS.orange)
    .on('mouseover', (event, d) => {
      showTooltip(event, `${d.date}: +${d.positive}/-${d.negative}`);
    })
    .on('mouseout', hideTooltip);

  // X axis
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d')));

  // Legend
  const legend = container.append('div').attr('class', 'sentiment-legend');

  const pos = legend.append('div').attr('class', 'sentiment-legend-item');
  pos.append('div').attr('class', 'sentiment-dot positive');
  pos.append('span').text('Positive');

  const neg = legend.append('div').attr('class', 'sentiment-legend-item');
  neg.append('div').attr('class', 'sentiment-dot negative');
  neg.append('span').text('Negative');
}

// Main render function called from renderer.js
function renderAnalytics(entries) {
  console.log('[Analytics] renderAnalytics called with', entries ? entries.length : 0, 'entries');

  const allContainers = [
    '#streaks-card', '#records-card', '#goals-card', '#activity-heatmap',
    '#activity-yearly', '#words-chart', '#time-saved-chart', '#wpm-chart', '#mode-donut',
    '#period-comparison', '#filler-words', '#vocabulary-diversity',
    '#common-phrases', '#wpm-by-hour', '#session-histogram',
    '#word-cloud', '#sentiment-chart'
  ];

  if (!entries || entries.length === 0) {
    allContainers.forEach(id => {
      d3.select(id).html('<div class="analytics-empty">No transcriptions yet</div>');
    });
    return;
  }

  const data = processData(entries);
  cachedAnalyticsData = data;

  // Productivity & Gamification
  renderStreaks('#streaks-card', data.currentStreak, data.longestStreak);
  renderRecords('#records-card', data.maxWpm, data.maxWordsInDay, data.longestSession);
  renderGoals('#goals-card', data.todayData, data.thisWeekWords);

  // Original charts - only render the visible heatmap
  const yearlyTab = document.querySelector('.activity-tab[data-view="yearly"]');
  const isYearlyActive = yearlyTab && yearlyTab.classList.contains('active');

  renderActivityHeatmap('#activity-heatmap', data.activityMatrix);
  if (isYearlyActive) {
    renderYearlyHeatmap('#activity-yearly', data.dailyData);
  }
  renderWordsChart('#words-chart', data.dailyArray);
  renderTimeSavedChart('#time-saved-chart', data.dailyArray);
  renderWpmChart('#wpm-chart', data.dailyArray);
  renderModeDonut('#mode-donut', data.modeCounts);

  // Period comparison
  renderPeriodComparison('#period-comparison', data.thisWeekData, data.lastWeekData);

  // Speech patterns
  renderFillerWords('#filler-words', data.fillerCounts);
  renderVocabulary('#vocabulary-diversity', data.uniqueWords, data.totalWords);
  renderCommonPhrases('#common-phrases', data.topBigrams, data.topTrigrams);

  // Time analysis
  renderWpmByHour('#wpm-by-hour', data.avgWpmByHour);
  renderSessionHistogram('#session-histogram', data.sessionDurations);

  // Content
  renderWordCloud('#word-cloud', data.wordFrequency);
  renderSentimentChart('#sentiment-chart', data.sentimentArray);
}

// Handle window resize - use cached data for faster re-render
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const analyticsPanel = document.getElementById('analytics-panel');
    if (analyticsPanel && analyticsPanel.style.display !== 'none' && cachedAnalyticsData) {
      // Re-render responsive charts (heatmaps are fixed size, no need to re-render)
      renderWordsChart('#words-chart', cachedAnalyticsData.dailyArray);
      renderTimeSavedChart('#time-saved-chart', cachedAnalyticsData.dailyArray);
      renderWpmChart('#wpm-chart', cachedAnalyticsData.dailyArray);
      renderModeDonut('#mode-donut', cachedAnalyticsData.modeCounts);
      renderWpmByHour('#wpm-by-hour', cachedAnalyticsData.avgWpmByHour);
      renderSessionHistogram('#session-histogram', cachedAnalyticsData.sessionDurations);
      renderWordCloud('#word-cloud', cachedAnalyticsData.wordFrequency);
      renderSentimentChart('#sentiment-chart', cachedAnalyticsData.sentimentArray);
    }
  }, 100);
});

// Activity heatmap tab switching
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.activity-tab');
  const hourlyView = document.getElementById('activity-heatmap');
  const yearlyView = document.getElementById('activity-yearly');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Switch view and re-render
      const view = tab.dataset.view;
      if (view === 'hourly') {
        hourlyView.style.display = 'block';
        yearlyView.style.display = 'none';
        if (cachedAnalyticsData) {
          renderActivityHeatmap('#activity-heatmap', cachedAnalyticsData.activityMatrix);
        }
      } else {
        hourlyView.style.display = 'none';
        yearlyView.style.display = 'block';
        if (cachedAnalyticsData) {
          renderYearlyHeatmap('#activity-yearly', cachedAnalyticsData.dailyData);
        }
      }
    });
  });
});
