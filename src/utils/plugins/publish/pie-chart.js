const { extend, last, find } = require("lodash")

const UUID = require("uuid").v4
const uuid = () => last(UUID().split("-"))


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
        let f = find(command.from, s => s[command.asCategory] == d.name)
            return {
                name: d.name,
                value: (f) ? f[command.asValue] : 0,
                itemStyle:{
                    color: d.color
                }    
            }
        }).filter( d => d.value > 0)
    
        command.legend = command.legend.filter( l => find(visualData, v => v.name == l.name))

    } else {
        visualData = command.from.map(d => ({
            name: d[command.asCategory],
            value: d[command.asValue]
        }))
        
        command.legend = visualData.map( d => ({name: d.name}))
    }


    const data = {
        title: {
            text: command.from.map(d => d[command.asValue]).reduce((d, sum) => d + sum, 0).toString(),
            left: "center",
            top: "60%",
            textStyle: {
                color: "#7e7e7e",
                fontSize: 18
            },
            subtextStyle: {
                fontSize: 12,
                color: "#7e7e7e",
                fontWeight: "bold"
            }
        },
        legend: {
            top: '0%',
            left: '2%',
            orient: "vertical",
            itemGap: 2,
            itemHeight: 10,
            data: command.legend
        },

        color: command.color,

        "series": [{
            "type": "pie",
            "radius": command.radius || [
                "30%",
                "45%"
            ],
            // color: "data",
            center: [
                "50%",
                "65%"
            ],
            "itemStyle": {
                borderRadius: 7,
                borderColor: "#fff",
                borderWidth: 2
            },
            "label": {
                show: true,
                edgeDistance: 5,
                formatter: "{b|{c}}",
                rich: {
                    a: {
                        width: 20,
                        fontSize: 8,
                        align: 'center'
                    },
                    b: {
                        fontSize: 12,
                        color: "#7e7e7e",
                        fontWeight: 600,
                        align: 'center'
                    }
                }
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 64,
                    fontWeight: 'bold',
                    color: "#757575"
                }
            },
            labelLine: {
                show: true
            },
            data: visualData
        }]
    }

    widget.data.embedded = data

    return widget
}