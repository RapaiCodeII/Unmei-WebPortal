/* UNMEI portal charts — D3 v7 based, self-hosted, no Chart.js.
   Palette: #C0392B, #2563EB, #16A34A, #F59E0B, #8B5CF6, #EC4899 */
(function () {
  'use strict';

  var FONT = "'Inter', 'Montserrat', sans-serif";
  var GRID = '#f3f4f6';
  var AXIS_TEXT = '#6b7280';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- shared tooltip ----------
  var tipEl = null;
  function tip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'unmei-chart-tip';
      tipEl.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;background:#111827;color:#fff;' +
        'padding:10px 12px;border-radius:8px;font:12px/1.5 ' + FONT + ';box-shadow:0 8px 24px rgba(0,0,0,0.25);' +
        'opacity:0;transition:opacity 0.12s ease;max-width:240px;';
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function showTip(html, event) {
    var t = tip();
    t.innerHTML = html;
    t.style.opacity = '1';
    var x = event.clientX + 14;
    var y = event.clientY + 14;
    if (x + 250 > window.innerWidth) x = event.clientX - 250;
    if (y + 120 > window.innerHeight) y = event.clientY - 110;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }
  function hideTip() { tip().style.opacity = '0'; }

  // ---------- host: converts <canvas> placeholders to <div> and clears ----------
  function host(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (el.tagName === 'CANVAS') {
      var div = document.createElement('div');
      div.id = id;
      div.className = el.className || '';
      div.style.cssText = el.style.cssText || '';
      div.style.width = '100%';
      el.parentNode.replaceChild(div, el);
      el = div;
    }
    el.innerHTML = '';
    return el;
  }

  // ---------- responsive: re-render on container resize ----------
  function mount(el, render) {
    el.__unmeiRender = render;
    if (window.ResizeObserver) {
      if (el.__unmeiRO) el.__unmeiRO.disconnect();
      var last = 0;
      el.__unmeiRO = new ResizeObserver(function () {
        var now = Date.now();
        if (now - last < 180) return;
        last = now;
        if (el.__unmeiSkipFirst) { el.__unmeiSkipFirst = false; return; }
        render(false);
      });
      el.__unmeiSkipFirst = true;
      el.__unmeiRO.observe(el);
    }
  }

  function svgFor(el, height) {
    var width = el.clientWidth || el.parentNode.clientWidth || 480;
    var svg = d3.select(el).append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('preserveAspectRatio', 'xMidYMid meet');
    return { svg: svg, width: width, height: height };
  }

  // ---------- radial arc gauge (replaces doughnut gauge) ----------
  function radialGauge(id, opts) {
    var el = host(id);
    if (!el) return;
    var size = opts.size || 92;
    var stroke = opts.stroke || 10;
    var pct = Math.max(0, Math.min(1, opts.value / (opts.max || 100)));

    function render() {
      el.innerHTML = '';
      var r = size / 2;
      var svg = d3.select(el).append('svg')
        .attr('width', size).attr('height', size)
        .attr('viewBox', '0 0 ' + size + ' ' + size)
        .style('display', 'block').style('margin', '0 auto');
      var g = svg.append('g').attr('transform', 'translate(' + r + ',' + r + ')');
      var arc = d3.arc().innerRadius(r - stroke).outerRadius(r).cornerRadius(stroke / 2);

      g.append('path')
        .attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI }))
        .attr('fill', opts.track || '#e5e7eb');

      var valPath = g.append('path').attr('fill', opts.color);
      valPath.transition().duration(1200).ease(d3.easeCubicOut)
        .attrTween('d', function () {
          var i = d3.interpolate(0, pct * 2 * Math.PI);
          return function (t) { return arc({ startAngle: 0, endAngle: i(t) }); };
        });
    }
    mount(el, render);
    render(true);
  }

  // ---------- HTML legend ----------
  function legend(el, series) {
    var row = document.createElement('div');
    row.className = 'unmei-chart-legend';
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:center;margin:0 0 10px;';
    series.forEach(function (s) {
      var item = document.createElement('span');
      item.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font:600 12px ' + FONT + ';color:#374151;';
      var dot = document.createElement('span');
      dot.style.cssText = 'width:9px;height:9px;border-radius:50%;background:' + s.color + ';display:inline-block;';
      item.appendChild(dot);
      item.appendChild(document.createTextNode(s.name));
      row.appendChild(item);
    });
    el.appendChild(row);
  }

  // ---------- multi-series line chart ----------
  function multiLine(id, opts) {
    var el = host(id);
    if (!el) return;
    var labels = opts.labels || [];
    var series = opts.series || [];
    var yMax = opts.yMax || 100;
    var height = opts.height || 260;

    function render() {
      el.innerHTML = '';
      if (opts.legend !== false) legend(el, series);
      var m = { top: 8, right: 14, bottom: 26, left: 34 };
      var box = svgFor(el, height);
      var svg = box.svg;
      var w = box.width - m.left - m.right;
      var h = height - m.top - m.bottom;
      var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

      var x = d3.scalePoint().domain(labels).range([0, w]).padding(0.4);
      var y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);
      var tickStep = Math.max(1, Math.ceil(labels.length / Math.max(4, Math.floor(w / 46))));
      var tickVals = labels.filter(function (l, i) { return i % tickStep === 0 || i === labels.length - 1; });

      g.append('g').selectAll('line').data(y.ticks(5)).enter().append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', function (d) { return y(d); }).attr('y2', function (d) { return y(d); })
        .attr('stroke', GRID).attr('stroke-dasharray', '4 4');

      g.append('g').attr('transform', 'translate(0,' + h + ')')
        .call(d3.axisBottom(x).tickValues(tickVals).tickSize(0).tickPadding(10))
        .call(function (s) { s.select('.domain').remove(); s.selectAll('text').attr('fill', AXIS_TEXT).style('font', '11px ' + FONT); });

      g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8))
        .call(function (s) { s.select('.domain').remove(); s.selectAll('text').attr('fill', AXIS_TEXT).style('font', '11px ' + FONT); });

      var line = d3.line().curve(d3.curveMonotoneX)
        .x(function (d, i) { return x(labels[i]); })
        .y(function (d) { return y(d == null ? 0 : d); });

      series.forEach(function (s, si) {
        if (s.fill) {
          var area = d3.area().curve(d3.curveMonotoneX)
            .x(function (d, i) { return x(labels[i]); })
            .y0(h)
            .y1(function (d) { return y(d == null ? 0 : d); });
          g.append('path').datum(s.data)
            .attr('d', area)
            .attr('fill', s.color).attr('fill-opacity', 0.10);
        }
        var path = g.append('path').datum(s.data)
          .attr('d', line)
          .attr('fill', 'none')
          .attr('stroke', s.color)
          .attr('stroke-width', si === 0 ? 3 : 2.5)
          .attr('stroke-linecap', 'round');
        var len = path.node().getTotalLength();
        path.attr('stroke-dasharray', len + ' ' + len).attr('stroke-dashoffset', len)
          .transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
          .on('end', function () { path.attr('stroke-dasharray', null); });

        g.selectAll('.pt-' + si).data(s.data).enter().append('circle')
          .attr('cx', function (d, i) { return x(labels[i]); })
          .attr('cy', function (d) { return y(d == null ? 0 : d); })
          .attr('r', si === 0 ? 4 : 3)
          .attr('fill', '#fff').attr('stroke', s.color).attr('stroke-width', 2);
      });

      // hover column: tooltip with all series values (interaction mode index)
      g.append('rect').attr('width', w).attr('height', h).attr('fill', 'transparent')
        .on('mousemove', function (event) {
          var mx = d3.pointer(event)[0];
          var best = 0, bd = Infinity;
          labels.forEach(function (l, i) {
            var dd = Math.abs(x(l) - mx);
            if (dd < bd) { bd = dd; best = i; }
          });
          var html = '<strong>' + esc(labels[best]) + '</strong>';
          series.forEach(function (s) {
            var v = s.data[best];
            html += '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">' +
              '<span style="width:8px;height:8px;border-radius:50%;background:' + s.color + ';display:inline-block;"></span>' +
              esc(s.name) + ': <strong>' + (v == null ? '–' : esc(v)) + '</strong></div>';
          });
          showTip(html, event);
        })
        .on('mouseleave', hideTip);
    }
    mount(el, render);
    render(true);
  }

  // ---------- horizontal stacked bar (module completion / course breakdown) ----------
  function horizontalStackedBar(id, opts) {
    var el = host(id);
    if (!el) return;
    var segments = opts.segments || [];
    var max = opts.max || d3.sum(segments, function (s) { return s.value; }) || 1;
    var height = opts.height || 64;

    function render() {
      el.innerHTML = '';
      var m = { top: 4, right: 8, bottom: 4, left: 8 };
      var box = svgFor(el, height);
      var svg = box.svg;
      var w = box.width - m.left - m.right;
      var barH = Math.min(26, height - 8);
      var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');
      var x = d3.scaleLinear().domain([0, max]).range([0, w]);

      var offset = 0;
      segments.forEach(function (s) {
        var segW = x(s.value);
        g.append('rect')
          .attr('x', offset).attr('y', (height - 8 - barH) / 2)
          .attr('width', 0).attr('height', barH)
          .attr('rx', 6).attr('fill', s.color)
          .on('mousemove', function (event) {
            showTip('<strong>' + esc(s.label) + '</strong>: ' + esc(s.value), event);
          })
          .on('mouseleave', hideTip)
          .transition().duration(800).ease(d3.easeCubicOut)
          .attr('width', segW);
        offset += segW;
      });

      if (opts.legend !== false) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:center;margin-top:10px;';
        segments.forEach(function (s) {
          var item = document.createElement('span');
          item.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font:11px ' + FONT + ';color:#374151;';
          var dot = document.createElement('span');
          dot.style.cssText = 'width:9px;height:9px;border-radius:3px;background:' + s.color + ';display:inline-block;';
          item.appendChild(dot);
          item.appendChild(document.createTextNode(s.label + ' (' + s.value + ')'));
          row.appendChild(item);
        });
        el.appendChild(row);
      }
    }
    mount(el, render);
    render(true);
  }

  // ---------- area chart (admin enrollment trend) ----------
  function areaChart(id, opts) {
    var el = host(id);
    if (!el) return;
    var labels = opts.labels || [];
    var values = opts.values || [];
    var color = opts.color || '#C0392B';
    var height = opts.height || 240;

    function render() {
      el.innerHTML = '';
      var m = { top: 10, right: 14, bottom: 26, left: 36 };
      var box = svgFor(el, height);
      var svg = box.svg;
      var w = box.width - m.left - m.right;
      var h = height - m.top - m.bottom;
      var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

      var x = d3.scalePoint().domain(labels).range([0, w]).padding(0.3);
      var y = d3.scaleLinear().domain([0, Math.max(4, d3.max(values) || 0)]).nice().range([h, 0]);

      g.append('g').selectAll('line').data(y.ticks(4)).enter().append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', function (d) { return y(d); }).attr('y2', function (d) { return y(d); })
        .attr('stroke', GRID).attr('stroke-dasharray', '4 4');

      g.append('g').attr('transform', 'translate(0,' + h + ')')
        .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
        .call(function (s) { s.select('.domain').remove(); s.selectAll('text').attr('fill', AXIS_TEXT).style('font', '11px ' + FONT); });

      g.append('g')
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')).tickSize(0).tickPadding(8))
        .call(function (s) { s.select('.domain').remove(); s.selectAll('text').attr('fill', AXIS_TEXT).style('font', '11px ' + FONT); });

      var defs = svg.append('defs');
      var grad = defs.append('linearGradient').attr('id', 'unmei-area-' + id)
        .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
      grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.22);
      grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);

      var area = d3.area().curve(d3.curveMonotoneX)
        .x(function (d, i) { return x(labels[i]); }).y0(h).y1(function (d) { return y(d); });
      var line = d3.line().curve(d3.curveMonotoneX)
        .x(function (d, i) { return x(labels[i]); }).y(function (d) { return y(d); });

      g.append('path').datum(values).attr('d', area).attr('fill', 'url(#unmei-area-' + id + ')');
      var path = g.append('path').datum(values)
        .attr('d', line).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.5);
      var len = path.node().getTotalLength();
      path.attr('stroke-dasharray', len + ' ' + len).attr('stroke-dashoffset', len)
        .transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
        .on('end', function () { path.attr('stroke-dasharray', null); });

      g.selectAll('.pt').data(values).enter().append('circle')
        .attr('cx', function (d, i) { return x(labels[i]); })
        .attr('cy', function (d) { return y(d); })
        .attr('r', 3.5).attr('fill', '#fff').attr('stroke', color).attr('stroke-width', 2)
        .on('mousemove', function (event, d) {
          var i = values.indexOf(d);
          showTip('<strong>' + esc(labels[i]) + '</strong><br>' + esc(d) + ' enrollment' + (d === 1 ? '' : 's'), event);
        })
        .on('mouseleave', hideTip);
    }
    mount(el, render);
    render(true);
  }

  // ---------- grouped bar (admin revenue trend) ----------
  function groupedBar(id, opts) {
    var el = host(id);
    if (!el) return;
    var labels = opts.labels || [];
    var series = opts.series || [];
    var height = opts.height || 240;
    var fmt = opts.format || function (v) { return v; };

    function render() {
      el.innerHTML = '';
      if (opts.legend !== false) legend(el, series);
      var m = { top: 8, right: 14, bottom: 26, left: 48 };
      var box = svgFor(el, height);
      var svg = box.svg;
      var w = box.width - m.left - m.right;
      var h = height - m.top - m.bottom;
      var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

      var x0 = d3.scaleBand().domain(labels).range([0, w]).paddingInner(0.3).paddingOuter(0.15);
      var x1 = d3.scaleBand().domain(series.map(function (s) { return s.name; })).range([0, x0.bandwidth()]).padding(0.12);
      var maxV = opts.yMax || d3.max(series, function (s) { return d3.max(s.values) || 0; }) || 0;
      var y = d3.scaleLinear().domain([0, Math.max(4, maxV)]).nice().range([h, 0]);

      g.append('g').selectAll('line').data(y.ticks(4)).enter().append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', function (d) { return y(d); }).attr('y2', function (d) { return y(d); })
        .attr('stroke', GRID).attr('stroke-dasharray', '4 4');

      g.append('g').attr('transform', 'translate(0,' + h + ')')
        .call(d3.axisBottom(x0).tickSize(0).tickPadding(10))
        .call(function (s) { s.select('.domain').remove(); s.selectAll('text').attr('fill', AXIS_TEXT).style('font', '11px ' + FONT); });

      g.append('g')
        .call(d3.axisLeft(y).ticks(4).tickFormat(fmt).tickSize(0).tickPadding(8))
        .call(function (s) { s.select('.domain').remove(); s.selectAll('text').attr('fill', AXIS_TEXT).style('font', '10px ' + FONT); });

      labels.forEach(function (label, li) {
        series.forEach(function (s) {
          var v = s.values[li] || 0;
          g.append('rect')
            .attr('x', x0(label) + x1(s.name))
            .attr('y', h)
            .attr('width', x1.bandwidth())
            .attr('height', 0)
            .attr('rx', 4)
            .attr('fill', s.color)
            .on('mousemove', function (event) {
              showTip('<strong>' + esc(label) + '</strong><br>' + esc(s.name) + ': ' + esc(fmt(v)), event);
            })
            .on('mouseleave', hideTip)
            .transition().duration(800).ease(d3.easeCubicOut)
            .attr('y', y(v))
            .attr('height', h - y(v));
        });
      });
    }
    mount(el, render);
    render(true);
  }

  // ---------- radar (skill breakdown — admin student view) ----------
  function radarChart(id, opts) {
    var el = host(id);
    if (!el) return;
    var axes = opts.axes || [];
    var color = opts.color || '#C0392B';
    var size = opts.size || 240;

    function render() {
      el.innerHTML = '';
      var r = size / 2 - 34;
      var cx = size / 2, cy = size / 2;
      var svg = d3.select(el).append('svg')
        .attr('width', '100%').attr('height', size)
        .attr('viewBox', '0 0 ' + size + ' ' + size);
      var g = svg.append('g').attr('transform', 'translate(' + cx + ',' + cy + ')');
      var n = Math.max(3, axes.length);
      var angle = function (i) { return (Math.PI * 2 * i) / n - Math.PI / 2; };
      var pt = function (i, val) { return [Math.cos(angle(i)) * r * val, Math.sin(angle(i)) * r * val]; };

      [0.25, 0.5, 0.75, 1].forEach(function (lvl) {
        var ring = d3.range(n).map(function (i) { return pt(i, lvl); });
        g.append('path').attr('d', d3.line()(ring) + 'Z')
          .attr('fill', 'none').attr('stroke', lvl === 1 ? '#e5e7eb' : GRID).attr('stroke-width', 1);
      });
      axes.forEach(function (a, i) {
        var p = pt(i, 1);
        g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', p[0]).attr('y2', p[1]).attr('stroke', GRID);
        var lp = pt(i, 1.22);
        g.append('text').attr('x', lp[0]).attr('y', lp[1])
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('fill', AXIS_TEXT).style('font', '600 10px ' + FONT)
          .text(a.label);
      });

      var dataPts = axes.map(function (a, i) { return pt(i, Math.max(0, Math.min(1, a.value / 100))); });
      g.append('path').attr('d', d3.line()(dataPts) + 'Z')
        .attr('fill', color).attr('fill-opacity', 0.16)
        .attr('stroke', color).attr('stroke-width', 2)
        .attr('opacity', 0)
        .transition().duration(800).attr('opacity', 1);

      axes.forEach(function (a, i) {
        var p = pt(i, Math.max(0, Math.min(1, a.value / 100)));
        g.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 3.5)
          .attr('fill', '#fff').attr('stroke', color).attr('stroke-width', 2)
          .on('mousemove', function (event) {
            showTip('<strong>' + esc(a.label) + '</strong>: ' + esc(a.value) + '%', event);
          })
          .on('mouseleave', hideTip);
      });
    }
    mount(el, render);
    render(true);
  }

  window.UnmeiCharts = {
    host: host,
    radialGauge: radialGauge,
    multiLine: multiLine,
    horizontalStackedBar: horizontalStackedBar,
    areaChart: areaChart,
    groupedBar: groupedBar,
    radarChart: radarChart
  };
})();
