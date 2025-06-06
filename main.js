// 1: SET GLOBAL VARIABLES
const margin = { top: 80, right: 30, bottom: 60, left: 100 };
const width = 900 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

// Store the current data state
let currentTimeSeriesData = [];
let currentCountryStats = [];
let allCountries = new Set();
let displayMode = "both"; // Can be "total", "fatal", or "both"

// Store display mode for each country
let countryDisplayModes = {};

// Create SVG containers for both charts
const svg1 = d3
	.select("#lineChart1")
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)
	.append("g")
	.attr("transform", `translate(${margin.left},${margin.top})`);

const svg2 = d3
	.select("#lineChart2")
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)
	.append("g")
	.attr("transform", `translate(${margin.left},${margin.top})`);

// Color scale for countries
const countryColorScale = d3.scaleOrdinal(d3.schemeCategory10);

// Tooltip element for interactivity
const tooltip = d3
	.select("body")
	.append("div")
	.attr("class", "tooltip")
	.style("position", "absolute")
	.style("background", "rgba(0,0,0,0.9)")
	.style("color", "white")
	.style("padding", "10px")
	.style("border-radius", "6px")
	.style("font-size", "12px")
	.style("font-family", "Arial, sans-serif")
	.style("pointer-events", "none")
	.style("opacity", 0)
	.style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)")
	.style("z-index", "1000");

// Enhanced tooltip for line chart with multi-country support
const enhancedTooltip = d3
	.select("body")
	.append("div")
	.attr("class", "enhanced-tooltip")
	.style("position", "absolute")
	.style("background", "rgba(255,255,255,0.95)")
	.style("color", "#333")
	.style("padding", "12px")
	.style("border-radius", "8px")
	.style("font-size", "13px")
	.style("font-family", "Arial, sans-serif")
	.style("pointer-events", "none")
	.style("opacity", 0)
	.style("box-shadow", "0 3px 14px rgba(0,0,0,0.25)")
	.style("z-index", "1001")
	.style("max-width", "300px")
	.style("border", "1px solid #ddd");

// Create a transparent overlay for the line chart to capture mouse events
const chartOverlay = svg1
	.append("rect")
	.attr("class", "chart-overlay")
	.attr("width", width)
	.attr("height", height)
	.style("fill", "none")
	.style("pointer-events", "all");

// Vertical line for tooltip
const tooltipLine = svg1
	.append("line")
	.attr("class", "tooltip-line")
	.style("stroke", "#999")
	.style("stroke-width", "1px")
	.style("stroke-dasharray", "5,5")
	.style("opacity", 0);

