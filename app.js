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
let utilitiesInitialized = false;
let organizerInitialized = false;
let habitCursor = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);

function startOfWeek(date) {
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset, 12);
}

let weekCursor = startOfWeek(selected);
let mobileWeekDayIndex = (selected.getDay() + 6) % 7;

const KEY = 'pajo-agenda-v1';
const PERIOD_KEY = 'pajo-agenda-periods-v1';
const ORGANIZER_KEY = 'pajo-agenda-organizer-v1';
const UK_HOLIDAY_CACHE_KEY = 'pajo-agenda-uk-holidays-v1';
let db = JSON.parse(localStorage.getItem(KEY) || '{}');
let periods = JSON.parse(localStorage.getItem(PERIOD_KEY) || '[]');

function readStoredObject(storageKey, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

let organizer = readStoredObject(ORGANIZER_KEY, {});
organizer.settings ??= {holidays: 'both'};
organizer.settings.holidays ??= 'both';
organizer.specialDates ??= [];
organizer.masterTasks ??= [];
organizer.habits ??= [];
organizer.habitChecks ??= {};
organizer.contacts ??= [];
organizer.information ??= [];

let ukHolidayCache = readStoredObject(UK_HOLIDAY_CACHE_KEY, {events: [], updatedAt: ''});

const PERIOD_TYPES = {
  holiday: {label: 'Férias', color: '#2f7d5c'},
  work: {label: 'Trabalho', color: '#315d8c'},
  health: {label: 'Saúde', color: '#9a5e78'},
  personal: {label: 'Pessoal', color: '#b66d32'}
};

const ORGANIZER_CATEGORIES = {
  personal: {label: 'Pessoal', color: '#a96535'},
  family: {label: 'Família', color: '#8d4f74'},
  work: {label: 'Trabalho', color: '#315d8c'},
  health: {label: 'Saúde', color: '#2f7d5c'},
  finance: {label: 'Pagamentos', color: '#8a6b20'}
};

const CURRENCY_CACHE_KEY = 'pajo-agenda-currency-v1';
const CURRENCIES = [
  ['GBP', 'Libra esterlina'], ['EUR', 'Euro'], ['USD', 'Dólar americano'],
  ['CHF', 'Franco suíço'], ['CAD', 'Dólar canadiano'], ['AUD', 'Dólar australiano'],
  ['BRL', 'Real brasileiro'], ['PLN', 'Zlóti polaco'], ['JPY', 'Iene japonês'],
  ['CNY', 'Yuan chinês'], ['INR', 'Rupia indiana']
];

const UTILITY_FILTERS = [
  ['all', 'Todas'], ['measures', 'Medidas'], ['home', 'Casa e cozinha'],
  ['travel', 'Viagem'], ['money', 'Divisas'], ['dates', 'Datas'], ['digital', 'Digital']
];

const CONVERTERS = [
  {
    id: 'length', title: 'Comprimento e distância', description: 'Do milímetro à milha.', category: 'measures',
    defaultValue: 1, from: 'km', to: 'mi',
    units: [
      ['mm', 'Milímetros (mm)', 0.001], ['cm', 'Centímetros (cm)', 0.01],
      ['m', 'Metros (m)', 1], ['km', 'Quilómetros (km)', 1000],
      ['in', 'Polegadas (in)', 0.0254], ['ft', 'Pés (ft)', 0.3048],
      ['yd', 'Jardas (yd)', 0.9144], ['mi', 'Milhas (mi)', 1609.344]
    ]
  },
  {
    id: 'weight', title: 'Peso', description: 'Inclui libras e stones usados no Reino Unido.', category: 'measures',
    defaultValue: 1, from: 'kg', to: 'lb',
    units: [
      ['g', 'Gramas (g)', 0.001], ['kg', 'Quilogramas (kg)', 1],
      ['oz', 'Onças (oz)', 0.028349523125], ['lb', 'Libras (lb)', 0.45359237],
      ['st', 'Stones (st)', 6.35029318]
    ]
  },
  {
    id: 'liquid', title: 'Líquidos', description: 'Medidas métricas, britânicas e americanas.', category: 'measures',
    defaultValue: 1, from: 'l', to: 'uk-pint',
    units: [
      ['ml', 'Mililitros (ml)', 0.001], ['cl', 'Centilitros (cl)', 0.01], ['l', 'Litros (l)', 1],
      ['uk-floz', 'Fluid ounces UK', 0.0284130625], ['uk-pint', 'Pints UK', 0.56826125],
      ['uk-gallon', 'Gallons UK', 4.54609], ['us-floz', 'Fluid ounces US', 0.0295735295625],
      ['us-pint', 'Pints US', 0.473176473], ['us-gallon', 'Gallons US', 3.785411784]
    ]
  },
  {
    id: 'temperature', title: 'Temperatura', description: 'Celsius, Fahrenheit e Kelvin.', category: 'measures',
    defaultValue: 20, from: 'c', to: 'f',
    units: [['c', 'Celsius (°C)'], ['f', 'Fahrenheit (°F)'], ['k', 'Kelvin (K)']],
    toBase(value, unit) {
      if (unit === 'f') return (value - 32) * 5 / 9;
      if (unit === 'k') return value - 273.15;
      return value;
    },
    fromBase(value, unit) {
      if (unit === 'f') return value * 9 / 5 + 32;
      if (unit === 'k') return value + 273.15;
      return value;
    }
  },
  {
    id: 'area', title: 'Área', description: 'De metros quadrados a acres.', category: 'measures',
    defaultValue: 100, from: 'm2', to: 'ft2',
    units: [
      ['cm2', 'Centímetros² (cm²)', 0.0001], ['m2', 'Metros² (m²)', 1],
      ['km2', 'Quilómetros² (km²)', 1000000], ['ha', 'Hectares (ha)', 10000],
      ['ft2', 'Pés² (ft²)', 0.09290304], ['yd2', 'Jardas² (yd²)', 0.83612736],
      ['acre', 'Acres', 4046.8564224]
    ]
  },
  {
    id: 'speed', title: 'Velocidade', description: 'Útil para condução e meteorologia.', category: 'travel',
    defaultValue: 100, from: 'kmh', to: 'mph',
    units: [
      ['kmh', 'Quilómetros/hora', 1], ['mph', 'Milhas/hora', 1.609344],
      ['ms', 'Metros/segundo', 3.6], ['knot', 'Nós', 1.852]
    ]
  },
  {
    id: 'economy', title: 'Consumo automóvel', description: 'MPG britânico, americano e L/100 km.', category: 'travel',
    defaultValue: 50, from: 'mpg-uk', to: 'l100',
    units: [
      ['l100', 'Litros/100 km'], ['mpg-uk', 'MPG britânico'],
      ['mpg-us', 'MPG americano'], ['kml', 'Quilómetros/litro']
    ],
    toBase(value, unit) {
      if (value <= 0) return NaN;
      if (unit === 'mpg-uk') return 282.480936 / value;
      if (unit === 'mpg-us') return 235.214583 / value;
      if (unit === 'kml') return 100 / value;
      return value;
    },
    fromBase(value, unit) {
      if (value <= 0) return NaN;
      if (unit === 'mpg-uk') return 282.480936 / value;
      if (unit === 'mpg-us') return 235.214583 / value;
      if (unit === 'kml') return 100 / value;
      return value;
    }
  },
  {
    id: 'cooking', title: 'Medidas de cozinha', description: 'Copos, colheres e medidas líquidas.', category: 'home',
    defaultValue: 1, from: 'metric-cup', to: 'ml',
    units: [
      ['ml', 'Mililitros (ml)', 1], ['l', 'Litros (l)', 1000],
      ['tsp', 'Colher de chá', 5], ['tbsp', 'Colher de sopa', 15],
      ['metric-cup', 'Copo métrico', 250], ['us-cup', 'Cup americano', 236.5882365],
      ['uk-floz', 'Fluid ounce UK', 28.4130625], ['us-floz', 'Fluid ounce US', 29.5735295625]
    ]
  },
  {
    id: 'storage', title: 'Armazenamento digital', description: 'Distingue bytes de bits e unidades decimais de binárias.', category: 'digital',
    defaultValue: 1, from: 'gb', to: 'mb',
    units: [
      ['bit', 'Bits', 0.125], ['byte', 'Bytes', 1], ['kb', 'Kilobytes (KB)', 1000],
      ['mb', 'Megabytes (MB)', 1000000], ['gb', 'Gigabytes (GB)', 1000000000],
      ['tb', 'Terabytes (TB)', 1000000000000], ['kib', 'Kibibytes (KiB)', 1024],
      ['mib', 'Mebibytes (MiB)', 1048576], ['gib', 'Gibibytes (GiB)', 1073741824],
      ['megabit', 'Megabits (Mb)', 125000]
    ]
  }
];

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

function saveOrganizer() {
  localStorage.setItem(ORGANIZER_KEY, JSON.stringify(organizer));
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function categoryDetails(category) {
  return ORGANIZER_CATEGORIES[category] || ORGANIZER_CATEGORIES.personal;
}

function categoryOptions(selectedCategory = 'personal') {
  return Object.entries(ORGANIZER_CATEGORIES)
    .map(([id, details]) => `<option value="${id}"${id === selectedCategory ? ' selected' : ''}>${details.label}</option>`)
    .join('');
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

function addCalendarDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}

function firstWeekdayOfMonth(year, month, weekday) {
  const date = new Date(year, month, 1, 12);
  return new Date(year, month, 1 + (weekday - date.getDay() + 7) % 7, 12);
}

function lastWeekdayOfMonth(year, month, weekday) {
  const date = new Date(year, month + 1, 0, 12);
  return new Date(year, month, date.getDate() - (date.getDay() - weekday + 7) % 7, 12);
}

function translatedUkHoliday(title) {
  const substitute = title.includes('(substitute day)');
  const clean = title.replace(' (substitute day)', '');
  const translations = {
    "New Year’s Day": 'Dia de Ano Novo',
    "New Year's Day": 'Dia de Ano Novo',
    'Good Friday': 'Sexta-feira Santa',
    'Easter Monday': 'Segunda-feira de Páscoa',
    'Early May bank holiday': 'Feriado bancário de maio',
    'Spring bank holiday': 'Feriado da primavera',
    'Summer bank holiday': 'Feriado de verão',
    'Christmas Day': 'Dia de Natal',
    'Boxing Day': 'Boxing Day'
  };
  return `${translations[clean] || clean}${substitute ? ' (substituição)' : ''}`;
}

function fallbackUkHolidays(year) {
  const easter = easterSunday(year);
  const holidays = [];
  const add = (date, title) => holidays.push({date: key(date), title, country: 'UK'});
  const newYear = new Date(year, 0, 1, 12);
  add(newYear.getDay() === 6 ? new Date(year, 0, 3, 12) : newYear.getDay() === 0 ? new Date(year, 0, 2, 12) : newYear, 'Dia de Ano Novo');
  add(addCalendarDays(easter, -2), 'Sexta-feira Santa');
  add(addCalendarDays(easter, 1), 'Segunda-feira de Páscoa');
  add(firstWeekdayOfMonth(year, 4, 1), 'Feriado bancário de maio');
  add(lastWeekdayOfMonth(year, 4, 1), 'Feriado da primavera');
  add(lastWeekdayOfMonth(year, 7, 1), 'Feriado de verão');

  const christmasDay = new Date(year, 11, 25, 12).getDay();
  if (christmasDay === 6) {
    add(new Date(year, 11, 27, 12), 'Dia de Natal (substituição)');
    add(new Date(year, 11, 28, 12), 'Boxing Day (substituição)');
  } else if (christmasDay === 0) {
    add(new Date(year, 11, 26, 12), 'Boxing Day');
    add(new Date(year, 11, 27, 12), 'Dia de Natal (substituição)');
  } else {
    add(new Date(year, 11, 25, 12), 'Dia de Natal');
    const boxing = new Date(year, 11, 26, 12);
    add(boxing.getDay() === 6 ? new Date(year, 11, 28, 12) : boxing, boxing.getDay() === 6 ? 'Boxing Day (substituição)' : 'Boxing Day');
  }
  return holidays;
}

function ukHolidaysForYear(year) {
  const official = (ukHolidayCache.events || [])
    .filter(event => Number(event.date?.slice(0, 4)) === year)
    .map(event => ({date: event.date, title: translatedUkHoliday(event.title), country: 'UK'}));
  return official.length ? official : fallbackUkHolidays(year);
}

function portugalHolidaysForYear(year) {
  const easter = easterSunday(year);
  const holidays = [
    [new Date(year, 0, 1, 12), 'Dia de Ano Novo'],
    [addCalendarDays(easter, -2), 'Sexta-feira Santa'],
    [easter, 'Domingo de Páscoa'],
    [new Date(year, 3, 25, 12), 'Dia da Liberdade'],
    [new Date(year, 4, 1, 12), 'Dia do Trabalhador'],
    [addCalendarDays(easter, 60), 'Corpo de Deus'],
    [new Date(year, 5, 10, 12), 'Dia de Portugal'],
    [new Date(year, 7, 15, 12), 'Assunção de Nossa Senhora'],
    [new Date(year, 9, 5, 12), 'Implantação da República'],
    [new Date(year, 10, 1, 12), 'Dia de Todos os Santos'],
    [new Date(year, 11, 1, 12), 'Restauração da Independência'],
    [new Date(year, 11, 8, 12), 'Imaculada Conceição'],
    [new Date(year, 11, 25, 12), 'Dia de Natal']
  ];
  return holidays.map(([date, title]) => ({date: key(date), title, country: 'PT'}));
}

function holidaysForDate(date) {
  const setting = organizer.settings.holidays;
  if (setting === 'none') return [];
  const dateKey = key(date);
  const events = [];
  if (setting === 'both' || setting === 'uk') events.push(...ukHolidaysForYear(date.getFullYear()));
  if (setting === 'both' || setting === 'pt') events.push(...portugalHolidaysForYear(date.getFullYear()));
  return events.filter(event => event.date === dateKey);
}

function specialDatesForDate(date) {
  const dateKey = key(date);
  const monthDay = dateKey.slice(5);
  return organizer.specialDates.filter(item => (
    item.repeat === 'yearly' ? item.date?.slice(5) === monthDay : item.date === dateKey
  ));
}

function masterTasksForDate(date) {
  const dateKey = key(date);
  return organizer.masterTasks.filter(task => task.date === dateKey);
}

function calendarEventsForDate(date) {
  const holidayEvents = holidaysForDate(date).map(event => ({
    ...event, kind: 'holiday', color: event.country === 'UK' ? '#315d8c' : '#2f7d5c', label: `${event.country} · ${event.title}`
  }));
  const importantEvents = specialDatesForDate(date).map(item => ({
    ...item, kind: 'important', color: categoryDetails(item.category).color, label: item.title
  }));
  const taskEvents = masterTasksForDate(date).map(item => ({
    ...item, kind: 'master-task', color: categoryDetails(item.category).color, label: `${item.done ? '✓ ' : ''}${item.text}`
  }));
  return [...importantEvents, ...taskEvents, ...holidayEvents];
}

function refreshVisibleCalendar() {
  const active = document.querySelector('.view.active')?.id;
  if (active === 'dayView') renderDay();
  if (active === 'weekView') renderWeek();
  if (active === 'monthView') renderMonth();
  if (active === 'yearView') renderYear();
  if (active === 'plannerView') renderPlanner();
}

async function refreshUkHolidays() {
  try {
    const response = await fetch('https://www.gov.uk/bank-holidays.json');
    if (!response.ok) throw new Error('holiday request failed');
    const data = await response.json();
    const events = data['england-and-wales']?.events;
    if (!Array.isArray(events)) throw new Error('invalid holiday data');
    ukHolidayCache = {events, updatedAt: new Date().toISOString()};
    localStorage.setItem(UK_HOLIDAY_CACHE_KEY, JSON.stringify(ukHolidayCache));
    if ($('#holidayStatus')) $('#holidayStatus').textContent = 'Feriados oficiais de England & Wales atualizados · Portugal calculado localmente';
    refreshVisibleCalendar();
  } catch {
    if ($('#holidayStatus')) $('#holidayStatus').textContent = 'Sem ligação: a usar os feriados guardados ou calculados';
  }
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
  calendarEventsForDate(date).forEach(event => {
    const badge = document.createElement('div');
    badge.className = `day-event-badge ${event.kind}`;
    badge.style.setProperty('--event-color', event.color);
    const detail = event.kind === 'holiday'
      ? 'Feriado'
      : event.kind === 'master-task'
        ? `${categoryDetails(event.category).label} · tarefa geral`
        : `${categoryDetails(event.category).label} · ${event.repeat === 'yearly' ? 'repete todos os anos' : 'data importante'}`;
    badge.innerHTML = `<strong>${escapeHtml(event.label)}</strong><span>${escapeHtml(detail)}</span>`;
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

function preparePrintView() {
  const activeView = document.querySelector('.view.active');
  document.body.dataset.printView = activeView?.id?.replace('View', '') || 'day';
  const notes = $('#notes');
  if (notes && notes.dataset.printHeight === undefined) {
    notes.dataset.printHeight = notes.style.height;
    notes.style.height = `${Math.max(notes.scrollHeight, 300)}px`;
  }
}

$('#printBtn').onclick = () => {
  preparePrintView();
  window.print();
};

window.addEventListener('beforeprint', preparePrintView);
window.addEventListener('afterprint', () => {
  delete document.body.dataset.printView;
  const notes = $('#notes');
  if (notes?.dataset.printHeight !== undefined) {
    notes.style.height = notes.dataset.printHeight;
    delete notes.dataset.printHeight;
  }
});

function show(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === name));
  $(`#${name}View`).classList.add('active');

  if (name === 'day') renderDay();
  if (name === 'week') renderWeek();
  if (name === 'month') renderMonth();
  if (name === 'year') renderYear();
  if (name === 'planner') renderPlanner();
  if (name === 'organizer') renderOrganizer();
  if (name === 'utilities') renderUtilities();
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
  const dateEvents = calendarEventsForDate(date);
  cell.className = 'week-period-cell';
  if (!mainPeriod && !dateEvents.length) return cell;

  if (mainPeriod) {
    const type = PERIOD_TYPES[mainPeriod.type] || PERIOD_TYPES.personal;
    const startsHere = mainPeriod.start === key(date) || index === 0;
    const endsHere = mainPeriod.end === key(date) || index === 6;
    cell.classList.add('has-period');
    if (startsHere) cell.classList.add('period-start');
    if (endsHere) cell.classList.add('period-end');
    cell.style.setProperty('--period-color', type.color);
    if (startsHere) {
      const label = document.createElement('span');
      label.textContent = mainPeriod.title;
      cell.appendChild(label);
    }
  }
  if (dateEvents.length) {
    cell.classList.add('has-event');
    cell.style.setProperty('--event-color', dateEvents[0].color);
    const label = document.createElement('span');
    label.className = 'week-event-label';
    label.textContent = `${dateEvents[0].label}${dateEvents.length > 1 ? ` +${dateEvents.length - 1}` : ''}`;
    cell.appendChild(label);
  }
  cell.title = [...datePeriods.map(period => period.title), ...dateEvents.map(event => event.label)].join(', ');
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
  const dateEvents = calendarEventsForDate(date);
  if (datePeriods.length || dateEvents.length) {
    const periodRoot = document.createElement('div');
    periodRoot.className = 'week-mobile-periods';
    datePeriods.forEach(period => {
      const type = PERIOD_TYPES[period.type] || PERIOD_TYPES.personal;
      const badge = document.createElement('div');
      badge.style.setProperty('--period-color', type.color);
      badge.textContent = period.title;
      periodRoot.appendChild(badge);
    });
    dateEvents.forEach(event => {
      const badge = document.createElement('div');
      badge.className = 'week-mobile-event';
      badge.style.setProperty('--period-color', event.color);
      badge.textContent = event.label;
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
    const dateEvents = calendarEventsForDate(date);
    const cell = document.createElement('div');
    cell.className = `day-cell${date.getMonth() !== month ? ' other' : ''}${sameDay(date, new Date()) ? ' today' : ''}${mainPeriod ? ' has-period' : ''}${dateEvents.length ? ' has-event' : ''}`;
    if (mainPeriod) {
      const type = PERIOD_TYPES[mainPeriod.type] || PERIOD_TYPES.personal;
      cell.style.setProperty('--period-color', type.color);
    }
    if (dateEvents.length) cell.style.setProperty('--event-color', dateEvents[0].color);
    const shownEvents = dateEvents.slice(0, 2);
    const eventHtml = shownEvents.map(event => `<div class="month-event" style="--event-color:${event.color}">${escapeHtml(event.label)}</div>`).join('');
    const extraEvents = dateEvents.length > 2 ? `<div class="month-event-more">+${dateEvents.length - 2}</div>` : '';
    cell.innerHTML = `<span class="num">${date.getDate()}</span>${datePeriods.map(period => `<div class="month-period">${escapeHtml(period.title)}</div>`).join('')}${eventHtml}${extraEvents}${hasData(date) ? '<div class="marks">• com registos</div>' : ''}`;
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
      html += `<span class="${hasData(date) || periodsForDate(date).length || calendarEventsForDate(date).length ? 'has' : ''}">${day}</span>`;
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
      const dateEvents = calendarEventsForDate(date);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = sameDay(date, today);

      button.className = [
        'planner-day',
        weekend ? 'weekend' : '',
        hasTasks ? 'has-tasks' : '',
        hasNotes ? 'has-notes' : '',
        mainPeriod ? 'has-period' : '',
        dateEvents.length ? 'has-event' : '',
        mainPeriod?.start === key(date) ? 'period-start' : '',
        mainPeriod?.end === key(date) ? 'period-end' : '',
        isToday ? 'is-today' : ''
      ].filter(Boolean).join(' ');
      if (mainPeriod) {
        const periodType = PERIOD_TYPES[mainPeriod.type] || PERIOD_TYPES.personal;
        button.style.setProperty('--period-color', periodType.color);
      }
      if (dateEvents.length) button.style.setProperty('--event-color', dateEvents[0].color);
      const rangeNames = datePeriods.map(period => period.title).join(', ');
      const eventNames = dateEvents.map(event => event.label).join(', ');
      button.title = `${plannerCellTitle(date, data)}${rangeNames ? ` — ${rangeNames}` : ''}${eventNames ? ` — ${eventNames}` : ''}`;
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

function showOrganizerMessage(message) {
  const root = $('#organizerMessage');
  root.textContent = message;
  clearTimeout(showOrganizerMessage.timer);
  showOrganizerMessage.timer = setTimeout(() => { root.textContent = ''; }, 2600);
}

function formatOrganizerDate(value, yearly = false) {
  const date = fromIso(value);
  return new Intl.DateTimeFormat('pt-PT', yearly
    ? {day: 'numeric', month: 'long'}
    : {day: 'numeric', month: 'short', year: 'numeric'}
  ).format(date);
}

function createEmptyOrganizerMessage(text) {
  const empty = document.createElement('p');
  empty.className = 'organizer-empty';
  empty.textContent = text;
  return empty;
}

function createCategoryTag(category) {
  const details = categoryDetails(category);
  const tag = document.createElement('span');
  tag.className = 'category-tag';
  tag.style.setProperty('--category-color', details.color);
  tag.textContent = details.label;
  return tag;
}

function renderImportantDates() {
  const root = $('#importantDateList');
  root.innerHTML = '';
  const items = [...organizer.specialDates].sort((a, b) => (
    (a.repeat === 'yearly' ? a.date.slice(5) : a.date).localeCompare(b.repeat === 'yearly' ? b.date.slice(5) : b.date)
  ));
  if (!items.length) {
    root.appendChild(createEmptyOrganizerMessage('Ainda não existem datas importantes.'));
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'organizer-list-item';
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'organizer-item-main';
    main.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${formatOrganizerDate(item.date, item.repeat === 'yearly')} · ${item.repeat === 'yearly' ? 'todos os anos' : 'uma vez'}</span>`;
    main.prepend(createCategoryTag(item.category));
    main.onclick = () => {
      const saved = fromIso(item.date);
      const date = item.repeat === 'yearly'
        ? new Date(selected.getFullYear(), saved.getMonth(), saved.getDate(), 12)
        : saved;
      openDay(date);
    };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'organizer-delete';
    remove.setAttribute('aria-label', `Apagar ${item.title}`);
    remove.textContent = '×';
    remove.onclick = () => {
      if (!window.confirm(`Apagar a data “${item.title}”?`)) return;
      organizer.specialDates = organizer.specialDates.filter(saved => saved.id !== item.id);
      saveOrganizer();
      renderImportantDates();
      showOrganizerMessage('Data apagada.');
    };
    row.append(main, remove);
    root.appendChild(row);
  });
}

function renderMasterTasks() {
  const root = $('#masterTaskList');
  root.innerHTML = '';
  const items = [...organizer.masterTasks].sort((a, b) => (
    Number(a.done) - Number(b.done) || (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99')
  ));
  if (!items.length) {
    root.appendChild(createEmptyOrganizerMessage('A lista geral está vazia.'));
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = `organizer-list-item master-task-item${item.done ? ' done' : ''}`;
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = Boolean(item.done);
    check.setAttribute('aria-label', `Concluir ${item.text}`);
    check.onchange = () => {
      item.done = check.checked;
      saveOrganizer();
      renderMasterTasks();
    };
    const main = document.createElement(item.date ? 'button' : 'div');
    if (item.date) main.type = 'button';
    main.className = 'organizer-item-main';
    main.innerHTML = `<strong>${escapeHtml(item.text)}</strong><span>${item.date ? formatOrganizerDate(item.date) : 'Sem data marcada'}</span>`;
    main.prepend(createCategoryTag(item.category));
    if (item.date) main.onclick = () => openDay(fromIso(item.date));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'organizer-delete';
    remove.setAttribute('aria-label', `Apagar ${item.text}`);
    remove.textContent = '×';
    remove.onclick = () => {
      if (!window.confirm(`Apagar a tarefa “${item.text}”?`)) return;
      organizer.masterTasks = organizer.masterTasks.filter(saved => saved.id !== item.id);
      saveOrganizer();
      renderMasterTasks();
      showOrganizerMessage('Tarefa apagada.');
    };
    row.append(check, main, remove);
    root.appendChild(row);
  });
}

function renderHabitTracker() {
  const root = $('#habitTracker');
  const year = habitCursor.getFullYear();
  const month = habitCursor.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  $('#habitMonthTitle').textContent = `${MONTHS[month]} ${year}`;
  root.innerHTML = '';
  if (!organizer.habits.length) {
    root.appendChild(createEmptyOrganizerMessage('Adiciona um hábito para começar o acompanhamento mensal.'));
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'habit-table-wrap';
  const table = document.createElement('table');
  table.className = 'habit-table';
  const head = document.createElement('tr');
  head.innerHTML = '<th scope="col">Hábito</th>';
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day, 12);
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : '';
    th.innerHTML = `<span>${day}</span><small>${WEEK_SHORT[date.getDay()].slice(0, 1)}</small>`;
    head.appendChild(th);
  }
  const thead = document.createElement('thead');
  thead.appendChild(head);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  organizer.habits.forEach(habit => {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.style.setProperty('--category-color', categoryDetails(habit.category).color);
    label.innerHTML = `<span>${escapeHtml(habit.name)}</span><button type="button" aria-label="Apagar ${escapeHtml(habit.name)}">×</button>`;
    label.querySelector('button').onclick = () => {
      if (!window.confirm(`Apagar o hábito “${habit.name}” e o respetivo histórico?`)) return;
      organizer.habits = organizer.habits.filter(saved => saved.id !== habit.id);
      Object.keys(organizer.habitChecks).forEach(checkKey => {
        if (checkKey.startsWith(`${habit.id}|`)) delete organizer.habitChecks[checkKey];
      });
      saveOrganizer();
      renderHabitTracker();
    };
    row.appendChild(label);
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(year, month, day, 12);
      const checkKey = `${habit.id}|${key(date)}`;
      const cell = document.createElement('td');
      if (date.getDay() === 0 || date.getDay() === 6) cell.className = 'weekend';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = Boolean(organizer.habitChecks[checkKey]);
      check.setAttribute('aria-label', `${habit.name}, ${day} de ${MONTHS[month]}`);
      check.onchange = () => {
        if (check.checked) organizer.habitChecks[checkKey] = true;
        else delete organizer.habitChecks[checkKey];
        saveOrganizer();
      };
      cell.appendChild(check);
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

function renderContacts() {
  const root = $('#contactList');
  root.innerHTML = '';
  const contacts = [...organizer.contacts].sort((a, b) => Number(b.emergency) - Number(a.emergency) || a.name.localeCompare(b.name, 'pt'));
  if (!contacts.length) {
    root.appendChild(createEmptyOrganizerMessage('Ainda não existem contactos guardados.'));
    return;
  }
  contacts.forEach(contact => {
    const row = document.createElement('div');
    row.className = `organizer-list-item contact-item${contact.emergency ? ' emergency' : ''}`;
    const content = document.createElement('div');
    content.className = 'contact-content';
    const links = [];
    if (contact.phone) links.push(`<a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a>`);
    if (contact.email) links.push(`<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>`);
    content.innerHTML = `<strong>${contact.emergency ? 'Emergência · ' : ''}${escapeHtml(contact.name)}</strong><span>${links.join(' · ') || 'Sem telefone ou email'}</span>${contact.notes ? `<small>${escapeHtml(contact.notes)}</small>` : ''}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'organizer-delete';
    remove.setAttribute('aria-label', `Apagar ${contact.name}`);
    remove.textContent = '×';
    remove.onclick = () => {
      if (!window.confirm(`Apagar o contacto “${contact.name}”?`)) return;
      organizer.contacts = organizer.contacts.filter(saved => saved.id !== contact.id);
      saveOrganizer();
      renderContacts();
    };
    row.append(content, remove);
    root.appendChild(row);
  });
}

function renderInformation() {
  const root = $('#informationList');
  root.innerHTML = '';
  if (!organizer.information.length) {
    root.appendChild(createEmptyOrganizerMessage('Ainda não existem informações guardadas.'));
    return;
  }
  organizer.information.forEach(item => {
    const row = document.createElement('div');
    row.className = 'organizer-list-item information-item';
    const content = document.createElement('div');
    content.className = 'information-content';
    content.innerHTML = `<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span>`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'organizer-delete';
    remove.setAttribute('aria-label', `Apagar ${item.label}`);
    remove.textContent = '×';
    remove.onclick = () => {
      if (!window.confirm(`Apagar “${item.label}”?`)) return;
      organizer.information = organizer.information.filter(saved => saved.id !== item.id);
      saveOrganizer();
      renderInformation();
    };
    row.append(content, remove);
    root.appendChild(row);
  });
}

function searchableText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function searchAgenda(query) {
  const needle = searchableText(query.trim());
  if (!needle) return [];
  const results = [];
  const add = (type, title, detail, date = '') => results.push({type, title, detail, date});

  Object.entries(db).forEach(([date, data]) => {
    (data.tasks || []).forEach(task => {
      if (searchableText(task.text).includes(needle)) add('Tarefa diária', task.text, date, date);
    });
    Object.entries(data.schedule || {}).forEach(([hour, text]) => {
      if (searchableText(text).includes(needle)) add('Agenda do dia', text, `${date} · ${String(hour).padStart(2, '0')}:00`, date);
    });
    if (searchableText(data.notes).includes(needle)) add('Notas', data.notes.trim().slice(0, 110), date, date);
  });
  periods.forEach(period => {
    if (searchableText(period.title).includes(needle)) add('Período', period.title, `${period.start} — ${period.end}`, period.start);
  });
  organizer.specialDates.forEach(item => {
    if (searchableText(item.title).includes(needle)) add('Data importante', item.title, formatOrganizerDate(item.date, item.repeat === 'yearly'), item.date);
  });
  organizer.masterTasks.forEach(item => {
    if (searchableText(item.text).includes(needle)) add('Tarefa geral', item.text, item.date || 'Sem data', item.date);
  });
  organizer.contacts.forEach(contact => {
    if (searchableText([contact.name, contact.phone, contact.email, contact.notes].join(' ')).includes(needle)) {
      add('Contacto', contact.name, [contact.phone, contact.email, contact.notes].filter(Boolean).join(' · '));
    }
  });
  organizer.information.forEach(item => {
    if (searchableText(`${item.label} ${item.value}`).includes(needle)) add('Informação', item.label, item.value);
  });
  return results.slice(0, 100);
}

function renderSearchResults() {
  const root = $('#searchResults');
  const query = $('#globalSearch').value;
  if (!query.trim()) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }
  const results = searchAgenda(query);
  root.hidden = false;
  root.innerHTML = `<div class="search-results-head"><strong>${results.length} resultado${results.length === 1 ? '' : 's'}</strong><button type="button">Fechar</button></div>`;
  root.querySelector('button').onclick = () => {
    $('#globalSearch').value = '';
    renderSearchResults();
  };
  if (!results.length) {
    root.appendChild(createEmptyOrganizerMessage('Nada encontrado.'));
    return;
  }
  const list = document.createElement('div');
  list.className = 'search-results-list';
  results.forEach(result => {
    const item = document.createElement(result.date ? 'button' : 'div');
    if (result.date) item.type = 'button';
    item.className = 'search-result-item';
    item.innerHTML = `<span>${escapeHtml(result.type)}</span><strong>${escapeHtml(result.title)}</strong><small>${escapeHtml(result.detail)}</small>`;
    if (result.date) item.onclick = () => openDay(fromIso(result.date));
    list.appendChild(item);
  });
  root.appendChild(list);
}

function exportAgendaBackup() {
  const payload = {
    app: 'Pajó Agenda',
    version: 2,
    exportedAt: new Date().toISOString(),
    db,
    periods,
    organizer,
    currencyCache: readCurrencyCache(),
    ukHolidayCache
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pajo-agenda-backup-${key(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showOrganizerMessage('Cópia de segurança exportada.');
}

async function importAgendaBackup(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (payload.app !== 'Pajó Agenda' || !payload.db || !Array.isArray(payload.periods) || !payload.organizer) {
      throw new Error('invalid backup');
    }
    if (!window.confirm('Importar esta cópia vai substituir os dados atuais da Agenda. Continuar?')) return;
    db = payload.db;
    periods = payload.periods;
    organizer = payload.organizer;
    organizer.settings ??= {holidays: 'both'};
    organizer.settings.holidays ??= 'both';
    organizer.specialDates ??= [];
    organizer.masterTasks ??= [];
    organizer.habits ??= [];
    organizer.habitChecks ??= {};
    organizer.contacts ??= [];
    organizer.information ??= [];
    ukHolidayCache = payload.ukHolidayCache || ukHolidayCache;
    localStorage.setItem(KEY, JSON.stringify(db));
    localStorage.setItem(PERIOD_KEY, JSON.stringify(periods));
    saveOrganizer();
    localStorage.setItem(UK_HOLIDAY_CACHE_KEY, JSON.stringify(ukHolidayCache));
    if (payload.currencyCache) localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify(payload.currencyCache));
    renderOrganizer();
    showOrganizerMessage('Cópia importada com sucesso.');
  } catch {
    showOrganizerMessage('Este ficheiro não é uma cópia válida da Pajó Agenda.');
  } finally {
    $('#backupFile').value = '';
  }
}

function initializeOrganizer() {
  if (organizerInitialized) return;
  ['importantDateCategory', 'masterTaskCategory', 'habitCategory'].forEach(id => {
    $(`#${id}`).innerHTML = categoryOptions();
  });
  $('#importantDateValue').value = key(selected);
  $('#holidayRegion').value = organizer.settings.holidays;

  $('#importantDateForm').onsubmit = event => {
    event.preventDefault();
    organizer.specialDates.push({
      id: createId(),
      title: $('#importantDateTitle').value.trim(),
      date: $('#importantDateValue').value,
      category: $('#importantDateCategory').value,
      repeat: $('#importantDateRepeat').value
    });
    saveOrganizer();
    event.target.reset();
    $('#importantDateValue').value = key(selected);
    renderImportantDates();
    showOrganizerMessage('Data importante adicionada.');
  };

  $('#masterTaskForm').onsubmit = event => {
    event.preventDefault();
    organizer.masterTasks.push({
      id: createId(), text: $('#masterTaskText').value.trim(), date: $('#masterTaskDate').value,
      category: $('#masterTaskCategory').value, done: false
    });
    saveOrganizer();
    event.target.reset();
    renderMasterTasks();
    showOrganizerMessage('Tarefa adicionada à lista geral.');
  };

  $('#habitForm').onsubmit = event => {
    event.preventDefault();
    organizer.habits.push({id: createId(), name: $('#habitName').value.trim(), category: $('#habitCategory').value});
    saveOrganizer();
    event.target.reset();
    renderHabitTracker();
    showOrganizerMessage('Hábito adicionado.');
  };

  $('#contactForm').onsubmit = event => {
    event.preventDefault();
    organizer.contacts.push({
      id: createId(), name: $('#contactName').value.trim(), phone: $('#contactPhone').value.trim(),
      email: $('#contactEmail').value.trim(), notes: $('#contactNotes').value.trim(), emergency: $('#contactEmergency').checked
    });
    saveOrganizer();
    event.target.reset();
    renderContacts();
    showOrganizerMessage('Contacto guardado.');
  };

  $('#informationForm').onsubmit = event => {
    event.preventDefault();
    organizer.information.push({id: createId(), label: $('#informationLabel').value.trim(), value: $('#informationValue').value.trim()});
    saveOrganizer();
    event.target.reset();
    renderInformation();
    showOrganizerMessage('Informação guardada.');
  };

  $('#prevHabitMonth').onclick = () => {
    habitCursor = new Date(habitCursor.getFullYear(), habitCursor.getMonth() - 1, 1, 12);
    renderHabitTracker();
  };
  $('#nextHabitMonth').onclick = () => {
    habitCursor = new Date(habitCursor.getFullYear(), habitCursor.getMonth() + 1, 1, 12);
    renderHabitTracker();
  };
  $('#holidayRegion').onchange = event => {
    organizer.settings.holidays = event.target.value;
    saveOrganizer();
    showOrganizerMessage('Preferência de feriados guardada.');
  };
  $('#globalSearch').oninput = renderSearchResults;
  $('#exportBackup').onclick = exportAgendaBackup;
  $('#importBackup').onclick = () => $('#backupFile').click();
  $('#backupFile').onchange = event => {
    const [file] = event.target.files;
    if (file) importAgendaBackup(file);
  };
  organizerInitialized = true;
}

function renderOrganizer() {
  initializeOrganizer();
  $('#holidayRegion').value = organizer.settings.holidays;
  renderImportantDates();
  renderMasterTasks();
  renderHabitTracker();
  renderContacts();
  renderInformation();
  renderSearchResults();
}

function formatUtilityNumber(value, maximumFractionDigits = 6) {
  if (!Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 0.000001) || absolute >= 1000000000000) {
    return value.toExponential(4);
  }
  return new Intl.NumberFormat('pt-PT', {maximumFractionDigits}).format(value);
}

function showUtilityMessage(message) {
  const root = $('#utilityMessage');
  root.textContent = message;
  clearTimeout(showUtilityMessage.timer);
  showUtilityMessage.timer = setTimeout(() => { root.textContent = ''; }, 2200);
}

async function copyUtilityValue(value) {
  try {
    await navigator.clipboard.writeText(value);
    showUtilityMessage('Resultado copiado.');
  } catch {
    showUtilityMessage('Não foi possível copiar automaticamente.');
  }
}

function utilityUnitOptions(units) {
  return units.map(unit => `<option value="${unit[0]}">${unit[1]}</option>`).join('');
}

function convertUtilityValue(converter, value, fromId, toId) {
  if (!Number.isFinite(value)) return NaN;
  if (converter.toBase && converter.fromBase) {
    return converter.fromBase(converter.toBase(value, fromId), toId);
  }
  const from = converter.units.find(unit => unit[0] === fromId);
  const to = converter.units.find(unit => unit[0] === toId);
  return value * from[2] / to[2];
}

function createUtilityCard(title, description, category, modifier = '') {
  const card = document.createElement('article');
  card.className = `utility-card${modifier ? ` ${modifier}` : ''}`;
  card.dataset.category = category;
  card.innerHTML = `<header><h3>${title}</h3><p>${description}</p></header>`;
  return card;
}

function createGenericConverter(converter) {
  const card = createUtilityCard(converter.title, converter.description, converter.category);
  const body = document.createElement('div');
  body.className = 'converter-body';
  body.innerHTML = `
    <label class="utility-field">Valor<input class="utility-input" type="number" step="any" inputmode="decimal" value="${converter.defaultValue}"></label>
    <div class="converter-units">
      <label class="utility-field">De<select class="utility-from">${utilityUnitOptions(converter.units)}</select></label>
      <button class="utility-swap" type="button" aria-label="Trocar unidades">⇄</button>
      <label class="utility-field">Para<select class="utility-to">${utilityUnitOptions(converter.units)}</select></label>
    </div>
    <div class="utility-result-row"><output class="utility-result"></output><button class="utility-copy" type="button">Copiar</button></div>`;
  card.appendChild(body);

  const input = body.querySelector('.utility-input');
  const from = body.querySelector('.utility-from');
  const to = body.querySelector('.utility-to');
  const result = body.querySelector('.utility-result');
  from.value = converter.from;
  to.value = converter.to;

  const calculate = () => {
    const converted = convertUtilityValue(converter, Number(input.value), from.value, to.value);
    result.value = Number.isFinite(converted) ? formatUtilityNumber(converted) : '—';
    result.dataset.copyValue = Number.isFinite(converted) ? String(converted) : '';
  };

  input.oninput = calculate;
  from.onchange = calculate;
  to.onchange = calculate;
  body.querySelector('.utility-swap').onclick = () => {
    [from.value, to.value] = [to.value, from.value];
    calculate();
  };
  body.querySelector('.utility-copy').onclick = () => {
    if (result.dataset.copyValue) copyUtilityValue(result.dataset.copyValue);
  };
  calculate();
  return card;
}

function readCurrencyCache() {
  try {
    return JSON.parse(localStorage.getItem(CURRENCY_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function currencyOptions() {
  return CURRENCIES.map(([code, name]) => `<option value="${code}">${code} — ${name}</option>`).join('');
}

function createCurrencyCard() {
  const card = createUtilityCard('Divisas', 'Taxas de referência atualizadas pela internet.', 'money', 'currency-card');
  const body = document.createElement('div');
  body.className = 'converter-body';
  body.innerHTML = `
    <label class="utility-field">Montante<input class="currency-amount" type="number" step="any" inputmode="decimal" value="100"></label>
    <div class="converter-units">
      <label class="utility-field">De<select class="currency-from">${currencyOptions()}</select></label>
      <button class="utility-swap currency-swap" type="button" aria-label="Trocar divisas">⇄</button>
      <label class="utility-field">Para<select class="currency-to">${currencyOptions()}</select></label>
    </div>
    <div class="utility-result-row"><output class="utility-result currency-result">—</output><button class="utility-copy currency-copy" type="button">Copiar</button></div>
    <div class="currency-footer"><span class="currency-status">A obter a taxa…</span><button class="currency-refresh" type="button">Atualizar taxa</button></div>
    <p class="utility-disclaimer">Taxa de referência; o banco ou cartão pode aplicar outra taxa e comissões.</p>`;
  card.appendChild(body);

  const amount = body.querySelector('.currency-amount');
  const from = body.querySelector('.currency-from');
  const to = body.querySelector('.currency-to');
  const result = body.querySelector('.currency-result');
  const status = body.querySelector('.currency-status');
  from.value = 'GBP';
  to.value = 'EUR';
  let currentRate = null;

  const calculate = () => {
    const converted = Number(amount.value) * currentRate;
    result.value = Number.isFinite(converted) ? formatUtilityNumber(converted, 4) : '—';
    result.dataset.copyValue = Number.isFinite(converted) ? String(converted) : '';
  };

  const refreshRate = async () => {
    const base = from.value;
    const quote = to.value;
    if (base === quote) {
      currentRate = 1;
      status.textContent = 'As duas divisas são iguais.';
      calculate();
      return;
    }

    const cache = readCurrencyCache();
    const pairKey = `${base}-${quote}`;
    const cached = cache[pairKey];
    if (cached?.rate) {
      currentRate = Number(cached.rate);
      status.textContent = `Última taxa guardada: ${cached.date || 'data não indicada'}`;
      calculate();
    } else {
      currentRate = null;
      result.value = '—';
      status.textContent = 'A obter a taxa…';
    }

    try {
      const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`);
      if (!response.ok) throw new Error('currency request failed');
      const data = await response.json();
      const rate = Number(data.rate);
      if (!Number.isFinite(rate)) throw new Error('invalid currency rate');
      currentRate = rate;
      cache[pairKey] = {rate, date: data.date || '', savedAt: new Date().toISOString()};
      localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify(cache));
      status.textContent = `Taxa de referência de ${data.date || 'hoje'}`;
      calculate();
    } catch {
      status.textContent = cached?.rate
        ? `Sem internet — a usar a taxa guardada de ${cached.date || 'data anterior'}`
        : 'Não foi possível obter a taxa. Verifica a ligação.';
    }
  };

  amount.oninput = calculate;
  from.onchange = refreshRate;
  to.onchange = refreshRate;
  body.querySelector('.currency-swap').onclick = () => {
    [from.value, to.value] = [to.value, from.value];
    refreshRate();
  };
  body.querySelector('.currency-copy').onclick = () => {
    if (result.dataset.copyValue) copyUtilityValue(result.dataset.copyValue);
  };
  body.querySelector('.currency-refresh').onclick = refreshRate;
  refreshRate();
  return card;
}

const SIZE_TABLES = [
  {
    id: 'men-shoes', label: 'Calçado — homem',
    rows: [['39', '5.5'], ['40', '6.5'], ['41', '7'], ['42', '8'], ['43', '9'], ['44', '9.5'], ['45', '10.5'], ['46', '11'], ['47', '12'], ['48', '13']]
  },
  {
    id: 'women-shoes', label: 'Calçado — mulher',
    rows: [['35', '2.5'], ['36', '3.5'], ['37', '4'], ['38', '5'], ['39', '6'], ['40', '6.5'], ['41', '7.5'], ['42', '8']]
  },
  {
    id: 'women-clothes', label: 'Roupa — mulher',
    rows: [['34', '6'], ['36', '8'], ['38', '10'], ['40', '12'], ['42', '14'], ['44', '16'], ['46', '18'], ['48', '20']]
  },
  {
    id: 'men-jackets', label: 'Casacos — homem',
    rows: [['44', '34'], ['46', '36'], ['48', '38'], ['50', '40'], ['52', '42'], ['54', '44'], ['56', '46'], ['58', '48']]
  }
];

function createSizeCard() {
  const card = createUtilityCard('Tamanhos UK e EU', 'Referência rápida para calçado e roupa.', 'home');
  const body = document.createElement('div');
  body.className = 'converter-body';
  body.innerHTML = `
    <label class="utility-field">Categoria<select class="size-category">${SIZE_TABLES.map(table => `<option value="${table.id}">${table.label}</option>`).join('')}</select></label>
    <div class="converter-units">
      <label class="utility-field">Sistema<select class="size-direction"><option value="eu-uk">EU → UK</option><option value="uk-eu">UK → EU</option></select></label>
      <button class="utility-swap size-swap" type="button" aria-label="Trocar sistemas">⇄</button>
      <label class="utility-field">Tamanho<select class="size-value"></select></label>
    </div>
    <div class="utility-result-row"><output class="utility-result size-result"></output><button class="utility-copy size-copy" type="button">Copiar</button></div>
    <p class="utility-disclaimer">Valores aproximados: confirma sempre a tabela da marca.</p>`;
  card.appendChild(body);
  const category = body.querySelector('.size-category');
  const direction = body.querySelector('.size-direction');
  const value = body.querySelector('.size-value');
  const result = body.querySelector('.size-result');

  const populate = () => {
    const table = SIZE_TABLES.find(item => item.id === category.value);
    const sourceIndex = direction.value === 'eu-uk' ? 0 : 1;
    value.innerHTML = table.rows.map(row => `<option value="${row[sourceIndex]}">${direction.value === 'eu-uk' ? 'EU' : 'UK'} ${row[sourceIndex]}</option>`).join('');
    calculate();
  };

  const calculate = () => {
    const table = SIZE_TABLES.find(item => item.id === category.value);
    const sourceIndex = direction.value === 'eu-uk' ? 0 : 1;
    const targetIndex = sourceIndex === 0 ? 1 : 0;
    const row = table.rows.find(item => item[sourceIndex] === value.value);
    const text = row ? `${direction.value === 'eu-uk' ? 'UK' : 'EU'} ${row[targetIndex]}` : '—';
    result.value = text;
    result.dataset.copyValue = text === '—' ? '' : text;
  };

  category.onchange = populate;
  direction.onchange = populate;
  value.onchange = calculate;
  body.querySelector('.size-swap').onclick = () => {
    direction.value = direction.value === 'eu-uk' ? 'uk-eu' : 'eu-uk';
    populate();
  };
  body.querySelector('.size-copy').onclick = () => {
    if (result.dataset.copyValue) copyUtilityValue(result.dataset.copyValue);
  };
  populate();
  return card;
}

function createOvenCard() {
  const card = createUtilityCard('Forno e Gas Mark', 'Equivalências usadas em receitas britânicas.', 'home');
  const temperatures = [
    ['¼', 110, 225], ['½', 120, 250], ['1', 140, 275], ['2', 150, 300],
    ['3', 170, 325], ['4', 180, 350], ['5', 190, 375], ['6', 200, 400],
    ['7', 220, 425], ['8', 230, 450], ['9', 240, 475]
  ];
  const body = document.createElement('div');
  body.className = 'converter-body';
  body.innerHTML = `
    <label class="utility-field">Gas Mark<select class="oven-mark">${temperatures.map(row => `<option value="${row[0]}">Gas Mark ${row[0]}</option>`).join('')}</select></label>
    <div class="oven-result"><strong></strong><span></span></div>
    <p class="utility-disclaimer">As temperaturas podem variar ligeiramente conforme o forno.</p>`;
  card.appendChild(body);
  const select = body.querySelector('.oven-mark');
  select.value = '4';
  const calculate = () => {
    const row = temperatures.find(item => item[0] === select.value);
    body.querySelector('.oven-result strong').textContent = `${row[1]} °C`;
    body.querySelector('.oven-result span').textContent = `${row[2]} °F`;
  };
  select.onchange = calculate;
  calculate();
  return card;
}

function parseDateValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function calendarDifference(first, second) {
  let start = first;
  let end = second;
  let reversed = false;
  if (start > end) {
    [start, end] = [end, start];
    reversed = true;
  }

  let years = end.getFullYear() - start.getFullYear();
  let cursor = new Date(start.getFullYear() + years, start.getMonth(), start.getDate(), 12);
  if (cursor > end) {
    years -= 1;
    cursor = new Date(start.getFullYear() + years, start.getMonth(), start.getDate(), 12);
  }

  let months = (end.getFullYear() - cursor.getFullYear()) * 12 + end.getMonth() - cursor.getMonth();
  let monthCursor = new Date(cursor.getFullYear(), cursor.getMonth() + months, cursor.getDate(), 12);
  if (monthCursor > end) {
    months -= 1;
    monthCursor = new Date(cursor.getFullYear(), cursor.getMonth() + months, cursor.getDate(), 12);
  }

  const days = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(monthCursor.getFullYear(), monthCursor.getMonth(), monthCursor.getDate())) / 86400000);
  const totalDays = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
  return {years, months, days, totalDays, reversed};
}

function createDateCard() {
  const card = createUtilityCard('Datas e idade', 'Calcula a diferença exata entre duas datas.', 'dates');
  const today = key(new Date());
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const body = document.createElement('div');
  body.className = 'converter-body';
  body.innerHTML = `
    <div class="date-fields">
      <label class="utility-field">Data inicial<input class="date-start" type="date" value="${yearStart}"></label>
      <label class="utility-field">Data final<input class="date-end" type="date" value="${today}"></label>
    </div>
    <div class="utility-result-row"><output class="utility-result date-result"></output><button class="utility-copy date-copy" type="button">Copiar</button></div>`;
  card.appendChild(body);
  const start = body.querySelector('.date-start');
  const end = body.querySelector('.date-end');
  const result = body.querySelector('.date-result');

  const calculate = () => {
    const startDate = parseDateValue(start.value);
    const endDate = parseDateValue(end.value);
    if (!startDate || !endDate) {
      result.value = 'Escolhe as duas datas';
      result.dataset.copyValue = '';
      return;
    }
    const difference = calendarDifference(startDate, endDate);
    const text = `${difference.reversed ? 'Intervalo inverso · ' : ''}${difference.years} anos, ${difference.months} meses e ${difference.days} dias · ${difference.totalDays} dias no total`;
    result.value = text;
    result.dataset.copyValue = text;
  };
  start.onchange = calculate;
  end.onchange = calculate;
  body.querySelector('.date-copy').onclick = () => copyUtilityValue(result.dataset.copyValue);
  calculate();
  return card;
}

function createTripCard() {
  const card = createUtilityCard('Custo de viagem', 'Calcula combustível necessário e custo estimado.', 'travel');
  const body = document.createElement('div');
  body.className = 'converter-body';
  body.innerHTML = `
    <div class="trip-fields">
      <label class="utility-field">Distância<input class="trip-distance" type="number" min="0" step="any" value="100"></label>
      <label class="utility-field">Unidade<select class="trip-distance-unit"><option value="mi">Milhas</option><option value="km">Quilómetros</option></select></label>
      <label class="utility-field">Consumo<input class="trip-economy" type="number" min="0" step="any" value="50"></label>
      <label class="utility-field">Formato<select class="trip-economy-unit"><option value="mpg-uk">MPG britânico</option><option value="mpg-us">MPG americano</option><option value="l100">L/100 km</option><option value="kml">km/l</option></select></label>
      <label class="utility-field trip-price">Preço por litro (£)<input class="trip-fuel-price" type="number" min="0" step="0.01" value="1.45"></label>
    </div>
    <div class="trip-result"><strong></strong><span></span></div>`;
  card.appendChild(body);
  const distance = body.querySelector('.trip-distance');
  const distanceUnit = body.querySelector('.trip-distance-unit');
  const economy = body.querySelector('.trip-economy');
  const economyUnit = body.querySelector('.trip-economy-unit');
  const price = body.querySelector('.trip-fuel-price');

  const calculate = () => {
    const distanceValue = Number(distance.value);
    const economyValue = Number(economy.value);
    const priceValue = Number(price.value);
    if (!(distanceValue >= 0) || !(economyValue > 0) || !(priceValue >= 0)) {
      body.querySelector('.trip-result strong').textContent = '—';
      body.querySelector('.trip-result span').textContent = 'Introduz valores válidos.';
      return;
    }
    const distanceKm = distanceUnit.value === 'mi' ? distanceValue * 1.609344 : distanceValue;
    const distanceMiles = distanceUnit.value === 'mi' ? distanceValue : distanceValue / 1.609344;
    let litres;
    if (economyUnit.value === 'mpg-uk') litres = distanceMiles / economyValue * 4.54609;
    else if (economyUnit.value === 'mpg-us') litres = distanceMiles / economyValue * 3.785411784;
    else if (economyUnit.value === 'kml') litres = distanceKm / economyValue;
    else litres = distanceKm / 100 * economyValue;
    const cost = litres * priceValue;
    body.querySelector('.trip-result strong').textContent = `${formatUtilityNumber(litres, 2)} litros`;
    body.querySelector('.trip-result span').textContent = new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'}).format(cost);
  };

  [distance, distanceUnit, economy, economyUnit, price].forEach(field => {
    field.oninput = calculate;
    field.onchange = calculate;
  });
  calculate();
  return card;
}

function renderUtilityFilters() {
  const root = $('#utilityFilters');
  root.innerHTML = '';
  UTILITY_FILTERS.forEach(([id, label], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = index === 0 ? 'active' : '';
    button.textContent = label;
    button.onclick = () => {
      root.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.utility-card').forEach(card => {
        card.hidden = id !== 'all' && card.dataset.category !== id;
      });
    };
    root.appendChild(button);
  });
}

function renderUtilities() {
  if (utilitiesInitialized) return;
  const root = $('#utilitiesGrid');
  root.innerHTML = '';
  CONVERTERS.forEach(converter => root.appendChild(createGenericConverter(converter)));
  root.append(
    createCurrencyCard(),
    createSizeCard(),
    createOvenCard(),
    createDateCard(),
    createTripCard()
  );
  renderUtilityFilters();
  utilitiesInitialized = true;
}

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
refreshUkHolidays();
