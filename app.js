const $ = selector => document.querySelector(selector);

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];
const MONTHS_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEK = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WEEK_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const DAY_HOURS = Array.from({length: 17}, (_, index) => index + 6);

let selected = new Date();
selected.setHours(12, 0, 0, 0);
let monthCursor = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
let yearCursor = selected.getFullYear();
let plannerCursor = selected.getFullYear();

function startOfWeek(date) {
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset, 12);
}

let weekCursor = startOfWeek(selected);
let mobileWeekDayIndex = (selected.getDay() + 6) % 7;

const KEY = 'pajo-agenda-v1';
const PERIOD_KEY = 'pajo-agenda-periods-v1';
let db = JSON.parse(localStorage.getItem(KEY) || '{}');
let periods = JSON.parse(localStorage.getItem(PERIOD_KEY) || '[]');

const PERIOD_TYPES = {
  holiday: {label: 'Férias', color: '#2f7d5c'},
  work: {label: 'Trabalho', color: '#315d8c'},
  health: {label: 'Saúde', color: '#9a5e78'},
  personal: {label: 'Pessoal', color: '#b66d32'}
};

const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayData = date => {
  const dateKey = key(date);
  const data = db[dateKey] || (db[dateKey] = {notes: '', tasks: [], schedule: {}});
  data.notes ??= '';
  data.tasks ??= [];
  data.schedule ??= {};
  return data;
};

function setSaveState(message) {
  document.querySelectorAll('.save-state').forEach(element => {
    element.textContent = message;
  });
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
  setSaveState('Guardado automaticamente');
}

function savePeriods() {
  localStorage.setItem(PERIOD_KEY, JSON.stringify(periods));
}

function fromIso(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function periodsForDate(date) {
  const dateKey = key(date);
  return periods.filter(period => period.start <= dateKey && period.end >= dateKey);
}

function formatPeriodDate(value) {
  return new Intl.DateTimeFormat('pt-PT', {day: 'numeric', month: 'short', year: 'numeric'}).format(fromIso(value));
}

function getData(date) {
  return db[key(date)];
}

function hasData(date) {
  const data = getData(date);
  return Boolean(data && (
    data.notes?.trim()
    || data.tasks?.some(task => task.text?.trim())
    || Object.values(data.schedule || {}).some(entry => entry?.trim())
  ));
}

function scheduleEntries(data) {
  return DAY_HOURS
    .map(hour => ({time: `${String(hour).padStart(2, '0')}:00`, text: data?.schedule?.[hour]?.trim() || ''}))
    .filter(entry => entry.text);
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
  weekCursor = startOfWeek(date);
  mobileWeekDayIndex = (date.getDay() + 6) % 7;
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
  renderDayPeriods(date);
  renderDaySchedule(date, data);

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

function renderDaySchedule(date, data) {
  const root = $('#daySchedule');
  const now = new Date();
  root.innerHTML = '';

  DAY_HOURS.forEach(hour => {
    const row = document.createElement('label');
    const isCurrentHour = sameDay(date, now) && now.getHours() === hour;
    row.className = `schedule-row${isCurrentHour ? ' is-current' : ''}`;

    const time = document.createElement('span');
    time.className = 'schedule-time';
    time.textContent = `${String(hour).padStart(2, '0')}:00`;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 100;
    input.value = data.schedule[hour] || '';
    input.placeholder = 'Compromisso ou atividade';
    input.setAttribute('aria-label', `Agenda das ${time.textContent}`);
    input.oninput = () => {
      const value = input.value;
      if (value.trim()) data.schedule[hour] = value;
      else delete data.schedule[hour];
      setSaveState('A guardar…');
      save();
    };

    row.append(time, input);
    root.appendChild(row);
  });
}

function renderDayPeriods(date) {
  const root = $('#dayPeriods');
  root.innerHTML = '';
  periodsForDate(date).forEach(period => {
    const type = PERIOD_TYPES[period.type] || PERIOD_TYPES.personal;
    const badge = document.createElement('div');
    badge.className = 'day-period-badge';
    badge.style.setProperty('--period-color', type.color);
    badge.innerHTML = `<strong>${escapeHtml(period.title)}</strong><span>${formatPeriodDate(period.start)} — ${formatPeriodDate(period.end)}</span>`;
    root.appendChild(badge);
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
  setSaveState('A guardar…');
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
  weekCursor = startOfWeek(selected);
  mobileWeekDayIndex = (selected.getDay() + 6) % 7;
  yearCursor = selected.getFullYear();
  plannerCursor = selected.getFullYear();
  show('day');
};

function show(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === name));
  $(`#${name}View`).classList.add('active');

  if (name === 'day') renderDay();
  if (name === 'week') renderWeek();
  if (name === 'month') renderMonth();
  if (name === 'year') renderYear();
  if (name === 'planner') renderPlanner();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => show(tab.dataset.view);
});

function weekDateLabel(start, end) {
  const formatter = new Intl.DateTimeFormat('pt-PT', {day: 'numeric', month: 'long'});
  if (start.getFullYear() === end.getFullYear()) {
    return `${formatter.format(start)} — ${formatter.format(end)} ${end.getFullYear()}`;
  }
  return `${formatter.format(start)} ${start.getFullYear()} — ${formatter.format(end)} ${end.getFullYear()}`;
}

function weekDates(start) {
  return Array.from({length: 7}, (_, index) => (
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12)
  ));
}

