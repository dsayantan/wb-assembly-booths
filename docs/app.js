let assemblies = [];
let currentData = null;
let currentRecords = [];


const tableWrapper = document.getElementById("tableWrapper");
const topScroll = document.getElementById("topScroll");
const topScrollInner = document.getElementById("topScrollInner");

const assemblySelect = document.getElementById("assemblySelect");
const modeSelect = document.getElementById("modeSelect");
const valueViewSelect = document.getElementById("valueViewSelect");

const panchayatSelect = document.getElementById("panchayatSelect");
const municipalitySelect = document.getElementById("municipalitySelect");
const wardSelect = document.getElementById("wardSelect");

const panchayatBox = document.getElementById("panchayatBox");
const municipalityBox = document.getElementById("municipalityBox");
const wardBox = document.getElementById("wardBox");

const boothTable = document.getElementById("boothTable");
const resultCount = document.getElementById("resultCount");

async function loadIndex() {
  try {
    const res = await fetch("data/index.json");

    if (!res.ok) {
      throw new Error("Could not load data/index.json");
    }

    assemblies = await res.json();

    assemblySelect.innerHTML = "";

    assemblies.forEach((asm, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${asm.ac_no} - ${asm.assembly}`;
      assemblySelect.appendChild(option);
    });

    if (assemblies.length > 0) {
      await loadAssembly(0);
    } else {
      resultCount.textContent = "No assemblies found.";
    }

  } catch (error) {
    console.error(error);
    resultCount.textContent = "Error loading assembly index. Check docs/data/index.json.";
  }
}

async function loadAssembly(index) {
  try {
    const asm = assemblies[index];

    const res = await fetch(asm.file);

    if (!res.ok) {
      throw new Error(`Could not load ${asm.file}`);
    }

    currentData = await res.json();
    currentRecords = currentData.records || [];

    populateFilters();
    applyFilters();

  } catch (error) {
    console.error(error);
    resultCount.textContent = "Error loading selected assembly data.";
    boothTable.innerHTML = "";
  }
}

function normalizeHeader(col) {
  return String(col)
    .toLowerCase()
    .replace(/[%().]/g, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function isHelperColumn(col) {
  return [
    "_ps_no",
    "_booth_name",
    "_municipality",
    "_ward",
    "_panchayat"
  ].includes(col);
}

function isOriginalPercentColumn(col) {
  return String(col).includes("%");
}

function isTotalColumn(col) {
  const h = normalizeHeader(col);
  return h === "total" || h === "totalvotes" || h === "totalvalidvotes";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleaned = String(value).replace(/,/g, "").trim();
  const num = Number(cleaned);

  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value) {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return value ?? "";
  }

  return Math.round(num).toLocaleString("en-IN");
}

function formatPercent(value) {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return "";
  }

  return num.toFixed(2);
}

function uniqueValues(records, key) {
  return [
    ...new Set(
      records
        .map(row => row[key])
        .filter(value => value !== "" && value !== null && value !== undefined)
    )
  ].sort((a, b) => {
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  });
}

function fillSelect(select, values, includeAll = true) {
  select.innerHTML = "";

  if (includeAll) {
    const allOption = document.createElement("option");
    allOption.value = "All";
    allOption.textContent = "All";
    select.appendChild(allOption);
  }

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function populateFilters() {
  fillSelect(panchayatSelect, uniqueValues(currentRecords, "_panchayat"));
  fillSelect(municipalitySelect, uniqueValues(currentRecords, "_municipality"));
  updateWardOptions();
  updateFilterVisibility();
}

function updateWardOptions() {
  const municipality = municipalitySelect.value;

  let records = currentRecords;

  if (municipality && municipality !== "All") {
    records = records.filter(row => String(row["_municipality"]) === String(municipality));
  }

  fillSelect(wardSelect, uniqueValues(records, "_ward"));
}

function updateFilterVisibility() {
  const mode = modeSelect.value;

  panchayatBox.style.display = mode === "panchayat" ? "flex" : "none";
  municipalityBox.style.display = mode === "municipality" ? "flex" : "none";
  wardBox.style.display = mode === "municipality" ? "flex" : "none";
}

function applyFilters() {
  const mode = modeSelect.value;

  let records = [...currentRecords];

  if (mode === "panchayat") {
    const panchayat = panchayatSelect.value;

    if (panchayat !== "All") {
      records = records.filter(row => String(row["_panchayat"]) === String(panchayat));
    }
  }

  if (mode === "municipality") {
    const municipality = municipalitySelect.value;
    const ward = wardSelect.value;

    if (municipality !== "All") {
      records = records.filter(row => String(row["_municipality"]) === String(municipality));
    }

    if (ward !== "All") {
      records = records.filter(row => String(row["_ward"]) === String(ward));
    }
  }

  renderTable(records);
}

function getDisplayColumns(records) {
  if (!records.length) {
    return [];
  }

  return Object.keys(records[0]).filter(col => !isHelperColumn(col));
}

function getTotalColumn(columns) {
  return columns.find(col => isTotalColumn(col));
}

/*
  Important rule based on your Excel structure:

  If a column header contains %, that column is the original Excel percentage column.
  The next column is the actual vote column for that candidate.

  Example:
  BJP %   → original percentage column, ignored
  BJP     → actual vote column, used for calculation

  TMC %   → original percentage column, ignored
  TMC     → actual vote column, used for calculation
*/
function getCandidatePairs(columns) {
  const pairs = [];

  for (let i = 0; i < columns.length; i++) {
    const percentCol = columns[i];

    if (!isOriginalPercentColumn(percentCol)) {
      continue;
    }

    const voteCol = columns[i + 1];

    if (!voteCol) {
      continue;
    }

    if (isHelperColumn(voteCol)) {
      continue;
    }

    if (isOriginalPercentColumn(voteCol)) {
      continue;
    }

    if (isTotalColumn(voteCol)) {
      continue;
    }

    pairs.push({
      percentCol: percentCol,
      voteCol: voteCol
    });
  }

  return pairs;
}

function sumColumn(records, col) {
  return records.reduce((sum, row) => {
    return sum + toNumber(row[col]);
  }, 0);
}

function calculatePercent(votes, totalVotes) {
  if (!totalVotes || totalVotes <= 0) {
    return "";
  }

  return (votes / totalVotes) * 100;
}

function buildDisplaySpec(columns, candidatePairs, totalCol, viewMode) {
  const pairByPercentCol = new Map();
  const actualVoteCols = new Set();

  candidatePairs.forEach(pair => {
    pairByPercentCol.set(pair.percentCol, pair);
    actualVoteCols.add(pair.voteCol);
  });

  const displaySpec = [];

  columns.forEach(col => {
    if (isHelperColumn(col)) {
      return;
    }

    if (viewMode === "actual") {
      /*
        Actual Votes view:
        - Hide original Excel % columns.
        - Show actual vote columns.
        - Show Total column.
        - Show Municipality, Ward, Panchayat columns.
      */
      if (isOriginalPercentColumn(col)) {
        return;
      }

      displaySpec.push({
        type: "source",
        header: col,
        col: col
      });

      return;
    }

    if (viewMode === "percent") {
      /*
        Percentage Votes view:
        - Hide original Excel actual vote columns.
        - Use original % column headers.
        - Recalculate percentages live from actual vote columns.
      */
      if (isOriginalPercentColumn(col)) {
        const pair = pairByPercentCol.get(col);

        if (pair) {
          displaySpec.push({
            type: "calculated_percent",
            header: col,
            voteCol: pair.voteCol
          });
        }

        return;
      }

      if (actualVoteCols.has(col)) {
        return;
      }

      displaySpec.push({
        type: "source",
        header: col,
        col: col
      });
    }
  });

  return displaySpec;
}

function buildTotalRow(records, displaySpec, candidatePairs, totalCol) {
  const totalVotes = totalCol ? sumColumn(records, totalCol) : 0;
  const actualVoteCols = new Set(candidatePairs.map(pair => pair.voteCol));

  const totalRow = {};

  displaySpec.forEach((spec, index) => {
    if (index === 0) {
      totalRow[spec.header] = "Total";
      return;
    }

    if (spec.type === "calculated_percent") {
      const candidateVotes = sumColumn(records, spec.voteCol);
      totalRow[spec.header] = calculatePercent(candidateVotes, totalVotes);
      return;
    }

    if (spec.type === "source") {
      if (spec.col === totalCol) {
        totalRow[spec.header] = totalVotes;
        return;
      }

      if (actualVoteCols.has(spec.col)) {
        totalRow[spec.header] = sumColumn(records, spec.col);
        return;
      }

      totalRow[spec.header] = "";
    }
  });

  return totalRow;
}

function getCellValue(record, spec, totalCol) {
  if (spec.type === "calculated_percent") {
    const candidateVotes = toNumber(record[spec.voteCol]);
    const totalVotes = toNumber(record[totalCol]);

    return calculatePercent(candidateVotes, totalVotes);
  }

  return record[spec.col];
}

function formatCellValue(value, spec, totalCol) {
  if (spec.type === "calculated_percent") {
    return formatPercent(value);
  }

  if (spec.col === totalCol) {
    return formatNumber(value);
  }

  const num = Number(value);

  if (
    Number.isFinite(num) &&
    value !== "" &&
    value !== null &&
    value !== undefined
  ) {
    return formatNumber(value);
  }

  return value ?? "";
}

function getColumnClass(spec, totalCol) {
  const header = String(spec.header).toLowerCase();

  if (
    header.includes("booth") ||
    header.includes("ps name") ||
    header.includes("polling station")
  ) {
    return "col-booth-name";
  }

  if (
    header.includes("municipality") ||
    header.includes("panchayat") ||
    header.includes("ward") ||
    header.includes("gp")
  ) {
    return "col-area";
  }

  if (spec.type === "calculated_percent") {
    return "col-percent";
  }

  if (spec.col === totalCol) {
    return "col-total";
  }

  return "col-normal";
}


function setupHorizontalScrollbar() {
  if (!tableWrapper || !topScroll || !topScrollInner || !boothTable) {
    return;
  }

  // Make the fake scrollbar as wide as the real table
  topScrollInner.style.width = boothTable.scrollWidth + "px";

  // Show top scrollbar only if table is wider than the visible area
  if (boothTable.scrollWidth > tableWrapper.clientWidth) {
    topScroll.style.display = "block";
  } else {
    topScroll.style.display = "none";
  }

  let syncingTop = false;
  let syncingTable = false;

  topScroll.onscroll = function () {
    if (syncingTable) return;

    syncingTop = true;
    tableWrapper.scrollLeft = topScroll.scrollLeft;
    syncingTop = false;
  };

  tableWrapper.onscroll = function () {
    if (syncingTop) return;

    syncingTable = true;
    topScroll.scrollLeft = tableWrapper.scrollLeft;
    syncingTable = false;
  };
}

function renderTable(records) {
  boothTable.innerHTML = "";

  if (!records.length) {
    resultCount.textContent = "No booths found.";
    return;
  }

  const viewMode = valueViewSelect.value;

  resultCount.textContent = `${records.length} booth(s) found.`;

  const columns = getDisplayColumns(records);
  const totalCol = getTotalColumn(columns);
  const candidatePairs = getCandidatePairs(columns);

  const displaySpec = buildDisplaySpec(columns, candidatePairs, totalCol, viewMode);
  const totalRow = buildTotalRow(records, displaySpec, candidatePairs, totalCol);

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  displaySpec.forEach(spec => {
    const th = document.createElement("th");
    th.textContent = spec.header;
    th.classList.add(getColumnClass(spec, totalCol));
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  boothTable.appendChild(thead);

  const tbody = document.createElement("tbody");

  records.forEach(record => {
    const tr = document.createElement("tr");

    displaySpec.forEach(spec => {
      const td = document.createElement("td");
      const value = getCellValue(record, spec, totalCol);

      td.textContent = formatCellValue(value, spec, totalCol);
      td.setAttribute("data-label", spec.header);
      td.classList.add(getColumnClass(spec, totalCol));

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  const totalTr = document.createElement("tr");
  totalTr.classList.add("total-row");

  displaySpec.forEach(spec => {
    const td = document.createElement("td");
    const value = totalRow[spec.header];

    if (spec.type === "calculated_percent") {
      td.textContent = formatPercent(value);
    } else {
      td.textContent = formatCellValue(value, spec, totalCol);
    }

    td.setAttribute("data-label", spec.header);
    td.classList.add(getColumnClass(spec, totalCol));

    totalTr.appendChild(td);
  });

  tbody.appendChild(totalTr);
  boothTable.appendChild(tbody);
  setTimeout(setupHorizontalScrollbar, 0);

}

assemblySelect.addEventListener("change", async () => {
  await loadAssembly(assemblySelect.value);
});

modeSelect.addEventListener("change", () => {
  updateFilterVisibility();
  applyFilters();
});

valueViewSelect.addEventListener("change", applyFilters);

panchayatSelect.addEventListener("change", applyFilters);

municipalitySelect.addEventListener("change", () => {
  updateWardOptions();
  applyFilters();
});

wardSelect.addEventListener("change", applyFilters);

loadIndex();