// Function to update time series chart
function updateTimeSeriesChart(filteredData, selectedCountries) {
	// Group data by year and country
	const yearCountryData = d3.group(filteredData, (d) => d.year);
	const timeSeriesData = Array.from(yearCountryData, ([year, incidents]) => {
		const countryData = {};
		selectedCountries.forEach((country) => {
			const countryIncidents = incidents.filter((d) => d.Country === country);
			countryData[country] = {
				total: countryIncidents.length,
				fatal: countryIncidents.filter((d) => d.isFatal).length,
			};
		});
		return { year, ...countryData };
	}).sort((a, b) => a.year - b.year);

	// Remove all previous country lines and dots
	svg1.selectAll('path[class^="line-"]').remove();
	svg1.selectAll('path[class^="fatal-line-"]').remove();
	svg1.selectAll('circle[class^="dot-"]').remove();
	svg1.selectAll('circle[class^="fatal-dot-"]').remove();

	// X-axis domain logic for single year
	let xDomain;
	if (timeSeriesData.length === 1) {
		const singleYear = timeSeriesData[0].year;
		xDomain = [singleYear - 1, singleYear + 1];
	} else {
		xDomain = d3.extent(timeSeriesData, (d) => d.year);
	}

	// Update scales
	const xScale1 = d3.scaleLinear().domain(xDomain).range([0, width]);

	// Find max value for y-scale considering both total and fatal incidents
	const yMax = d3.max(timeSeriesData, (d) =>
		d3.max(selectedCountries, (country) =>
			Math.max(d[country]?.total || 0, d[country]?.fatal || 0)
		)
	);

	const yScale1 = d3.scaleLinear().domain([0, yMax]).nice().range([height, 0]);

	// Always show Y-axis tick numbers
	svg1
		.select(".x-axis")
		.transition()
		.duration(750)
		.call(d3.axisBottom(xScale1).tickFormat(d3.format("d")));
	svg1
		.select(".y-axis")
		.transition()
		.duration(750)
		.call(d3.axisLeft(yScale1).ticks(6))
		.selectAll("text")
		.style("fill", "#333")
		.style("font-size", "14px");

	// Draw lines and dots for selected countries
	selectedCountries.forEach((country) => {
		// Get country-specific display mode
		const countryMode = countryDisplayModes[country] || "both";

		// Total incidents line
		const totalLine = d3
			.line()
			.x((d) => xScale1(d.year))
			.y((d) => yScale1(d[country]?.total || 0))
			.curve(d3.curveMonotoneX);

		// Fatal incidents line
		const fatalLine = d3
			.line()
			.x((d) => xScale1(d.year))
			.y((d) => yScale1(d[country]?.fatal || 0))
			.curve(d3.curveMonotoneX);

		if (timeSeriesData.length > 1) {
			// Draw total incidents line if country display mode includes total
			if (countryMode === "total" || countryMode === "both") {
				const totalPath = svg1
					.append("path")
					.datum(timeSeriesData)
					.attr("class", `line-${country}`)
					.style("stroke", countryColorScale(country))
					.style("fill", "none")
					.style("stroke-width", 2)
					.attr("d", totalLine)
					.style("opacity", 0.9)
					.style("cursor", "pointer");

				// Add hover effect
				totalPath
					.on("mouseover", function (event) {
						// Highlight this line
						d3.select(this).style("stroke-width", 4).style("opacity", 1);

						// Fade other lines
						svg1.selectAll(`path:not(.line-${country})`).style("opacity", 0.2);

						// Show tooltip
						tooltip
							.style("opacity", 1)
							.html(`<strong>${country} - Total Incidents</strong>`)
							.style("left", event.pageX + 15 + "px")
							.style("top", event.pageY - 10 + "px");
					})
					.on("mouseout", function () {
						// Restore all lines
						svg1
							.selectAll("path")
							.style("stroke-width", 2)
							.style("opacity", 0.9);

						tooltip.style("opacity", 0);
					});
			}

			// Draw fatal incidents line if country display mode includes fatal
			if (countryMode === "fatal" || countryMode === "both") {
				const fatalPath = svg1
					.append("path")
					.datum(timeSeriesData)
					.attr("class", `fatal-line-${country}`)
					.style("stroke", countryColorScale(country))
					.style("fill", "none")
					.style("stroke-width", 2)
					.style("stroke-dasharray", "4,4") // Make it dashed
					.attr("d", fatalLine)
					.style("opacity", 0.9)
					.style("cursor", "pointer");

				// Add hover effect
				fatalPath
					.on("mouseover", function (event) {
						// Highlight this line
						d3.select(this).style("stroke-width", 4).style("opacity", 1);

						// Fade other lines
						svg1
							.selectAll(`path:not(.fatal-line-${country})`)
							.style("opacity", 0.2);

						// Show tooltip
						tooltip
							.style("opacity", 1)
							.html(`<strong>${country} - Fatal Incidents</strong>`)
							.style("left", event.pageX + 15 + "px")
							.style("top", event.pageY - 10 + "px");
					})
					.on("mouseout", function () {
						// Restore all lines
						svg1
							.selectAll("path")
							.style("stroke-width", 2)
							.style("opacity", 0.9);

						tooltip.style("opacity", 0);
					});
			}
		}

		// Draw total incidents dots if country display mode includes total
		if (countryMode === "total" || countryMode === "both") {
			svg1
				.selectAll(`.dot-${country}`)
				.data(timeSeriesData)
				.enter()
				.append("circle")
				.attr("class", `dot-${country}`)
				.attr("cx", (d) => xScale1(d.year))
				.attr("cy", (d) => yScale1(d[country]?.total || 0))
				.attr("r", timeSeriesData.length === 1 ? 10 : 4)
				.style("fill", countryColorScale(country))
				.style("opacity", 0.9)
				.on("mouseover", function (event, d) {
					d3.select(this)
						.attr("r", timeSeriesData.length === 1 ? 12 : 6)
						.style("opacity", 1);

					tooltip
						.style("opacity", 1)
						.html(
							`<strong>${country} (${d.year})</strong><br>Total: ${
								d[country]?.total || 0
							}`
						)
						.style("left", event.pageX + 15 + "px")
						.style("top", event.pageY - 10 + "px");
				})
				.on("mouseout", function () {
					d3.select(this)
						.attr("r", timeSeriesData.length === 1 ? 10 : 4)
						.style("opacity", 0.9);

					tooltip.style("opacity", 0);
				});
		}

		// Draw fatal incidents dots if country display mode includes fatal
		if (countryMode === "fatal" || countryMode === "both") {
			svg1
				.selectAll(`.fatal-dot-${country}`)
				.data(timeSeriesData)
				.enter()
				.append("circle")
				.attr("class", `fatal-dot-${country}`)
				.attr("cx", (d) => xScale1(d.year))
				.attr("cy", (d) => yScale1(d[country]?.fatal || 0))
				.attr("r", timeSeriesData.length === 1 ? 8 : 3)
				.style("fill", "white")
				.style("stroke", countryColorScale(country))
				.style("stroke-width", 2)
				.style("opacity", 0.9)
				.on("mouseover", function (event, d) {
					d3.select(this)
						.attr("r", timeSeriesData.length === 1 ? 10 : 5)
						.style("opacity", 1);

					tooltip
						.style("opacity", 1)
						.html(
							`<strong>${country} (${d.year})</strong><br>Fatal: ${
								d[country]?.fatal || 0
							}`
						)
						.style("left", event.pageX + 15 + "px")
						.style("top", event.pageY - 10 + "px");
				})
				.on("mouseout", function () {
					d3.select(this)
						.attr("r", timeSeriesData.length === 1 ? 8 : 3)
						.style("opacity", 0.9);

					tooltip.style("opacity", 0);
				});
		}
	});

	// Set up the chart overlay for enhanced tooltip functionality
	setupChartOverlay(timeSeriesData, selectedCountries, xScale1, yScale1);

	updateCountryLegend(selectedCountries);
}