function taskHour(task) {
  if (!task.time) return null;
  const hour = Number(task.time.split(':')[0]);
  return Number.isInteger(hour) ? hour : null;
}

function tasksAtHour(data, hour) {
  return (data?.tasks || []).filter(task => task.text?.trim() && taskHour(task) === hour);
}

function tasksOutsideWeekGrid(data) {
  return (data?.tasks || []).filter(task => {
    if (!task.text?.trim()) return false;
    const hour = taskHour(task);
    return hour === null || hour < DAY_HOURS[0] || hour > DAY_HOURS.at(-1);
  });
}

function createWeekHeader(date, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${className}${sameDay(date, new Date()) ? ' is-today' : ''}`;
  button.innerHTML = `<span>${WEEK_SHORT[date.getDay()]}</span><strong>${date.getDate()}</strong><small>${MONTHS_SHORT[date.getMonth()]}</small>`;
  button.setAttribute('aria-label', `Abrir ${date.getDate()} de ${MONTHS[date.getMonth()]}`);
  button.onclick = () => openDay(date);
  return button;
}

function createWeekScheduleInput(date, hour) {
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 100;
  input.className = 'week-slot-input';
  input.value = getData(date)?.schedule?.[hour] || '';
  input.placeholder = 'Adicionar';
  input.setAttribute('aria-label', `${WEEK[date.getDay()]} ${date.getDate()}, às ${String(hour).padStart(2, '0')}:00`);
  input.oninput = () => {
    const data = dayData(date);
    if (input.value.trim()) data.schedule[hour] = input.value;
    else delete data.schedule[hour];
    setSaveState('A guardar…');
    save();
  };
  return input;
}

function createWeekTaskChip(task, date, showTime = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `week-task-chip${task.done ? ' done' : ''}`;
  button.textContent = `${showTime && task.time ? `${task.time} · ` : ''}${task.text}`;
  button.title = 'Abrir na página diária';
  button.onclick = () => openDay(date);
  return button;
}

function createWeekPeriodCell(date, index) {
  const cell = document.createElement('div');
  const datePeriods = periodsForDate(date);
  const mainPeriod = datePeriods[0];
  cell.className = 'week-period-cell';
  if (!mainPeriod) return cell;

  const type = PERIOD_TYPES[mainPeriod.type] || PERIOD_TYPES.personal;
  const startsHere = mainPeriod.start === key(date) || index === 0;
  const endsHere = mainPeriod.end === key(date) || index === 6;
  cell.classList.add('has-period');
  if (startsHere) cell.classList.add('period-start');
  if (endsHere) cell.classList.add('period-end');
  cell.style.setProperty('--period-color', type.color);
  cell.title = datePeriods.map(period => period.title).join(', ');
  if (startsHere) {
    const label = document.createElement('span');
    label.textContent = mainPeriod.title;
    cell.appendChild(label);
  }
  return cell;
}

function renderWeekDesktop(dates) {
  const root = $('#weekDesktop');
  root.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'week-timetable';

  const corner = document.createElement('div');
  corner.className = 'week-corner';
  corner.textContent = 'Hora';
  grid.appendChild(corner);
  dates.forEach(date => grid.appendChild(createWeekHeader(date, 'week-column-head')));

  const periodLabel = document.createElement('div');
  periodLabel.className = 'week-period-label';
  periodLabel.textContent = 'Períodos';
  grid.appendChild(periodLabel);
  dates.forEach((date, index) => grid.appendChild(createWeekPeriodCell(date, index)));

  const now = new Date();
  DAY_HOURS.forEach(hour => {
    const time = document.createElement('div');
    time.className = 'week-time';
    time.textContent = `${String(hour).padStart(2, '0')}:00`;
    grid.appendChild(time);

    dates.forEach(date => {
      const data = getData(date);
      const slot = document.createElement('div');
      slot.className = `week-slot${date.getDay() === 0 || date.getDay() === 6 ? ' is-weekend' : ''}${sameDay(date, now) && now.getHours() === hour ? ' is-current' : ''}`;
      slot.appendChild(createWeekScheduleInput(date, hour));
      tasksAtHour(data, hour).forEach(task => slot.appendChild(createWeekTaskChip(task, date)));
      grid.appendChild(slot);
    });
  });
  root.appendChild(grid);

  const taskSection = document.createElement('section');
  taskSection.className = 'week-unscheduled';
  taskSection.innerHTML = '<div class="section-title">Tarefas sem hora ou fora do horário</div>';
  const taskGrid = document.createElement('div');
  taskGrid.className = 'week-unscheduled-grid';
  dates.forEach(date => {
    const day = document.createElement('article');
    const heading = createWeekHeader(date, 'week-task-day');
    const tasks = tasksOutsideWeekGrid(getData(date));
    day.appendChild(heading);
    if (tasks.length) tasks.forEach(task => day.appendChild(createWeekTaskChip(task, date, true)));
    else {
      const empty = document.createElement('p');
      empty.textContent = 'Sem tarefas';
      day.appendChild(empty);
    }
    taskGrid.appendChild(day);
  });
  taskSection.appendChild(taskGrid);
  root.appendChild(taskSection);
}

function renderWeekMobile(start, dates) {
  const root = $('#weekMobile');
  root.innerHTML = '';

  const picker = document.createElement('div');
  picker.className = 'week-mobile-picker';
  dates.forEach((date, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${index === mobileWeekDayIndex ? 'active' : ''}${sameDay(date, new Date()) ? ' is-today' : ''}`;
    button.innerHTML = `<span>${WEEK_SHORT[date.getDay()].slice(0, 1)}</span><strong>${date.getDate()}</strong>`;
    button.setAttribute('aria-label', `${WEEK[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`);
    button.onclick = () => {
      mobileWeekDayIndex = index;
      renderWeekMobile(start, dates);
    };
    picker.appendChild(button);
  });
  root.appendChild(picker);

  const date = dates[mobileWeekDayIndex];
  const data = getData(date);
  const panel = document.createElement('section');
  panel.className = 'week-mobile-panel';
  panel.appendChild(createWeekHeader(date, 'week-mobile-head'));

  const datePeriods = periodsForDate(date);
  if (datePeriods.length) {
    const periodRoot = document.createElement('div');
    periodRoot.className = 'week-mobile-periods';
    datePeriods.forEach(period => {
      const type = PERIOD_TYPES[period.type] || PERIOD_TYPES.personal;
      const badge = document.createElement('div');
      badge.style.setProperty('--period-color', type.color);
      badge.textContent = period.title;
      periodRoot.appendChild(badge);
    });
    panel.appendChild(periodRoot);
  }

  const schedule = document.createElement('div');
  schedule.className = 'week-mobile-schedule';
  const now = new Date();
  DAY_HOURS.forEach(hour => {
    const row = document.createElement('div');
    row.className = `week-mobile-row${sameDay(date, now) && now.getHours() === hour ? ' is-current' : ''}`;
    const time = document.createElement('span');
    time.textContent = `${String(hour).padStart(2, '0')}:00`;
    const content = document.createElement('div');
    content.appendChild(createWeekScheduleInput(date, hour));
    tasksAtHour(data, hour).forEach(task => content.appendChild(createWeekTaskChip(task, date)));
    row.append(time, content);
    schedule.appendChild(row);
  });
  panel.appendChild(schedule);

  const remaining = tasksOutsideWeekGrid(data);
  const taskSection = document.createElement('section');
  taskSection.className = 'week-mobile-tasks';
  taskSection.innerHTML = '<div class="section-title">Tarefas sem hora ou fora do horário</div>';
  if (remaining.length) remaining.forEach(task => taskSection.appendChild(createWeekTaskChip(task, date, true)));
  else {
    const empty = document.createElement('p');
    empty.textContent = 'Sem tarefas';
    taskSection.appendChild(empty);
  }
  panel.appendChild(taskSection);
  root.appendChild(panel);
}

