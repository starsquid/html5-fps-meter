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
        // all blocks in this list must have frameTimeData.length > 0
        finishedBlocks: [],
        // currentBlock must always exist
        currentBlock: new block(),

        // blockDuration is minimum elapsed time before closing currentBlock
        blockDuration: 1000,


        clearData: function() {
            this.finishedBlocks = []
            this.currentBlock = new block()
        },

        getAllDataRaw: function() {
            var allData = []
            this.finishedBlocks.forEach(
                function(d) { allData = allData.concat(d.frameTimeData) } )

            return allData.concat(this.currentBlock.frameTimeData)
        },

        getAllDataBounded: function() {
            var allDataBounded = []

            this.getAllDataRaw().forEach(
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
        svgY: null,
        svgXMap: {},

        createDivContainer: function() {
            this.divContainer = document.createElement('div')
            this.divContainer.class = "fpsChart"
            this.divContainer.setAttribute("style",
                "position: absolute; " +
                "z-index: 2000; " +
                "background: black; " +
                "display: block; left: 240px; top: 720px; " +
                "width: " + this.width + "; " +
                "height: " + this.height + "; " +
                "")

            return this.divContainer
        },

        createSvgObject: function() {
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
            this.svgY = this.svg.append("g")
                .attr("style", "stroke: white; fill: white; font-family: Avenir, Arial, arial, sans-serif")
                .attr("transform", "translate(806,0)")

            // add chevron styling (for static screenshots)
            //---------------------------------------------------------
            var arrow = this.svg.append("g")
            arrow.append("text")
                .attr("style", "stroke: #00ff00; fill: #00ff00; font-family: Avenir, Arial, arial, sans-serif; font-size: 72px")
                .attr("transform", "translate(720,110)")
                .text("«")
        },

        refresh: function() {
            // collate existing data together
            var completeFrameTimeData = blockList.getAllDataBounded()


            // y-axis labeling + scaling
            //---------------------------------------------------------
            // pre-compute maximum frame time, so we can scale the chart's Y-axis
            yDataMax = Math.max.apply(null,
                    completeFrameTimeData.map(function(d) { return 1000/d.ycoord; } ))
            yAxisMax = 1.1 * yDataMax
            // clamp value to 70 FPS
            yAxisMax = Math.max(70, yAxisMax)

            // Y-axis scaling: from 0 to max frame time * 1.2
            yScale = d3.scale.linear()
                .domain([0, yAxisMax])
                .range([chart.height, 0]);

            // add axis scaling
            var yAxis = d3.svg.axis()
                .scale(yScale)
                .orient("left")
            // if data is reasonable (within 120 FPS range), set axis
            if (yAxisMax < 120) {
                yAxis.tickValues([30, 60, 90, 120])
            }
            else {
                yAxis.ticks(3)
            }

            this.svgY.call(yAxis)


            // x-axis labeling + scaling
            //---------------------------------------------------------
            // X-axis scaling: from 10 seconds ago to now
            xScale = d3.scale.linear()
                .domain([Date.now() - 5 * 1000, Date.now()])
                .range([0, chart.width - 40]);

            // draw x-axis labeling (average FPS for each block)
            var t = this
            blockList.finishedBlocks.forEach(function(d) {
                var blockInfo = t.svgXMap[d.frameTimeData[0].startTime]

                // if block does not have an entry, create it
                if (!blockInfo) {
                    blockInfo = {}
                    blockInfo.label = t.svg.append("g")
                    blockInfo.label.append("text")
                        .attr("style", "stroke: white; fill: white; font-family: Avenir, Arial, arial, sans-serif")

                    // compute the "average" time, position to display the label
                    blockInfo.labelTime =
                        (d.frameTimeData[0].startTime +
                        d.frameTimeData[d.frameTimeData.length - 1].endTime)
                        / 2

                    // compute the average frame time for this block
                    blockInfo.averageFrameTime =
                        d.frameTimeData.reduce(function(previous, current) {
                            return previous + (current.endTime - current.startTime)
                        }, 0)
                        / d.frameTimeData.length

                    // done, add info object to map
                    t.svgXMap[d.frameTimeData[0].startTime] = blockInfo
                }

                // update the corresponding entry
                blockInfo.label
                    .attr("transform", "translate(" + xScale(blockInfo.labelTime) + "," + 20 + ")")
                blockInfo.label.select("text").text("" + Number(1000/blockInfo.averageFrameTime).toFixed(2) + " FPS")
            })
            // clear out old labels, once size gets too big


            // actual data (plotline)
            //---------------------------------------------------------
            dataLine = d3.svg.line()
                .x( function(d) { return xScale(d.xcoord); } )
                .y( function(d) { return yScale(1000/(d.ycoord)); } )

            vis = d3.select(this.divContainer).selectAll('svg')
            var newData = vis.selectAll('path')
                .data([completeFrameTimeData])
                .attr("d", dataLine)
                .attr("stroke", "#0f0")
                .attr("stroke-width", "1px")
                .exit().remove()
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
        chart.createSvgObject()
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
