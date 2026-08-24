const $ = selector => document.querySelector(selector);

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];
const MONTHS_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEK = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

let selected = new Date();
selected.setHours(12, 0, 0, 0);
let monthCursor = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
let yearCursor = selected.getFullYear();
let plannerCursor = selected.getFullYear();

const KEY = 'pajo-agenda-v1';
let db = JSON.parse(localStorage.getItem(KEY) || '{}');

const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayData = date => db[key(date)] || (db[key(date)] = {notes: '', tasks: []});

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
  $('#saveState').textContent = 'Guardado automaticamente';
}

function getData(date) {
  return db[key(date)];
}

function hasData(date) {
  const data = getData(date);
  return Boolean(data && (data.notes?.trim() || data.tasks?.some(task => task.text?.trim())));
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function openDay(date) {
  selected = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  monthCursor = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  yearCursor = date.getFullYear();
  plannerCursor = date.getFullYear();
  show('day');
}

function renderDay() {
  const date = selected;
  const data = dayData(date);
  $('#dayWeek').textContent = WEEK[date.getDay()];
  $('#dayNumber').textContent = date.getDate();
  $('#dayMonthYear').textContent = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  $('#notes').value = data.notes || '';

  const root = $('#tasks');
  root.innerHTML = '';

  data.tasks.forEach((task, index) => {
    const row = document.createElement('div');
    row.className = `task-row${task.done ? ' done' : ''}`;
    row.innerHTML = `<input type="checkbox" ${task.done ? 'checked' : ''}><input type="time" value="${task.time || ''}"><input type="text" value="${escapeHtml(task.text || '')}" placeholder="Tarefa ou compromisso"><button class="delete" title="Apagar">×</button>`;

    const [check, time, text, remove] = row.children;
    check.onchange = () => {
      task.done = check.checked;
      save();
      renderDay();
    };
    time.onchange = () => {
      task.time = time.value;
      save();
    };
    text.oninput = () => {
      task.text = text.value;
      save();
    };
    remove.onclick = () => {
      data.tasks.splice(index, 1);
      save();
      renderDay();
    };
    root.appendChild(row);
  });
}

$('#addTask').onclick = () => {
  dayData(selected).tasks.push({time: '', text: '', done: false});
  save();
  renderDay();
  setTimeout(() => $('#tasks .task-row:last-child input[type=text]')?.focus(), 0);
};

$('#notes').oninput = event => {
  dayData(selected).notes = event.target.value;
  $('#saveState').textContent = 'A guardar…';
  save();
};

function shiftDay(amount) {
  const date = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + amount, 12);
  openDay(date);
}

$('#prevDay').onclick = () => shiftDay(-1);
$('#nextDay').onclick = () => shiftDay(1);

$('#todayBtn').onclick = () => {
  selected = new Date();
  selected.setHours(12, 0, 0, 0);
  monthCursor = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
  yearCursor = selected.getFullYear();
  plannerCursor = selected.getFullYear();
  show('day');
};

function show(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === name));
  $(`#${name}View`).classList.add('active');

  if (name === 'day') renderDay();
  if (name === 'month') renderMonth();
  if (name === 'year') renderYear();
  if (name === 'planner') renderPlanner();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => show(tab.dataset.view);
});

function renderMonth() {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  $('#monthTitle').textContent = `${MONTHS[month]} ${year}`;

  const root = $('#monthGrid');
  root.innerHTML = '';
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month, 1 - offset + index, 12);
    const cell = document.createElement('div');
    cell.className = `day-cell${date.getMonth() !== month ? ' other' : ''}${sameDay(date, new Date()) ? ' today' : ''}`;
    cell.innerHTML = `<span class="num">${date.getDate()}</span>${hasData(date) ? '<div class="marks">• com registos</div>' : ''}`;
    cell.onclick = () => openDay(date);
    root.appendChild(cell);
  }
}

$('#prevMonth').onclick = () => {
  monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1, 12);
  renderMonth();
};

$('#nextMonth').onclick = () => {
  monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1, 12);
  renderMonth();
};

function renderYear() {
  $('#yearTitle').textContent = yearCursor;
  const root = $('#yearGrid');
  root.innerHTML = '';

  for (let month = 0; month < 12; month += 1) {
    const box = document.createElement('div');
    box.className = 'mini-month';
    let html = `<h3>${MONTHS[month]}</h3><div class="mini-grid">`;
    ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].forEach(day => { html += `<b>${day}</b>`; });

    const first = new Date(yearCursor, month, 1, 12);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(yearCursor, month + 1, 0).getDate();
    for (let index = 0; index < offset; index += 1) html += '<span class="muted">·</span>';
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(yearCursor, month, day, 12);
      html += `<span class="${hasData(date) ? 'has' : ''}">${day}</span>`;
    }
    html += '</div>';

    box.innerHTML = html;
    box.onclick = () => {
      monthCursor = new Date(yearCursor, month, 1, 12);
      show('month');
    };
    root.appendChild(box);
  }
}

$('#prevYear').onclick = () => {
  yearCursor -= 1;
  renderYear();
};

$('#nextYear').onclick = () => {
  yearCursor += 1;
  renderYear();
};

function plannerCellTitle(date, data) {
  const label = `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
  if (!data) return label;

  const details = [];
  const tasks = data.tasks?.filter(task => task.text?.trim()) || [];
  if (tasks.length) details.push(`${tasks.length} tarefa${tasks.length === 1 ? '' : 's'}`);
  if (data.notes?.trim()) details.push('notas');
  return details.length ? `${label} — ${details.join(' e ')}` : label;
}

function renderPlanner() {
  $('#plannerTitle').textContent = `Planner ${plannerCursor}`;
  const table = $('#plannerTable');
  table.innerHTML = '';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const monthHead = document.createElement('th');
  monthHead.className = 'month-heading';
  monthHead.scope = 'col';
  monthHead.textContent = plannerCursor;
  headRow.appendChild(monthHead);

  for (let day = 1; day <= 31; day += 1) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = day;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const today = new Date();

  for (let month = 0; month < 12; month += 1) {
    const row = document.createElement('tr');
    const monthCell = document.createElement('th');
    monthCell.scope = 'row';
    monthCell.className = 'planner-month';
    monthCell.innerHTML = `<strong>${MONTHS_SHORT[month]}</strong><span>${MONTHS[month]}</span>`;
    row.appendChild(monthCell);

    const daysInMonth = new Date(plannerCursor, month + 1, 0).getDate();
    for (let day = 1; day <= 31; day += 1) {
      const cell = document.createElement('td');
      if (day > daysInMonth) {
        cell.className = 'planner-empty';
        row.appendChild(cell);
        continue;
      }

      const date = new Date(plannerCursor, month, day, 12);
      const data = getData(date);
      const button = document.createElement('button');
      const hasTasks = Boolean(data?.tasks?.some(task => task.text?.trim()));
      const hasNotes = Boolean(data?.notes?.trim());
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = sameDay(date, today);

      button.className = [
        'planner-day',
        weekend ? 'weekend' : '',
        hasTasks ? 'has-tasks' : '',
        hasNotes ? 'has-notes' : '',
        isToday ? 'is-today' : ''
      ].filter(Boolean).join(' ');
      button.title = plannerCellTitle(date, data);
      button.setAttribute('aria-label', button.title);
      button.onclick = () => openDay(date);
      cell.appendChild(button);
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
}

$('#prevPlannerYear').onclick = () => {
  plannerCursor -= 1;
  renderPlanner();
};

$('#nextPlannerYear').onclick = () => {
  plannerCursor += 1;
  renderPlanner();
};

renderDay();