function renderWeek() {
  const start = startOfWeek(weekCursor);
  const dates = weekDates(start);
  const end = dates.at(-1);
  $('#weekTitle').textContent = weekDateLabel(start, end);
  renderWeekDesktop(dates);
  renderWeekMobile(start, dates);
}

$('#prevWeek').onclick = () => {
  weekCursor = new Date(weekCursor.getFullYear(), weekCursor.getMonth(), weekCursor.getDate() - 7, 12);
  renderWeek();
};

$('#nextWeek').onclick = () => {
  weekCursor = new Date(weekCursor.getFullYear(), weekCursor.getMonth(), weekCursor.getDate() + 7, 12);
  renderWeek();
};

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
    const datePeriods = periodsForDate(date);
    const mainPeriod = datePeriods[0];
    const cell = document.createElement('div');
    cell.className = `day-cell${date.getMonth() !== month ? ' other' : ''}${sameDay(date, new Date()) ? ' today' : ''}${mainPeriod ? ' has-period' : ''}`;
    if (mainPeriod) {
      const type = PERIOD_TYPES[mainPeriod.type] || PERIOD_TYPES.personal;
      cell.style.setProperty('--period-color', type.color);
    }
    cell.innerHTML = `<span class="num">${date.getDate()}</span>${datePeriods.map(period => `<div class="month-period">${escapeHtml(period.title)}</div>`).join('')}${hasData(date) ? '<div class="marks">• com registos</div>' : ''}`;
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
      html += `<span class="${hasData(date) || periodsForDate(date).length ? 'has' : ''}">${day}</span>`;
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
  const agenda = scheduleEntries(data);
  if (tasks.length) details.push(`${tasks.length} tarefa${tasks.length === 1 ? '' : 's'}`);
  if (agenda.length) details.push(`${agenda.length} registo${agenda.length === 1 ? '' : 's'} na agenda`);
  if (data.notes?.trim()) details.push('notas');
  return details.length ? `${label} — ${details.join(' e ')}` : label;
}

