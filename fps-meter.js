// Lifecycle overview:
// * HTML page includes this script file (and D3.js)
// * Page calls createChart(), and adds the resulting floating <div> to the page
// * Page calls installTimer(), which will redraw the chart on a JS timer
// * HTML page adds a call to markNewFrame() whenever a new frame is drawn.
//   Only pages that use window.requestAnimFrame() are supported.
//
function fps() {
    // FPS chart is broken into blocks, representing 1 second of profiling info (by default)
    // Each block stores data for frames that started within that second.
    //
    // These are data-only objects, whose rendering and lifecycle is managed by "fps"
    // Time is measured in milliseconds, based on whatever Date.now() returns
    //
    // frameTimeData is strictly ordered, with these guarantees:
    // * startTimes monotonically increasing
    // * endTime cannot come before startTime for that pair
    //
    block = function() {
        // each object in this array is a pair
        //   startTime
        //   endTime
        //
        // endTime tends to just be the value of startTime from the last frame
        //
        this.frameTimeData = [];
    };

    blockList = {
        // list of blocks that no longer need processing
        finishedBlocks: [],
        // currentBlock must always exist
        currentBlock: new block(),

        // blockDuration is minimum elapsed time before closing currentBlock
        blockDuration: 1000,


        clearData: function() {
            this.finishedBlocks = []
            this.currentBlock = new block()
        },

        getAllData: function() {
            var allData = []
            this.finishedBlocks.forEach(
                function(d) { allData = allData.concat(d.frameTimeData) } )

            return allData.concat(this.currentBlock.frameTimeData)
        },

        getAllDataBounded: function() {
            var allDataBounded = []

            this.getAllData().forEach(
                function(d) {
                    allDataBounded.push({xcoord: d.startTime, ycoord: d.endTime - d.startTime});
                    allDataBounded.push({xcoord: d.endTime,   ycoord: d.endTime - d.startTime});
                } )

            return allDataBounded
        },

        addFrame: function(startTime, endTime) {
            // add frame to end of block
            this.currentBlock.frameTimeData.push({
                startTime: startTime,
                endTime:   endTime
            })

            // check if block is done
            if (endTime - this.currentBlock.frameTimeData[0].startTime > this.blockDuration) {
                this.finishedBlocks.push(this.currentBlock)
                this.currentBlock = new block
            }
        },

        shrinkBlocks: function(maxBlocks) {
            while (this.finishedBlocks.length > maxBlocks)
                this.finishedBlocks.shift()
        }
    };


    // functions and prototypes related to capturing frame data
    //-----------------------------------------------------------------
    // currentFrameStartTime is only valid if currentlyMidFrame is true
    this.currentlyMidFrame = false
    this.currentFrameStartTime = null


    // rendering and styling of frame data chart
    // * Implemented as an SVG graphic on an HTML5 <div>
    // * SVG data is manipulated using D3.js
    //-----------------------------------------------------------------
    chart = {
        width:  800,
        height: 120,

        divContainer: null,
        svg: null,
        svg_y: null,

        createDivContainer: function() {
            this.divContainer = document.createElement('div')
            this.divContainer.class = "fpsChart"
            this.divContainer.setAttribute("style",
                "position: absolute; " +
                "z-index: 2000; " +
                "background: black; " +
                "width: " + this.width + "; " +
                "height: " + this.height + "; " +
                "")

            return this.divContainer
        },

        createSvgLine: function() {
            // create and add data to the chart
            this.svg = d3.select(this.divContainer)
                .append('svg')
                .attr("width", ''+chart.width+'px')
                .attr("height", ''+chart.height+'px')

            // add empty initial line
            var vis = d3.select(this.divContainer).selectAll('svg')
            vis.selectAll('path.line').data([[]])
                .enter().append("path")
                .attr("d", d3.svg.line())
                .attr("style", "fill: none")

            // add y-axis
            this.svg_y = this.svg.append("g")
        },

        refresh: function() {
            // collate existing data together
            // TODO: render each line/section independently?
            var completeFrameTimeData = blockList.getAllDataBounded()

            // pre-compute maximum frame time, so we can scale the chart's Y-axis
            yAxisMax = Math.max.apply(null,
                    completeFrameTimeData.map(function(d) { return d.endTime - d.startTime; } ))

            // X-axis scaling: from 10 seconds ago to now
            xScale = d3.scale.linear()
                .domain([Date.now() - 10 * 1000, Date.now()])
                .range([0, chart.width - 40]);
            // Y-axis scaling: from 0 to max frame time * 1.2
            yScale = d3.scale.linear()
                .domain([0, 70])
                .range([chart.height, 0]);

            dataLine = d3.svg.line()
                .x( function(d) { return xScale(d.xcoord); } )
                .y( function(d) { return yScale(1000/(d.ycoord)); } )

            // add data (plotline)
            vis = d3.select(this.divContainer).selectAll('svg')
            var newData = vis.selectAll('path')
                .data([completeFrameTimeData])
            newData
                .attr("d", dataLine)
                .attr("stroke", "#0f0")
                .attr("stroke-width", "1px")
                .exit().remove()

            // add axis scaling
            var yAxis = d3.svg.axis()
                .scale(yScale)
                .orient("left")
                .tickValues([30, 60])
            this.svg_y.call(yAxis)
                .attr("style", "stroke: white; fill: white; font-family: Avenir, Arial, arial, sans-serif")
                .attr("transform", "translate(800,0)")
        }
    }

    // chart is redrawn using a JavaScript timer
    //-----------------------------------------------------------------
    // redraw interval is in milliseconds
    this.chartRedrawTimerInterval = 10
    this.chartRedrawTimerID = null
}

fps.prototype = {
    // functions and prototypes related to capturing frame data
    //-----------------------------------------------------------------
    clearFrameTimeData: function() {
        this.currentlyMidFrame = false
        this.currentFrameStartTime = null

        blockList.clearData()
    },
    markEndOfFrames: function() {
        this.currentlyMidFrame = false
        this.currentFrameStartTime = null
    },

    markNewFrame: function() {
        // if we were in the middle of a frame, add it
        if (this.currentlyMidFrame) {
            var currentFrameEndTime = Date.now()

            // add entries to list (new style)
            blockList.addFrame(this.currentFrameStartTime, currentFrameEndTime)
        }

        this.currentlyMidFrame = true
        this.currentFrameStartTime = Date.now()

        // remove old entries, as needed
        blockList.shrinkBlocks(10)
    },


    // rendering and styling of frame data chart
    //-----------------------------------------------------------------
    createFrameTimeChart: function() {
        container = chart.createDivContainer()
        chart.createSvgLine()
        chart.refresh()

        return container
    },
    redrawChart: function() {
        chart.refresh()
    },

    // chart is redrawn using a JavaScript timer
    //-----------------------------------------------------------------
    installIntervalTimer: function() {
        var t = this
        this.chartRedrawTimerID = setInterval(
            function() {t.redrawChart()},
            this.chartRedrawTimerInterval)
    },
    removeIntervalTimer: function() {
        clearInterval(this.chartRedrawTimerID)
        this.chartRedrawTimerID = null
    }
};
