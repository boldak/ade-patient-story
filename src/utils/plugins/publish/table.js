const { extend, last, keys, uniq, flattenDeep } = require("lodash")

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

    command.header = command.header || {decoration:{}}
    let header = command.header.items || uniq ( flattenDeep( command.from.map( d => keys(d)))) 

    let widget = {
        id,
        "type": "data-table-widget",
        "name": id,
        "icon": "mdi-grid",
        "options": {
            "widget": {
                "visible": true
            },
            "style": command.style || "\n  widget-style {\n    border: 1px solid #bdbdbd;\n    margin:0 5px;\n  }\n"
        },
        "data": {
            "source": "embedded",
            "embedded": {
                "decoration": {
                    "dense": true,
                    "loading": false
                },
                "header": {
                    "decoration": command.header.decoration || {
                        "class": command.header.decoration.class || "body-1 primary--text"
                    },
                    "items": header
                },
                "rows": command.from
            },
            "script": ""
        },
    }

    return widget
}