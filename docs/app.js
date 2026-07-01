let assemblies = [];
let currentData = null;
let currentRecords = [];

const partyFilterType = document.getElementById("partyFilterType");
const minPercentBox = document.getElementById("minPercentBox");
const maxPercentBox = document.getElementById("maxPercentBox");
const rankBox = document.getElementById("rankBox");
const rankInput = document.getElementById("rankInput");

const partySelect = document.getElementById("partySelect");
const minPercentInput = document.getElementById("minPercentInput");
const maxPercentInput = document.getElementById("maxPercentInput");

const districtSelect = document.getElementById("districtSelect");
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
const loadedAssemblyTitle = document.getElementById("loadedAssemblyTitle");
const tableWrapper = document.getElementById("tableWrapper");
const topScroll = document.getElementById("topScroll");
const topScrollInner = document.getElementById("topScrollInner");

async function loadIndex() {
  try {
    const res = await fetch("data/index.json");

    if (!res.ok) {
      throw new Error("Could not load data/index.json");
    }

    assemblies = await res.json();

    assemblies.sort((a, b) => {
      return Number(a.ac_no) - Number(b.ac_no);
    });

    populateDistricts();

  } catch (error) {
    console.error(error);
    resultCount.textContent = "Error loading assembly index. Check docs/data/index.json.";
    boothTable.innerHTML = "";
  }
}

function populateDistricts() {
  const districts = [
    ...new Set(
      assemblies.map(asm => {
        const district = asm.district || "Unknown District";
        return String(district).trim() || "Unknown District";
      })
    )
  ].sort((a, b) => String(a).localeCompare(String(b)));

  districtSelect.innerHTML = "";

  districts.forEach(district => {
    const option = document.createElement("option");
    option.value = district;
    option.textContent = district;
    districtSelect.appendChild(option);
  });

  if (districts.length > 0) {
    populateAssembliesForDistrict(districts[0]);
  } else {
    resultCount.textContent = "No districts found.";
    boothTable.innerHTML = "";
  }
}