// Function to set up the chart overlay for enhanced tooltip
function setupChartOverlay(timeSeriesData, selectedCountries, xScale, yScale) {
	// Remove any existing event listeners to prevent duplicates
	chartOverlay.on("mouseover", null).on("mousemove", null).on("mouseout", null);

	// Add event listeners for the overlay
	chartOverlay
		.on("mouseover", function () {
			tooltipLine.style("opacity", 1);
			enhancedTooltip.style("opacity", 1);
		})
		.on("mouseout", function () {
			tooltipLine.style("opacity", 0);
			enhancedTooltip.style("opacity", 0);
		})
		.on("mousemove", function (event) {
			// Get mouse position relative to the chart
			const [mouseX, mouseY] = d3.pointer(event);

			// Find the closest year to the mouse position
			const xInverse = xScale.invert(mouseX);
			const bisect = d3.bisector((d) => d.year).left;
			const index = bisect(timeSeriesData, xInverse);
			const d0 = timeSeriesData[Math.max(0, index - 1)];
			const d1 = timeSeriesData[Math.min(timeSeriesData.length - 1, index)];
			const d = xInverse - d0.year > d1.year - xInverse ? d1 : d0;

			// Position the vertical tooltip line
			tooltipLine
				.attr("x1", xScale(d.year))
				.attr("x2", xScale(d.year))
				.attr("y1", 0)
				.attr("y2", height);

			// Build tooltip content
			let tooltipContent = `<div style="text-align:center; font-weight:bold; border-bottom:1px solid #ddd; padding-bottom:5px; margin-bottom:8px;">
									Year: ${d.year}
								  </div>`;

			// Add data for each selected country
			selectedCountries.forEach((country) => {
				const countryMode = countryDisplayModes[country] || "both";
				const showTotal = countryMode === "total" || countryMode === "both";
				const showFatal = countryMode === "fatal" || countryMode === "both";

				tooltipContent += `<div style="margin-bottom:6px;">
									<span style="font-weight:bold; color:${countryColorScale(country)}">
									  ${country}:
									</span>`;

				if (showTotal) {
					tooltipContent += `<span style="margin-left:5px;">
										Total: <b>${d[country]?.total || 0}</b>
									  </span>`;
				}

				if (showFatal) {
					tooltipContent += `<span style="margin-left:5px;">
										Fatal: <b>${d[country]?.fatal || 0}</b>
										${
											showTotal
												? `(${(
														((d[country]?.fatal || 0) /
															(d[country]?.total || 1)) *
														100
												  ).toFixed(1)}%)`
												: ""
										}
									  </span>`;
				}

				tooltipContent += `</div>`;
			});

			// Add summary statistics
			let totalIncidents = 0;
			let totalFatal = 0;

			selectedCountries.forEach((country) => {
				totalIncidents += d[country]?.total || 0;
				totalFatal += d[country]?.fatal || 0;
			});

			tooltipContent += `<div style="margin-top:8px; padding-top:5px; border-top:1px solid #ddd;">
								<b>Summary (${d.year}):</b><br>
								Total Incidents: ${totalIncidents}<br>
								Fatal Incidents: ${totalFatal} (${
				totalIncidents > 0
					? ((totalFatal / totalIncidents) * 100).toFixed(1)
					: 0
			}%)
							  </div>`;

			// Position and show the tooltip
			enhancedTooltip
				.html(tooltipContent)
				.style("left", event.pageX + 15 + "px")
				.style("top", event.pageY - 100 + "px");
		});
}

// Add a helper function to get country abbreviations
function getCountryAbbreviation(country) {
	const abbreviations = {
		"United States": "USA",
		Canada: "CAN",
		"United Kingdom": "GBR",
		Australia: "AUS",
		France: "FRA",
		Germany: "DEU",
		Italy: "ITA",
		Spain: "ESP",
		Japan: "JPN",
		China: "CHN",
		Russia: "RUS",
		Brazil: "BRA",
		Mexico: "MEX",
		India: "IND",
		"South Africa": "ZAF",
		"New Zealand": "NZL",
		Argentina: "ARG",
		Switzerland: "CHE",
		Sweden: "SWE",
		Norway: "NOR",
		Netherlands: "NLD",
		Indonesia: "IDN",
		Philippines: "PHL",
		Thailand: "THA",
		"South Korea": "KOR",
		Colombia: "COL",
		Chile: "CHL",
		Peru: "PER",
		Belgium: "BEL",
		Portugal: "PRT",
		Ireland: "IRL",
		Greece: "GRC",
		Denmark: "DNK",
		Finland: "FIN",
		Austria: "AUT",
		Malaysia: "MYS",
		Singapore: "SGP",
		Israel: "ISR",
		Turkey: "TUR",
		Egypt: "EGY",
		Kenya: "KEN",
		Nigeria: "NGA",
		Venezuela: "VEN",
		Ukraine: "UKR",
		Poland: "POL",
	};

	return abbreviations[country] || country.substring(0, 3).toUpperCase();
}

// Function to update country chart
function updateCountryChart(filteredData) {
	const selectedCountries = Array.from(
		document.querySelectorAll("#countryFilters input:checked")
	).map((checkbox) => checkbox.value);

	// Aggregate data by country
	const countryStats = selectedCountries
		.map((country) => {
			const countryData = filteredData.filter((d) => d.Country === country);
			return {
				country: country,
				abbr: getCountryAbbreviation(country),
				total: countryData.length,
				fatal: countryData.filter((d) => d.isFatal).length,
				fatalityRate:
					(countryData.filter((d) => d.isFatal).length /
						Math.max(countryData.length, 1)) *
					100,
			};
		})
		.sort((a, b) => b.total - a.total);

	// Update scales
	const xScale2 = d3
		.scaleBand()
		.domain(countryStats.map((d) => d.country))
		.range([0, width])
		.padding(0.3);

	const yScale2 = d3
		.scaleLinear()
		.domain([0, d3.max(countryStats, (d) => d.total)])
		.nice()
		.range([height, 0]);

	svg2
		.select(".x-axis")
		.transition()
		.duration(750)
		.call(d3.axisBottom(xScale2))
		// Hide original country names in the axis
		.selectAll("text")
		.style("opacity", 0);

	svg2
		.select(".y-axis")
		.transition()
		.duration(750)
		.call(d3.axisLeft(yScale2).ticks(6))
		.selectAll("text")
		.style("fill", "#333")
		.style("font-size", "14px");

	// Update bars
	const bars = svg2.selectAll(".bar").data(countryStats);

	bars.exit().remove();

	bars
		.enter()
		.append("rect")
		.attr("class", "bar")
		.merge(bars)
		.transition()
		.duration(750)
		.attr("x", (d) => xScale2(d.country))
		.attr("width", xScale2.bandwidth())
		.attr("y", (d) => yScale2(d.total))
		.attr("height", (d) => height - yScale2(d.total))
		.attr("fill", (d) => countryColorScale(d.country));

	// Update bar labels (incident count)
	const labels = svg2.selectAll(".bar-label").data(countryStats);

	labels.exit().remove();

	labels
		.enter()
		.append("text")
		.attr("class", "bar-label")
		.merge(labels)
		.transition()
		.duration(750)
		.attr("x", (d) => xScale2(d.country) + xScale2.bandwidth() / 2)
		.attr("y", (d) => yScale2(d.total) - 5)
		.attr("text-anchor", "middle")
		.text((d) => d.total);

	// Add country abbreviation labels below the bars
	const abbrLabels = svg2.selectAll(".country-abbr-label").data(countryStats);

	abbrLabels.exit().remove();

	abbrLabels
		.enter()
		.append("text")
		.attr("class", "country-abbr-label")
		.merge(abbrLabels)
		.attr("x", (d) => xScale2(d.country) + xScale2.bandwidth() / 2)
		.attr("y", height + 20) // Below the x-axis
		.attr("text-anchor", "middle")
		.style("font-size", "12px")
		.style("font-weight", "bold")
		.style("fill", "#333")
		.text((d) => d.abbr);
}