function renderPeriodList() {
  const root = $('#periodList');
  root.innerHTML = '';
  const startOfYear = `${plannerCursor}-01-01`;
  const endOfYear = `${plannerCursor}-12-31`;
  const visiblePeriods = periods
    .filter(period => period.start <= endOfYear && period.end >= startOfYear)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!visiblePeriods.length) {
    const empty = document.createElement('p');
    empty.className = 'period-empty';
    empty.textContent = 'Ainda não existem períodos marcados neste ano.';
    root.appendChild(empty);
    return;
  }

  visiblePeriods.forEach(period => {
    const type = PERIOD_TYPES[period.type] || PERIOD_TYPES.personal;
    const item = document.createElement('div');
    item.className = 'period-item';
    item.innerHTML = `<i class="period-swatch"></i><div class="period-info"><strong>${escapeHtml(period.title)}</strong><span>${formatPeriodDate(period.start)} — ${formatPeriodDate(period.end)} · ${type.label}</span></div><button type="button" class="period-delete" aria-label="Apagar ${escapeHtml(period.title)}">×</button>`;
    item.querySelector('.period-swatch').style.backgroundColor = type.color;
    item.querySelector('.period-delete').onclick = () => {
      periods = periods.filter(saved => saved.id !== period.id);
      savePeriods();
      renderPlanner();
    };
    root.appendChild(item);
  });
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
      const hasTasks = Boolean(
        data?.tasks?.some(task => task.text?.trim())
        || Object.values(data?.schedule || {}).some(entry => entry?.trim())
      );
      const hasNotes = Boolean(data?.notes?.trim());
      const datePeriods = periodsForDate(date);
      const mainPeriod = datePeriods[0];
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = sameDay(date, today);

      button.className = [
        'planner-day',
        weekend ? 'weekend' : '',
        hasTasks ? 'has-tasks' : '',
        hasNotes ? 'has-notes' : '',
        mainPeriod ? 'has-period' : '',
        mainPeriod?.start === key(date) ? 'period-start' : '',
        mainPeriod?.end === key(date) ? 'period-end' : '',
        isToday ? 'is-today' : ''
      ].filter(Boolean).join(' ');
      if (mainPeriod) {
        const periodType = PERIOD_TYPES[mainPeriod.type] || PERIOD_TYPES.personal;
        button.style.setProperty('--period-color', periodType.color);
      }
      const rangeNames = datePeriods.map(period => period.title).join(', ');
      button.title = `${plannerCellTitle(date, data)}${rangeNames ? ` — ${rangeNames}` : ''}`;
      button.setAttribute('aria-label', button.title);
      button.onclick = () => openDay(date);
      cell.appendChild(button);
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  renderPeriodList();
}