function populateAssembliesForDistrict(district) {
  const filteredAssemblies = assemblies
    .map((asm, index) => ({ ...asm, originalIndex: index }))
    .filter(asm => {
      const asmDistrict = String(asm.district || "Unknown District").trim() || "Unknown District";
      return asmDistrict === district;
    })
    .sort((a, b) => Number(a.ac_no) - Number(b.ac_no));

  assemblySelect.innerHTML = "";

  filteredAssemblies.forEach(asm => {
    const option = document.createElement("option");
    option.value = asm.originalIndex;
    option.textContent = `${asm.ac_no} - ${asm.assembly}`;
    assemblySelect.appendChild(option);
  });

  if (filteredAssemblies.length > 0) {
    loadAssembly(filteredAssemblies[0].originalIndex);
  } else {
    currentData = null;
    currentRecords = [];
    boothTable.innerHTML = "";
    resultCount.textContent = "No assemblies found for this district.";
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

    if (loadedAssemblyTitle) {
      loadedAssemblyTitle.textContent = `${currentData.ac_no} - ${currentData.assembly}`;
    }

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
  populatePartyDropdown();
  updateWardOptions();
  updateFilterVisibility();
}

function updatePartyFilterVisibility() {
  if (partyFilterType.value === "rank") {
    minPercentBox.style.display = "none";
    maxPercentBox.style.display = "none";
    rankBox.style.display = "flex";
  } else {
    minPercentBox.style.display = "flex";
    maxPercentBox.style.display = "flex";
    rankBox.style.display = "none";
  }
}

function clampRankInput(input) {
  let value = input.value;

  if (value === "") {
    return;
  }

  value = Number(value);

  if (!Number.isInteger(value)) {
    value = Math.round(value);
  }

  if (value < 1) {
    value = 1;
  }

  input.value = value;
}

function getPartyRankForRow(row, partyVoteCol, candidatePairs) {
  const partyVotes = toNumber(row[partyVoteCol]);

  const voteList = candidatePairs
    .map(pair => toNumber(row[pair.voteCol]))
    .sort((a, b) => b - a);

  const higherVotesCount = voteList.filter(votes => votes > partyVotes).length;

  return higherVotesCount + 1;
}

function applyPartyRankFilter(records, candidatePairs) {
  const partyVoteCol = partySelect.value;

  if (!partyVoteCol) {
    return records;
  }

  let rankValue = rankInput.value === "" ? 1 : Number(rankInput.value);

  if (!Number.isFinite(rankValue)) {
    rankValue = 1;
  }

  rankValue = Math.max(1, Math.round(rankValue));
  rankInput.value = rankValue;

  return records.filter(row => {
    const rank = getPartyRankForRow(row, partyVoteCol, candidatePairs);
    return rank === rankValue;
  });
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
  let useExcelTotal = false;

  if (mode === "all") {
    // Full Assembly: use the last row from Excel/JSON as the Total row.
    useExcelTotal = true;
  }

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

  const columns = getDisplayColumns(records);
  const totalCol = getTotalColumn(columns);
  const candidatePairs = getCandidatePairs(columns);


  if (partySelect.value) {
    if (partyFilterType.value === "rank") {
      records = applyPartyRankFilter(records, candidatePairs);
    } else {
      records = applyPartyPercentFilter(records, totalCol);
    }

    useExcelTotal = false;
  }
  renderTable(records, useExcelTotal);
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

function populatePartyDropdown() {
  const columns = getDisplayColumns(currentRecords);
  const candidatePairs = getCandidatePairs(columns);

  partySelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All Parties";
  partySelect.appendChild(allOption);

  candidatePairs.forEach(pair => {
    const option = document.createElement("option");
    option.value = pair.voteCol;
    option.textContent = pair.voteCol;
    partySelect.appendChild(option);
  });
}

function clampPercentInput(input) {
  let value = input.value;

  if (value === "") {
    return;
  }

  value = Number(value);

  if (!Number.isInteger(value)) {
    value = Math.round(value);
  }

  if (value < 0) {
    value = 0;
  }

  if (value > 100) {
    value = 100;
  }

  input.value = value;
}

function getPartyPercentForRow(row, partyVoteCol, totalCol) {
  const partyVotes = toNumber(row[partyVoteCol]);
  const totalVotes = toNumber(row[totalCol]);

  if (!totalVotes || totalVotes <= 0) {
    return null;
  }

  return (partyVotes / totalVotes) * 100;
}

function applyPartyPercentFilter(records, totalCol) {
  const partyVoteCol = partySelect.value;

  if (!partyVoteCol) {
    return records;
  }

  let minValue = minPercentInput.value === "" ? 0 : Number(minPercentInput.value);
  let maxValue = maxPercentInput.value === "" ? 100 : Number(maxPercentInput.value);

  if (!Number.isFinite(minValue)) {
    minValue = 0;
  }

  if (!Number.isFinite(maxValue)) {
    maxValue = 100;
  }

  minValue = Math.max(0, Math.min(100, Math.round(minValue)));
  maxValue = Math.max(0, Math.min(100, Math.round(maxValue)));

  if (minValue > maxValue) {
    const temp = minValue;
    minValue = maxValue;
    maxValue = temp;
  }

  minPercentInput.value = minValue;
  maxPercentInput.value = maxValue;

  return records.filter(row => {
    const percent = getPartyPercentForRow(row, partyVoteCol, totalCol);

    if (percent === null) {
      return false;
    }

    return percent >= minValue && percent <= maxValue;
  });
}

function getPartyFilterMessage() {
  const partyVoteCol = partySelect.value;

  if (!partyVoteCol) {
    return "";
  }

  if (partyFilterType.value === "rank") {
    const rankValue = rankInput.value === "" ? 1 : Number(rankInput.value);
    return ` Showing booths where ${partyVoteCol} ranked ${rankValue}.`;
  }

  const minValue = minPercentInput.value === "" ? 0 : Number(minPercentInput.value);
  const maxValue = maxPercentInput.value === "" ? 100 : Number(maxPercentInput.value);

  return ` Showing booths where ${partyVoteCol} got between ${minValue}% and ${maxValue}% votes.`;
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

  if (header.includes("ward")) {
    return "col-ward";
  }

  if (header.includes("municipality")) {
    return "col-municipality";
  }

  if (
    header.includes("panchayat") ||
    header.includes("gp")
  ) {
    return "col-panchayat";
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

  topScrollInner.style.width = boothTable.scrollWidth + "px";

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

function renderTable(records, useExcelTotal = false) {
  boothTable.innerHTML = "";

  if (!records.length) {
    resultCount.textContent = "No booths found.";
    return;
  }

  const viewMode = valueViewSelect.value;

  const columns = getDisplayColumns(records);
  const totalCol = getTotalColumn(columns);
  const candidatePairs = getCandidatePairs(columns);

  const displaySpec = buildDisplaySpec(columns, candidatePairs, totalCol, viewMode);

  let displayRecords = records;
  let totalRow;

  if (useExcelTotal) {
    totalRow = records[records.length - 1];
    displayRecords = records.slice(0, -1);
  } else {
    totalRow = buildTotalRow(records, displaySpec, candidatePairs, totalCol);
  }

  resultCount.textContent = `${displayRecords.length} booth(s) found.${getPartyFilterMessage()}`;

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

  displayRecords.forEach(record => {
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

    let value;

    if (useExcelTotal) {
      if (spec.type === "calculated_percent") {
        value = getCellValue(totalRow, spec, totalCol);
      } else {
        value = totalRow[spec.col];
      }
    } else {
      value = totalRow[spec.header];
    }

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

districtSelect.addEventListener("change", () => {
  populateAssembliesForDistrict(districtSelect.value);
});

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

partySelect.addEventListener("change", applyFilters);

minPercentInput.addEventListener("input", () => {
  clampPercentInput(minPercentInput);
  applyFilters();
});

maxPercentInput.addEventListener("input", () => {
  clampPercentInput(maxPercentInput);
  applyFilters();
});

partyFilterType.addEventListener("change", () => {
  updatePartyFilterVisibility();
  applyFilters();
});

rankInput.addEventListener("change", applyFilters);

window.addEventListener("resize", () => {
  setTimeout(setupHorizontalScrollbar, 0);
});

loadIndex();
updatePartyFilterVisibility();


