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

  // Daily aggregates
  const dailyData = {};

  // Mode counts
  const modeCounts = { transcribe: 0, greppy: 0, cleanup: 0, plan: 0 };

  entries.forEach(entry => {
    const date = new Date(entry.timestamp);
    const dayOfWeek = date.getDay(); // 0 = Sunday
    const hour = date.getHours();
    const dateKey = date.toISOString().split('T')[0];

    // Activity matrix
    activityMatrix[dayOfWeek][hour]++;

    // Daily data
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        words: 0,
        duration: 0,
        wpmSum: 0,
        wpmCount: 0,
      };
    }
    dailyData[dateKey].words += entry.word_count || 0;
    dailyData[dateKey].duration += entry.duration_seconds || 0;
    if (entry.wpm) {
      dailyData[dateKey].wpmSum += entry.wpm;
      dailyData[dateKey].wpmCount++;
    }

    // Mode counts
    const mode = entry.mode || 'transcribe';
    if (modeCounts.hasOwnProperty(mode)) {
      modeCounts[mode]++;
    }
  });

  // Convert daily data to sorted array
  const dailyArray = Object.values(dailyData)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate cumulative time saved
  let cumulativeTimeSaved = 0;
  dailyArray.forEach(d => {
    const typingTimeMinutes = d.words / 40; // 40 WPM typing
    const dictatingTimeMinutes = d.duration / 60;
    d.timeSavedToday = Math.max(0, typingTimeMinutes - dictatingTimeMinutes);
    cumulativeTimeSaved += d.timeSavedToday;
    d.cumulativeTimeSaved = cumulativeTimeSaved;
    d.avgWpm = d.wpmCount > 0 ? Math.round(d.wpmSum / d.wpmCount) : null;
  });

  return {
    activityMatrix,
    dailyArray,
    modeCounts,
  };
}

// Render activity heatmap
function renderActivityHeatmap(containerId, activityMatrix) {
  const container = d3.select(containerId);
  container.html('');

  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 140 - margin.top - margin.bottom;

  if (width <= 0) return;

  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = d3.range(24);

  const cellWidth = width / 24;
  const cellHeight = height / 7;

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
        .attr('x', hour * cellWidth)
        .attr('y', dayIndex * cellHeight)
        .attr('width', cellWidth - 2)
        .attr('height', cellHeight - 2)
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
    .attr('y', (d, i) => i * cellHeight + cellHeight / 2)
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
    .attr('x', d => d * cellWidth + cellWidth / 2)
    .attr('y', height + 15)
    .attr('text-anchor', 'middle')
    .attr('fill', CHART_COLORS.muted)
    .attr('font-size', '9px')
    .text(d => `${d}:00`);
}

// Render words over time area chart
function renderWordsChart(containerId, dailyArray) {
  const container = d3.select(containerId);
  container.html('');

  if (dailyArray.length < 2) {
    container.append('div').attr('class', 'analytics-empty').text('Need more data');
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

  if (dailyArray.length < 2) {
    container.append('div').attr('class', 'analytics-empty').text('Need more data');
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

  if (wpmData.length < 2) {
    container.append('div').attr('class', 'analytics-empty').text('Need more data');
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

// Main render function called from renderer.js
function renderAnalytics(entries) {
  console.log('[Analytics] renderAnalytics called with', entries ? entries.length : 0, 'entries');

  if (!entries || entries.length === 0) {
    // Show empty state in all charts
    ['#activity-heatmap', '#words-chart', '#time-saved-chart', '#wpm-chart', '#mode-donut'].forEach(id => {
      d3.select(id).html('<div class="analytics-empty">No transcriptions yet</div>');
    });
    return;
  }

  const { activityMatrix, dailyArray, modeCounts } = processData(entries);

  renderActivityHeatmap('#activity-heatmap', activityMatrix);
  renderWordsChart('#words-chart', dailyArray);
  renderTimeSavedChart('#time-saved-chart', dailyArray);
  renderWpmChart('#wpm-chart', dailyArray);
  renderModeDonut('#mode-donut', modeCounts);
}

// Handle window resize
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const analyticsPanel = document.getElementById('analytics-panel');
    if (analyticsPanel && analyticsPanel.style.display !== 'none') {
      // Re-render if analytics is visible
      if (typeof loadHistory === 'function') {
        const history = loadHistory();
        renderAnalytics(history.entries || []);
      }
    }
  }, 250);
});