// Function to filter data based on widget selections
function filterData() {
	const startYear = parseInt(d3.select("#startYear").property("value"));
	const endYear = parseInt(d3.select("#endYear").property("value"));
	// Compute top 10 countries by incident count in filtered data
	const filteredData = currentTimeSeriesData.filter(
		(d) => d.year >= startYear && d.year <= endYear
	);
	const countryCounts = {};
	filteredData.forEach((d) => {
		countryCounts[d.Country] = (countryCounts[d.Country] || 0) + 1;
	});
	const topCountries = Object.entries(countryCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([country]) => country);
	// Get checked countries (from previous widget state)
	let checkedCountries = Array.from(
		document.querySelectorAll("#countryFilters input:checked")
	).map((cb) => cb.value);
	// Only default to all checked if none of the checked countries are in the new top 10 (year range change)
	if (
		checkedCountries.length === 0 &&
		document.activeElement.id !== "countryFilters"
	) {
		// If user just unchecked all, allow empty selection
		// If year range changed and none are checked, default to all
		checkedCountries = [];
	} else if (checkedCountries.some((c) => !topCountries.includes(c))) {
		checkedCountries = topCountries;
	}
	// Update widget to only show top 10
	populateCountryFilters(topCountries, checkedCountries);
	// Add event listeners to new checkboxes
	d3.selectAll('#countryFilters input[type="checkbox"]').on(
		"change",
		filterData
	);
	// Update legend and chart
	updateCountryLegend(checkedCountries);
	updateTimeSeriesChart(filteredData, checkedCountries);
	updateCountryChart(filteredData);
}

// Function to populate country checkboxes
function populateCountryFilters(topCountries, checkedCountries) {
	const countryFilter = d3.select("#countryFilters");
	countryFilter.html(""); // Clear previous
	topCountries.forEach((country) => {
		const label = countryFilter.append("label");
		label
			.append("input")
			.attr("type", "checkbox")
			.attr("value", country)
			.property("checked", checkedCountries.includes(country));
		label
			.append("span")
			.style("color", countryColorScale(country))
			.text(` ${country}`);
	});
}

// Add select/clear all functionality
function setupCountryFilterButtons() {
	d3.select("#selectAllCountries").on("click", function () {
		d3.selectAll('#countryFilters input[type="checkbox"]').property(
			"checked",
			true
		);
		filterData();
	});
	d3.select("#clearAllCountries").on("click", function () {
		d3.selectAll('#countryFilters input[type="checkbox"]').property(
			"checked",
			false
		);
		filterData();
	});
}

// Update the legend to show both total and fatal incidents with clickable elements
function updateCountryLegend(selectedCountries) {
	const legendContainer = d3.select("#countryLegendContainer");
	if (selectedCountries.length === 0) {
		legendContainer.style("display", "none").html("");
		return;
	}

	// Initialize display modes for newly selected countries
	selectedCountries.forEach((country) => {
		if (!countryDisplayModes[country]) {
			countryDisplayModes[country] = "both"; // Default to showing both
		}
	});

	legendContainer.style("display", "block");

	// Clear previous legend
	legendContainer.html("");

	// Add legend title
	legendContainer
		.append("strong")
		.text("Country Legend: ")
		.style("margin-right", "10px");

	// Create legend items for each country
	selectedCountries.forEach((country) => {
		const countryLegend = legendContainer
			.append("span")
			.style("margin-right", "20px")
			.style("display", "inline-flex")
			.style("align-items", "center");

		// Country name
		countryLegend
			.append("span")
			.style("color", countryColorScale(country))
			.style("font-weight", "bold")
			.style("margin-right", "8px")
			.text(country);

		// Total incidents toggle
		const totalToggle = countryLegend
			.append("span")
			.attr("class", "legend-toggle total-toggle")
			.style("margin-right", "5px")
			.style("padding", "2px 6px")
			.style("border", `1px solid ${countryColorScale(country)}`)
			.style("border-radius", "3px")
			.style("cursor", "pointer")
			.style(
				"background-color",
				countryDisplayModes[country] === "total" ||
					countryDisplayModes[country] === "both"
					? countryColorScale(country)
					: "transparent"
			)
			.style(
				"color",
				countryDisplayModes[country] === "total" ||
					countryDisplayModes[country] === "both"
					? "white"
					: countryColorScale(country)
			)
			.text("Total")
			.on("click", function () {
				// Toggle display mode for this country
				if (countryDisplayModes[country] === "both") {
					countryDisplayModes[country] = "fatal";
				} else if (countryDisplayModes[country] === "fatal") {
					countryDisplayModes[country] = "both";
				} else if (countryDisplayModes[country] === "total") {
					countryDisplayModes[country] = "both";
				}

				// Update the legend appearance
				updateCountryLegend(selectedCountries);

				// Update the chart with individual country display modes
				refreshChart();
			});

		// Fatal incidents toggle
		const fatalToggle = countryLegend
			.append("span")
			.attr("class", "legend-toggle fatal-toggle")
			.style("padding", "2px 6px")
			.style("border", `1px solid ${countryColorScale(country)}`)
			.style("border-radius", "3px")
			.style("cursor", "pointer")
			.style(
				"background-color",
				countryDisplayModes[country] === "fatal" ||
					countryDisplayModes[country] === "both"
					? countryColorScale(country)
					: "transparent"
			)
			.style(
				"color",
				countryDisplayModes[country] === "fatal" ||
					countryDisplayModes[country] === "both"
					? "white"
					: countryColorScale(country)
			)
			.style("border-style", "dashed")
			.text("Fatal")
			.on("click", function () {
				// Toggle display mode for this country
				if (countryDisplayModes[country] === "both") {
					countryDisplayModes[country] = "total";
				} else if (countryDisplayModes[country] === "total") {
					countryDisplayModes[country] = "both";
				} else if (countryDisplayModes[country] === "fatal") {
					countryDisplayModes[country] = "both";
				}

				// Update the legend appearance
				updateCountryLegend(selectedCountries);

				// Update the chart with individual country display modes
				refreshChart();
			});
	});
}

