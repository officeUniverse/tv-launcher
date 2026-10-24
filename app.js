// Tile presses go to ntfy.sh; bridge.py on the Mac opens the app and acks on TOPIC-ack.
var TOPIC = 'tvl-cb2547f08fc89ed93bf18ce1';
var DOCK = [
  ['Netflix', 'netflix', '1'], ['YouTube', 'youtube', '3'], ['Disney+', 'disneyplus', '295'],
  ['Prime Video', 'primevideo', '2'], ['Apple TV', 'appletv', '351']
];

var dock = document.getElementById('dock');
var tiles = DOCK.map(function (d) {
  var el = document.createElement('div');
  el.className = 'tile';
  el.dataset.cmd = 'app:' + d[2];
  el.dataset.name = d[0];
  el.innerHTML = '<img src="assets/icons/' + d[1] + '.svg" alt=""><div>' + d[0] + '</div>';
  dock.appendChild(el);
  return el;
});
var pills = [].slice.call(document.querySelectorAll('.pill'));

var grid = document.getElementById('grid');
var apps = (window.ALL_APPS || []).map(function (a) {
  var el = document.createElement('div');
  el.className = 'app';
  el.dataset.cmd = 'app:' + a.id;
  el.dataset.name = a.name;
  el.innerHTML = '<img src="' + a.icon + '" alt=""><span></span>';
  el.lastChild.textContent = a.name;
  grid.appendChild(el);
  return el;
});

// Focus model: one row each for the top pills and the dock, a grid for All apps.
var row = 'dock', col = 0, current = null;
function list() { return row === 'top' ? pills : row === 'dock' ? tiles : apps; }
function focus() {
  if (current) current.classList.remove('focus');
  var l = list();
  col = Math.max(0, Math.min(col, l.length - 1));
  current = l[col];
  current.classList.add('focus');
  if (row === 'grid') current.scrollIntoView({ block: 'nearest' });
}

function gridCols() {
  var first = apps[0] && apps[0].offsetTop, n = 0;
  while (n < apps.length && apps[n].offsetTop === first) n++;
  return n || 1;
}

var all = document.getElementById('all');
function openAll(open) {
  all.classList.toggle('open', open);
  row = open ? 'grid' : 'dock';
  col = 0;
  focus();
}

// Remote: arrows move, OK activates, Back closes All apps.
var BACK = { 8: 1, 27: 1, 461: 1, 10009: 1 };
document.addEventListener('keydown', function (e) {
  var k = e.keyCode;
  debug('key ' + k);
  if (row === 'grid') {
    var c = gridCols();
    if (k === 37) col--;
    else if (k === 39) col++;
    else if (k === 38) col -= c;
    else if (k === 40) col += c;
    else if (k === 13) activate(current);
    else if (BACK[k]) openAll(false);
    else return;
  } else {
    if (k === 37) col--;
    else if (k === 39) col++;
    else if (k === 38 && row === 'dock') { row = 'top'; col = pills.length - 1; }
    else if (k === 40 && row === 'top') { row = 'dock'; col = 0; }
    else if (k === 13) activate(current);
    else return;
  }
  e.preventDefault();
  focus();
});

function activate(el) {
  var cmd = el.dataset.cmd;
  if (cmd === 'all') return openAll(true);
  send(cmd, el.dataset.name || el.textContent.trim());
}

// Send a command and report back: the Mac acks within a second or two when it is on.
var toast = document.getElementById('toast'), toastTimer, waiting = null;
function say(text, ms) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(function () { toast.classList.remove('show'); }, ms);
}
function send(cmd, label) {
  say('Opening ' + label + '…');
  clearTimeout(waiting);
  waiting = setTimeout(function () { say('No answer from your Mac. Is it on?', 6000); }, 6000);
  var x = new XMLHttpRequest();
  x.open('POST', 'https://ntfy.sh/' + TOPIC);
  x.onerror = function () { clearTimeout(waiting); say('No internet connection', 5000); };
  x.send(cmd);
}
try {
  var acks = new EventSource('https://ntfy.sh/' + TOPIC + '-ack/sse');
  acks.onmessage = function (e) {
    var m = JSON.parse(e.data);
    if (m.event !== 'message' || !waiting) return;
    clearTimeout(waiting);
    waiting = null;
    if (m.message.indexOf('ok:') === 0) say('Opening…', 2500);
    else say('Couldn’t do that (' + m.message.slice(4) + ')', 5000);
  };
} catch (e) { debug('no EventSource: ' + e); }

function tick() {
  var d = new Date();
  document.getElementById('clock').textContent = d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
}
tick();
setInterval(tick, 5000);

// Scale the 1280x720 stage to fit non-TV screens (scale is 1 on the TV).
function fit() {
  var s = Math.min(innerWidth / 1280, innerHeight / 720);
  document.getElementById('stage').style.transform = s === 1 ? '' : 'scale(' + s + ')';
}
fit();
addEventListener('resize', fit);

// Once per load, tell the Mac how the TV opened this page, so it can reopen it.
(function hello() {
  var info = { href: location.href, ref: document.referrer, name: window.name, hist: history.length };
  Object.getOwnPropertyNames(window).forEach(function (k) {
    if (/^Hisense_Get.*(App|Id|Url|URL|Launch|Channel|Source|Page)/.test(k)) {
      try { info[k.slice(11)] = String(window[k]()).slice(0, 200); } catch (e) {}
    }
  });
  var x = new XMLHttpRequest();
  x.open('POST', 'https://ntfy.sh/' + TOPIC);
  x.send('hello:' + JSON.stringify(info).slice(0, 3800));
})();

var dbg = document.getElementById('debug');
if (/[?&]debug=1/.test(location.search)) dbg.style.display = 'block';
function debug(t) { dbg.textContent = t + '  ' + new Date().toLocaleTimeString(); }

focus();
