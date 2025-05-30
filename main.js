// 1: SET GLOBAL VARIABLES
const margin = { top: 80, right: 30, bottom: 60, left: 70 };
const width = 900 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

// Create SVG containers for both charts
const svg1 = d3.select("#lineChart1")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const svg2 = d3.select("#lineChart2")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Tooltip element for interactivity
const tooltip = d3.select("body").append("div")
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

// 2.a: LOAD...
d3.csv("aircraft_incidents.csv").then(rawData => {
    // Remove any existing placeholder titles first
    d3.select("#lineChart1").selectAll("h2, h3, .chart-title").remove();
    d3.select("#lineChart2").selectAll("h2, h3, .chart-title").remove();
    
    // 2.b: ... AND TRANSFORM DATA
    
    // Parse and clean the data
    const cleanedData = rawData.map(d => {
        // Parse date (format: M/D/YY or MM/DD/YY)
        let date = null;
        let year = null;
        
        if (d.Event_Date) {
            const parts = d.Event_Date.split('/');
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
        
        if (d.Injury_Severity && d.Injury_Severity.includes('Fatal(')) {
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
            totalUninjured: +d.Total_Uninjured || 0
        };
    });
    
    // Filter valid data and create aggregations
    const validData = cleanedData.filter(d => d.year && d.year >= 1995 && d.year <= 2016);
    
    // Group by year for time series
    const yearlyData = d3.group(validData, d => d.year);
    const timeSeriesData = Array.from(yearlyData, ([year, incidents]) => ({
        year: year,
        totalIncidents: incidents.length,
        fatalIncidents: incidents.filter(d => d.isFatal).length,
        nonFatalIncidents: incidents.filter(d => !d.isFatal && d.Injury_Severity === 'Non-Fatal').length,
        totalFatalities: d3.sum(incidents, d => d.fatalCount)
    })).sort((a, b) => a.year - b.year);
    
    // Weather conditions aggregation
    const weatherData = validData.filter(d => d.Weather_Condition && d.Weather_Condition !== 'UNK');
    const weatherGroups = d3.group(weatherData, d => d.Weather_Condition);
    const weatherStats = Array.from(weatherGroups, ([condition, incidents]) => ({
        condition: condition === 'VMC' ? 'Visual Conditions' : 
                  condition === 'IMC' ? 'Instrument Conditions' : condition,
        count: incidents.length,
        fatalIncidents: incidents.filter(d => d.isFatal).length,
        fatalityRate: (incidents.filter(d => d.isFatal).length / incidents.length) * 100
    })).sort((a, b) => b.count - a.count);
    
    // ==========================================
    // CHART 1: Time Series Line Chart
    // ==========================================
    
    // Add proper title for Chart 1 - positioned above the chart area
    const chart1Title = svg1.append("text")
        .attr("x", width / 2)
        .attr("y", -50)  // Moved higher to avoid overlap
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "bold")
        .style("fill", "#2c3e50")
        .style("cursor", "pointer")
        .style("font-family", "Arial, sans-serif")
        .text("Aircraft Incidents Over Time (1995-2016)")
        .on("mouseover", function() {
            d3.select(this)
                .style("fill", "#3498db")
                .style("font-size", "21px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("fill", "#2c3e50")
                .style("font-size", "20px");
        })
        .on("click", function() {
            const totalIncidents = d3.sum(timeSeriesData, d => d.totalIncidents);
            const totalFatal = d3.sum(timeSeriesData, d => d.fatalIncidents);
            alert(`Overall Summary (1995-2016):\nTotal Incidents: ${totalIncidents}\nFatal Incidents: ${totalFatal}\nFatality Rate: ${((totalFatal/totalIncidents)*100).toFixed(1)}%`);
        });
    
    // 3.a: SET SCALES FOR CHART 1
    const xScale1 = d3.scaleLinear()
        .domain(d3.extent(timeSeriesData, d => d.year))
        .range([0, width]);
    
    const yScale1 = d3.scaleLinear()
        .domain([0, d3.max(timeSeriesData, d => d.totalIncidents)])
        .nice()
        .range([height, 0]);
    
    // 4.a: PLOT DATA FOR CHART 1
    
    // Add grid lines
    svg1.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale1)
            .tickSize(-height)
            .tickFormat("")
        )
        .selectAll("line")
        .style("stroke", "#e0e0e0")
        .style("stroke-dasharray", "2,2");
    
    svg1.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yScale1)
            .tickSize(-width)
            .tickFormat("")
        )
        .selectAll("line")
        .style("stroke", "#e0e0e0")
        .style("stroke-dasharray", "2,2");
    
    // Line generators
    const totalLine = d3.line()
        .x(d => xScale1(d.year))
        .y(d => yScale1(d.totalIncidents))
        .curve(d3.curveMonotoneX);
    
    const fatalLine = d3.line()
        .x(d => xScale1(d.year))
        .y(d => yScale1(d.fatalIncidents))
        .curve(d3.curveMonotoneX);
    
    // Draw lines with hover effects
    const totalPath = svg1.append("path")
        .datum(timeSeriesData)
        .attr("fill", "none")
        .attr("stroke", "#3498db")
        .attr("stroke-width", 3)
        .attr("d", totalLine)
        .style("cursor", "pointer");
    
    const fatalPath = svg1.append("path")
        .datum(timeSeriesData)
        .attr("fill", "none")
        .attr("stroke", "#e74c3c")
        .attr("stroke-width", 3)
        .attr("d", fatalLine)
        .style("cursor", "pointer");
    
    // Interactive line hover effects
    totalPath
        .on("mouseover", function(event) {
            d3.select(this).attr("stroke-width", 5);
            tooltip.style("opacity", 1)
                .html(`<strong>Total Incidents Trend</strong><br/>
                       Click points for details<br/>
                       Hover over data points for specific years`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke-width", 3);
            tooltip.style("opacity", 0);
        });
    
    fatalPath
        .on("mouseover", function(event) {
            d3.select(this).attr("stroke-width", 5);
            tooltip.style("opacity", 1)
                .html(`<strong>Fatal Incidents Trend</strong><br/>
                       Click points for details<br/>
                       Hover over data points for specific years`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke-width", 3);
            tooltip.style("opacity", 0);
        });
    
    // Add interactive dots
    svg1.selectAll(".dot-total")
        .data(timeSeriesData)
        .enter().append("circle")
        .attr("class", "dot-total")
        .attr("cx", d => xScale1(d.year))
        .attr("cy", d => yScale1(d.totalIncidents))
        .attr("r", 5)
        .attr("fill", "#3498db")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 8).attr("stroke-width", 3);
            tooltip.style("opacity", 1)
                .html(`<strong>${d.year}</strong><br/>
                       Total Incidents: <span style="color: #3498db">${d.totalIncidents}</span><br/>
                       Fatal Incidents: <span style="color: #e74c3c">${d.fatalIncidents}</span><br/>
                       Non-Fatal Incidents: ${d.nonFatalIncidents}<br/>
                       Total Fatalities: ${d.totalFatalities}<br/>
                       <em>Click for more details</em>`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 5).attr("stroke-width", 2);
            tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
            const fatalityRate = ((d.fatalIncidents / d.totalIncidents) * 100).toFixed(1);
            alert(`Detailed Report for ${d.year}:\n\n` +
                  `Total Incidents: ${d.totalIncidents}\n` +
                  `Fatal Incidents: ${d.fatalIncidents}\n` +
                  `Non-Fatal Incidents: ${d.nonFatalIncidents}\n` +
                  `Total Fatalities: ${d.totalFatalities}\n` +
                  `Fatality Rate: ${fatalityRate}%`);
        });
    
    svg1.selectAll(".dot-fatal")
        .data(timeSeriesData)
        .enter().append("circle")
        .attr("class", "dot-fatal")
        .attr("cx", d => xScale1(d.year))
        .attr("cy", d => yScale1(d.fatalIncidents))
        .attr("r", 4)
        .attr("fill", "#e74c3c")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 7).attr("stroke-width", 3);
            tooltip.style("opacity", 1)
                .html(`<strong>${d.year} Fatal Incidents</strong><br/>
                       Fatal Incidents: <span style="color: #e74c3c">${d.fatalIncidents}</span><br/>
                       Total Fatalities: ${d.totalFatalities}<br/>
                       Fatality Rate: ${((d.fatalIncidents / d.totalIncidents) * 100).toFixed(1)}%<br/>
                       <em>Click for details</em>`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 4).attr("stroke-width", 2);
            tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
            alert(`Fatal Incidents in ${d.year}:\n\n` +
                  `Fatal Incidents: ${d.fatalIncidents}\n` +
                  `Total Fatalities: ${d.totalFatalities}\n` +
                  `Average Fatalities per Fatal Incident: ${(d.totalFatalities / Math.max(d.fatalIncidents, 1)).toFixed(1)}`);
        });
    
    // 5.a: ADD AXES FOR CHART 1
    svg1.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale1).tickFormat(d3.format("d")))
        .style("font-size", "12px");
    
    svg1.append("g")
        .call(d3.axisLeft(yScale1))
        .style("font-size", "12px");
    
    // 6.a: ADD LABELS FOR CHART 1
    svg1.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Number of Incidents");
    
    svg1.append("text")
        .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Year");
    
    // Add interactive legend for Chart 1
    const legend1 = svg1.append("g")
        .attr("transform", `translate(${width - 150}, 20)`);
    
    const totalLegend = legend1.append("g")
        .style("cursor", "pointer")
        .on("mouseover", function() {
            totalPath.attr("stroke-width", 5);
            svg1.selectAll(".dot-total").attr("r", 7);
        })
        .on("mouseout", function() {
            totalPath.attr("stroke-width", 3);
            svg1.selectAll(".dot-total").attr("r", 5);
        })
        .on("click", function() {
            const total = d3.sum(timeSeriesData, d => d.totalIncidents);
            alert(`Total Incidents (1995-2016): ${total}`);
        });
    
    totalLegend.append("line")
        .attr("x1", 0).attr("x2", 20)
        .attr("y1", 0).attr("y2", 0)
        .attr("stroke", "#3498db")
        .attr("stroke-width", 3);
    
    totalLegend.append("text")
        .attr("x", 25).attr("y", 0)
        .attr("dy", "0.32em")
        .style("font-size", "12px")
        .text("Total Incidents");
    
    const fatalLegend = legend1.append("g")
        .style("cursor", "pointer")
        .on("mouseover", function() {
            fatalPath.attr("stroke-width", 5);
            svg1.selectAll(".dot-fatal").attr("r", 6);
        })
        .on("mouseout", function() {
            fatalPath.attr("stroke-width", 3);
            svg1.selectAll(".dot-fatal").attr("r", 4);
        })
        .on("click", function() {
            const total = d3.sum(timeSeriesData, d => d.fatalIncidents);
            alert(`Total Fatal Incidents (1995-2016): ${total}`);
        });
    
    fatalLegend.append("line")
        .attr("x1", 0).attr("x2", 20)
        .attr("y1", 20).attr("y2", 20)
        .attr("stroke", "#e74c3c")
        .attr("stroke-width", 3);
    
    fatalLegend.append("text")
        .attr("x", 25).attr("y", 20)
        .attr("dy", "0.32em")
        .style("font-size", "12px")
        .text("Fatal Incidents");
    
    // ==========================================
    // CHART 2: Weather Conditions Bar Chart
    // ==========================================
    
    // Add proper title for Chart 2 - positioned above the chart area
    const chart2Title = svg2.append("text")
        .attr("x", width / 2)
        .attr("y", -50)  // Moved higher to avoid overlap
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "bold")
        .style("fill", "#2c3e50")
        .style("cursor", "pointer")
        .style("font-family", "Arial, sans-serif")
        .text("Incidents by Weather Condition (Color = Fatality Rate)")
        .on("mouseover", function() {
            d3.select(this)
                .style("fill", "#3498db")
                .style("font-size", "21px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("fill", "#2c3e50")
                .style("font-size", "20px");
        })
        .on("click", function() {
            const totalWeatherIncidents = d3.sum(weatherStats, d => d.count);
            const avgFatalityRate = d3.mean(weatherStats, d => d.fatalityRate).toFixed(1);
            alert(`Weather Analysis Summary:\nTotal Incidents Analyzed: ${totalWeatherIncidents}\nAverage Fatality Rate: ${avgFatalityRate}%\n\nNote: Color intensity shows fatality rate\nDarker red = Higher fatality rate`);
        });
    
    // 3.b: SET SCALES FOR CHART 2
    const xScale2 = d3.scaleBand()
        .domain(weatherStats.map(d => d.condition))
        .range([0, width])
        .padding(0.3);
    
    const yScale2 = d3.scaleLinear()
        .domain([0, d3.max(weatherStats, d => d.count)])
        .nice()
        .range([height, 0]);
    
    const colorScale = d3.scaleLinear()
        .domain([0, d3.max(weatherStats, d => d.fatalityRate)])
        .range(["#3498db", "#e74c3c"]);
    
    // 4.b: PLOT DATA FOR CHART 2
    
    // Add grid lines
    svg2.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yScale2)
            .tickSize(-width)
            .tickFormat("")
        )
        .selectAll("line")
        .style("stroke", "#e0e0e0")
        .style("stroke-dasharray", "2,2");
    
    // Draw interactive bars
    svg2.selectAll(".bar")
        .data(weatherStats)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale2(d.condition))
        .attr("width", xScale2.bandwidth())
        .attr("y", d => yScale2(d.count))
        .attr("height", d => height - yScale2(d.count))
        .attr("fill", d => colorScale(d.fatalityRate))
        .style("cursor", "pointer")
        .style("transition", "all 0.3s ease")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .style("opacity", 0.8)
                .attr("stroke", "#2c3e50")
                .attr("stroke-width", 3)
                .style("filter", "brightness(1.1)");
            
            tooltip.style("opacity", 1)
                .html(`<strong>${d.condition}</strong><br/>
                       Total Incidents: ${d.count}<br/>
                       Fatal Incidents: <span style="color: #e74c3c">${d.fatalIncidents}</span><br/>
                       Non-Fatal Incidents: ${d.count - d.fatalIncidents}<br/>
                       Fatality Rate: <span style="color: #e74c3c">${d.fatalityRate.toFixed(1)}%</span><br/>
                       <em>Click for detailed analysis</em>`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("opacity", 1)
                .attr("stroke", "none")
                .style("filter", "none");
            tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
            const safetyRating = d.fatalityRate < 5 ? "Relatively Safe" : 
                               d.fatalityRate < 10 ? "Moderate Risk" : "High Risk";
            alert(`Detailed Weather Analysis: ${d.condition}\n\n` +
                  `Total Incidents: ${d.count}\n` +
                  `Fatal Incidents: ${d.fatalIncidents}\n` +
                  `Non-Fatal Incidents: ${d.count - d.fatalIncidents}\n` +
                  `Fatality Rate: ${d.fatalityRate.toFixed(1)}%\n` +
                  `Risk Assessment: ${safetyRating}\n\n` +
                  `This condition accounts for ${((d.count / d3.sum(weatherStats, w => w.count)) * 100).toFixed(1)}% of all weather-related incidents.`);
        });
    
    // Add interactive value labels on top of bars
    svg2.selectAll(".bar-label")
        .data(weatherStats)
        .enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => xScale2(d.condition) + xScale2.bandwidth() / 2)
        .attr("y", d => yScale2(d.count) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#2c3e50")
        .style("cursor", "pointer")
        .text(d => d.count)
        .on("mouseover", function(event, d) {
            d3.select(this).style("font-size", "14px");
            tooltip.style("opacity", 1)
                .html(`<strong>${d.count} incidents</strong><br/>in ${d.condition}`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("font-size", "12px");
            tooltip.style("opacity", 0);
        });
    
    // 5.b: ADD AXES FOR CHART 2
    svg2.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale2))
        .style("font-size", "12px");
    
    svg2.append("g")
        .call(d3.axisLeft(yScale2))
        .style("font-size", "12px");
    
    // 6.b: ADD LABELS FOR CHART 2
    svg2.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Number of Incidents");
    
    svg2.append("text")
        .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Weather Condition");
    
    // Add interactive color legend for Chart 2
    const legend2 = svg2.append("g")
        .attr("transform", `translate(${width - 200}, 20)`);
    
    legend2.append("text")
        .attr("x", 0).attr("y", 0)
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("cursor", "pointer")
        .text("Fatality Rate (%)")
        .on("click", function() {
            const maxRate = d3.max(weatherStats, d => d.fatalityRate);
            const minRate = d3.min(weatherStats, d => d.fatalityRate);
            alert(`Fatality Rate Legend:\n\nLowest Rate: ${minRate.toFixed(1)}%\nHighest Rate: ${maxRate.toFixed(1)}%\n\nBlue = Lower fatality rate\nRed = Higher fatality rate`);
        });
    
    const gradientData = d3.range(0, d3.max(weatherStats, d => d.fatalityRate), 1);
    const legendScale = d3.scaleLinear()
        .domain([0, d3.max(weatherStats, d => d.fatalityRate)])
        .range([0, 100]);
    
    legend2.selectAll(".legend-rect")
        .data(gradientData)
        .enter().append("rect")
        .attr("class", "legend-rect")
        .attr("x", d => legendScale(d))
        .attr("y", 10)
        .attr("width", 2)
        .attr("height", 15)
        .attr("fill", d => colorScale(d))
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1)
                .html(`Fatality Rate: ${d.toFixed(1)}%`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
        });
    
    legend2.append("text")
        .attr("x", 0).attr("y", 35)
        .style("font-size", "10px")
        .text("0%");
    
    legend2.append("text")
        .attr("x", 85).attr("y", 35)
        .style("font-size", "10px")
        .text(`${d3.max(weatherStats, d => d.fatalityRate).toFixed(0)}%`);
    
}).catch(error => {
    console.error("Error loading data:", error);
    alert("Error loading aircraft incidents data. Please ensure the CSV file is available.");
});