// Function to refresh the chart with current settings
function refreshChart() {
	const selectedCountries = Array.from(
		document.querySelectorAll("#countryFilters input:checked")
	).map((checkbox) => checkbox.value);

	// Get currently filtered data
	const startYear = parseInt(d3.select("#startYear").property("value"));
	const endYear = parseInt(d3.select("#endYear").property("value"));
	const filteredData = currentTimeSeriesData.filter(
		(d) =>
			d.year >= startYear &&
			d.year <= endYear &&
			selectedCountries.includes(d.Country)
	);

	// Update chart with current country display modes
	updateTimeSeriesChart(filteredData, selectedCountries);
}

// Add a function to toggle display mode
function toggleDisplayMode(mode) {
	displayMode = mode;
	const selectedCountries = Array.from(
		document.querySelectorAll("#countryFilters input:checked")
	).map((checkbox) => checkbox.value);

	// Get currently filtered data
	const startYear = parseInt(d3.select("#startYear").property("value"));
	const endYear = parseInt(d3.select("#endYear").property("value"));
	const filteredData = currentTimeSeriesData.filter(
		(d) =>
			d.year >= startYear &&
			d.year <= endYear &&
			selectedCountries.includes(d.Country)
	);

	// Update the chart with current selection but new display mode
	updateTimeSeriesChart(filteredData, selectedCountries);

	// Update toggle buttons
	d3.select("#toggleTotal").classed(
		"active",
		mode === "total" || mode === "both"
	);
	d3.select("#toggleFatal").classed(
		"active",
		mode === "fatal" || mode === "both"
	);
}

// Function to create toggle buttons
function createToggleButtons() {
	const toggleContainer = d3
		.select("#lineChart1")
		.append("div")
		.attr("class", "toggle-container")
		.style("position", "absolute")
		.style("top", "10px")
		.style("right", "10px")
		.style("z-index", "10");

	toggleContainer
		.append("button")
		.attr("id", "toggleTotal")
		.attr("class", "toggle-btn active")
		.style("margin-right", "5px")
		.style("padding", "5px 10px")
		.style(
			"background",
			displayMode === "total" || displayMode === "both" ? "#3498db" : "#eee"
		)
		.style(
			"color",
			displayMode === "total" || displayMode === "both" ? "white" : "#333"
		)
		.style("border", "none")
		.style("border-radius", "3px")
		.style("cursor", "pointer")
		.text("Total Incidents")
		.on("click", function () {
			if (displayMode === "total") {
				toggleDisplayMode("both");
			} else {
				toggleDisplayMode("total");
			}
		});

	toggleContainer
		.append("button")
		.attr("id", "toggleFatal")
		.attr("class", "toggle-btn active")
		.style("padding", "5px 10px")
		.style(
			"background",
			displayMode === "fatal" || displayMode === "both" ? "#e74c3c" : "#eee"
		)
		.style(
			"color",
			displayMode === "fatal" || displayMode === "both" ? "white" : "#333"
		)
		.style("border", "none")
		.style("border-radius", "3px")
		.style("cursor", "pointer")
		.text("Fatal Incidents")
		.on("click", function () {
			if (displayMode === "fatal") {
				toggleDisplayMode("both");
			} else {
				toggleDisplayMode("fatal");
			}
		});
}

