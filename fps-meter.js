var fps = {
    frameStartTime : Date.now(),
    frameInFrame   : false,

    frameTimeData : [],
    chartWidth    : 800,
    chartHeight   : 120,
    chartMaxY     : 200,
    chartMinX     : -10 * 1000,

    frameTimeChart : null,
    xAxis : null,
    yAxis : null,

    clearFrameTimeData: function() {
        fps.frameStartTime = Date.now()
        fps.frameInFrame   = false
        fps.frameTimeData  = [
            {timestamp: Date.now() + fps.chartMinX, frameTime: 1e6},
            {timestamp: Date.now(),                 frameTime: 1e6}
        ]
    },
    markEndOfFrames: function() {
        fps.frameInFrame = false
    },

    createFrameTimeChart: function() {
        fps.frameTimeChart = document.createElement('div')
        fps.frameTimeChart.id = "frameTimeChart"
        fps.frameTimeChart.setAttribute("style",
            "position: absolute; " +
            "z-index: 2000; " +
            "padding: 2px; " +
            "background: #000; " +
            "width: " + fps.chartWidth + "; " +
            "height: " + fps.chartHeight + "; ");

        // create and add data to the chart
        vis = d3.select(fps.frameTimeChart)
            .append('svg:svg')
            .attr("width", ''+fps.chartWidth+'px')
            .attr("height", ''+fps.chartHeight+'px')

        // add initial, uncalibrated plotline
        vis = d3.select(fps.frameTimeChart).selectAll('svg')
        vis.selectAll('path.line').data([fps.frameTimeData])
            .enter().append("svg:path")
            .attr("d", d3.svg.line())

        fps.redrawChart()

        return fps.frameTimeChart
    },
    markNewFrame: function() {
        if (fps.frameInFrame) {
            frameEndTime = Date.now()

            if (fps.frameTimeData.length > 500)
                fps.frameTimeData.shift()

            fps.frameTimeData.push(
                {timestamp: frameEndTime, frameTime: frameEndTime - fps.frameStartTime}
            )
        }

        fps.frameInFrame = true
        fps.frameStartTime = Date.now()
    },
    redrawChart: function() {
        vis = d3.select(fps.frameTimeChart).selectAll('svg')

        // pre-compute maximum frame time,
        // so we can set it as the Y-axis max
        yAxisMax = Math.max.apply(null,
                fps.frameTimeData.map(function(d) { return d.frameTime; } ))

        // set axis scaling for chart
        xAxis = d3.scale.linear()
            .domain([Date.now() + fps.chartMinX, Date.now()])
            .range([0, fps.chartWidth]);
        yAxis = d3.scale.linear()
            .domain([0, yAxisMax * 1.2])
            .range([fps.chartHeight, 0]);

        dataLine = d3.svg.line()
            .x( function(d) { return xAxis(d.timestamp); } )
            .y( function(d) { return yAxis(d.frameTime); } )

        // add data (plotline)
        vis.selectAll('path')
            .data([fps.frameTimeData])
            .attr("d", dataLine)
            .attr("stroke", "#0f0")
            .attr("stroke-width", "3px")
    },

    timerId: 0,
    updateInterval: 30,
    installIntervalTimer: function() {
        timerId = setInterval(function() {
            fps.redrawChart()
        }, fps.updateInterval);
    },
    removeIntervalTimer: function() {
        clearInterval(timerId)
        timerId = 0
    }
}

// example usage
// -------------

function __ignore_fps_init_sample() {
    oldLoadFunction = window.onload
    awindow.onload = function() {
        if (oldLoadFunction)
            oldLoadFunction()

        fps.clearFrameTimeData()
        document.body.appendChild(fps.createFrameTimeChart())
        fps.installIntervalTimer()

        mainLoop()
    }
}

function __ignore_fps_mainLoop_sample() {
    while (true) {
        fps.markNewFrame();
    }
}
