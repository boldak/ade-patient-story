const { extend, last, find, isArray, shuffle, template, templateSettings } = require("lodash")
const deepExtend = require("deep-extend")

const UUID = require("uuid").v4
const uuid = () => last(UUID().split("-"))

let compile = (_template, context) => {

    templateSettings.interpolate = /\$\{([\s\S]+?)\}/g;

    let result = template(_template)(context)

    templateSettings.interpolate = /<%=([\s\S]+?)%>/g;

    return result

}



// oneOf:
            //     title:                
            //     shuffle: true

            //     variants:
            //         - title: a
            //           score: 10
            //         - title: b  
            //         - title: c



module.exports = (command, context) => {

    // console.log(command, context)
    
    context.answers = context.answers || {}
    
    context.answers[command.id] = {
        id: command.id,
        title: compile(command.title, context),
        variants: null
    }


    context.score = context.score || {}
    context.score.answers = context.score.answers || {}

    context.score.answers[command.id] = command.variants.map( v => {
        let res = extend({}, v)
        res.score = res.score || 0 
        return res
    })


    let id = uuid()


    let title = (command.title) 

    ? {
        type: "md-widget",
        icon: "mdi-language-markdown-outline",
        id,
        name: id,
        activated: false,

        "options": {
            "widget": {
                "visible": true
            },
                style: `widget-style {${(command.decoration) ? command.decoration.titleStyle || "": ""}}`
        },
        "data": {
            "source": "embedded",
            "embedded": compile(command.title, context),
            "script": ""
        }

    }
    : null

    



    id = uuid()

    let  widget = {
        "type": "one-of-widget",
        id,
        "name": id, 
        "icon": "mdi-chart-box-outline",
        "options": {
            "widget": {
                "visible": true,
                "height": command.height || 250
            },
            style: `widget-style {${(command.decoration) ? command.decoration.style || "": ""}}`
        },
        "data": {
            "source": "embedded",
            "embedded": {
                data:{
                  event: "watch",  
                  variants: (command.shuffle) ? shuffle(command.variants.map( d => d.title)) : command.variants.map( d => d.title),
                  value: `\$\{app.context.answers['${command.id}'].variants}`,
                },
                decoration: command.decoration || {
                    "classes": "pa-1",
                    "labelStyle": "line-height:1",
                    "dense": false,
                    "labelClass": "subtitle-2 secondary--text"
                }
            },
            "script": ""
        },
        "activated": false
    }


  return {
      context,
      widget:[title, widget].filter(w => w)
    }  
}