$('#prevPlannerYear').onclick = () => {
  plannerCursor -= 1;
  renderPlanner();
};

$('#nextPlannerYear').onclick = () => {
  plannerCursor += 1;
  renderPlanner();
};

$('#addPeriod').onclick = () => {
  const initialDate = selected.getFullYear() === plannerCursor
    ? selected
    : new Date(plannerCursor, 0, 1, 12);
  $('#periodTitle').value = 'Férias';
  $('#periodStart').value = key(initialDate);
  $('#periodEnd').value = key(initialDate);
  $('#periodType').value = 'holiday';
  $('#periodError').textContent = '';
  $('#periodDialog').showModal();
  $('#periodTitle').focus();
  $('#periodTitle').select();
};

$('#cancelPeriod').onclick = () => {
  $('#periodDialog').close();
};

$('#periodForm').onsubmit = event => {
  event.preventDefault();
  const title = $('#periodTitle').value.trim();
  const start = $('#periodStart').value;
  const end = $('#periodEnd').value;
  const type = $('#periodType').value;

  if (!title || !start || !end) {
    $('#periodError').textContent = 'Preenche o nome e as duas datas.';
    return;
  }
  if (end < start) {
    $('#periodError').textContent = 'A data final não pode ser anterior à data inicial.';
    return;
  }

  periods.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    start,
    end,
    type
  });
  savePeriods();
  $('#periodDialog').close();
  plannerCursor = fromIso(start).getFullYear();
  renderPlanner();
};

renderDay();
