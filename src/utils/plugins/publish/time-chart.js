const { extend, last, keys, find } = require("lodash")

const UUID = require("uuid").v4
const uuid = () => last(UUID().split("-"))

// command.height
// command.from
// command.asSerieName
// command.asSerieData
// command.stacked
// command.step
// command.smooth


module.exports = command => {

    const id = uuid()

    let widget = {
        id,
        "type": "chart-low-level-widget",
        "name": id, //TODO
        "icon": "mdi-chart-box-outline",
        "options": {
            "widget": {
                "visible": true,
                "height": command.height || 250
            },
            style: `widget-style {${command.style}}`
        },
        "data": {
            "source": "embedded",
            "embedded": {}, // TODO
            "script": ""
        },
        "activated": false
    }


    let visualData

    if(command.legend) {
        visualData = command.legend.map( d => {
        let f = find(command.from, s => keys(s[command.asSerieName]).map( k => s[command.asSerieName][k]).join(" ") == d.name)
            return {
                name: d.name,
                data: (f) ? f[command.asSerieData].map( d => [d.date, d.value]) : null,
                itemStyle:{
                    color: d.color
                }    
            }
        }).filter( d => d.data)
    
        command.legend = command.legend.filter( l => find(visualData, v => v.name == l.name))

    } else {
        visualData = command.from.map( s => ({
            name: keys(s[command.asSerieName]).map( k => s[command.asSerieName][k]).join(" "),
            data: s[command.asSerieData].map( d => [d.date, d.value])
        }))
        
        command.legend = visualData.map( d => ({name: d.name}))
    }


    const data = {
      legend: {
        data: command.legend
      },
      tooltip: {
        trigger: 'axis',
        position: function (pt) {
          return [pt[0], '10%'];
        }
      },
      xAxis: {
        type: 'time',
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
      },

      color: command.color,
      
      series:  visualData.map( s => ({
        name: s.name,
        type: 'line',
        step: command.step,
        stack: (command.stacked) ? 'Total' : undefined,
        
        showSymbol: command.showSymbol || false,
        
        itemStyle: s.itemStyle,

        areaStyle: command.areaStyle || {
          opacity: 0.75
        },

        lineStyle: command.lineStyle || {
          width: 0.75
        },

        smooth: command.smooth,
        
        emphasis: {
          focus: 'series'
        },

        data: s.data
      })) 
      
    }

    widget.data.embedded = data

    return widget
}