// 2.a: LOAD...
d3.csv("aircraft_incidents.csv")
	.then((rawData) => {
		// Remove any existing placeholder titles
		d3.select("#lineChart1").selectAll("h2, h3, .chart-title").remove();
		d3.select("#lineChart2").selectAll("h2, h3, .chart-title").remove();

		// 2.b: ... AND TRANSFORM DATA

		// Parse and clean the data
		const cleanedData = rawData.map((d) => {
			// Parse date (format: M/D/YY or MM/DD/YY)
			let date = null;
			let year = null;

			if (d.Event_Date) {
				const parts = d.Event_Date.split("/");
				if (parts.length === 3) {
					let yearPart = parseInt(parts[2]);
					// Handle 2-digit years (assume 00-30 = 2000s, 31-99 = 1900s)
					if (yearPart <= 30) yearPart += 2000;
					else if (yearPart < 100) yearPart += 1900;

					date = new Date(yearPart, parseInt(parts[0]) - 1, parseInt(parts[1]));
					year = yearPart;
				}
			}

			// Parse fatality information from Injury_Severity field
			let fatalCount = 0;
			let isFatal = false;

			if (d.Injury_Severity && d.Injury_Severity.includes("Fatal(")) {
				const match = d.Injury_Severity.match(/Fatal\((\d+)\)/);
				if (match) {
					fatalCount = parseInt(match[1]);
					isFatal = true;
				}
			}

			return {
				...d,
				parsedDate: date,
				year: year,
				isFatal: isFatal,
				fatalCount: fatalCount,
				totalFatalInjuries: +d.Total_Fatal_Injuries || 0,
				totalSeriousInjuries: +d.Total_Serious_Injuries || 0,
				totalUninjured: +d.Total_Uninjured || 0,
				Country: d.Country || "Unknown",
			};
		});

		// Filter valid data and create aggregations
		const validData = cleanedData.filter(
			(d) =>
				d.year &&
				d.year >= 1995 &&
				d.year <= 2016 &&
				d.Country &&
				d.Country !== "Unknown"
		);

		// Get unique countries and store in global Set
		validData.forEach((d) => allCountries.add(d.Country));

		// Store the processed data in our global variables
		currentTimeSeriesData = validData;

		// Populate country filters
		populateCountryFilters(
			validData,
			validData.map((d) => d.Country)
		);
		setupCountryFilterButtons();

		// ==========================================
		// CHART 1: Time Series Line Chart
		// ==========================================

		// Add proper title for Chart 1 - positioned above the chart area
		const chart1Title = svg1
			.append("text")
			.attr("x", width / 2)
			.attr("y", -50) // Moved higher to avoid overlap
			.attr("text-anchor", "middle")
			.style("font-size", "20px")
			.style("font-weight", "bold")
			.style("fill", "#2c3e50")
			.style("cursor", "pointer")
			.style("font-family", "Arial, sans-serif")
			.text("Aircraft Incidents by Country Over Time (1995-2016)")
			.on("mouseover", function () {
				d3.select(this).style("fill", "#3498db").style("font-size", "21px");
			})
			.on("mouseout", function () {
				d3.select(this).style("fill", "#2c3e50").style("font-size", "20px");
			})
			.on("click", function () {
				const totalIncidents = d3.sum(currentTimeSeriesData, (d) => d.total);
				const totalFatal = d3.sum(currentTimeSeriesData, (d) => d.fatal);
				alert(
					`Overall Summary (1995-2016):\nTotal Incidents: ${totalIncidents}\nFatal Incidents: ${totalFatal}\nFatality Rate: ${(
						(totalFatal / totalIncidents) *
						100
					).toFixed(1)}%`
				);
			});

		// 3.a: SET SCALES FOR CHART 1
		const xScale1 = d3
			.scaleLinear()
			.domain(d3.extent(currentTimeSeriesData, (d) => d.year))
			.range([0, width]);

		const yScale1 = d3
			.scaleLinear()
			.domain([0, d3.max(currentTimeSeriesData, (d) => d.total)])
			.nice()
			.range([height, 0]);

		// 4.a: PLOT DATA FOR CHART 1

		// Add grid lines
		svg1
			.append("g")
			.attr("class", "grid")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(xScale1).tickSize(-height).tickFormat(""))
			.selectAll("line")
			.style("stroke", "#e0e0e0")
			.style("stroke-dasharray", "2,2");

		svg1
			.append("g")
			.attr("class", "grid")
			.call(d3.axisLeft(yScale1).tickSize(-width).tickFormat(""))
			.selectAll("line")
			.style("stroke", "#e0e0e0")
			.style("stroke-dasharray", "2,2");

		// Line generators
		const totalLine = d3
			.line()
			.x((d) => xScale1(d.year))
			.y((d) => yScale1(d.total))
			.curve(d3.curveMonotoneX);

		const fatalLine = d3
			.line()
			.x((d) => xScale1(d.year))
			.y((d) => yScale1(d.fatal))
			.curve(d3.curveMonotoneX);

		// Draw lines with hover effects
		const totalPath = svg1
			.append("path")
			.datum(currentTimeSeriesData)
			.attr("fill", "none")
			.attr("stroke", "#3498db")
			.attr("stroke-width", 3)
			.attr("d", totalLine)
			.style("cursor", "pointer");

		const fatalPath = svg1
			.append("path")
			.datum(currentTimeSeriesData)
			.attr("fill", "none")
			.attr("stroke", "#e74c3c")
			.attr("stroke-width", 3)
			.attr("d", fatalLine)
			.style("cursor", "pointer");

		// Interactive line hover effects
		totalPath
			.on("mouseover", function (event) {
				d3.select(this).attr("stroke-width", 5);
				tooltip
					.style("opacity", 1)
					.html(
						`<strong>Total Incidents Trend</strong><br/>
                       Click points for details<br/>
                       Hover over data points for specific years`
					)
					.style("left", event.pageX + 15 + "px")
					.style("top", event.pageY - 10 + "px");
			})
			.on("mouseout", function () {
				d3.select(this).attr("stroke-width", 3);
				tooltip.style("opacity", 0);
			});

		fatalPath
			.on("mouseover", function (event) {
				d3.select(this).attr("stroke-width", 5);
				tooltip
					.style("opacity", 1)
					.html(
						`<strong>Fatal Incidents Trend</strong><br/>
                       Click points for details<br/>
                       Hover over data points for specific years`
					)
					.style("left", event.pageX + 15 + "px")
					.style("top", event.pageY - 10 + "px");
			})
			.on("mouseout", function () {
				d3.select(this).attr("stroke-width", 3);
				tooltip.style("opacity", 0);
			});

		// Add interactive dots
		svg1
			.selectAll(".dot-total")
			.data(currentTimeSeriesData)
			.enter()
			.append("circle")
			.attr("class", "dot-total")
			.attr("cx", (d) => xScale1(d.year))
			.attr("cy", (d) => yScale1(d.total))
			.attr("r", 5)
			.attr("fill", "#3498db")
			.attr("stroke", "white")
			.attr("stroke-width", 2)
			.style("cursor", "pointer")
			.on("mouseover", function (event, d) {
				d3.select(this).attr("r", 8).attr("stroke-width", 3);
				tooltip
					.style("opacity", 1)
					.html(
						`<strong>${d.year}</strong><br/>
                       Total Incidents: <span style="color: #3498db">${
													d.total
												}</span><br/>
                       Fatal Incidents: <span style="color: #e74c3c">${
													d.fatal
												}</span><br/>
                       Non-Fatal Incidents: ${d.total - d.fatal}<br/>
                       Total Fatalities: ${d.fatalCount}<br/>
                       <em>Click for more details</em>`
					)
					.style("left", event.pageX + 15 + "px")
					.style("top", event.pageY - 10 + "px");
			})
			.on("mouseout", function () {
				d3.select(this).attr("r", 5).attr("stroke-width", 2);
				tooltip.style("opacity", 0);
			})
			.on("click", function (event, d) {
				const fatalityRate = ((d.fatal / d.total) * 100).toFixed(1);
				alert(
					`Detailed Report for ${d.year}:\n\n` +
						`Total Incidents: ${d.total}\n` +
						`Fatal Incidents: ${d.fatal}\n` +
						`Non-Fatal Incidents: ${d.total - d.fatal}\n` +
						`Total Fatalities: ${d.fatalCount}\n` +
						`Fatality Rate: ${fatalityRate}%`
				);
			});

		svg1
			.selectAll(".dot-fatal")
			.data(currentTimeSeriesData)
			.enter()
			.append("circle")
			.attr("class", "dot-fatal")
			.attr("cx", (d) => xScale1(d.year))
			.attr("cy", (d) => yScale1(d.fatal))
			.attr("r", 4)
			.attr("fill", "#e74c3c")
			.attr("stroke", "white")
			.attr("stroke-width", 2)
			.style("cursor", "pointer")
			.on("mouseover", function (event, d) {
				d3.select(this).attr("r", 7).attr("stroke-width", 3);
				tooltip
					.style("opacity", 1)
					.html(
						`<strong>${d.year} Fatal Incidents</strong><br/>
                       Fatal Incidents: <span style="color: #e74c3c">${
													d.fatal
												}</span><br/>
                       Total Fatalities: ${d.fatalCount}<br/>
                       Fatality Rate: ${((d.fatal / d.total) * 100).toFixed(
													1
												)}%<br/>
                       <em>Click for details</em>`
					)
					.style("left", event.pageX + 15 + "px")
					.style("top", event.pageY - 10 + "px");
			})
			.on("mouseout", function () {
				d3.select(this).attr("r", 4).attr("stroke-width", 2);
				tooltip.style("opacity", 0);
			})
			.on("click", function (event, d) {
				alert(
					`Fatal Incidents in ${d.year}:\n\n` +
						`Fatal Incidents: ${d.fatal}\n` +
						`Total Fatalities: ${d.fatalCount}\n` +
						`Average Fatalities per Fatal Incident: ${(
							d.fatalCount / Math.max(d.fatal, 1)
						).toFixed(1)}`
				);
			});

		// 5.a: ADD AXES FOR CHART 1
		svg1
			.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(xScale1).tickFormat(d3.format("d")))
			.style("font-size", "12px");

		svg1.append("g").call(d3.axisLeft(yScale1)).style("font-size", "12px");

		// 6.a: ADD LABELS FOR CHART 1
		svg1
			.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 0 - margin.left)
			.attr("x", 0 - height / 2)
			.attr("dy", "1em")
			.style("text-anchor", "middle")
			.style("font-size", "16px")
			.style("font-weight", "500")
			.text("Number of Incidents");

		svg1
			.append("text")
			.attr(
				"transform",
				`translate(${width / 2}, ${height + margin.bottom - 10})`
			)
			.style("text-anchor", "middle")
			.style("font-size", "14px")
			.style("font-weight", "500")
			.text("Year");

		// Add interactive legend for Chart 1
		const legend1 = svg1
			.append("g")
			.attr("transform", `translate(${width - 150}, 20)`);

		const totalLegend = legend1
			.append("g")
			.style("cursor", "pointer")
			.on("mouseover", function () {
				totalPath.attr("stroke-width", 5);
				svg1.selectAll(".dot-total").attr("r", 7);
			})
			.on("mouseout", function () {
				totalPath.attr("stroke-width", 3);
				svg1.selectAll(".dot-total").attr("r", 5);
			})
			.on("click", function () {
				const total = d3.sum(currentTimeSeriesData, (d) => d.total);
				alert(`Total Incidents (1995-2016): ${total}`);
			});

		totalLegend
			.append("line")
			.attr("x1", 0)
			.attr("x2", 20)
			.attr("y1", 0)
			.attr("y2", 0)
			.attr("stroke", "#3498db")
			.attr("stroke-width", 3);

		totalLegend
			.append("text")
			.attr("x", 25)
			.attr("y", 0)
			.attr("dy", "0.32em")
			.style("font-size", "12px")
			.text("Total Incidents");

		const fatalLegend = legend1
			.append("g")
			.style("cursor", "pointer")
			.on("mouseover", function () {
				fatalPath.attr("stroke-width", 5);
				svg1.selectAll(".dot-fatal").attr("r", 6);
			})
			.on("mouseout", function () {
				fatalPath.attr("stroke-width", 3);
				svg1.selectAll(".dot-fatal").attr("r", 4);
			})
			.on("click", function () {
				const total = d3.sum(currentTimeSeriesData, (d) => d.fatal);
				alert(`Total Fatal Incidents (1995-2016): ${total}`);
			});

		fatalLegend
			.append("line")
			.attr("x1", 0)
			.attr("x2", 20)
			.attr("y1", 20)
			.attr("y2", 20)
			.attr("stroke", "#e74c3c")
			.attr("stroke-width", 3);

		fatalLegend
			.append("text")
			.attr("x", 25)
			.attr("y", 20)
			.attr("dy", "0.32em")
			.style("font-size", "12px")
			.text("Fatal Incidents");

		// ==========================================
		// CHART 2: Weather Conditions Bar Chart
		// ==========================================

		// Add proper title for Chart 2 - positioned above the chart area
		const chart2Title = svg2
			.append("text")
			.attr("x", width / 2)
			.attr("y", -50) // Moved higher to avoid overlap
			.attr("text-anchor", "middle")
			.style("font-size", "20px")
			.style("font-weight", "bold")
			.style("fill", "#2c3e50")
			.style("cursor", "pointer")
			.style("font-family", "Arial, sans-serif")
			.text("Total Incidents by Country")
			.on("mouseover", function () {
				d3.select(this).style("fill", "#3498db").style("font-size", "21px");
			})
			.on("mouseout", function () {
				d3.select(this).style("fill", "#2c3e50").style("font-size", "20px");
			})
			.on("click", function () {
				const totalWeatherIncidents = d3.sum(
					currentCountryStats,
					(d) => d.total
				);
				alert(
					`Total Incidents by Country:\nTotal Incidents: ${totalWeatherIncidents}`
				);
			});

		// 3.b: SET SCALES FOR CHART 2
		const xScale2 = d3
			.scaleBand()
			.domain(currentCountryStats.map((d) => d.country))
			.range([0, width])
			.padding(0.3);

		const yScale2 = d3
			.scaleLinear()
			.domain([0, d3.max(currentCountryStats, (d) => d.total)])
			.nice()
			.range([height, 0]);

		// 4.b: PLOT DATA FOR CHART 2

		// Add grid lines
		svg2
			.append("g")
			.attr("class", "grid")
			.call(d3.axisLeft(yScale2).tickSize(-width).tickFormat(""))
			.selectAll("line")
			.style("stroke", "#e0e0e0")
			.style("stroke-dasharray", "2,2");

		// Draw interactive bars
		svg2
			.selectAll(".bar")
			.data(currentCountryStats)
			.enter()
			.append("rect")
			.attr("class", "bar")
			.attr("x", (d) => xScale2(d.country))
			.attr("width", xScale2.bandwidth())
			.attr("y", (d) => yScale2(d.total))
			.attr("height", (d) => height - yScale2(d.total))
			.attr("fill", (d) => countryColorScale(d.country))
			.style("cursor", "pointer")
			.style("transition", "all 0.3s ease")
			.on("mouseover", function (event, d) {
				d3.select(this)
					.style("opacity", 0.8)
					.attr("stroke", "#2c3e50")
					.attr("stroke-width", 3)
					.style("filter", "brightness(1.1)");

				tooltip
					.style("opacity", 1)
					.html(
						`<strong>${d.country}</strong><br/>
                       Total Incidents: ${d.total}<br/>
                       Fatal Incidents: <span style="color: #e74c3c">${
													d.fatal
												}</span><br/>
                       Non-Fatal Incidents: ${d.total - d.fatal}<br/>
                       Fatality Rate: <span style="color: #e74c3c">${(
													(d.fatal / d.total) *
													100
												).toFixed(1)}%</span><br/>
                       <em>Click for detailed analysis</em>`
					)
					.style("left", event.pageX + 15 + "px")
					.style("top", event.pageY - 10 + "px");
			})
			.on("mouseout", function () {
				d3.select(this)
					.style("opacity", 1)
					.attr("stroke", "none")
					.style("filter", "none");
				tooltip.style("opacity", 0);
			})
			.on("click", function (event, d) {
				const safetyRating =
					d.fatal < 5
						? "Relatively Safe"
						: d.fatal < 10
						? "Moderate Risk"
						: "High Risk";
				alert(
					`Detailed Country Analysis: ${d.country}\n\n` +
						`Total Incidents: ${d.total}\n` +
						`Fatal Incidents: ${d.fatal}\n` +
						`Non-Fatal Incidents: ${d.total - d.fatal}\n` +
						`Fatality Rate: ${d.fatalityRate.toFixed(1)}%\n` +
						`Risk Assessment: ${safetyRating}\n\n` +
						`This country accounts for ${(
							(d.total / d3.sum(currentCountryStats, (w) => w.total)) *
							100
						).toFixed(1)}% of all incidents.`
				);
			});

		// Add interactive value labels on top of bars
		svg2
			.selectAll(".bar-label")
			.data(currentCountryStats)
			.enter()
			.append("text")
			.attr("class", "bar-label")
			.attr("x", (d) => xScale2(d.country) + xScale2.bandwidth() / 2)
			.attr("y", (d) => yScale2(d.total) - 5)
			.attr("text-anchor", "middle")
			.style("font-size", "12px")
			.style("font-weight", "bold")
			.style("fill", "#2c3e50")
			.style("cursor", "pointer")
			.text((d) => d.total)
			.on("mouseover", function (event, d) {
				d3.select(this).style("font-size", "14px");
				tooltip
					.style("opacity", 1)
					.html(`<strong>${d.total} incidents</strong><br/>in ${d.country}`)
					.style("left", event.pageX + 15 + "px")
					.style("top", event.pageY - 10 + "px");
			})
			.on("mouseout", function () {
				d3.select(this).style("font-size", "12px");
				tooltip.style("opacity", 0);
			});

		// 5.b: ADD AXES FOR CHART 2
		svg2
			.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(xScale2))
			.style("font-size", "12px");

		svg2.append("g").call(d3.axisLeft(yScale2)).style("font-size", "12px");

		// 6.b: ADD LABELS FOR CHART 2
		svg2
			.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 0 - margin.left)
			.attr("x", 0 - height / 2)
			.attr("dy", "1em")
			.style("text-anchor", "middle")
			.style("font-size", "16px")
			.style("font-weight", "500")
			.text("Number of Incidents");

		svg2
			.append("text")
			.attr(
				"transform",
				`translate(${width / 2}, ${height + margin.bottom - 10})`
			)
			.style("text-anchor", "middle")
			.style("font-size", "14px")
			.style("font-weight", "500")
			.text("Country");

		// Add event listeners to widgets
		d3.select("#startYear").on("change", filterData);
		d3.select("#endYear").on("change", filterData);
		d3.selectAll('#countryFilters input[type="checkbox"]').on(
			"change",
			filterData
		);

		// Validate year selection
		d3.select("#startYear").on("change", function () {
			const startYear = parseInt(this.value);
			const endYear = parseInt(d3.select("#endYear").property("value"));
			if (startYear > endYear) {
				d3.select("#endYear").property("value", this.value);
			}
			filterData();
		});

		d3.select("#endYear").on("change", function () {
			const endYear = parseInt(this.value);
			const startYear = parseInt(d3.select("#startYear").property("value"));
			if (endYear < startYear) {
				d3.select("#startYear").property("value", this.value);
			}
			filterData();
		});

		// Add toggle buttons for display mode
		createToggleButtons();

		// Initial data filter
		filterData();
	})
	.catch((error) => {
		console.error("Error loading data:", error);
		alert(
			"Error loading aircraft incidents data. Please ensure the CSV file is available."
		);
	});
